FROM node:22-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build
RUN npm run build

# Production stage
FROM node:22-alpine AS production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production && npm cache clean --force

COPY --from=base /app/dist ./dist

ENV NODE_ENV=production

# SERVICE_MODE determines which worker runs: api | data-ingestion | signal-worker | executor
ENV SERVICE_MODE=api

EXPOSE 3000

CMD ["node", "dist/index.js"]
