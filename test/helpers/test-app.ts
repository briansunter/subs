/**
 * Fast test app setup using Fastify inject()
 * Much faster than spawning a separate server process
 */

import cors from "@fastify/cors";
import Fastify from "fastify";
import { clearConfigCache as _clearConfigCache, config } from "../../src/config";
import type { SignupContext } from "../../src/routes/handlers";
import { signupRoutes } from "../../src/routes/signup";

// Import metrics to ensure they're registered for tests
import { register } from "../../src/services/metrics";

// Import mock services
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

// Re-export clearConfigCache for convenience
export { _clearConfigCache as clearConfigCache };

// Re-export mock services for test convenience
export { mockDiscordService, mockSheetsService, mockTurnstileService };
export { register };

/**
 * Create a fresh test Fastify app instance
 * Uses inject() for super-fast HTTP simulation without network
 * Each call creates a new instance to ensure test isolation
 *
 * Note: Creating a new app per test is intentional for isolation.
 * The config object is captured at app creation time, so tests that
 * modify environment variables should clear the config cache and
 * create a new app to pick up the changes.
 */
export async function getTestApp() {
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

  // Create test context with mocked services
  const testContext: SignupContext = {
    sheets: {
      appendSignup: mockSheetsService.appendSignup,
      emailExists: mockSheetsService.emailExists,
      getSignupStats: mockSheetsService.getSignupStats,
    },
    discord: {
      sendSignupNotification: mockDiscordService.sendSignupNotification,
      sendErrorNotification: mockDiscordService.sendErrorNotification,
    },
    turnstile: {
      verifyTurnstileToken: mockTurnstileService.verifyTurnstileToken,
    },
    config,
  };

  // Register routes with mocked context
  await fastify.register(signupRoutes, {
    prefix: "/api",
    context: testContext,
  });

  return fastify;
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
  CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
} as const;

/**
 * Cloudflare Turnstile test token that always passes
 * From: https://developers.cloudflare.com/turnstile/reference/testing
 */
export const VALID_TURNSTILE_TOKEN = "1x0000000000000000000000000000000AA";
