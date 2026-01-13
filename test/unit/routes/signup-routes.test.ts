/**
 * Unit tests for signup routes
 * Tests routes with dependency injection using Fastify inject()
 */

import { beforeEach, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { mockDiscordService } from "../../mocks/discord";
import { mockSheetsService } from "../../mocks/sheets";
import { signupRoutes } from "../../../src/routes/signup";
import type { SignupContext } from "../../../src/routes/handlers";

describe("Signup Routes - Unit Tests", () => {
  let fastify: FastifyInstance;
  let mockContext: SignupContext;

  beforeEach(async () => {
    // Reset all mocks
    mockSheetsService.reset();
    mockDiscordService.reset();

    // Create mock context
    mockContext = {
      sheets: {
        appendSignup: mockSheetsService.appendSignup,
        emailExists: mockSheetsService.emailExists,
        getSignupStats: mockSheetsService.getSignupStats,
      },
      discord: {
        sendSignupNotification: mockDiscordService.sendSignupNotification,
        sendErrorNotification: mockDiscordService.sendErrorNotification,
      },
      config: {
        defaultSheetTab: "Sheet1",
        discordWebhookUrl: "https://discord.com/api/webhooks/test",
      },
    };

    // Create Fastify instance and register routes with /api prefix
    fastify = Fastify({ logger: false });
    await fastify.register(async function (fastify) {
      await signupRoutes(fastify, { context: mockContext });
      // Add custom test route within the same plugin so it shares the error handler
      fastify.get("/test-error", async () => {
        throw new Error("Unexpected error");
      });
    }, { prefix: "/api" });

    await fastify.ready();
  });

  describe("Zod Error Handler", () => {
    test("should return 400 for invalid email", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "not-an-email" },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe("Validation failed");
      expect(payload.details).toBeArray();
      expect(payload.details.length).toBeGreaterThan(0);
    });

    test("should include field name in validation error details", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "invalid" },
      });

      const payload = JSON.parse(response.payload);
      expect(payload.details?.[0]).toInclude("email");
    });

    test("should return 400 for empty request body", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    test("should return 400 for invalid tags array (non-array)", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          source: "api",
          tags: "not-an-array",
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    test("should handle generic non-Zod errors (line 64)", async () => {
      // The custom route added in beforeEach throws a plain error
      const response = await fastify.inject({
        method: "GET",
        url: "/api/test-error",
      });

      // Generic errors result in 500 with error message
      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      // The error message should be included
      expect(payload.message).toBe("Unexpected error");
    });
  });

  describe("GET /health", () => {
    test("should return 200 with ok status", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/health",
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe("ok");
      expect(payload.timestamp).toBeDefined();
    });

    test("should return ISO timestamp string", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/health",
      });

      const payload = JSON.parse(response.payload);
      expect(payload.timestamp).toBeString();
      // Verify it's a valid ISO date
      expect(() => new Date(payload.timestamp)).not.toThrow();
    });
  });

  describe("GET /stats", () => {
    test("should return stats without sheetTab query", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/stats",
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toBeDefined();
      expect(payload.data.totalSignups).toBe(0); // No signups yet
    });

    test("should return stats with sheetTab query", async () => {
      const response = await fastify.inject({
        method: "GET",
        url: "/api/stats?sheetTab=Sheet1",
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toBeDefined();
      // Verify getSignupStats was called with the sheetTab
      expect(mockSheetsService.countOperations("getSignupStats")).toBeGreaterThan(0);
    });

    test("should return error response when service fails", async () => {
      mockSheetsService.setAuthError(new Error("Stats failed"));

      const response = await fastify.inject({
        method: "GET",
        url: "/api/stats",
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toBeDefined();
    });
  });

  describe("POST /signup", () => {
    test("should return 200 for valid email", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test@example.com" },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
    });

    test("should call appendSignup with correct data", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test@example.com" },
      });

      expect(response.statusCode).toBe(200);
      expect(mockSheetsService.assertCalledWithEmail("test@example.com")).toBe(true);
    });

    test("should use default sheet tab when not provided", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test@example.com" },
      });

      expect(response.statusCode).toBe(200);
      // Check operation history for sheet tab
      const history = mockSheetsService.getOperationHistory();
      const appendOps = history.filter((op) => op.operation === "appendSignup");
      expect(appendOps.length).toBeGreaterThan(0);
      expect(appendOps[0].data?.["sheetTab"]).toBe("Sheet1"); // Default from config
    });

    test("should use provided sheet tab", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test@example.com", sheetTab: "Beta" },
      });

      expect(response.statusCode).toBe(200);
      const history = mockSheetsService.getOperationHistory();
      const appendOps = history.filter((op) => op.operation === "appendSignup");
      expect(appendOps[0].data?.["sheetTab"]).toBe("Beta");
    });

    test("should return error when appendSignup fails", async () => {
      mockSheetsService.setWriteError(new Error("Append failed"));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "test@example.com" },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    test("should return 409 for email that already exists", async () => {
      // First, add an email to the mock data
      await mockSheetsService.appendSignup({
        email: "existing@example.com",
        timestamp: new Date().toISOString(),
        sheetTab: "Sheet1",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup",
        payload: { email: "existing@example.com" },
      });

      expect(response.statusCode).toBe(409); // 409 Conflict for duplicate
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      expect(payload.error).toInclude("already");
    });
  });

  describe("POST /signup/extended", () => {
    test("should return 200 for valid extended signup", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          source: "api",
          tags: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
    });

    test("should handle name field", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          name: "John Doe",
          source: "api",
          tags: [],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockSheetsService.assertCalledWithEmail("test@example.com")).toBe(true);
    });

    test("should handle tags array", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          source: "api",
          tags: ["newsletter", "beta"],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test("should handle empty tags array", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          source: "api",
          tags: [],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test("should handle metadata field", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          source: "api",
          tags: [],
          metadata: { source: "landing-page" },
        },
      });

      expect(response.statusCode).toBe(200);
    });

    test("should use default source when not provided", async () => {
      // source is optional with default "api"
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "test@example.com",
          tags: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
    });

    test("should return 400 for invalid email format", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/extended",
        payload: {
          email: "not-an-email",
          source: "api",
          tags: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });
  });

  describe("POST /signup/bulk", () => {
    test("should return 200 for valid bulk signup", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com" },
            { email: "user2@example.com" },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data).toBeDefined();
      expect(payload.data.success).toBe(2);
      expect(payload.data.failed).toBe(0);
    });

    test("should handle maximum 100 signups", async () => {
      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.success).toBe(100);
    });

    test("should reject more than 100 signups", async () => {
      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
      // The validation details should mention the limit
      expect(payload.details?.[0]).toBeDefined();
    });

    test("should reject empty signup array", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: { signups: [] },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    test("should track failed signups", async () => {
      // First, add emails to the mock data (they already exist)
      await mockSheetsService.appendSignup({
        email: "user1@example.com",
        timestamp: new Date().toISOString(),
        sheetTab: "Sheet1",
      });
      await mockSheetsService.appendSignup({
        email: "user2@example.com",
        timestamp: new Date().toISOString(),
        sheetTab: "Sheet1",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com" },
            { email: "user2@example.com" },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.success).toBe(0);
      expect(payload.data.duplicates).toBe(2);
      expect(payload.data.failed).toBe(0);
    });

    test("should validate individual signup data", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "valid@example.com" },
            { email: "invalid-email" },
          ],
        },
      });

      expect(response.statusCode).toBe(400); // Zod validation fails
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(false);
    });

    test("should handle mixed success and failure", async () => {
      // Add one existing email
      await mockSheetsService.appendSignup({
        email: "user1@example.com",
        timestamp: new Date().toISOString(),
        sheetTab: "Sheet1",
      });

      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com" }, // Already exists
            { email: "user2@example.com" }, // New
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.success).toBe(1);
      expect(payload.data.duplicates).toBe(1);
    });

    test("should handle sheet tab in bulk signups", async () => {
      const response = await fastify.inject({
        method: "POST",
        url: "/api/signup/bulk",
        payload: {
          signups: [
            { email: "user1@example.com", sheetTab: "CustomTab" },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.success).toBe(true);
      expect(payload.data.success).toBe(1);

      // Verify the signup went to the correct tab
      const history = mockSheetsService.getOperationHistory();
      const appendOps = history.filter((op) => op.operation === "appendSignup");
      expect(appendOps[appendOps.length - 1].data?.["sheetTab"]).toBe("CustomTab");
    });
  });
});
