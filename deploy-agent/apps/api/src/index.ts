import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { projectRoutes } from './routes/projects';
import { reviewRoutes } from './routes/reviews';
import { deployRoutes } from './routes/deploys';
import { mcpRoutes } from './routes/mcp';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// CORS
await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});

// Health check
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: process.env.npm_package_version ?? '0.0.1',
}));

// Register routes
await app.register(projectRoutes);
await app.register(reviewRoutes);
await app.register(deployRoutes);
await app.register(mcpRoutes);

// Global error handler
app.setErrorHandler((error, request, reply) => {
  app.log.error({ err: error, url: request.url, method: request.method }, 'Request error');

  if (error.name === 'ZodError') {
    return reply.status(400).send({
      error: 'Validation error',
      details: JSON.parse(error.message),
    });
  }

  if (error.name === 'InvalidTransitionError') {
    return reply.status(409).send({ error: error.message });
  }

  return reply.status(error.statusCode ?? 500).send({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  });
});

// Start
const port = parseInt(process.env.PORT ?? '4000', 10);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Deploy Agent API running on ${host}:${port}`);
} catch (err) {
  app.log.fatal(err);
  process.exit(1);
}
