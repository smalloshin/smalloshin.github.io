// Environment Variable Auto-Detector
// Analyzes project source to infer required env vars and set sensible defaults for Cloud Run
//
// Strategy:
// 1. Read .env.example / .env.sample / .env.template for declared vars
// 2. Scan source code for process.env.* / os.environ.get() references
// 3. Apply framework-specific rules (NextAuth, Prisma, etc.)
// 4. Merge with user-provided env vars (user values take priority)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface EnvDetectionResult {
  /** Auto-detected env vars with values */
  detected: Record<string, string>;
  /** Env vars referenced in code but no value could be inferred (user must provide) */
  missing: string[];
  /** Human-readable notes about what was detected */
  notes: string[];
}

interface DetectionContext {
  projectDir: string;
  framework: string | null;
  language: string;
  customDomain?: string;
  cloudRunUrl?: string;
  gcpProject?: string;
  gcpRegion?: string;
  port: number;
}

// ─── Main entry ───

export function detectEnvVars(ctx: DetectionContext): EnvDetectionResult {
  const detected: Record<string, string> = {};
  const missing: string[] = [];
  const notes: string[] = [];

  // 1. Scan source code for process.env references
  const referenced = scanSourceForEnvRefs(ctx.projectDir, ctx.language);
  notes.push(`Found ${referenced.size} env var references in source code`);

  // 2. Read .env.example for declared vars with example values
  const exampleVars = readEnvExample(ctx.projectDir);
  for (const [key, val] of Object.entries(exampleVars)) {
    if (val && !isPlaceholder(val)) {
      detected[key] = val;
    }
  }

  // 3. Framework-specific detection
  if (ctx.framework === 'nextjs') {
    applyNextjsRules(ctx, detected, missing, notes, referenced);
  }

  // 4. Common patterns (any framework)
  applyCommonRules(ctx, detected, missing, notes, referenced);

  // 5. PORT — always set to match Cloud Run container port
  detected['PORT'] = String(ctx.port);

  // 6. NODE_ENV
  if (referenced.has('NODE_ENV') || ctx.language === 'typescript' || ctx.language === 'javascript') {
    detected['NODE_ENV'] = 'production';
  }

  // 7. Collect vars referenced but not resolved
  for (const ref of referenced) {
    if (!detected[ref] && !missing.includes(ref) && !isIgnoredVar(ref)) {
      missing.push(ref);
    }
  }

  return { detected, missing, notes };
}

// ─── Merge detected + user-provided env vars ───

export function mergeEnvVars(
  detected: Record<string, string>,
  userProvided: Record<string, string>,
  existingOnService?: Record<string, string>,
): Record<string, string> {
  // Priority: userProvided > existingOnService > detected
  return {
    ...detected,
    ...(existingOnService ?? {}),
    ...userProvided,
  };
}

// ─── Source code scanning ───

function scanSourceForEnvRefs(projectDir: string, language: string): Set<string> {
  const refs = new Set<string>();
  const extensions = language === 'python'
    ? ['.py']
    : language === 'go'
      ? ['.go']
      : ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  try {
    walkFiles(projectDir, extensions, (filePath) => {
      const content = safeRead(filePath);
      if (!content) return;

      // Node.js: process.env.VAR_NAME or process.env['VAR_NAME']
      const nodePattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
      const nodeBracketPattern = /process\.env\[['"]([A-Z_][A-Z0-9_]*)['"]\]/g;

      // Python: os.environ.get('VAR') or os.getenv('VAR') or os.environ['VAR']
      const pyPattern = /os\.(?:environ\.get|getenv|environ\[)\(?['"]([A-Z_][A-Z0-9_]*)['"]\)?/g;

      // Go: os.Getenv("VAR")
      const goPattern = /os\.Getenv\("([A-Z_][A-Z0-9_]*)"\)/g;

      for (const pattern of [nodePattern, nodeBracketPattern, pyPattern, goPattern]) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          refs.add(match[1]);
        }
      }
    });
  } catch {
    // If we can't scan (e.g., GCS-only source), return empty set
  }

  return refs;
}

// ─── .env.example parser ───

function readEnvExample(projectDir: string): Record<string, string> {
  const envFiles = ['.env.example', '.env.sample', '.env.template', '.env.local.example'];
  const vars: Record<string, string> = {};

  for (const f of envFiles) {
    const content = safeRead(path.join(projectDir, f));
    if (!content) continue;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;

      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key) vars[key] = val;
    }
    break; // Use first found
  }

  return vars;
}

// ─── Framework-specific rules ───

function applyNextjsRules(
  ctx: DetectionContext,
  detected: Record<string, string>,
  missing: string[],
  notes: string[],
  referenced: Set<string>,
) {
  const baseUrl = ctx.customDomain
    ? `https://${ctx.customDomain}`
    : ctx.cloudRunUrl ?? `http://localhost:${ctx.port}`;

  // NextAuth
  if (referenced.has('NEXTAUTH_URL') || hasNextAuth(ctx.projectDir)) {
    detected['NEXTAUTH_URL'] = baseUrl;
    notes.push(`NextAuth detected → NEXTAUTH_URL=${baseUrl}`);

    if (referenced.has('NEXTAUTH_SECRET') || referenced.has('AUTH_SECRET')) {
      const secret = crypto.randomBytes(32).toString('base64url');
      detected['NEXTAUTH_SECRET'] = secret;
      if (referenced.has('AUTH_SECRET')) {
        detected['AUTH_SECRET'] = secret;
      }
      notes.push('Generated NEXTAUTH_SECRET (random 32 bytes)');
    }
  }

  // JWT_SECRET (common in NextAuth apps)
  if (referenced.has('JWT_SECRET') && !detected['JWT_SECRET']) {
    detected['JWT_SECRET'] = crypto.randomBytes(32).toString('base64url');
    notes.push('Generated JWT_SECRET (random 32 bytes)');
  }

  // NEXT_PUBLIC_* — these are build-time vars, set them anyway for SSR
  for (const ref of referenced) {
    if (ref.startsWith('NEXT_PUBLIC_') && !detected[ref]) {
      // Can't auto-detect public env vars — add to missing
      if (!isIgnoredVar(ref)) {
        missing.push(ref);
      }
    }
  }
}

function hasNextAuth(projectDir: string): boolean {
  // Check package.json for next-auth dependency
  try {
    const pkgContent = safeRead(path.join(projectDir, 'package.json'));
    if (pkgContent) {
      const pkg = JSON.parse(pkgContent);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      return 'next-auth' in allDeps || '@auth/core' in allDeps;
    }
  } catch { /* ignore */ }
  return false;
}

// ─── Common rules (any framework) ───

function applyCommonRules(
  ctx: DetectionContext,
  detected: Record<string, string>,
  missing: string[],
  notes: string[],
  referenced: Set<string>,
) {
  // DATABASE_URL — if referenced, try to construct from GCP project
  if (referenced.has('DATABASE_URL')) {
    // Can't auto-detect DB connection — mark as missing
    if (!detected['DATABASE_URL']) {
      missing.push('DATABASE_URL');
      notes.push('DATABASE_URL referenced but cannot be auto-detected — user must provide');
    }
  }

  // REDIS_URL / REDIS_HOST
  for (const key of ['REDIS_URL', 'REDIS_HOST']) {
    if (referenced.has(key) && !detected[key]) {
      missing.push(key);
    }
  }

  // Google Cloud / Firebase
  if (referenced.has('GOOGLE_CLOUD_PROJECT') || referenced.has('GCP_PROJECT') || referenced.has('GCLOUD_PROJECT')) {
    const gcpProject = ctx.gcpProject ?? '';
    if (gcpProject) {
      if (referenced.has('GOOGLE_CLOUD_PROJECT')) detected['GOOGLE_CLOUD_PROJECT'] = gcpProject;
      if (referenced.has('GCP_PROJECT')) detected['GCP_PROJECT'] = gcpProject;
      if (referenced.has('GCLOUD_PROJECT')) detected['GCLOUD_PROJECT'] = gcpProject;
      notes.push(`GCP project vars auto-set to ${gcpProject}`);
    }
  }

  // API keys / secrets that we can't auto-generate — mark as missing
  const secretPatterns = [
    'API_KEY', 'API_SECRET', 'SECRET_KEY', 'ACCESS_KEY',
    'STRIPE_', 'SENDGRID_', 'TWILIO_', 'SLACK_',
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
    'GOOGLE_API_KEY', 'FIREBASE_',
    'AWS_', 'AZURE_',
    'SMTP_', 'EMAIL_', 'MAIL_',
    'S3_', 'CLOUDINARY_',
  ];

  for (const ref of referenced) {
    if (detected[ref] || missing.includes(ref)) continue;
    for (const pattern of secretPatterns) {
      if (ref.includes(pattern) || ref.startsWith(pattern)) {
        missing.push(ref);
        break;
      }
    }
  }

  // HOST / HOSTNAME — set to 0.0.0.0 for Cloud Run
  if (referenced.has('HOST') && !detected['HOST']) {
    detected['HOST'] = '0.0.0.0';
  }
  if (referenced.has('HOSTNAME') && !detected['HOSTNAME']) {
    detected['HOSTNAME'] = '0.0.0.0';
  }

  // APP_URL / BASE_URL / SITE_URL
  const urlVars = ['APP_URL', 'BASE_URL', 'SITE_URL', 'PUBLIC_URL', 'VITE_API_URL'];
  const baseUrl = ctx.customDomain
    ? `https://${ctx.customDomain}`
    : ctx.cloudRunUrl ?? '';
  for (const key of urlVars) {
    if (referenced.has(key) && !detected[key] && baseUrl) {
      detected[key] = baseUrl;
      notes.push(`${key} auto-set to ${baseUrl}`);
    }
  }
}

// ─── Helpers ───

function isPlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  return (
    lower === 'your_value_here' ||
    lower === 'xxx' ||
    lower === 'changeme' ||
    lower === 'replace_me' ||
    lower === 'todo' ||
    lower === '' ||
    lower.startsWith('your_') ||
    lower.startsWith('<') ||
    lower.endsWith('>')
  );
}

function isIgnoredVar(name: string): boolean {
  // System/runtime vars that Cloud Run sets or are irrelevant
  const ignored = new Set([
    'HOME', 'PATH', 'USER', 'SHELL', 'PWD', 'LANG', 'TERM',
    'K_SERVICE', 'K_REVISION', 'K_CONFIGURATION',
    'CLOUD_RUN_JOB', 'CLOUD_RUN_EXECUTION', 'CLOUD_RUN_TASK_INDEX',
    'PORT', // We set this explicitly
    'NODE_ENV', // We set this explicitly
    'CI', 'VERCEL', 'NETLIFY', 'HEROKU',
    'npm_package_name', 'npm_package_version',
    'NEXT_RUNTIME',
  ]);
  return ignored.has(name);
}

function walkFiles(dir: string, extensions: string[], callback: (filePath: string) => void, depth = 0): void {
  if (depth > 5) return; // Limit recursion
  const skipDirs = new Set(['node_modules', '.git', '.next', '__pycache__', 'venv', '.venv', 'dist', 'build', '.turbo', 'coverage']);

  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          walkFiles(path.join(dir, entry.name), extensions, callback, depth + 1);
        }
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        callback(path.join(dir, entry.name));
      }
    }
  } catch { /* ignore permission errors */ }
}

function safeRead(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}
