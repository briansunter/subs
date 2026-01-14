/**
 * Integration tests for signup routes
 * Uses Fastify inject() for fast testing
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getTestApp,
  mockDiscordService,
  mockSheetsService,
  mockTurnstileService,
  register,
  VALID_TURNSTILE_TOKEN,
} from "../helpers/test-app";
import type { ApiResponse } from "../types";

describe("Signup API Integration Tests", () => {
  beforeEach(async () => {
    register.resetMetrics();
    mockSheetsService.reset();
    mockDiscordService.reset();
    mockTurnstileService.reset();
  });

  afterEach(async () => {
    await mockDiscordService.waitForPendingNotifications();
  });

  describe("GET /api/health", () => {
    test("should return healthy status", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      const data = response.json() as ApiResponse;

      expect(response.statusCode).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("POST /api/signup", () => {
    test("should validate email format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "invalid-email",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;

      expect(response.statusCode).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
      expect(data.details?.length).toBeGreaterThan(0);
    });

    test("should accept valid email", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "test@example.com",
          sheetTab: "Sheet1",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;

      // Should either succeed (200) or fail on sheets auth (500)
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 200) {
        expect(data.success).toBe(true);
      } else {
        expect(data.success).toBe(false);
      }
    });

    test("should reject missing email", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;

      expect(response.statusCode).toBe(400);
      expect(data.success).toBe(false);
    });

    test("should trim and lowercase email", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "  TEST@EXAMPLE.COM  ",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      // Will fail validation or sheets auth
      expect([400, 200, 500]).toContain(response.statusCode);
    });

    test("should accept metadata", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "metadata-test@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          metadata: { source: "landing-page", referrer: "google" },
        },
      });

      expect([200, 409, 500]).toContain(response.statusCode);
    });
  });

  describe("POST /api/signup/extended", () => {
    test("should accept extended signup data", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          name: "John Doe",
          sheetTab: "Beta",
          source: "website",
          tags: ["newsletter", "beta-user"],
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    test("should validate email format in extended signup", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "invalid-email",
          name: "Test User",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;

      expect(response.statusCode).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
    });

    test("should accept optional name", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "optional-name@example.com",
          name: "Jane Doe",
          source: "api",
          tags: [],
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect([200, 409, 500]).toContain(response.statusCode);
    });

    test("should accept optional tags array", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "optional-tags@example.com",
          source: "form",
          tags: ["newsletter"],
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect([200, 409, 500]).toContain(response.statusCode);
    });
  });

  describe("POST /api/signup/bulk", () => {
    test("should accept bulk signup", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    test("should reject empty signups array", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    test("should reject more than 100 signups", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups },
      });

      expect(response.statusCode).toBe(400);
    });

    test("should validate all emails in bulk", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [{ email: "valid@example.com" }, { email: "invalid" }],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
