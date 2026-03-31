import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gcpFetch } from '../services/gcp-auth';
import {
  createProject,
  listProjects,
  getProject,
  transitionProject,
  createScanReport,
  getLatestScanReport,
  getDeploymentsByProject,
  deleteProjectFromDb,
  updateProjectConfig,
} from '../services/orchestrator';
import { runPipeline } from '../services/pipeline-worker';
import { deleteService, deleteDomainMapping, deleteContainerImage, updateServiceEnvVars, getServiceEnvVars } from '../services/deploy-engine';
import { deleteCname } from '../services/dns-manager';

const execFileAsync = promisify(execFile);

// Parse "KEY=VALUE\nKEY2=VALUE2" format into a Record
function parseEnvVarsText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!text.trim()) return result;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = val;
  }
  return result;
}

// Upload source tarball to GCS for durable storage (Cloud Run /tmp is ephemeral)
async function uploadSourceToGcs(
  projectSlug: string,
  projectDir: string,
): Promise<string> {
  const gcpProject = process.env.GCP_PROJECT || 'wave-deploy-agent';
  const bucket = `${gcpProject}_cloudbuild`;
  const objectName = `sources/${projectSlug}-${Date.now()}.tgz`;
  const tarballPath = join(tmpdir(), `${projectSlug}-source-${Date.now()}.tgz`);

  // Create tarball from project directory
  await execFileAsync('tar', ['-czf', tarballPath, '-C', projectDir, '.'], { timeout: 60_000 });

  // Upload to GCS
  const { readFileSync, unlinkSync } = await import('node:fs');
  const tarball = readFileSync(tarballPath);
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = await gcpFetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/gzip' },
    body: tarball,
  });

  try { unlinkSync(tarballPath); } catch { /* ignore */ }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GCS upload failed (${res.status}): ${err}`);
  }

  const gcsUri = `gs://${bucket}/${objectName}`;
  console.log(`[Upload] Source uploaded to ${gcsUri}`);
  return gcsUri;
}

const submitSchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['upload', 'git', 'openclaw']),
  sourceUrl: z.string().optional(),
  config: z.object({
    deployTarget: z.enum(['cloud_run']).default('cloud_run'),
    customDomain: z.string().optional(),
    allowUnauthenticated: z.boolean().default(true),  // Public by default
    gcpProject: z.string().optional(),
    gcpRegion: z.string().optional(),
  }).optional(),
});

export async function projectRoutes(app: FastifyInstance) {
  // List all projects
  app.get('/api/projects', async () => {
    const projects = await listProjects();
    return { projects };
  });

  // Get single project
  app.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });
    return { project };
  });

  // Submit new project
  app.post('/api/projects', async (request, reply) => {
    const body = submitSchema.parse(request.body);
    const project = await createProject({
      name: body.name,
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl,
      config: body.config,
    });

    // Transition to scanning and create scan report
    await transitionProject(project.id, 'scanning', 'system', { trigger: 'auto' });
    const scanReport = await createScanReport(project.id);

    // Dispatch pipeline worker asynchronously (non-blocking)
    // sourceUrl is the local path or git URL to scan
    const projectDir = body.sourceUrl ?? '';
    if (projectDir) {
      runPipeline(project.id, projectDir).catch((err) => {
        console.error(`[Pipeline] Async dispatch failed for ${project.id}:`, (err as Error).message);
      });
    }

    return reply.status(201).send({ project: { ...project, status: 'scanning' }, scanReport });
  });

  // Submit new project via file upload (multipart form)
  app.post('/api/projects/upload', async (request, reply) => {
    const parts = request.parts();

    let name = '';
    let customDomain = '';
    let allowUnauthenticated = false;
    let sourceType: 'upload' | 'git' = 'upload';
    let gitUrl = '';
    let envVarsRaw = '';
    let fileBuffer: Buffer | null = null;
    let fileName = '';

    for await (const part of parts) {
      if (part.type === 'field') {
        const val = String(part.value);
        if (part.fieldname === 'name') name = val;
        else if (part.fieldname === 'customDomain') customDomain = val;
        else if (part.fieldname === 'allowUnauthenticated') allowUnauthenticated = val === 'true';
        else if (part.fieldname === 'sourceType') sourceType = val as 'upload' | 'git';
        else if (part.fieldname === 'gitUrl') gitUrl = val;
        else if (part.fieldname === 'envVars') envVarsRaw = val;
      } else if (part.type === 'file' && part.fieldname === 'file') {
        fileName = part.filename;
        fileBuffer = await part.toBuffer();
      }
    }

    if (!name.trim()) {
      return reply.status(400).send({ error: 'Project name is required' });
    }

    // If git source type, handle like before
    if (sourceType === 'git') {
      if (!gitUrl.trim()) {
        return reply.status(400).send({ error: 'Git URL is required' });
      }
      const userEnvVars = parseEnvVarsText(envVarsRaw);
      const project = await createProject({
        name: name.trim(),
        sourceType: 'git',
        sourceUrl: gitUrl.trim(),
        config: {
          deployTarget: 'cloud_run',
          customDomain: customDomain.trim() || undefined,
          allowUnauthenticated,
          envVars: Object.keys(userEnvVars).length > 0 ? userEnvVars : undefined,
        },
      });
      await transitionProject(project.id, 'scanning', 'system', { trigger: 'auto' });
      const scanReport = await createScanReport(project.id);
      runPipeline(project.id, gitUrl.trim()).catch((err) => {
        console.error(`[Pipeline] Async dispatch failed for ${project.id}:`, (err as Error).message);
      });
      return reply.status(201).send({ project: { ...project, status: 'scanning' }, scanReport });
    }

    // Upload source type — need a file
    if (!fileBuffer || !fileName) {
      return reply.status(400).send({ error: 'File upload is required for upload source type' });
    }

    // Save uploaded file to temp dir and extract
    const projectSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const uploadDir = join(tmpdir(), 'deploy-agent-uploads', `${projectSlug}-${Date.now()}`);
    const extractDir = join(uploadDir, 'source');
    await mkdir(extractDir, { recursive: true });

    const archivePath = join(uploadDir, fileName);
    await writeFile(archivePath, fileBuffer);

    // Extract based on file type
    const lowerName = fileName.toLowerCase();
    try {
      if (lowerName.endsWith('.zip')) {
        await execFileAsync('unzip', ['-o', archivePath, '-d', extractDir], { timeout: 60000 });
      } else if (lowerName.endsWith('.tar.gz') || lowerName.endsWith('.tgz')) {
        await execFileAsync('tar', ['-xzf', archivePath, '-C', extractDir], { timeout: 60000 });
      } else if (lowerName.endsWith('.tar')) {
        await execFileAsync('tar', ['-xf', archivePath, '-C', extractDir], { timeout: 60000 });
      } else {
        return reply.status(400).send({ error: 'Unsupported file type. Please upload .zip, .tar.gz, or .tar' });
      }
    } catch (err) {
      return reply.status(400).send({ error: `Failed to extract archive: ${(err as Error).message}` });
    }

    // ── Defensive cleanup: remove macOS/OS junk directories ──
    const { rmSync, existsSync, statSync, readdirSync } = await import('node:fs');
    const junkDirs = ['__MACOSX', '.DS_Store', '__pycache__', '.Spotlight-V100', '.Trashes'];
    for (const junk of junkDirs) {
      const junkPath = join(extractDir, junk);
      try { rmSync(junkPath, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    // Also recursively remove .DS_Store files inside subdirectories
    const removeDsStore = (dir: string) => {
      try {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.name === '.DS_Store') { try { rmSync(full, { force: true }); } catch {} }
          else if (entry.isDirectory()) removeDsStore(full);
        }
      } catch { /* ignore */ }
    };
    removeDsStore(extractDir);

    // ── Determine projectDir: find the real root with source code ──
    const { stdout } = await execFileAsync('ls', [extractDir]);
    const entries = stdout.trim().split('\n').filter(e => e && !junkDirs.includes(e));
    let projectDir: string;

    if (entries.length === 1 && existsSync(join(extractDir, entries[0])) &&
        statSync(join(extractDir, entries[0])).isDirectory()) {
      // Single directory inside archive — use it as root
      projectDir = join(extractDir, entries[0]);
    } else {
      // Files are directly in extractDir
      projectDir = extractDir;
    }

    // ── Validate: must have a Dockerfile or package.json ──
    const hasDockerfile = existsSync(join(projectDir, 'Dockerfile'));
    const hasPackageJson = existsSync(join(projectDir, 'package.json'));
    if (!hasDockerfile && !hasPackageJson) {
      // Maybe nested one level deeper? Try to find Dockerfile
      const subdirs = readdirSync(projectDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const subWithDockerfile = subdirs.find(d => existsSync(join(projectDir, d, 'Dockerfile')));
      if (subWithDockerfile) {
        console.log(`[Upload] Dockerfile found in subdirectory: ${subWithDockerfile}, adjusting projectDir`);
        projectDir = join(projectDir, subWithDockerfile);
      } else {
        console.warn(`[Upload] No Dockerfile or package.json found in extracted archive at: ${projectDir}`);
        console.warn(`[Upload] Directory contents: ${readdirSync(projectDir).join(', ')}`);
        // Don't block — the build step will give a clearer error
      }
    }
    console.log(`[Upload] Final projectDir: ${projectDir}, hasDockerfile: ${existsSync(join(projectDir, 'Dockerfile'))}, entries: [${entries.join(', ')}]`);

    // Upload source to GCS for durable storage (Cloud Run /tmp is ephemeral)
    let gcsSourceUri = '';
    try {
      gcsSourceUri = await uploadSourceToGcs(projectSlug, projectDir);
    } catch (err) {
      console.error(`[Upload] GCS upload failed, continuing with local path:`, (err as Error).message);
    }

    const userEnvVars = parseEnvVarsText(envVarsRaw);
    const project = await createProject({
      name: name.trim(),
      sourceType: 'upload',
      sourceUrl: projectDir,
      config: {
        deployTarget: 'cloud_run',
        customDomain: customDomain.trim() || undefined,
        allowUnauthenticated,
        gcsSourceUri,  // persisted source for deploy step
        envVars: Object.keys(userEnvVars).length > 0 ? userEnvVars : undefined,
      },
    });

    await transitionProject(project.id, 'scanning', 'system', { trigger: 'auto' });
    const scanReport = await createScanReport(project.id);

    runPipeline(project.id, projectDir).catch((err) => {
      console.error(`[Pipeline] Async dispatch failed for ${project.id}:`, (err as Error).message);
    });

    return reply.status(201).send({
      project: { ...project, status: 'scanning' },
      scanReport,
      uploadedFile: fileName,
      extractedTo: projectDir,
    });
  });

  // Get latest scan report for project
  app.get<{ Params: { id: string } }>('/api/projects/:id/scan', async (request, reply) => {
    const report = await getLatestScanReport(request.params.id);
    if (!report) return reply.status(404).send({ error: 'No scan report found' });
    return { report };
  });

  // Get full project detail: project + scan report + deployments + timeline
  app.get<{ Params: { id: string } }>('/api/projects/:id/detail', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const [scanReport, deployments] = await Promise.all([
      getLatestScanReport(project.id),
      getDeploymentsByProject(project.id),
    ]);

    // Get state transitions (timeline)
    const { query: dbQuery } = await import('../db/index');
    const transitions = await dbQuery(
      `SELECT * FROM state_transitions WHERE project_id = $1 ORDER BY created_at ASC`,
      [project.id]
    );

    return {
      project,
      scanReport,
      deployments,
      timeline: transitions.rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        fromState: r.from_state,
        toState: r.to_state,
        triggeredBy: r.triggered_by,
        metadata: r.metadata,
        createdAt: r.created_at,
      })),
    };
  });

  // Resubmit/retry project (from needs_revision or failed) — re-triggers pipeline
  app.post<{ Params: { id: string } }>('/api/projects/:id/resubmit', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    if (project.status !== 'needs_revision' && project.status !== 'failed') {
      return reply.status(400).send({ error: `Cannot retry from status: ${project.status}` });
    }

    // Reset to submitted, then scanning
    await transitionProject(project.id, 'submitted', 'user', { action: 'retry' });
    await transitionProject(project.id, 'scanning', 'system', { trigger: 'retry' });

    // Create a new scan report
    const scanReport = await createScanReport(project.id);

    // Re-trigger pipeline using the existing source
    const projectDir = project.sourceUrl ?? '';
    if (projectDir) {
      runPipeline(project.id, projectDir).catch((err) => {
        console.error(`[Pipeline] Retry dispatch failed for ${project.id}:`, (err as Error).message);
      });
    }

    return { project: { ...project, status: 'scanning' }, scanReport };
  });

  // Delete project and tear down all GCP resources
  app.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    const gcpProject = project.config?.gcpProject || process.env.GCP_PROJECT || '';
    const gcpRegion = project.config?.gcpRegion || process.env.GCP_REGION || 'asia-east1';

    const teardownLog: { step: string; status: string; error?: string }[] = [];

    // 1. Find deployments to know what GCP resources to clean up
    const deployments = await getDeploymentsByProject(project.id);

    for (const deploy of deployments) {
      // 2. Delete Cloud Run service
      if (deploy.cloudRunService && gcpProject) {
        try {
          await deleteService(gcpProject, gcpRegion, deploy.cloudRunService);
          teardownLog.push({ step: `Delete Cloud Run service: ${deploy.cloudRunService}`, status: 'ok' });
        } catch (err) {
          teardownLog.push({ step: `Delete Cloud Run service: ${deploy.cloudRunService}`, status: 'error', error: (err as Error).message });
        }
      }

      // 3. Delete domain mapping & Cloudflare DNS
      if (deploy.customDomain && gcpProject) {
        try {
          await deleteDomainMapping(gcpProject, gcpRegion, deploy.customDomain);
          teardownLog.push({ step: `Delete domain mapping: ${deploy.customDomain}`, status: 'ok' });
        } catch (err) {
          teardownLog.push({ step: `Delete domain mapping: ${deploy.customDomain}`, status: 'error', error: (err as Error).message });
        }

        // Delete Cloudflare DNS record
        const cfToken = process.env.CLOUDFLARE_TOKEN || '';
        const cfZoneId = process.env.CLOUDFLARE_ZONE_ID || '';
        const cfZoneName = process.env.CLOUDFLARE_ZONE_NAME || '';

        if (cfToken && cfZoneId && cfZoneName) {
          // Extract subdomain from custom_domain (e.g. "kol-studio.punwave.com" → "kol-studio")
          const subdomain = deploy.customDomain.replace(`.${cfZoneName}`, '');
          try {
            const result = await deleteCname({ cloudflareToken: cfToken, zoneId: cfZoneId, subdomain, zoneName: cfZoneName });
            teardownLog.push({ step: `Delete DNS: ${deploy.customDomain}`, status: result.success ? 'ok' : 'error', error: result.error ?? undefined });
          } catch (err) {
            teardownLog.push({ step: `Delete DNS: ${deploy.customDomain}`, status: 'error', error: (err as Error).message });
          }
        }
      }
    }

    // 4. Delete container images from Artifact Registry
    if (gcpProject && gcpRegion) {
      try {
        await deleteContainerImage(gcpProject, gcpRegion, project.slug);
        teardownLog.push({ step: `Delete container image: ${project.slug}`, status: 'ok' });
      } catch (err) {
        teardownLog.push({ step: `Delete container image: ${project.slug}`, status: 'error', error: (err as Error).message });
      }
    }

    // 5. Delete from database (CASCADE deletes scan_reports, reviews, deployments, state_transitions)
    await deleteProjectFromDb(project.id);
    teardownLog.push({ step: 'Delete database records', status: 'ok' });

    console.log(`[Teardown] Project "${project.name}" (${project.id}) deleted:`, JSON.stringify(teardownLog));

    return { success: true, project: { id: project.id, name: project.name }, teardownLog };
  });

  // Get environment variable keys (values masked) for a deployed project
  app.get<{ Params: { id: string } }>('/api/projects/:id/env-vars', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    // Try to read live env vars from Cloud Run service first
    const deployments = await getDeploymentsByProject(project.id);
    const activeDeployment = deployments.find((d) => d.cloudRunService);

    let envVars: Record<string, string> = {};

    if (activeDeployment?.cloudRunService) {
      const gcpProject = (project.config?.gcpProject as string) || process.env.GCP_PROJECT || '';
      const gcpRegion = (project.config?.gcpRegion as string) || process.env.GCP_REGION || 'asia-east1';
      if (gcpProject) {
        try {
          envVars = await getServiceEnvVars(gcpProject, gcpRegion, activeDeployment.cloudRunService);
        } catch {
          // Fallback to DB
          envVars = (project.config?.envVars as Record<string, string>) ?? {};
        }
      }
    } else {
      // No deployment — use DB config
      envVars = (project.config?.envVars as Record<string, string>) ?? {};
    }

    const maskedVars = Object.entries(envVars).map(([key, value]) => ({
      key,
      maskedValue: value.length > 3 ? value.slice(0, 3) + '***' : '***',
    }));

    return { projectId: project.id, envVars: maskedVars };
  });

  // Update environment variables for a deployed project (no rebuild)
  app.patch<{ Params: { id: string } }>('/api/projects/:id/env-vars', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    // Validate request body
    const body = request.body as { envVars?: Record<string, string> };
    if (!body.envVars || typeof body.envVars !== 'object') {
      return reply.status(400).send({ error: 'Request body must include envVars object' });
    }

    // Find a deployment with a Cloud Run service
    const deployments = await getDeploymentsByProject(project.id);
    const activeDeployment = deployments.find((d) => d.cloudRunService);
    if (!activeDeployment || !activeDeployment.cloudRunService) {
      return reply.status(400).send({ error: 'No active Cloud Run deployment found for this project' });
    }

    const gcpProject = (project.config?.gcpProject as string) || process.env.GCP_PROJECT || '';
    const gcpRegion = (project.config?.gcpRegion as string) || process.env.GCP_REGION || 'asia-east1';

    if (!gcpProject) {
      return reply.status(400).send({ error: 'GCP project not configured' });
    }

    // Merge with existing env vars
    const existingEnvVars: Record<string, string> = (project.config?.envVars as Record<string, string>) ?? {};
    const mergedEnvVars = { ...existingEnvVars, ...body.envVars };

    // Update Cloud Run service env vars (no rebuild)
    const result = await updateServiceEnvVars(
      gcpProject,
      gcpRegion,
      activeDeployment.cloudRunService,
      mergedEnvVars,
    );

    if (!result.success) {
      return reply.status(500).send({ error: `Failed to update env vars: ${result.error}` });
    }

    // Update project config in DB
    const updatedConfig = { ...(project.config ?? {}), envVars: mergedEnvVars };
    await updateProjectConfig(project.id, updatedConfig as Record<string, unknown>);

    return {
      success: true,
      projectId: project.id,
      updatedKeys: Object.keys(mergedEnvVars),
    };
  });
}
