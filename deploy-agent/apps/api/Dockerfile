FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY . .
RUN npm run build --workspace=packages/shared && npm run build --workspace=apps/api

FROM node:22-alpine
WORKDIR /app
RUN addgroup --system --gid 1001 agent && adduser --system --uid 1001 agent
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/src/db/schema.sql ./dist/db/schema.sql
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./
USER agent
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
