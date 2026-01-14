/**
 * Feature flags integration tests
 * Tests that feature flags properly enable/disable functionality
 */

import { beforeEach, describe, expect, test } from "bun:test";
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

  describe("ENABLE_EXTENDED_SIGNUP", () => {
    test("should disable extended signup endpoint when false", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "false",
        ENABLE_BULK_SIGNUP: "true",
        ENABLE_METRICS: "true",
      });
      clearConfigCache();

      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            name: "Test User",
            source: "api",
            tags: ["test"],
          }),
        }),
      );

      // Should return 404 when disabled
      expect(response.status).toBe(404);
    });

    test("should enable extended signup endpoint when true", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
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

      // Should return 200 when enabled (or validation error if schema differs)
      expect([200, 409]).toContain(response.status);
      expect(response.status).not.toBe(404);
    });
  });

  describe("ENABLE_BULK_SIGNUP", () => {
    test("should disable bulk signup endpoint when false", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "false",
        ENABLE_METRICS: "true",
      });
      clearConfigCache();

      const app = await getTestApp();

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

      // Should return 404 when disabled
      expect(response.status).toBe(404);
    });

    test("should enable bulk signup endpoint when true", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
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

      // Should return 200 when enabled
      expect([200, 409]).toContain(response.status);
      expect(response.status).not.toBe(404);
    });
  });

  describe("ENABLE_METRICS", () => {
    test("should disable metrics endpoint when false", async () => {
      setTestEnv({
        ...defaultEnv,
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
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
        ENABLE_EXTENDED_SIGNUP: "true",
        ENABLE_BULK_SIGNUP: "true",
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
        ENABLE_EXTENDED_SIGNUP: "false",
        ENABLE_BULK_SIGNUP: "false",
        ENABLE_METRICS: "false",
      });
      clearConfigCache();

      const app = await getTestApp();

      const response = await app.handle(new Request("http://localhost/api/health"));

      // Health check should always work
      expect(response.status).toBe(200);
    });
  });
});
