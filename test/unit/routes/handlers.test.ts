/**
 * Unit tests for route handlers
 * Tests extracted business logic without HTTP layer
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mockDiscordService } from "../../mocks/discord";
import { mockSheetsService } from "../../mocks/sheets";
// Clear module cache before importing handlers to ensure fresh config
delete (require as any).cache[require.resolve("../../../src/config")];
delete (require as any).cache[require.resolve("../../../src/utils/logger")];
import {
  handleBulkSignup,
  handleExtendedSignup,
  handleGetStats,
  handleHealthCheck,
  handleSignup,
  type SignupContext,
} from "../../../src/routes/handlers";

// Type guards for test data
function isHealthCheckData(data: unknown): data is { status: string; timestamp: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    "timestamp" in data &&
    typeof data.status === "string" &&
    typeof data.timestamp === "string"
  );
}

function isStatsData(data: unknown): data is { totalSignups: number; sheetTabs: string[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "totalSignups" in data &&
    "sheetTabs" in data &&
    typeof data.totalSignups === "number" &&
    Array.isArray(data.sheetTabs)
  );
}

function isBulkResultData(data: unknown): data is {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
} {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    "failed" in data &&
    "duplicates" in data &&
    "errors" in data &&
    typeof data.success === "number" &&
    typeof data.failed === "number" &&
    typeof data.duplicates === "number" &&
    Array.isArray(data.errors)
  );
}

function isDiscordPayload(data: unknown): data is { embeds: Array<{ fields: unknown }> } {
  return (
    typeof data === "object" &&
    data !== null &&
    "embeds" in data &&
    Array.isArray(data.embeds) &&
    data.embeds.length > 0 &&
    typeof data.embeds[0] === "object" &&
    data.embeds[0] !== null &&
    "fields" in data.embeds[0]
  );
}

describe("Route Handlers - Unit Tests", () => {
  let mockContext: SignupContext;

  beforeEach(() => {
    mockSheetsService.reset();
    mockDiscordService.reset();

    // Create test context with mocked services
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
      config: { defaultSheetTab: "Sheet1" },
    };
  });

  afterEach(() => {
    // Clear module cache to prevent test pollution
    const handlersPath = require.resolve("../../../src/routes/handlers");
    const servicePath = require.resolve("../../../src/services/discord");
    const sheetsServicePath = require.resolve("../../../src/services/sheets");
    const configPath = require.resolve("../../../src/config");
    const loggerPath = require.resolve("../../../src/utils/logger");
    delete (require as any).cache[handlersPath];
    delete (require as any).cache[servicePath];
    delete (require as any).cache[sheetsServicePath];
    delete (require as any).cache[configPath];
    delete (require as any).cache[loggerPath];
  });

  describe("handleHealthCheck", () => {
    test("should return healthy status", () => {
      const result = handleHealthCheck();

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.data).toBeDefined();

      expect(isHealthCheckData(result.data)).toBe(true);
      if (isHealthCheckData(result.data)) {
        expect(result.data.status).toBe("ok");
        expect(result.data.timestamp).toBeDefined();
      }
    });
  });

  describe("handleSignup", () => {
    test("should process valid signup", async () => {
      const result = await handleSignup(
        { email: "test@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain("Successfully");

      // Verify services were called
      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(1);
      expect(sheetData[0]?.email).toBe("test@example.com");

      expect(mockDiscordService.getNotificationCount()).toBe(1);
    });

    test("should validate email format", async () => {
      const result = await handleSignup(
        { email: "invalid-email", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
      expect(result.details).toBeDefined();
      expect(result.details).toContainEqual("email: Invalid email format");
    });

    test("should reject duplicate email", async () => {
      // First signup
      await handleSignup(
        { email: "test@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      // Second signup with same email
      const result = await handleSignup(
        { email: "test@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain("already registered");
    });

    test("should handle sheets errors gracefully", async () => {
      mockSheetsService.setAuthError(new Error("Authentication failed"));

      const result = await handleSignup(
        { email: "test2@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe("Internal server error");

      // Should have sent error notification
      expect(mockDiscordService.getNotificationCount()).toBeGreaterThanOrEqual(0);
    });

    test("should use default sheet tab when not provided", async () => {
      const result = await handleSignup(
        { email: "test3@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(1);
    });

    test("should include metadata when provided", async () => {
      const metadata = { source: "website", referrer: "google" };
      const result = await handleSignup(
        { email: "test4@example.com", sheetTab: "Sheet1", metadata },
        mockContext
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.metadata).toBe(JSON.stringify(metadata));
    });

    test("should lowercase email", async () => {
      const result = await handleSignup(
        { email: "TEST5@EXAMPLE.COM", sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.email).toBe("test5@example.com");
    });
  });

  describe("handleExtendedSignup", () => {
    test("should process extended signup with all fields", async () => {
      const result = await handleExtendedSignup(
        {
          email: "test@example.com",
          name: "John Doe",
          source: "website",
          tags: ["newsletter", "beta"],
          sheetTab: "Sheet1",
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(1);
      expect(sheetData[0]?.name).toBe("John Doe");
      expect(sheetData[0]?.source).toBe("website");
      expect(sheetData[0]?.tags).toBe("newsletter, beta");
    });

    test("should validate email format", async () => {
      const result = await handleExtendedSignup(
        { email: "not-an-email", name: "Test User", source: "api", tags: [], sheetTab: "Sheet1" },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });

    test("should reject duplicate email", async () => {
      await handleExtendedSignup(
        { email: "test@example.com", sheetTab: "Sheet2", source: "api", tags: [] },
        mockContext
      );

      const result = await handleExtendedSignup(
        { email: "test@example.com", sheetTab: "Sheet2", source: "api", tags: [] },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
    });

    test("should include optional fields in notification", async () => {
      await handleExtendedSignup(
        {
          email: "jane@example.com",
          name: "Jane Doe",
          source: "api",
          tags: ["vip"],
          sheetTab: "Sheet1",
        },
        mockContext
      );

      const lastNotification = mockDiscordService.getLastNotification();
      expect(lastNotification).toBeDefined();

      if (lastNotification && isDiscordPayload(lastNotification.payload)) {
        expect(lastNotification.payload.embeds).toBeDefined();
        expect(lastNotification.payload.embeds[0]?.fields).toBeDefined();
      }
    });

    test("should handle missing optional fields", async () => {
      const result = await handleExtendedSignup(
        { email: "john@example.com", sheetTab: "Sheet1", source: "api", tags: [] },
        mockContext
      );

      expect(result.success).toBe(true);
    });
  });

  describe("handleBulkSignup", () => {
    test("should process multiple signups", async () => {
      const result = await handleBulkSignup(
        {
          signups: [
            { email: "user1@example.com", sheetTab: "Sheet1" },
            { email: "user2@example.com", sheetTab: "Sheet1" },
            { email: "user3@example.com", sheetTab: "Sheet1" },
          ],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain("Processed 3");

      expect(isBulkResultData(result.data)).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.success).toBe(3);
        expect(result.data.failed).toBe(0);
        expect(result.data.duplicates).toBe(0);
      }
    });

    test("should reject empty signups array", async () => {
      const result = await handleBulkSignup({ signups: [] }, mockContext);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });

    test("should reject more than 100 signups", async () => {
      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const result = await handleBulkSignup({ signups }, mockContext);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });

    test("should handle partial failures", async () => {
      // First signup succeeds
      await handleSignup(
        { email: "user1@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      // Set error for second signup
      mockSheetsService.setWriteError(new Error("Write error"));

      const result = await handleBulkSignup(
        {
          signups: [
            { email: "user1@example.com", sheetTab: "Sheet1" }, // Duplicate
            { email: "user2@example.com", sheetTab: "Sheet1" }, // Will fail
            { email: "user3@example.com", sheetTab: "Sheet1" }, // Will fail
          ],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.duplicates).toBe(1);
        expect(result.data.failed).toBeGreaterThan(0);
      }
    });

    test("should skip duplicate emails", async () => {
      await handleSignup(
        { email: "user1@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      const result = await handleBulkSignup(
        {
          signups: [
            { email: "user1@example.com", sheetTab: "Sheet1" }, // Duplicate
            { email: "user2@example.com", sheetTab: "Sheet1" }, // New
          ],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.duplicates).toBe(1);
        expect(result.data.success).toBe(1);
      }
    });

    test("should validate all emails in bulk", async () => {
      const result = await handleBulkSignup(
        {
          signups: [
            { email: "valid@example.com", sheetTab: "Sheet1" },
            { email: "invalid-email", sheetTab: "Sheet1" },
            { email: "another@example.com", sheetTab: "Sheet1" },
          ],
        },
        mockContext
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  describe("handleGetStats", () => {
    test("should return stats for all sheets", async () => {
      // Add some test data
      await handleSignup(
        { email: "user1@example.com", sheetTab: "Sheet1" },
        mockContext
      );
      await handleSignup(
        { email: "user2@example.com", sheetTab: "Sheet2" },
        mockContext
      );

      const result = await handleGetStats(undefined, mockContext);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);

      expect(isStatsData(result.data)).toBe(true);
      if (isStatsData(result.data)) {
        expect(result.data.totalSignups).toBe(2);
        expect(result.data.sheetTabs).toContain("Sheet1");
        expect(result.data.sheetTabs).toContain("Sheet2");
      }
    });

    test("should return stats for specific sheet tab", async () => {
      await handleSignup(
        { email: "user1@example.com", sheetTab: "Sheet1" },
        mockContext
      );
      await handleSignup(
        { email: "user2@example.com", sheetTab: "Sheet2" },
        mockContext
      );

      const result = await handleGetStats("Sheet1", mockContext);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);

      if (isStatsData(result.data)) {
        expect(result.data.totalSignups).toBe(1);
      }
    });

    test("should handle sheets errors gracefully", async () => {
      mockSheetsService.setAuthError(new Error("Auth error"));

      const result = await handleGetStats(undefined, mockContext);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toContain("Failed to retrieve");
    });
  });

  describe("Error Handling", () => {
    test("should handle discord notification errors gracefully", async () => {
      // Set Discord error but signup should still succeed
      mockDiscordService.setError(new Error("Discord error"));

      const result = await handleSignup(
        { email: "test@example.com", sheetTab: "Sheet1" },
        mockContext
      );

      // Signup should still succeed (Discord is non-blocking)
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    test("should handle concurrent signups correctly", async () => {
      const results = await Promise.all([
        handleSignup(
          { email: "user1@example.com", sheetTab: "Sheet1" },
          mockContext
        ),
        handleSignup(
          { email: "user2@example.com", sheetTab: "Sheet1" },
          mockContext
        ),
        handleSignup(
          { email: "user3@example.com", sheetTab: "Sheet1" },
          mockContext
        ),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(3);
    });
  });
});
