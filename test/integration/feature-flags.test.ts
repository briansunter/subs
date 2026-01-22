/**
 * Feature flags integration tests
 * Tests that feature flags properly enable/disable functionality
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearConfigCache } from "../../src/config";
import { getTestApp, setTestEnv } from "../helpers/test-app-elysia";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

describe("Feature Flags - Integration Tests", () => {
  beforeEach(async () => {
    // Reset all mocks and config (async reset waits for pending operations)
    mockSheetsService.reset();
    mockTurnstileService.reset();

    // Clear config cache last to ensure clean state
    clearConfigCache();
  });

  afterEach(async () => {
    // Reset environment variables to default enabled state after each test
    // This prevents polluting other tests that run in parallel
    setTestEnv({
      NODE_ENV: "test",
      GOOGLE_SHEET_ID: "test-sheet-id",
      GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
      GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
      ALLOWED_ORIGINS: "*",
      PORT: "3012",
      HOST: "0.0.0.0",
      CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
      CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
      ENABLE_METRICS: "true",
    });
    clearConfigCache();
  });

  const defaultEnv = {
    NODE_ENV: "test",
    GOOGLE_SHEET_ID: "test-sheet-id",
    GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
    GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
    ALLOWED_ORIGINS: "*",
    PORT: "3012",
    HOST: "0.0.0.0",
    CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
  };

  describe("ENABLE_METRICS", () => {
    test("should disable metrics endpoint when false", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_METRICS: "false",
      });
      clearConfigCache();

      const app = await getTestApp();

      const response = await app.handle(new Request("http://localhost/api/metrics"));

      // Should return 404 when disabled
      expect(response.status).toBe(404);
    });

    test("should enable metrics endpoint when true", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_METRICS: "true",
      });
      clearConfigCache();

      const app = await getTestApp();

      const response = await app.handle(new Request("http://localhost/api/metrics"));

      // Should return 200 when enabled
      expect(response.status).toBe(200);
      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("text/plain");
    });
  });

  describe("Health check is always available", () => {
    test("should keep health check available regardless of flags", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_METRICS: "false",
      });
      clearConfigCache();

      const app = await getTestApp();

      const response = await app.handle(new Request("http://localhost/api/health"));

      // Health check should always work
      expect(response.status).toBe(200);
    });
  });

  describe("Extended and bulk signup are always available", () => {
    test("should allow extended signup (no feature flag)", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_METRICS: "true",
      });
      clearConfigCache();

      const app = await getTestApp();
      mockTurnstileService.setSuccess();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            name: "Test User",
            source: "api",
            tags: ["test"],
            turnstileToken: "valid-token",
          }),
        }),
      );

      // Should not return 404
      expect(response.status).not.toBe(404);
    });

    test("should allow bulk signup (no feature flag)", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_METRICS: "true",
      });
      clearConfigCache();

      const app = await getTestApp();
      mockTurnstileService.setSuccess();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "user1@example.com", turnstileToken: "valid-token" },
              { email: "user2@example.com", turnstileToken: "valid-token" },
            ],
          }),
        }),
      );

      // Should not return 404
      expect(response.status).not.toBe(404);
    });
  });
});
