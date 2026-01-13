# Multi-stage Dockerfile with Bun bundling for optimal production performance

# Stage 1: Build and bundle
FROM oven/bun:1 AS builder
WORKDIR /app

# Install all dependencies (including dev deps for bundling)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Bundle the application
RUN bun build index.ts --outdir ./dist --target bun --minify

# Stage 2: Production runtime
FROM oven/bun:1 AS release
WORKDIR /app

# Install only production dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy bundled application from builder
COPY --from=builder /app/dist ./dist

# Switch to non-root user
USER bun

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD bun --eval "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))"

# Run the bundled application (faster startup)
CMD ["bun", "dist/index.js"]
