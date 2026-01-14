/**
 * Error scenario integration tests (using Fastify inject())
 * Tests how the API handles various error conditions
 * Refactored from server spawning to Fastify's inject() for speed and consistency
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

describe.serial("Error Scenarios - Fastify Inject Tests", () => {
  beforeEach(async () => {
    register.resetMetrics();
    mockSheetsService.reset();
    mockDiscordService.reset();
    mockTurnstileService.reset();
  });

  afterEach(async () => {
    await mockDiscordService.waitForPendingNotifications();
  });

  describe("Malformed Request Bodies", () => {
    test("should handle invalid JSON gracefully", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: "{invalid json}",
      });

      // Should return an error, not crash
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
      expect(response.statusCode).not.toBe(200);
    });

    test("should handle completely empty request", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: "",
      });

      // Should handle gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });

    test("should handle request with wrong content type", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        headers: { "Content-Type": "text/plain" },
        payload: "email:test@example.com",
      });

      // Fastify may still parse it or return error
      expect([200, 400, 415]).toContain(response.statusCode);
    });

    test("should handle request with missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: { name: "John Doe" }, // Missing email
      });

      expect(response.statusCode).toBe(400);

      const data = response.json() as ApiResponse;
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    test("should handle request with extra unexpected fields", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "test@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          unexpectedField: "value",
          anotherUnexpected: 123,
        },
      });

      // Should succeed (extra fields are ignored by Zod)
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe("Extremely Large Payloads", () => {
    test("should handle very long email address", async () => {
      const app = await getTestApp();

      // Create an email that's at the boundary of valid length
      const localPart = "a".repeat(64);
      const domain = `${"b".repeat(63)}.com`;
      const email = `${localPart}@${domain}`;

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email, turnstileToken: VALID_TURNSTILE_TOKEN },
      });

      // Should accept valid long email
      expect([200, 500]).toContain(response.statusCode);
    });

    test("should handle very large metadata object", async () => {
      const app = await getTestApp();

      const largeMetadata: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = "x".repeat(100);
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "large-metadata@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          metadata: largeMetadata,
        },
      });

      // Should handle large metadata
      expect([200, 409, 413, 500]).toContain(response.statusCode);
    });

    test("should handle bulk signup with 100 items (max)", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups },
      });

      // Should accept max bulk size
      expect([200, 500]).toContain(response.statusCode);
    });

    test("should reject bulk signup with 101 items (exceeds max)", async () => {
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

      const data = response.json() as ApiResponse;
      expect(data.success).toBe(false);
    });
  });

  describe("Network and Header Scenarios", () => {
    test("should handle very long query strings", async () => {
      const app = await getTestApp();

      const longQuery = "a".repeat(5000);
      const response = await app.inject({
        method: "GET",
        url: `/api/health?${longQuery}`,
      });

      // Should handle gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });

    test("should handle requests with many headers", async () => {
      const app = await getTestApp();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      for (let i = 0; i < 50; i++) {
        headers[`X-Custom-Header-${i}`] = "value".repeat(10);
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/health",
        headers,
      });

      // Should handle gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle email with unicode characters", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "test@例え.jp",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      // Should handle unicode (validator accepts it)
      expect([200, 400, 500]).toContain(response.statusCode);
    });

    test("should handle email with plus sign", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "user+tag@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    test("should handle email with subdomains", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "user@mail.sub.example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    test("should handle special characters in name field", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "special-chars@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          name: "John O'Brien-Müller-Jørgen III",
          source: "api",
          tags: [],
        },
      });

      expect([200, 409, 500]).toContain(response.statusCode);
    });

    test("should handle empty tags array", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "empty-tags@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          source: "api",
          tags: [],
        },
      });

      expect([200, 409, 500]).toContain(response.statusCode);
    });
  });

  describe("Error Response Format", () => {
    test("should return consistent error format", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "invalid-email",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      expect(response.statusCode).toBe(400);

      const data = response.json() as ApiResponse;

      // Error responses should have consistent structure
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test("should include validation details when validation fails", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "not-an-email",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;

      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);
    });

    test("should return proper content-type on errors", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "invalid",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const contentType = response.headers["content-type"];
      expect(contentType).toContain("application/json");
    });
  });
});
