# Multi-stage Dockerfile for Bun Fastify Signup API

# Stage 1: Build stage - Install dependencies and build TypeScript
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# Stage 2: Production stage
FROM base AS release
WORKDIR /app

# Copy production dependencies
COPY --from=install /temp/prod/node_modules node_modules

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup --system --gid 1001 bun && \
    adduser --system --uid 1001 --gid 1001 bun && \
    chown -R bun:bun /app

# Switch to non-root user
USER bun

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD bun --eval "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))"

# Run the application
CMD ["bun", "run", "index.ts"]
