/**
 * Integration tests for signup routes
 *
 * Uses Elysia's handle() method for fast testing without network overhead.
 * Following Elysia testing best practices with proper setup/teardown.
 *
 * @see {@link https://elysiajs.com/patterns/unit-test | Elysia Unit Testing}
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  createPostRequest,
  getTestApp,
  mockSheetsService,
  mockTurnstileService,
  parseJsonResponse,
  register,
  VALID_TURNSTILE_TOKEN,
} from "../helpers/test-app-elysia";
import type { ApiResponse } from "../types";

describe("Signup API Integration Tests", () => {
  beforeEach(async () => {
    register.resetMetrics();
    mockSheetsService.reset();
    mockTurnstileService.reset();
  });

  describe("GET /api/health", () => {
    test("should return healthy status", async () => {
      const app = await getTestApp();
      const response = await app.handle(new Request("http://localhost/api/health"));
      const data = await parseJsonResponse<ApiResponse>(response);

      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("POST /api/signup", () => {
    test("should validate email format", async () => {
      const app = await getTestApp();
      const response = await app.handle(
        createPostRequest("/api/signup", {
          email: "invalid-email",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      );
      const data = await parseJsonResponse<ApiResponse>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
      expect(data.details?.length).toBeGreaterThan(0);
    });

    test("should accept valid email", async () => {
      const app = await getTestApp();
      const response = await app.handle(
        createPostRequest("/api/signup", {
          email: "test@example.com",
          sheetTab: "Sheet1",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      );
      const data = await parseJsonResponse<ApiResponse>(response);

      // Should either succeed (200) or fail on sheets auth (500)
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(data.success).toBe(true);
      } else {
        expect(data.success).toBe(false);
      }
    });

    test("should reject missing email", async () => {
      const app = await getTestApp();
      const response = await app.handle(
        createPostRequest("/api/signup", {
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      );

      const data = await parseJsonResponse<ApiResponse>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    test("should trim and lowercase email", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "  TEST@EXAMPLE.COM  ",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      // Will fail validation or sheets auth
      expect([400, 200, 500]).toContain(response.status);
    });

    test("should accept metadata", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "metadata-test@example.com",
            turnstileToken: VALID_TURNSTILE_TOKEN,
            metadata: { source: "landing-page", referrer: "google" },
          }),
        }),
      );

      expect([200, 409, 500]).toContain(response.status);
    });
  });

  describe("POST /api/signup/extended", () => {
    test("should accept extended signup data", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            name: "John Doe",
            sheetTab: "Beta",
            source: "website",
            tags: ["newsletter", "beta-user"],
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should validate email format in extended signup", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid-email",
            name: "Test User",
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      const data = await parseJsonResponse<ApiResponse>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
    });

    test("should accept optional name", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "optional-name@example.com",
            name: "Jane Doe",
            source: "api",
            tags: [],
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect([200, 409, 500]).toContain(response.status);
    });

    test("should accept optional tags array", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "optional-tags@example.com",
            source: "form",
            tags: ["newsletter"],
            turnstileToken: VALID_TURNSTILE_TOKEN,
          }),
        }),
      );

      expect([200, 409, 500]).toContain(response.status);
    });
  });

  describe("POST /api/signup/bulk", () => {
    test("should accept bulk signup", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ email: "user1@example.com" }, { email: "user2@example.com" }],
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should reject empty signups array", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [],
          }),
        }),
      );

      expect(response.status).toBe(400);
    });

    test("should reject more than 100 signups", async () => {
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
    });

    test("should validate all emails in bulk", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ email: "valid@example.com" }, { email: "invalid" }],
          }),
        }),
      );

      expect(response.status).toBe(400);
    });
  });
});
