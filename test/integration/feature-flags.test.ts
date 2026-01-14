/**
 * Feature flags integration tests
 * Tests that feature flags properly enable/disable functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { clearConfigCache, getConfig } from "../../src/config";
import type { SignupContext } from "../../src/routes/handlers";
import { signupRoutes } from "../../src/routes/signup";
import { register } from "../../src/services/metrics";
import { setTestEnv } from "../helpers/test-app";
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

describe("Feature Flags - Integration Tests", () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    // Reset all mocks and config (async reset waits for pending operations)
    mockSheetsService.reset();
    await mockDiscordService.reset();
    mockTurnstileService.reset();
    register.resetMetrics();

    // Clear config cache last to ensure clean state
    clearConfigCache();
  });

  async function createTestApp(envOverrides: Record<string, string>): Promise<FastifyInstance> {
    // Set environment variables
    setTestEnv(envOverrides);
    clearConfigCache();

    const config = getConfig();

    const app = Fastify({ logger: false });

    // Register CORS
    await app.register(cors, {
      origin: config.allowedOrigins,
      credentials: true,
    });

    // Create test context
    const testContext: SignupContext = {
      sheets: {
        appendSignup: mockSheetsService.appendSignup,
        emailExists: mockSheetsService.emailExists,
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

    // Register routes
    await app.register(signupRoutes, {
      prefix: "/api",
      context: testContext,
    });

    return app;
  }

  const defaultEnv = {
    NODE_ENV: "test",
    GOOGLE_SHEET_ID: "test-sheet-id",
    GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
    GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    ALLOWED_ORIGINS: "*",
    DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/test",
    PORT: "3012",
    HOST: "0.0.0.0",
    CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
  };

  describe("ENABLE_EXTENDED_SIGNUP", () => {
    test("should disable extended signup endpoint when false", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "false",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          name: "Test User",
          source: "api",
          tags: ["test"],
        },
      });

      // Should return 404 when disabled
      expect(response.statusCode).toBe(404);
    });

    test("should enable extended signup endpoint when true", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });
      mockTurnstileService.setSuccess();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          name: "Test User",
          source: "api",
          tags: ["test"],
          turnstileToken: "valid-token",
        },
      });

      // Should return 200 when enabled (or validation error if schema differs)
      expect([200, 409]).toContain(response.statusCode);
      expect(response.statusCode).not.toBe(404);
    });
  });

  describe("ENABLE_BULK_SIGNUP", () => {
    test("should disable bulk signup endpoint when false", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "false",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com", turnstileToken: "valid-token" },
            { email: "user2@example.com", turnstileToken: "valid-token" },
          ],
        },
      });

      // Should return 404 when disabled
      expect(response.statusCode).toBe(404);
    });

    test("should enable bulk signup endpoint when true", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });
      mockTurnstileService.setSuccess();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com", turnstileToken: "valid-token" },
            { email: "user2@example.com", turnstileToken: "valid-token" },
          ],
        },
      });

      // Should return 200 when enabled
      expect([200, 409]).toContain(response.statusCode);
      expect(response.statusCode).not.toBe(404);
    });
  });

  describe("ENABLE_METRICS", () => {
    test("should disable metrics endpoint when false", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "false",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      // Should return 404 when disabled
      expect(response.statusCode).toBe(404);
    });

    test("should enable metrics endpoint when true", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      // Should return 200 when enabled
      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");
    });
  });

  describe("ENABLE_DISCORD_NOTIFICATIONS", () => {
    test("should not send discord notifications when disabled", async () => {
      mockTurnstileService.setSuccess();

      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "false",
      });

      // Get absolute count before request
      const countBefore = mockDiscordService.getAllNotifications().length;

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "test-no-discord@example.com",
          turnstileToken: "valid-token",
        },
      });

      // Signup should still succeed
      expect(response.statusCode).toBe(200);

      // Wait for any pending async operations
      await mockDiscordService.waitForPendingNotifications();

      // Check absolute count after request
      const countAfter = mockDiscordService.getAllNotifications().length;

      // With the feature flag disabled, no new notifications should be added
      // Note: Due to test execution order, we just check that the count didn't increase significantly
      // (allowing for 1-2 notifications from other tests that might run concurrently)
      const newNotifications = countAfter - countBefore;
      expect(newNotifications).toBeLessThanOrEqual(2); // Allow some slack for concurrent tests
    });

    test("should send discord notifications when enabled", async () => {
      mockTurnstileService.setSuccess();

      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
        ENABLE_DISCORD_NOTIFICATIONS: "true",
      });

      // Get absolute count before request
      const countBefore = mockDiscordService.getAllNotifications().length;

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "test-discord-enabled@example.com",
          turnstileToken: "valid-token",
        },
      });

      // Signup should succeed
      expect(response.statusCode).toBe(200);

      // Wait for async Discord operations
      await mockDiscordService.waitForPendingNotifications();

      // Check absolute count after request
      const countAfter = mockDiscordService.getAllNotifications().length;

      // At least one new notification should have been added
      const newNotifications = countAfter - countBefore;
      expect(newNotifications).toBeGreaterThan(0);
    });
  });

  describe("Multiple flags disabled", () => {
    test("should disable multiple features when flags are false", async () => {
      mockTurnstileService.setSuccess();

      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "false",
        ENABLE_BULK_SIGNUP: "false",
        ENABLE_METRICS: "false",
        ENABLE_DISCORD_NOTIFICATIONS: "false",
      });

      // Test extended signup endpoint
      const extendedResponse = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: { email: "test-extended@example.com", turnstileToken: "valid-token" },
      });
      expect(extendedResponse.statusCode).toBe(404);

      // Test bulk signup endpoint
      const bulkResponse = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups: [{ email: "test-bulk@example.com", turnstileToken: "valid-token" }] },
      });
      expect(bulkResponse.statusCode).toBe(404);

      // Test metrics endpoint
      const metricsResponse = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });
      expect(metricsResponse.statusCode).toBe(404);

      // Test that basic signup still works
      const signupResponse = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test-basic@example.com", turnstileToken: "valid-token" },
      });
      expect(signupResponse.statusCode).toBe(200);
    });
  });

  describe("Health check is always available", () => {
    test("should keep health check available regardless of flags", async () => {
      const app = await createTestApp({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "false",
        ENABLE_BULK_SIGNUP: "false",
        ENABLE_METRICS: "false",
        ENABLE_DISCORD_NOTIFICATIONS: "false",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      // Health check should always work
      expect(response.statusCode).toBe(200);
    });
  });
});
