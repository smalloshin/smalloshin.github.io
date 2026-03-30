// Pipeline Worker — runs the full scan → analyze → auto-fix → review pipeline
// Triggered when a project is submitted. Runs asynchronously (non-blocking).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import {
  transitionProject,
  updateScanReport,
  getLatestScanReport,
  createReview,
} from './orchestrator';
import { detectProject } from './project-detector';
import { generateDockerfile } from './dockerfile-gen';
import { runSemgrep, runTrivy } from './scanner';
import { analyzeThreatModel, generateReviewReport } from './llm-analyzer';
import { estimateMonthlyCost, formatCostEstimate } from './cost-estimator';
import type { ScanFinding, AutoFixResult } from '@deploy-agent/shared';

// File extensions worth scanning
const SCAN_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.php',
  '.env', '.yml', '.yaml', '.json', '.toml',
  '.sql', '.sh', '.bash', '.dockerfile',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build',
  '__pycache__', '.venv', 'vendor', 'target',
]);

export async function runPipeline(
  projectId: string,
  projectDir: string
): Promise<void> {
  console.log(`\n[Pipeline] Starting for project ${projectId}`);
  console.log(`[Pipeline] Project dir: ${projectDir}`);

  try {
    // ─── Step 1: Project Detection ───
    console.log('[Pipeline] Step 1: Detecting project...');
    const detection = detectProject(projectDir);
    console.log(`[Pipeline]   ${detection.framework} (${detection.language}), port ${detection.port}`);

    // ─── Step 2: Dockerfile Generation (if missing) ───
    console.log('[Pipeline] Step 2: Checking Dockerfile...');
    if (!detection.hasDockerfile) {
      const dockerfile = generateDockerfile(detection);
      const { writeFileSync: wfs } = await import('node:fs');
      wfs(join(projectDir, 'Dockerfile'), dockerfile);
      console.log('[Pipeline]   Generated Dockerfile');
    } else {
      console.log('[Pipeline]   Existing Dockerfile found');
    }

    // ─── Step 3: Security Scanning (Semgrep + Trivy) ───
    console.log('[Pipeline] Step 3: Running security scans...');
    const [semgrepResult, trivyResult] = await Promise.all([
      runSemgrep(projectDir).catch((err) => {
        console.warn(`[Pipeline]   Semgrep failed: ${(err as Error).message}`);
        return { tool: 'semgrep' as const, findings: [] as ScanFinding[], rawOutput: '', duration: 0 };
      }),
      runTrivy(projectDir).catch((err) => {
        console.warn(`[Pipeline]   Trivy failed: ${(err as Error).message}`);
        return { tool: 'trivy' as const, findings: [] as ScanFinding[], rawOutput: '', duration: 0 };
      }),
    ]);

    const scannerFindings = [...semgrepResult.findings, ...trivyResult.findings];
    console.log(`[Pipeline]   Semgrep: ${semgrepResult.findings.length} findings (${semgrepResult.duration}ms)`);
    console.log(`[Pipeline]   Trivy: ${trivyResult.findings.length} findings (${trivyResult.duration}ms)`);

    // Update scan report with scanner results
    const scanReport = await getLatestScanReport(projectId);
    if (scanReport) {
      await updateScanReport(scanReport.id, {
        semgrepFindings: semgrepResult.findings,
        trivyFindings: trivyResult.findings,
      });
    }

    // ─── Step 4: LLM Threat Analysis ───
    console.log('[Pipeline] Step 4: LLM threat analysis...');
    const sourceFiles = collectSourceFiles(projectDir);
    console.log(`[Pipeline]   Collected ${sourceFiles.size} source files`);

    const threatAnalysis = await analyzeThreatModel(sourceFiles, scannerFindings);
    console.log(`[Pipeline]   Provider: ${threatAnalysis.provider}`);
    console.log(`[Pipeline]   LLM findings: ${threatAnalysis.findings.length}`);
    console.log(`[Pipeline]   Auto-fix suggestions: ${threatAnalysis.autoFixes.length}`);

    if (scanReport) {
      await updateScanReport(scanReport.id, {
        llmAnalysis: threatAnalysis,
        threatSummary: threatAnalysis.summary,
      });
    }

    // ─── Step 5: Auto-Fix Application ───
    console.log('[Pipeline] Step 5: Applying auto-fixes...');
    const autoFixResults: AutoFixResult[] = [];

    for (const fix of threatAnalysis.autoFixes) {
      try {
        const filePath = join(projectDir, fix.filePath);
        const original = readFileSync(filePath, 'utf8');

        if (original.includes(fix.originalCode)) {
          const fixed = original.replace(fix.originalCode, fix.fixedCode);
          const { writeFileSync: wfs } = await import('node:fs');
          wfs(filePath, fixed);
          autoFixResults.push({
            applied: true,
            diff: `--- ${fix.filePath}\n+++ ${fix.filePath}\n-${fix.originalCode}\n+${fix.fixedCode}`,
            explanation: fix.explanation,
            verificationPassed: null, // will be set after re-scan
          });
          console.log(`[Pipeline]   Fixed: ${fix.filePath} — ${fix.explanation}`);
        } else {
          autoFixResults.push({
            applied: false,
            diff: '',
            explanation: `Could not find original code in ${fix.filePath}`,
            verificationPassed: null,
          });
        }
      } catch (err) {
        autoFixResults.push({
          applied: false,
          diff: '',
          explanation: `Error applying fix: ${(err as Error).message}`,
          verificationPassed: null,
        });
      }
    }

    const appliedCount = autoFixResults.filter((r) => r.applied).length;
    console.log(`[Pipeline]   Applied ${appliedCount}/${threatAnalysis.autoFixes.length} fixes`);

    if (scanReport) {
      await updateScanReport(scanReport.id, { autoFixes: autoFixResults });
    }

    // ─── Step 6: Verification Scan (re-scan after fixes) ───
    if (appliedCount > 0) {
      console.log('[Pipeline] Step 6: Verification scan...');
      const [verifySemgrep, verifyTrivy] = await Promise.all([
        runSemgrep(projectDir).catch(() => ({ findings: [] as ScanFinding[] })),
        runTrivy(projectDir).catch(() => ({ findings: [] as ScanFinding[] })),
      ]);
      const verifyFindings = [...verifySemgrep.findings, ...verifyTrivy.findings];
      console.log(`[Pipeline]   Post-fix findings: ${verifyFindings.length} (was ${scannerFindings.length})`);

      if (scanReport) {
        await updateScanReport(scanReport.id, { verificationResults: verifyFindings });
      }
    }

    // ─── Step 7: Cost Estimation ───
    console.log('[Pipeline] Step 7: Cost estimation...');
    const costEstimate = estimateMonthlyCost({
      cpu: 1,
      memoryMB: 512,
      avgRequestsPerDay: 100,
      avgRequestDurationMs: 200,
      avgResponseSizeKB: 50,
      minInstances: 0,
    });
    console.log(`[Pipeline]   Estimated: $${costEstimate.monthlyTotal}/month`);

    if (scanReport) {
      await updateScanReport(scanReport.id, { costEstimate, status: 'completed' });
    }

    // ─── Step 8: Generate Review Report ───
    console.log('[Pipeline] Step 8: Generating review report...');
    const allFindings = [...scannerFindings, ...threatAnalysis.findings];
    const reviewReport = await generateReviewReport(
      projectId,
      threatAnalysis,
      scannerFindings,
      autoFixResults,
      costEstimate
    );
    console.log(`[Pipeline]   Report generated (${reviewReport.length} chars)`);

    if (scanReport) {
      await updateScanReport(scanReport.id, {
        threatSummary: reviewReport,
      });
    }

    // ─── Step 9: Transition to review_pending ───
    console.log('[Pipeline] Step 9: Transitioning to review_pending...');
    await transitionProject(projectId, 'review_pending', 'pipeline-worker', {
      totalFindings: allFindings.length,
      criticalFindings: allFindings.filter((f) => f.severity === 'critical').length,
      autoFixesApplied: appliedCount,
      costEstimate: costEstimate.monthlyTotal,
    });

    // Create review entry for the human reviewer
    if (scanReport) {
      await createReview(scanReport.id);
    }

    console.log(`[Pipeline] ✓ Complete for project ${projectId}`);
    console.log(`[Pipeline]   Findings: ${allFindings.length} total, ${appliedCount} auto-fixed`);
    console.log(`[Pipeline]   Status: review_pending — awaiting human approval`);

  } catch (err) {
    console.error(`[Pipeline] ✗ Failed for project ${projectId}:`, (err as Error).message);
    try {
      await transitionProject(projectId, 'failed', 'pipeline-worker', {
        error: (err as Error).message,
      });
    } catch (transitionErr) {
      console.error('[Pipeline] Could not transition to failed:', (transitionErr as Error).message);
    }
  }
}

// ─── Collect source files for LLM analysis ───

function collectSourceFiles(dir: string, prefix = ''): Map<string, string> {
  const files = new Map<string, string>();
  let totalSize = 0;
  const MAX_TOTAL_SIZE = 500 * 1024; // 500KB max total to send to LLM

  function walk(currentDir: string, currentPrefix: string) {
    if (totalSize >= MAX_TOTAL_SIZE) return;

    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;
      if (totalSize >= MAX_TOTAL_SIZE) break;

      const fullPath = join(currentDir, entry);
      const relativePath = currentPrefix ? `${currentPrefix}/${entry}` : entry;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, relativePath);
        } else if (stat.isFile() && SCAN_EXTENSIONS.has(extname(entry).toLowerCase())) {
          if (stat.size > 50 * 1024) continue; // Skip files > 50KB
          const content = readFileSync(fullPath, 'utf8');
          files.set(relativePath, content);
          totalSize += content.length;
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  walk(dir, prefix);
  return files;
}
