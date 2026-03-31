import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { ScanFinding, AutoFixResult } from '@deploy-agent/shared';

// Primary: Claude | Fallback: GPT-5.4
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI() : null;

const SYSTEM_PROMPT = `You are a senior security engineer reviewing AI-generated (vibe-coded) application code.
Your job is to:
1. Analyze the code for security vulnerabilities beyond what automated scanners find
2. Focus on: auth gaps, BOLA, endpoint exposure, error handling leaks, hardcoded secrets, insecure defaults
3. For each finding, provide a specific severity, description, and recommended fix
4. Generate auto-fix patches when safe to do so

Please write all human-readable text fields (summary, title, description, explanation) in bilingual format: Traditional Chinese (繁體中文) first, followed by the English version, separated by " / ". For example: "發現嚴重的身份驗證漏洞 / Critical authentication vulnerability found".

Respond in JSON format matching the schema provided.`;

export interface ThreatAnalysis {
  summary: string;
  findings: ScanFinding[];
  autoFixes: AutoFixAttempt[];
  provider: 'claude' | 'gpt' | 'fallback';
}

export interface AutoFixAttempt {
  findingId: string;
  filePath: string;
  originalCode: string;
  fixedCode: string;
  explanation: string;
}

// ─── Unified LLM call with automatic fallback ───

async function callLLM(system: string, userMessage: string, maxTokens: number): Promise<{ text: string; provider: 'claude' | 'gpt' }> {
  // Try Claude first
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: process.env.LLM_MODEL ?? 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      console.log('  LLM provider: Claude ✓');
      return { text, provider: 'claude' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Claude API failed: ${msg.slice(0, 150)}`);
      console.warn('  Falling back to GPT-5.4...');
    }
  }

  // Fallback: GPT-5.4
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? 'gpt-5.4',
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage },
        ],
      });
      const text = response.choices[0]?.message?.content ?? '';
      console.log('  LLM provider: GPT-5.4 ✓');
      return { text, provider: 'gpt' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  GPT-5.4 API failed: ${msg.slice(0, 150)}`);
    }
  }

  throw new Error('All LLM providers unavailable');
}

// ─── Threat Analysis ───

export async function analyzeThreatModel(
  sourceFiles: Map<string, string>,
  scannerFindings: ScanFinding[]
): Promise<ThreatAnalysis> {
  if (!anthropic && !openai) {
    console.warn('No LLM API keys set — skipping LLM analysis');
    return { summary: 'LLM analysis skipped: no API key configured', findings: [], autoFixes: [], provider: 'fallback' };
  }

  const fileList = Array.from(sourceFiles.entries())
    .map(([path, content]) => `--- ${path} ---\n${content.slice(0, 10000)}`)
    .join('\n\n');

  const scannerSummary = scannerFindings
    .map((f) => `[${f.severity}] ${f.title}: ${f.filePath}:${f.lineStart}`)
    .join('\n');

  const userMessage = `Analyze this codebase for security vulnerabilities. Focus on issues automated scanners miss: auth logic, BOLA, endpoint exposure, error handling, secret fallbacks, and insecure defaults.

Scanner already found:
${scannerSummary || '(no scanner findings)'}

Source files:
${fileList}

Respond with JSON:
{
  "summary": "One paragraph threat model summary in bilingual format (繁體中文 first, then English)",
  "findings": [
    {
      "category": "auth|injection|secrets|config|endpoint_exposure|error_handling|bola",
      "severity": "critical|high|medium|low",
      "title": "Short title",
      "description": "What's wrong and why it matters",
      "filePath": "path/to/file.ts",
      "lineStart": 10,
      "lineEnd": 15,
      "action": "auto_fix|report_only"
    }
  ],
  "autoFixes": [
    {
      "findingId": "matches a finding above by index",
      "filePath": "path/to/file.ts",
      "originalCode": "the vulnerable code",
      "fixedCode": "the fixed code",
      "explanation": "Why this fix works"
    }
  ]
}`;

  let result;
  try {
    result = await callLLM(SYSTEM_PROMPT, userMessage, 8000);
  } catch {
    return { summary: 'LLM analysis failed: all providers unavailable', findings: [], autoFixes: [], provider: 'fallback' };
  }

  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('LLM returned no JSON. Raw response:', result.text.slice(0, 500));
    return { summary: 'Analysis failed: no structured output', findings: [], autoFixes: [], provider: result.provider };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const findings: ScanFinding[] = (parsed.findings ?? []).map((f: Record<string, unknown>, i: number) => ({
      id: `llm-${i}`,
      tool: 'llm' as const,
      category: f.category as string,
      severity: f.severity as ScanFinding['severity'],
      title: f.title as string,
      description: f.description as string,
      filePath: f.filePath as string,
      lineStart: f.lineStart as number,
      lineEnd: f.lineEnd as number,
      action: f.action as ScanFinding['action'],
    }));

    return {
      summary: parsed.summary ?? '',
      findings,
      autoFixes: parsed.autoFixes ?? [],
      provider: result.provider,
    };
  } catch (err) {
    console.error('Failed to parse LLM JSON:', err);
    return { summary: 'Analysis failed: invalid JSON output', findings: [], autoFixes: [], provider: result.provider };
  }
}

// ─── Review Report Generation ───

export async function generateReviewReport(
  projectName: string,
  threatAnalysis: ThreatAnalysis,
  scannerFindings: ScanFinding[],
  autoFixResults: AutoFixResult[],
  costEstimate: { monthlyTotal: number } | null
): Promise<string> {
  const allFindings = [...scannerFindings, ...threatAnalysis.findings];
  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
  const highCount = allFindings.filter((f) => f.severity === 'high').length;
  const mediumCount = allFindings.filter((f) => f.severity === 'medium').length;
  const lowCount = allFindings.filter((f) => f.severity === 'low').length;
  const autoFixedCount = autoFixResults.filter((r) => r.applied).length;

  if (!anthropic && !openai) {
    return generateFallbackReport(projectName, allFindings, autoFixResults, costEstimate);
  }

  const userMessage = `Generate a structured security review report for "${projectName}".

Findings summary: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low
Auto-fixes applied: ${autoFixedCount}
Threat model: ${threatAnalysis.summary}
Cost estimate: ${costEstimate ? `$${costEstimate.monthlyTotal}/month` : 'not available'}

Findings requiring human review:
${allFindings.filter((f) => f.action === 'report_only').map((f) => `- [${f.severity}] ${f.title}: ${f.description}`).join('\n')}

Auto-fixes applied:
${autoFixResults.filter((r) => r.applied).map((r) => `- ${r.explanation}`).join('\n')}

Write a concise report in bilingual format (Traditional Chinese 繁體中文 first, then English for each section) with sections:
1. 執行摘要 / Executive Summary (2-3 sentences)
2. 已套用的自動修復 / Auto-Fixes Applied (list with explanations)
3. 需要人工審查的發現 / Findings Requiring Human Review (grouped by severity)
4. 部署安全基線 / Deploy Security Baseline (what security settings will be enforced)
5. 建議 / Recommendation (approve/conditional approve/reject with reasoning)`;

  try {
    const result = await callLLM(
      'You are a security review report writer. Generate clear, actionable reports. Please write the report in bilingual format: each section should have both Traditional Chinese (繁體中文) and English. Write the Chinese version first, followed by the English version.',
      userMessage,
      4000
    );
    return result.text;
  } catch {
    return generateFallbackReport(projectName, allFindings, autoFixResults, costEstimate);
  }
}

// ─── Fallback Report (no LLM needed) ───

function generateFallbackReport(
  projectName: string,
  allFindings: ScanFinding[],
  autoFixResults: AutoFixResult[],
  costEstimate: { monthlyTotal: number } | null
): string {
  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length;
  const highCount = allFindings.filter((f) => f.severity === 'high').length;
  const mediumCount = allFindings.filter((f) => f.severity === 'medium').length;
  const lowCount = allFindings.filter((f) => f.severity === 'low').length;
  const autoFixedCount = autoFixResults.filter((r) => r.applied).length;

  const lines = [
    `# Security Review Report: ${projectName}`,
    `> Generated by Deploy Agent (scanner-only mode, LLM unavailable)`,
    '',
    '## Executive Summary',
    `Found ${allFindings.length} security issues (${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low). ${autoFixedCount} auto-fixes applied.`,
    '',
    '## Findings by Severity',
  ];

  for (const sev of ['critical', 'high', 'medium', 'low'] as const) {
    const items = allFindings.filter((f) => f.severity === sev);
    if (items.length === 0) continue;
    lines.push(`\n### ${sev.toUpperCase()} (${items.length})`);
    for (const f of items) {
      lines.push(`- **${f.title}** — ${f.filePath}:${f.lineStart} [${f.action}]`);
      if (f.description) lines.push(`  ${f.description}`);
    }
  }

  if (autoFixResults.length > 0) {
    lines.push('\n## Auto-Fixes Applied');
    for (const r of autoFixResults.filter((r) => r.applied)) {
      lines.push(`- ${r.explanation}`);
    }
  }

  if (costEstimate) {
    lines.push(`\n## Cost Estimate\nEstimated monthly cost: $${costEstimate.monthlyTotal}`);
  }

  lines.push('\n## Recommendation');
  if (criticalCount > 0) {
    lines.push('**REJECT** — Critical security issues must be resolved before deployment.');
  } else if (highCount > 0) {
    lines.push('**CONDITIONAL APPROVE** — High severity issues should be reviewed by a senior engineer.');
  } else {
    lines.push('**APPROVE** — No critical or high severity issues found.');
  }

  return lines.join('\n');
}
