# Multi-stage Dockerfile with Bun compile for optimal production performance

# Stage 1: Build and compile to standalone binary
FROM oven/bun:1 AS builder
WORKDIR /app

# Install all dependencies (including dev deps)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Set production environment for compile-time evaluation
# This ensures pino-pretty transport is NOT included in the binary
ENV NODE_ENV=production

# Compile to standalone binary (includes all dependencies)
RUN bun build index.ts \
  --compile \
  --minify-whitespace \
  --minify-syntax \
  --outfile ./subs-server

# Stage 2: Minimal production runtime
FROM oven/bun:1 AS release
WORKDIR /app

# Copy only the compiled binary (no node_modules needed!)
COPY --from=builder /app/subs-server ./subs-server

# Switch to non-root user
USER bun

# Expose port (for API, health checks, and Prometheus metrics)
EXPOSE 3000

# Labels for Prometheus service discovery
LABEL prometheus.io/scrape="true"
LABEL prometheus.io/port="3000"
LABEL prometheus.io.path="/metrics"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD ./subs-server --eval "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1))"

# Run the compiled binary (fastest startup, no dependencies needed)
CMD ["./subs-server"]
