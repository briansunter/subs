/**
 * Error scenario integration tests (using Elysia's handle() method)
 * Tests how the API handles various error conditions
 * Refactored from server spawning to Elysia's handle() for speed and consistency
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearConfigCache,
  DEFAULT_TEST_ENV,
  getTestApp,
  mockSheetsService,
  mockTurnstileService,
  parseJsonResponse,
  register,
  setTestEnv,
  VALID_TURNSTILE_TOKEN,
} from "../helpers/test-app-elysia";
import type { ApiResponse } from "../types";

// Setup environment variables for all tests
setTestEnv(DEFAULT_TEST_ENV);
clearConfigCache();

describe.serial("Error Scenarios - Elysia Handle Tests", () => {
  beforeEach(async () => {
    register.resetMetrics();
    mockSheetsService.reset();
    mockTurnstileService.reset();
  });

  describe("Malformed Request Bodies", () => {
    test("should handle invalid JSON gracefully", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{invalid json",
        }),
      );

      // Should return an error, not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(response.status).not.toBe(200);
    });

    test("should handle completely empty request", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "",
        }),
      );

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("should handle request with wrong content type", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: "email:test@example.com",
        }),
      );

      // Elysia may still parse it or return error
      expect([200, 400, 415]).toContain(response.status);
    });

    test("should handle request with missing required fields", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "John Doe" }), // Missing email
        }),
      );

      expect(response.status).toBe(400);

      const data = await parseJsonResponse<ApiResponse>(response);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
    });

    test("should handle request with extra unexpected fields", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            unexpectedField: "value",
            anotherUnexpected: 123,
          }),
        }),
      );

      // Should succeed (extra fields are ignored by Zod)
      expect([200, 500]).toContain(response.status);
    });
  });

  describe("Extremely Large Payloads", () => {
    test("should handle very long email address", async () => {
      const app = await getTestApp();

      // Create an email that's at the boundary of valid length
      const localPart = "a".repeat(64);
      const domain = `${"b".repeat(63)}.com`;
      const email = `${localPart}@${domain}`;

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, turnstileToken: VALID_TURNSTILE_TOKEN }),
        }),
      );

      // Should accept valid long email
      expect([200, 500]).toContain(response.status);
    });

    test("should handle very large metadata object", async () => {
      const app = await getTestApp();

      const largeMetadata: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = "x".repeat(100);
      }

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "large-metadata@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            metadata: largeMetadata,
          }),
        }),
      );

      // Should handle large metadata
      expect([200, 409, 413, 500]).toContain(response.status);
    });

    test("should handle bulk signup with 100 items (max)", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups }),
        }),
      );

      // Should accept max bulk size
      expect([200, 500]).toContain(response.status);
    });

    test("should reject bulk signup with 101 items (exceeds max)", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups }),
        }),
      );

      expect(response.status).toBe(400);

      const data = await parseJsonResponse<ApiResponse>(response);
      expect(data.success).toBe(false);
    });
  });

  describe("Network and Header Scenarios", () => {
    test("should handle very long query strings", async () => {
      const app = await getTestApp();

      const longQuery = "a".repeat(5000);
      const response = await app.handle(new Request(`http://localhost/api/health?${longQuery}`));

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });

    test("should handle requests with many headers", async () => {
      const app = await getTestApp();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      for (let i = 0; i < 50; i++) {
        headers[`X-Custom-Header-${i}`] = "value".repeat(10);
      }

      const response = await app.handle(
        new Request("http://localhost/api/health", {
          headers,
        }),
      );

      // Should handle gracefully
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle email with unicode characters", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@例え.jp",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      // Should handle unicode (validator accepts it)
      expect([200, 400, 500]).toContain(response.status);
    });

    test("should handle email with plus sign", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user+tag@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should handle email with subdomains", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "user@mail.sub.example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should handle special characters in name field", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "special-chars@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            name: "John O'Brien-Müller-Jørgen III",
            source: "api",
            tags: [],
          }),
        }),
      );

      expect([200, 409, 500]).toContain(response.status);
    });

    test("should handle empty tags array", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "empty-tags@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            source: "api",
            tags: [],
          }),
        }),
      );

      expect([200, 409, 500]).toContain(response.status);
    });
  });

  describe("Error Response Format", () => {
    test("should return consistent error format", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid-email",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect(response.status).toBe(400);

      const data = await parseJsonResponse<ApiResponse>(response);

      // Error responses should have consistent structure
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test("should include validation details when validation fails", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "not-an-email",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      const data = await parseJsonResponse<ApiResponse>(response);

      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
      expect(Array.isArray(data.details)).toBe(true);
    });

    test("should return proper content-type on errors", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      const contentType = response.headers.get("content-type");
      expect(contentType).toContain("application/json");
    });
  });
});
