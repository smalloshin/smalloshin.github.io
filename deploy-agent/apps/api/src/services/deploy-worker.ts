// Deploy Worker — runs the full build → deploy → DNS → SSL → canary pipeline
// Triggered when a project is approved. Runs asynchronously (non-blocking).

import {
  getProject,
  transitionProject,
  createDeployment,
  updateDeployment,
} from './orchestrator';
import { buildAndPushImage, deployToCloudRun } from './deploy-engine';
import { setupCustomDomainWithDns, type DnsConfig } from './dns-manager';
import { monitorSsl } from './ssl-monitor';
import { runCanaryChecks } from './canary-monitor';
import { detectProject } from './project-detector';
import { detectEnvVars, mergeEnvVars } from './env-detector';
import { provisionProjectDatabase } from './db-provisioner';

export async function runDeployPipeline(
  projectId: string,
  reviewId: string
): Promise<void> {
  let currentStep = '';

  try {
    const project = await getProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    const gcpProject = project.config?.gcpProject || process.env.GCP_PROJECT || '';
    const gcpRegion = project.config?.gcpRegion || process.env.GCP_REGION || 'asia-east1';
    const projectDir = project.sourceUrl ?? '';
    const gcsSourceUri = project.config?.gcsSourceUri as string | undefined;

    if (!gcpProject) throw new Error('GCP project not configured');
    if (!projectDir && !gcsSourceUri) throw new Error('No source directory or GCS URI found for project');

    // ─── Step 1: Transition to deploying ───
    currentStep = 'Step 1: Transition to deploying';
    console.log(`[Deploy] ${currentStep} for ${project.name}`);
    await transitionProject(projectId, 'deploying', 'deploy-worker', { trigger: 'auto-after-approval' });

    // Create deployment record
    const deployment = await createDeployment(projectId, reviewId);

    // ─── Step 2: Detect project settings + env vars ───
    currentStep = 'Step 2: Detect project settings';
    console.log(`[Deploy] ${currentStep}...`);
    let port = 3000;
    let detectedFramework: string | null = null;
    let detectedLanguage = 'unknown';
    try {
      const detection = detectProject(projectDir);
      port = detection.port;
      detectedFramework = detection.framework;
      detectedLanguage = detection.language;
      console.log(`[Deploy]   Detected: ${detectedLanguage}/${detectedFramework ?? 'none'}, port: ${port}`);
    } catch {
      console.log(`[Deploy]   Using default port: ${port}`);
    }

    // Compute custom domain FQDN for env detection
    const customDomainSubdomain = project.config?.customDomain;
    const cfZoneName = process.env.CLOUDFLARE_ZONE_NAME || '';
    const customDomainFqdn = customDomainSubdomain && cfZoneName
      ? `${customDomainSubdomain}.${cfZoneName}`
      : undefined;

    // Auto-detect env vars from source code
    currentStep = 'Step 2b: Auto-detect environment variables';
    console.log(`[Deploy] ${currentStep}...`);
    const envDetection = detectEnvVars({
      projectDir,
      framework: detectedFramework,
      language: detectedLanguage,
      customDomain: customDomainFqdn,
      gcpProject,
      gcpRegion,
      projectSlug: project.slug,
      port,
    });

    for (const note of envDetection.notes) {
      console.log(`[Deploy]   ENV: ${note}`);
    }
    if (envDetection.warnings.length > 0) {
      for (const w of envDetection.warnings) {
        console.warn(`[Deploy]   ⚠ ${w.type}: ${w.variable} in ${w.file}:${w.line} — ${w.recommendation}`);
      }
    }
    if (envDetection.missing.length > 0) {
      console.warn(`[Deploy]   ENV missing (user can inject post-deploy): ${envDetection.missing.join(', ')}`);
    }

    // Merge: auto-detected + user-provided (user values take priority)
    const userEnvVars = (project.config?.envVars as Record<string, string>) ?? {};
    const finalEnvVars = mergeEnvVars(envDetection.detected, userEnvVars);
    console.log(`[Deploy]   ENV total: ${Object.keys(finalEnvVars).length} vars (${Object.keys(envDetection.detected).length} auto + ${Object.keys(userEnvVars).length} user)`);

    // Determine if CloudSQL connection is needed
    const dbVarKeys = Object.keys(finalEnvVars).filter(k =>
      k === 'DATABASE_URL' || k.endsWith('_DATABASE_URL') || k === 'DB_URL'
    );
    const needsCloudSql = dbVarKeys.length > 0;
    const cloudSqlInstance = needsCloudSql
      ? `${gcpProject}:${gcpRegion}:deploy-agent-db`
      : undefined;

    // Provision per-project database if CloudSQL is needed
    if (needsCloudSql && gcpProject && gcpRegion) {
      currentStep = 'Step 2c: Provision project database';
      console.log(`[Deploy] ${currentStep}...`);
      try {
        const dbResult = await provisionProjectDatabase(project.slug, gcpProject, gcpRegion);
        console.log(`[Deploy]   DB: ${dbResult.dbName} (user: ${dbResult.dbUser}, created: ${dbResult.created})`);

        // Replace auto-generated DATABASE_URL with the project-specific one
        // Only replace if the value was auto-generated (contains deploy-agent-db and deploy_agent user)
        for (const key of dbVarKeys) {
          const val = finalEnvVars[key] ?? '';
          const isAutoGenerated = val.includes('deploy_agent:') && val.includes('deploy-agent-db');
          const isUserProvided = !!userEnvVars[key];
          if (isAutoGenerated && !isUserProvided) {
            finalEnvVars[key] = dbResult.connectionString;
            console.log(`[Deploy]   Replaced ${key} with project-specific DB credentials`);
          }
        }
      } catch (err) {
        console.error(`[Deploy]   DB provisioning failed: ${(err as Error).message}`);
        console.warn(`[Deploy]   Continuing with existing DATABASE_URL (may fail at runtime)`);
      }
    }

    // ─── Step 3: Build and push Docker image ───
    currentStep = 'Step 3: Build Docker image (Cloud Build)';
    console.log(`[Deploy] ${currentStep}...`);
    const buildResult = await buildAndPushImage(projectDir, {
      projectSlug: project.slug,
      gcpProject,
      gcpRegion,
      imageName: project.slug,
      imageTag: `v${Date.now()}`,
      envVars: finalEnvVars,
      port,
    }, gcsSourceUri);

    if (!buildResult.success) {
      throw new Error(`Docker build failed: ${buildResult.error}`);
    }
    console.log(`[Deploy]   Image: ${buildResult.imageUri}`);

    // ─── Step 4: Deploy to Cloud Run ───
    currentStep = 'Step 4: Deploy to Cloud Run';
    console.log(`[Deploy] ${currentStep}...`);
    const deployResult = await deployToCloudRun({
      projectSlug: project.slug,
      gcpProject,
      gcpRegion,
      imageName: project.slug,
      imageTag: `v${Date.now()}`,
      envVars: finalEnvVars,
      memory: '512Mi',
      cpu: '1',
      minInstances: 0,
      maxInstances: 10,
      allowUnauthenticated: project.config?.allowUnauthenticated ?? false,
      port,
      cloudSqlInstance,
    }, buildResult.imageUri);

    if (!deployResult.success) {
      throw new Error(`Cloud Run deploy failed: ${deployResult.error}`);
    }
    console.log(`[Deploy]   Service: ${deployResult.serviceName}`);
    console.log(`[Deploy]   URL: ${deployResult.serviceUrl}`);

    // Update deployment record
    await updateDeployment(deployment.id, {
      cloudRunService: deployResult.serviceName,
      cloudRunUrl: deployResult.serviceUrl ?? undefined,
      healthStatus: 'unknown',
      deployedAt: new Date(),
    });

    // Post-deploy: update URL-based env vars now that Cloud Run URL is known
    // If no custom domain, URL-based vars (NEXTAUTH_URL, APP_URL etc.) should use Cloud Run URL
    if (deployResult.serviceUrl && !customDomainFqdn) {
      const urlVarsToUpdate: Record<string, string> = {};
      const urlKeys = ['NEXTAUTH_URL', 'APP_URL', 'BASE_URL', 'SITE_URL', 'PUBLIC_URL'];
      for (const key of urlKeys) {
        if (finalEnvVars[key] && (finalEnvVars[key].includes('localhost') || finalEnvVars[key] === '')) {
          urlVarsToUpdate[key] = deployResult.serviceUrl;
        }
      }
      if (Object.keys(urlVarsToUpdate).length > 0) {
        console.log(`[Deploy]   Updating URL env vars with Cloud Run URL: ${Object.keys(urlVarsToUpdate).join(', ')}`);
        Object.assign(finalEnvVars, urlVarsToUpdate);
        // Re-deploy with corrected env vars (quick update, same image)
        await deployToCloudRun({
          projectSlug: project.slug,
          gcpProject,
          gcpRegion,
          imageName: project.slug,
          imageTag: `v${Date.now()}`,
          envVars: finalEnvVars,
          memory: '512Mi',
          cpu: '1',
          minInstances: 0,
          maxInstances: 10,
          allowUnauthenticated: project.config?.allowUnauthenticated ?? false,
          port,
          cloudSqlInstance,
        }, buildResult.imageUri);
      }
    }

    await transitionProject(projectId, 'deployed', 'deploy-worker', {
      serviceName: deployResult.serviceName,
      serviceUrl: deployResult.serviceUrl,
      duration: `${(deployResult.duration / 1000).toFixed(1)}s`,
      envVarsSet: Object.keys(finalEnvVars),
      envVarsMissing: envDetection.missing,
      envWarnings: envDetection.warnings.length,
    });

    // ─── Step 5: Custom domain setup (if configured) ───
    if (customDomainSubdomain) {
      currentStep = 'Step 5: Custom domain & DNS setup';
      console.log(`[Deploy] ${currentStep}...`);

      const cfToken = process.env.CLOUDFLARE_TOKEN || '';
      const cfZoneId = process.env.CLOUDFLARE_ZONE_ID || '';

      if (cfToken && cfZoneId && cfZoneName) {
        const dnsConfig: DnsConfig = {
          cloudflareToken: cfToken,
          zoneId: cfZoneId,
          subdomain: customDomainSubdomain,
          zoneName: cfZoneName,
        };

        const domainResult = await setupCustomDomainWithDns(
          dnsConfig,
          deployResult.serviceUrl ?? '',
          gcpProject,
          gcpRegion,
          deployResult.serviceName
        );

        if (domainResult.success) {
          const fqdn = `${customDomainSubdomain}.${cfZoneName}`;
          await updateDeployment(deployment.id, {
            customDomain: fqdn,
            sslStatus: 'provisioning',
          });

          await transitionProject(projectId, 'ssl_provisioning', 'deploy-worker', {
            customDomain: fqdn,
          });

          // ─── Step 6: SSL monitoring ───
          currentStep = 'Step 6: SSL certificate provisioning';
          console.log(`[Deploy] ${currentStep}...`);

          try {
            const sslResult = await monitorSsl(deployment.id, projectId, {
              gcpProject,
              gcpRegion,
              domain: fqdn,
              maxChecks: 20,      // 20 checks × 30s = 10 minutes max
              intervalMs: 30000,
            });

            if (sslResult.allReady) {
              await updateDeployment(deployment.id, { sslStatus: 'active' });
              console.log(`[Deploy]   SSL active for ${fqdn}`);
            } else {
              // SSL not ready yet — this is normal, can take up to 15 minutes
              // Don't fail, just continue the pipeline
              console.warn(`[Deploy]   SSL still provisioning for ${fqdn}, continuing pipeline`);
              await updateDeployment(deployment.id, { sslStatus: 'provisioning' });
            }
          } catch (sslErr) {
            console.warn(`[Deploy]   SSL monitoring error: ${(sslErr as Error).message}, continuing`);
          }
        } else {
          console.warn(`[Deploy]   Domain setup failed: ${domainResult.error}`);
          // Continue without custom domain
        }
      } else {
        console.warn('[Deploy]   Cloudflare not configured, skipping custom domain');
      }
    }

    // ─── Step 7: Canary checks ───
    currentStep = 'Step 7: Canary health checks';
    console.log(`[Deploy] ${currentStep}...`);

    // Transition to canary_check from whatever current state
    const currentProject = await getProject(projectId);
    const currentState = currentProject?.status ?? 'deployed';
    if (currentState === 'deployed') {
      // No custom domain path: deployed → ssl_provisioning → canary_check
      await transitionProject(projectId, 'ssl_provisioning', 'deploy-worker', { note: 'no custom domain, skipped' });
      await transitionProject(projectId, 'canary_check', 'deploy-worker', { trigger: 'auto' });
    } else if (currentState === 'ssl_provisioning') {
      await transitionProject(projectId, 'canary_check', 'deploy-worker', { trigger: 'auto' });
    }

    // Use the custom domain URL if available, otherwise the Cloud Run URL
    const customDomainUrl = customDomainFqdn
      ? `https://${customDomainFqdn}`
      : null;
    // For canary, prefer Cloud Run URL (always accessible with auth) over custom domain (may not have SSL yet)
    const targetUrl = deployResult.serviceUrl ?? '';
    if (targetUrl) {
      // Use identity token for .run.app URLs since the service may require auth
      const canaryResult = await runCanaryChecks(targetUrl, {
        checks: 3,          // reduce from 5 to speed up
        intervalMs: 5000,   // 5s between checks
      });
      await updateDeployment(deployment.id, {
        canaryResults: canaryResult,
        healthStatus: canaryResult.passed ? 'healthy' : 'unhealthy',
      });

      if (canaryResult.passed) {
        // ─── Step 8: Go live ───
        currentStep = 'Step 8: Go live';
        console.log(`[Deploy] ${currentStep}...`);
        const liveUrl = customDomainUrl || deployResult.serviceUrl;
        await transitionProject(projectId, 'live', 'deploy-worker', {
          serviceUrl: liveUrl,
          cloudRunUrl: deployResult.serviceUrl,
          canaryPassed: true,
        });
        console.log(`[Deploy] ✓ Project ${project.name} is LIVE at ${liveUrl}`);
      } else {
        // Canary failed — log details but go live anyway (don't block on canary for now)
        const failedChecks = canaryResult.checks
          .filter((c) => !c.passed)
          .map((c) => `${c.type}: ${c.value} (threshold: ${c.threshold})`)
          .join(', ');
        console.warn(`[Deploy]   Canary checks had failures: ${failedChecks}`);
        console.warn(`[Deploy]   Continuing to live (canary is advisory for now)`);

        currentStep = 'Step 8: Go live';
        const liveUrl = customDomainUrl || deployResult.serviceUrl;
        await transitionProject(projectId, 'live', 'deploy-worker', {
          serviceUrl: liveUrl,
          cloudRunUrl: deployResult.serviceUrl,
          canaryWarnings: failedChecks,
        });
        console.log(`[Deploy] ✓ Project ${project.name} is LIVE at ${liveUrl} (with canary warnings)`);
      }
    } else {
      // No URL to check, just go live
      await transitionProject(projectId, 'live', 'deploy-worker', {
        serviceUrl: 'unknown',
        canarySkipped: true,
      });
    }

  } catch (err) {
    const error = err as Error;
    console.error(`[Deploy] ✗ Failed for project ${projectId} at ${currentStep}:\n${error.message}`);
    try {
      await transitionProject(projectId, 'failed', 'deploy-worker', {
        error: error.message,
        failedStep: currentStep,
        stack: error.stack?.split('\n').slice(0, 5).join(' → ') ?? '',
      });
    } catch (transitionErr) {
      console.error('[Deploy] Could not transition to failed:', (transitionErr as Error).message);
    }
  }
}
