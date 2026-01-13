/**
 * Fast test app setup using Fastify inject()
 * Much faster than spawning a separate server process
 */

import cors from "@fastify/cors";
import Fastify from "fastify";
import { config } from "../../src/config";
import { signupRoutes } from "../../src/routes/signup";
import "../../src/schemas/signup";

let testApp: ReturnType<typeof Fastify> | null = null;

/**
 * Get or create the test Fastify app
 * Uses inject() for super-fast HTTP simulation without network
 */
export async function getTestApp() {
  if (testApp) {
    return testApp;
  }

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

  testApp = fastify;
  return fastify;
}

/**
 * Reset the test app (call between tests if needed)
 */
export function resetTestApp(): void {
  testApp = null;
}

/**
 * Helper to make a test request using inject()
 * Simulates HTTP without starting a server
 */
export async function injectRequest(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const app = await getTestApp();

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
export async function injectPost(path: string, body: unknown) {
  return injectRequest(path, "POST", body);
}

/**
 * Helper for GET requests
 */
export async function injectGet(path: string) {
  return injectRequest(path, "GET");
}

/**
 * Set test environment variables
 */
export function setTestEnv(envOverrides: Record<string, string>): void {
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }
}

/**
 * Clear test environment variables
 */
export function clearTestEnv(keys: string[]): void {
  for (const key of keys) {
    delete process.env[key];
  }
}

/**
 * Default test environment
 */
export const DEFAULT_TEST_ENV = {
  NODE_ENV: "test",
  GOOGLE_SHEET_ID: "test-sheet-id",
  GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  ALLOWED_ORIGINS: "*",
  DISCORD_WEBHOOK_URL: "",
  PORT: "3011",
  HOST: "0.0.0.0",
} as const;
