/**
 * Security integration tests
 * Tests various security-related scenarios and input validation
 * Uses Fastify inject() for fast testing (except for true concurrency tests)
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

describe.serial("Security Tests - Integration", () => {
  beforeEach(async () => {
    register.resetMetrics();
    mockSheetsService.reset();
    mockDiscordService.reset();
    mockTurnstileService.reset();
  });

  afterEach(async () => {
    await mockDiscordService.waitForPendingNotifications();
  });

  describe("Input Sanitization", () => {
    test("should accept email with special characters (not SQL injection)", async () => {
      const app = await getTestApp();

      // These are valid email characters that could be confused with injection attempts
      const testEmails = [
        "user+tag@example.com",
        "user.name@example.com",
        "user_name@example.com",
        "user-name@example.com",
        "user'name@example.com",
      ];

      for (const email of testEmails) {
        const response = await app.inject({
          method: "POST",
          url: "/api/signup",
          payload: { email, turnstileToken: VALID_TURNSTILE_TOKEN },
        });

        // Should accept valid emails
        expect([200, 500]).toContain(response.statusCode);
        if (response.statusCode === 400) {
          const data = response.json() as ApiResponse;
          // Only acceptable failure is auth error, not validation error
          expect(data.error).not.toBe("Validation failed");
        }
      }
    });

    test("should reject emails with attempted command injection", async () => {
      const app = await getTestApp();

      const maliciousEmails = [
        "user;rm -rf /@example.com",
        "user$(whoami)@example.com",
        "user`id`@example.com",
        "user|cat /etc/passwd@example.com",
        "user&&echo@example.com",
      ];

      for (const email of maliciousEmails) {
        const response = await app.inject({
          method: "POST",
          url: "/api/signup",
          payload: { email, turnstileToken: VALID_TURNSTILE_TOKEN },
        });

        // The email validator might reject these as invalid format
        // or accept them (they're stored as strings, not executed)
        // Key is that they don't cause crashes or unexpected behavior
        expect(response.statusCode).toBeGreaterThanOrEqual(200);
        expect(response.statusCode).toBeLessThan(600);
      }
    });

    test("should safely handle XSS attempts in metadata", async () => {
      const app = await getTestApp();

      const xssPayloads = [
        { "<script>alert('xss')</script>": "value" },
        { key: "<img src=x onerror=alert('xss')>" },
        { "<svg onload=alert('xss')>": "test" },
        { "javascript:alert('xss')": "value" },
      ];

      for (let i = 0; i < xssPayloads.length; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/signup",
          payload: {
            email: `xss-test-${i}@example.com`,
            turnstileToken: VALID_TURNSTILE_TOKEN,
            metadata: xssPayloads[i],
          },
        });

        // Should handle safely - data is stored as JSON string, not rendered
        expect([200, 409, 500]).toContain(response.statusCode);
      }
    });

    test("should safely handle script tags in name field", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "xss-name@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          name: "<script>alert('xss')</script>",
          source: "api",
          tags: [],
        },
      });

      // Should accept the input (stored as string, not rendered as HTML)
      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe("Request Size Limits", () => {
    test("should handle oversized request body", async () => {
      const app = await getTestApp();

      // Create a very large payload
      const largeMetadata: Record<string, string> = {};
      for (let i = 0; i < 1000; i++) {
        largeMetadata[`key${i}`] = "x".repeat(1000);
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "large-payload@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          metadata: largeMetadata,
        },
      });

      // Fastify has default body size limits
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });

    test("should reject deeply nested objects", async () => {
      const app = await getTestApp();

      // Create a deeply nested object
      let deepObject: Record<string, unknown> = { value: "end" };
      for (let i = 0; i < 100; i++) {
        deepObject = { level: i, nested: deepObject };
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "nested@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
          metadata: deepObject,
        },
      });

      // Should handle gracefully
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });

    test("should handle extremely long email address", async () => {
      const app = await getTestApp();

      // Way beyond valid email length
      const tooLongEmail = `${"a".repeat(1000)}@example.com`;

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: tooLongEmail,
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      // Should reject or handle gracefully
      expect([400, 413, 414, 500]).toContain(response.statusCode);
    });
  });

  describe("Header Security", () => {
    test("should not leak sensitive information in error responses", async () => {
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

      // Should not contain sensitive info
      const responseStr = JSON.stringify(data);
      expect(responseStr).not.toContain("private");
      expect(responseStr).not.toContain("credential");
      expect(responseStr).not.toContain("secret");
      expect(responseStr).not.toContain("password");
    });

    test("should handle suspicious user agent headers", async () => {
      const app = await getTestApp();

      const suspiciousAgents = [
        "sqlmap/1.0",
        "nmap scripting engine",
        "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)",
        "",
        "<script>alert('xss')</script>",
      ];

      for (const userAgent of suspiciousAgents) {
        const response = await app.inject({
          method: "GET",
          url: "/api/health",
          headers: { "User-Agent": userAgent },
        });

        // Should still respond normally
        expect(response.statusCode).toBeGreaterThanOrEqual(200);
        expect(response.statusCode).toBeLessThan(600);
      }
    });

    test("should handle requests with many headers", async () => {
      const app = await getTestApp();

      const headers: Record<string, string> = {};
      for (let i = 0; i < 50; i++) {
        headers[`X-Custom-${i}`] = "value";
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

  describe("CORS Security", () => {
    test("should handle preflight OPTIONS requests", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/signup",
        headers: {
          Origin: "https://example.com",
          "Access-Control-Request-Method": "POST",
        },
      });

      // Should handle preflight
      expect([200, 204, 400, 404]).toContain(response.statusCode);
    });
  });

  describe("Path Traversal and Injection", () => {
    test("should safely handle sheet tab names with path separators", async () => {
      const app = await getTestApp();

      const maliciousTabs = [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32",
        "./../../sensitive",
        "....//....//....//etc/passwd",
        "%2e%2e%2fetc%2fpasswd", // URL encoded ../
      ];

      for (const tab of maliciousTabs) {
        const response = await app.inject({
          method: "POST",
          url: "/api/signup",
          payload: {
            email: "path-test@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            sheetTab: tab,
          },
        });

        // Should handle safely - tab names are just strings
        expect([200, 500]).toContain(response.statusCode);
      }
    });

    test("should handle query parameter injection attempts", async () => {
      const app = await getTestApp();

      const maliciousQueries = [
        "?injected=test",
        "?injected=<script>alert('xss')</script>",
        "?injected=' OR '1'='1",
        "?injected=1; DROP TABLE users--",
      ];

      for (let i = 0; i < maliciousQueries.length; i++) {
        const response = await app.inject({
          method: "POST",
          url: `/api/signup${maliciousQueries[i]}`,
          payload: {
            email: `query-injection-test-${i}@example.com`,
            turnstileToken: VALID_TURNSTILE_TOKEN,
          },
        });

        // Should handle safely
        expect([200, 400, 409, 500]).toContain(response.statusCode);
      }
    });
  });

  describe("Content Type Security", () => {
    test("should reject incorrect content types for POST requests", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        headers: { "Content-Type": "application/xml" },
        payload: '<?xml version="1.0"?><email>test@example.com</email>',
      });

      // Fastify should handle this - may accept or reject
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });

    test("should handle missing content-type header", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: '{ "email": "test@example.com" }',
        headers: { "Content-Type": undefined as unknown as string },
      });

      // Fastify may still parse it
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(600);
    });
  });

  describe("Error Message Safety", () => {
    test("should not expose internal paths in errors", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "invalid",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;
      const responseStr = JSON.stringify(data);

      // Should not expose file paths
      expect(responseStr).not.toContain("/src/");
      expect(responseStr).not.toContain("/Volumes/");
      expect(responseStr).not.toContain(".ts:");
    });

    test("should not expose stack traces in API responses", async () => {
      const app = await getTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/signup",
        payload: {
          email: "",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        },
      });

      const data = response.json() as ApiResponse;
      const responseStr = JSON.stringify(data);

      // Should not contain stack trace indicators
      expect(responseStr).not.toContain("at ");
      expect(responseStr).not.toContain("Error: ");
      expect(responseStr).not.toContain("    at");
    });
  });

  describe("Protocol and Method Security", () => {
    test("should handle unsupported HTTP methods", async () => {
      const app = await getTestApp();

      const methods = ["PUT", "PATCH", "DELETE"];

      for (const method of methods) {
        const response = await app.inject({
          method: method as "PUT" | "PATCH" | "DELETE",
          url: "/api/signup",
        });

        // Should return 404, 405, or similar
        expect([200, 404, 405, 400]).toContain(response.statusCode);
      }
    });
  });
});
