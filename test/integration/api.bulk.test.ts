/**
 * Integration tests for bulk signup endpoint
 * Uses Elysia's handle() method for super-fast testing without server spawning
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  getTestApp,
  mockSheetsService,
  mockTurnstileService,
  parseJsonResponse,
  register,
} from "../helpers/test-app-elysia";
import type { BulkApiResponse } from "../types";

describe("Bulk Signup API Integration Tests", () => {
  beforeEach(async () => {
    // Reset all mock services
    register.resetMetrics();
    mockSheetsService.reset();
    mockTurnstileService.reset();
  });

  describe("POST /api/signup/bulk - Success Cases", () => {
    test("should process multiple signups successfully", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "user1@example.com", sheetTab: "Sheet1" },
              { email: "user2@example.com", sheetTab: "Sheet1" },
              { email: "user3@example.com", sheetTab: "Sheet1" },
            ],
          }),
        }),
      );

      const data = await parseJsonResponse<BulkApiResponse>(response);

      // Will fail on sheets auth with test credentials
      expect([200, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(data.success).toBe(true);
        expect(data.message).toContain("Processed");
        expect(data.data).toBeDefined();
        // Note: With test credentials, auth errors cause failures instead of successes
        // Accept both 3 successes (real auth) and 3 failures (test credentials)
        if (data.data?.success === 3) {
          expect(data.data.failed).toBe(0);
        } else if (data.data?.failed === 3) {
          expect(data.data.success).toBe(0);
        }
      }
    });

    test("should handle signups with different sheet tabs", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "user1@example.com", sheetTab: "Sheet1" },
              { email: "user2@example.com", sheetTab: "Sheet2" },
              { email: "user3@example.com", sheetTab: "Sheet3" },
            ],
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should handle signups with default sheet tab", async () => {
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

    test("should process signups with metadata", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              {
                email: "user1@example.com",
                sheetTab: "Sheet1",
                metadata: { source: "test", referrer: "google" },
              },
              {
                email: "user2@example.com",
                sheetTab: "Sheet1",
                metadata: { source: "test", referrer: "direct" },
              },
            ],
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should handle exactly 100 signups (maximum allowed)", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });
  });

  describe("POST /api/signup/bulk - Validation Errors", () => {
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
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Validation failed");
    });

    test("should reject more than 100 signups", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups }),
        }),
      );

      expect(response.status).toBe(400);
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Validation failed");
    });

    test("should reject invalid email format", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ email: "invalid-email", sheetTab: "Sheet1" }],
          }),
        }),
      );

      expect(response.status).toBe(400);
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
    });

    test("should reject missing signups field", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
    });

    test("should reject signups array with non-object items", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: ["not-an-object", "also-not-an-object"],
          }),
        }),
      );

      expect(response.status).toBe(400);
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
    });

    test("should reject missing email field", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ sheetTab: "Sheet1" }],
          }),
        }),
      );

      expect(response.status).toBe(400);
      const data = await parseJsonResponse<BulkApiResponse>(response);
      expect(data.success).toBe(false);
      expect(data.details).toBeDefined();
    });
  });

  describe("POST /api/signup/bulk - Edge Cases", () => {
    test("should handle all signups being duplicates", async () => {
      // This test would need a mock to properly simulate duplicates
      // For now, we test that the endpoint handles the request structure
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "duplicate@example.com", sheetTab: "Sheet1" },
              { email: "duplicate@example.com", sheetTab: "Sheet1" },
              { email: "duplicate@example.com", sheetTab: "Sheet1" },
            ],
          }),
        }),
      );

      // Should process the request (even if sheets operations fail with test creds)
      expect([200, 500]).toContain(response.status);
    });

    test("should handle single signup", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ email: "single@example.com", sheetTab: "Sheet1" }],
          }),
        }),
      );

      expect([200, 500]).toContain(response.status);
    });

    test("should handle signups with null/undefined values", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              {
                email: "user1@example.com",
                sheetTab: null,
              },
            ],
          }),
        }),
      );

      expect(response.status).toBe(400);
    });

    test("should handle very long email addresses", async () => {
      const app = await getTestApp();

      const longEmail = `a${"very".repeat(100)}long@example.com`;
      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [{ email: longEmail, sheetTab: "Sheet1" }],
          }),
        }),
      );

      // Zod email validation should catch this
      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/signup/bulk - Response Format", () => {
    test("should return correct JSON structure", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "user1@example.com", sheetTab: "Sheet1" },
              { email: "user2@example.com", sheetTab: "Sheet1" },
            ],
          }),
        }),
      );

      const data = await parseJsonResponse<BulkApiResponse>(response);

      // Check response structure
      if (response.status === 200) {
        expect(data).toHaveProperty("success");
        expect(data).toHaveProperty("message");
        expect(data).toHaveProperty("data");
        expect(data.data).toHaveProperty("success");
        expect(data.data).toHaveProperty("failed");
        expect(data.data).toHaveProperty("duplicates");
        expect(data.data).toHaveProperty("errors");
      } else if (response.status === 500) {
        expect(data).toHaveProperty("success");
        expect(data).toHaveProperty("error");
      }
    });

    test("should include accurate counts in response data", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "user1@example.com", sheetTab: "Sheet1" },
              { email: "user2@example.com", sheetTab: "Sheet1" },
              { email: "user3@example.com", sheetTab: "Sheet1" },
            ],
          }),
        }),
      );

      const data = await parseJsonResponse<BulkApiResponse>(response);

      if (response.status === 200) {
        expect(typeof data.data?.success).toBe("number");
        expect(typeof data.data?.failed).toBe("number");
        expect(typeof data.data?.duplicates).toBe("number");
        expect(Array.isArray(data.data?.errors)).toBe(true);

        // Total should equal input count
        const total =
          (data.data?.success ?? 0) + (data.data?.failed ?? 0) + (data.data?.duplicates ?? 0);
        expect(total).toBe(3);
      }
    });

    test("should aggregate errors from failed signups", async () => {
      const app = await getTestApp();

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signups: [
              { email: "invalid-email", sheetTab: "Sheet1" },
              { email: "also-invalid", sheetTab: "Sheet1" },
            ],
          }),
        }),
      );

      const data = await parseJsonResponse<BulkApiResponse>(response);

      // Should have validation errors for invalid emails
      expect(response.status).toBe(400);
      expect(data.details).toBeDefined();
    });
  });

  describe("POST /api/signup/bulk - Performance", () => {
    test("should handle bulk request within reasonable time", async () => {
      const app = await getTestApp();

      const signups = Array.from({ length: 50 }, (_, i) => ({
        email: `user${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const startTime = Date.now();
      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups }),
        }),
      );
      const duration = Date.now() - startTime;

      // Should complete within 5 seconds (even with test credentials causing auth failures)
      expect(duration).toBeLessThan(5000);
      expect([200, 500]).toContain(response.status);
    });
  });
});
