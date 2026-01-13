# Simple Dockerfile for Bun Fastify Signup API
FROM oven/bun:1

WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Switch to non-root user (already exists in base image)
USER bun

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD bun --eval "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))"

# Run the application
CMD ["bun", "run", "index.ts"]
