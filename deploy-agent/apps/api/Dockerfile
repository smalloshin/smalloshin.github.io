FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared

FROM node:22-alpine
WORKDIR /app
RUN addgroup --system --gid 1001 agent && adduser --system --uid 1001 agent
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER agent
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "apps/api/src/index.ts"]
