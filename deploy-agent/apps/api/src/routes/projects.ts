import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createProject,
  listProjects,
  getProject,
  transitionProject,
  createScanReport,
  getLatestScanReport,
} from '../services/orchestrator';

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

    // TODO: Dispatch worker job for scanning pipeline
    // For now, the scan will be triggered via the worker endpoint

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
}
