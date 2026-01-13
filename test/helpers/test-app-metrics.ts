/**
 * Test app setup specifically for metrics tests
 * Ensures proper isolation between tests
 */

import cors from "@fastify/cors";
import Fastify from "fastify";
import { clearConfigCache as _clearConfigCache, config } from "../../src/config";
import { signupRoutes } from "../../src/routes/signup";
import { register } from "prom-client";
import "../../src/schemas/signup";

// Re-export clearConfigCache for convenience
export { _clearConfigCache as clearConfigCache };

/**
 * Create a fresh test Fastify app for metrics testing
 * This ensures each test gets a clean app with fresh metrics
 */
export async function createFreshTestApp() {
  // Reset metrics before creating app
  register.resetMetrics();

  const fastify = Fastify({
    logger: false,
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: config.allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  });

  // Register routes
  await fastify.register(signupRoutes, { prefix: "/api" });

  return fastify;
}

/**
 * Helper to make a test request using inject()
 */
export async function injectRequest(
  app: Awaited<ReturnType<typeof createFreshTestApp>>,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
) {
  return app.inject({
    method,
    url: path,
    payload: body,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Helper for POST requests
 */
export async function injectPost(
  app: Awaited<ReturnType<typeof createFreshTestApp>>,
  path: string,
  body: unknown,
) {
  return injectRequest(app, path, "POST", body);
}

/**
 * Helper for GET requests
 */
export async function injectGet(
  app: Awaited<ReturnType<typeof createFreshTestApp>>,
  path: string,
) {
  return injectRequest(app, path, "GET");
}
