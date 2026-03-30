import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createProject,
  listProjects,
  getProject,
  transitionProject,
  createScanReport,
  getLatestScanReport,
  getDeploymentsByProject,
  deleteProjectFromDb,
} from '../services/orchestrator';
import { runPipeline } from '../services/pipeline-worker';
import { deleteService, deleteDomainMapping, deleteContainerImage } from '../services/deploy-engine';
import { deleteCname } from '../services/dns-manager';

const submitSchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['upload', 'git', 'openclaw']),
  sourceUrl: z.string().optional(),
  config: z.object({
    deployTarget: z.enum(['cloud_run']).default('cloud_run'),
    customDomain: z.string().optional(),
    allowUnauthenticated: z.boolean().default(false),
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

  // Get latest scan report for project
  app.get<{ Params: { id: string } }>('/api/projects/:id/scan', async (request, reply) => {
    const report = await getLatestScanReport(request.params.id);
    if (!report) return reply.status(404).send({ error: 'No scan report found' });
    return { report };
  });

  // Resubmit project (from needs_revision or failed)
  app.post<{ Params: { id: string } }>('/api/projects/:id/resubmit', async (request, reply) => {
    const project = await getProject(request.params.id);
    if (!project) return reply.status(404).send({ error: 'Project not found' });

    if (project.status !== 'needs_revision' && project.status !== 'failed') {
      return reply.status(400).send({ error: `Cannot resubmit from status: ${project.status}` });
    }

    const updated = await transitionProject(project.id, 'submitted', 'user', { action: 'resubmit' });
    return { project: updated };
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
}
