import type { FastifyInstance } from 'fastify';
import { query } from '../db/index';

export async function deployRoutes(app: FastifyInstance) {
  // List deployments
  app.get('/api/deploys', async () => {
    const result = await query(
      `SELECT d.*, p.name as project_name, p.slug as project_slug
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       ORDER BY d.created_at DESC
       LIMIT 50`
    );
    return { deployments: result.rows };
  });

  // Get single deployment
  app.get<{ Params: { id: string } }>('/api/deploys/:id', async (request, reply) => {
    const result = await query(
      `SELECT d.*, p.name as project_name, p.slug as project_slug
       FROM deployments d
       JOIN projects p ON d.project_id = p.id
       WHERE d.id = $1`,
      [request.params.id]
    );
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Deployment not found' });
    return { deployment: result.rows[0] };
  });

  // Get deployment logs (state transitions)
  app.get<{ Params: { id: string } }>('/api/deploys/:id/logs', async (request, reply) => {
    const deploy = await query('SELECT project_id FROM deployments WHERE id = $1', [request.params.id]);
    if (deploy.rows.length === 0) return reply.status(404).send({ error: 'Deployment not found' });

    const transitions = await query(
      `SELECT * FROM state_transitions
       WHERE project_id = $1
       ORDER BY created_at ASC`,
      [deploy.rows[0].project_id]
    );
    return { logs: transitions.rows };
  });
}
