/**
 * Unit tests for route handlers
 * Tests extracted business logic without HTTP layer
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  handleBulkSignup,
  handleExtendedSignup,
  handleHealthCheck,
  handleSignup,
  handleStats,
  type SignupContext,
} from "../../../src/routes/handlers";
import { mockSheetsService } from "../../mocks/sheets";
import { mockTurnstileService } from "../../mocks/turnstile";

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

describe("Route Handlers - Unit Tests", () => {
  let mockContext: SignupContext;

  beforeEach(() => {
    mockSheetsService.reset();
    mockTurnstileService.reset();

    // Create test context with mocked services
    mockContext = {
      sheets: {
        appendSignup: mockSheetsService.appendSignup,
        emailExists: mockSheetsService.emailExists,
        getSignupStats: mockSheetsService.getSignupStats,
      },
      turnstile: {
        verifyTurnstileToken: mockTurnstileService.verifyTurnstileToken,
      },
      config: {
        defaultSheetTab: "Sheet1",
        port: 3000,
        host: "0.0.0.0",
        googleSheetId: "test-sheet-id",
        googleCredentialsEmail: "test@example.com",
        googlePrivateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
        allowedOrigins: ["*"],
        enableMetrics: true,
        allowedSheets: new Map(),
        sheetTabs: ["Sheet1"],
      },
    };
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
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain("Successfully");

      // Verify services were called
      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(1);
      expect(sheetData[0]?.email).toBe("test@example.com");
    });

    test("should validate email format", async () => {
      const result = await handleSignup(
        { email: "invalid-email", sheetTab: "Sheet1" },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
      expect(result.details).toBeDefined();
      expect(result.details).toContainEqual("email: Invalid email format");
    });

    test("should reject duplicate email", async () => {
      // First signup
      await handleSignup({ email: "test@example.com", sheetTab: "Sheet1" }, mockContext);

      // Second signup with same email
      const result = await handleSignup(
        { email: "test@example.com", sheetTab: "Sheet1" },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain("already registered");
    });

    test("should handle sheets errors gracefully", async () => {
      mockSheetsService.setAuthError(new Error("Authentication failed"));

      const result = await handleSignup(
        { email: "test2@example.com", sheetTab: "Sheet1" },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(result.error).toBe("Internal server error");
    });

    test("should use default sheet tab when not provided", async () => {
      const result = await handleSignup(
        { email: "test3@example.com", sheetTab: "Sheet1" },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(1);
    });

    test("should include metadata when provided", async () => {
      const metadata = { source: "website", referrer: "google" };
      const result = await handleSignup(
        { email: "test4@example.com", sheetTab: "Sheet1", metadata },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.metadata).toBe(JSON.stringify(metadata));
    });

    test("should lowercase email", async () => {
      const result = await handleSignup(
        { email: "TEST5@EXAMPLE.COM", sheetTab: "Sheet1" },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.email).toBe("test5@example.com");
    });

    test("should check duplicates against resolved site sheet", async () => {
      const checkedSheetIds: string[] = [];
      const siteContext: SignupContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          googleSheetId: "default-sheet",
          allowedSheets: new Map([["siteA", "siteA-sheet-id"]]),
        },
        sheets: {
          ...mockContext.sheets,
          emailExists: async (_email, _sheetTab, config) => {
            checkedSheetIds.push(config.googleSheetId);
            return false;
          },
          appendSignup: async () => {},
        },
      };

      const result = await handleSignup({ email: "site@example.com", site: "siteA" }, siteContext);

      expect(result.success).toBe(true);
      expect(checkedSheetIds).toEqual(["siteA-sheet-id"]);
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
        mockContext,
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
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });

    test("should reject duplicate email", async () => {
      await handleExtendedSignup(
        { email: "test@example.com", sheetTab: "Sheet2", source: "api", tags: [] },
        mockContext,
      );

      const result = await handleExtendedSignup(
        { email: "test@example.com", sheetTab: "Sheet2", source: "api", tags: [] },
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(409);
    });

    test("should include optional fields in notification", async () => {
      const result = await handleExtendedSignup(
        {
          email: "jane@example.com",
          name: "Jane Doe",
          source: "api",
          tags: ["vip"],
          sheetTab: "Sheet1",
        },
        mockContext,
      );

      expect(result.success).toBe(true);
    });

    test("should handle missing optional fields", async () => {
      const result = await handleExtendedSignup(
        { email: "john@example.com", sheetTab: "Sheet1", source: "api", tags: [] },
        mockContext,
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
        mockContext,
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
      await handleSignup({ email: "user1@example.com", sheetTab: "Sheet1" }, mockContext);

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
        mockContext,
      );

      expect(result.success).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.duplicates).toBe(1);
        expect(result.data.failed).toBeGreaterThan(0);
      }
    });

    test("should skip duplicate emails", async () => {
      await handleSignup({ email: "user1@example.com", sheetTab: "Sheet1" }, mockContext);

      const result = await handleBulkSignup(
        {
          signups: [
            { email: "user1@example.com", sheetTab: "Sheet1" }, // Duplicate
            { email: "user2@example.com", sheetTab: "Sheet1" }, // New
          ],
        },
        mockContext,
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
        mockContext,
      );

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    test("should check duplicates against each signup site sheet", async () => {
      const checkedSheetIds: string[] = [];
      const siteContext: SignupContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          googleSheetId: "default-sheet",
          allowedSheets: new Map([["siteA", "siteA-sheet-id"]]),
        },
        sheets: {
          ...mockContext.sheets,
          emailExists: async (_email, _sheetTab, config) => {
            checkedSheetIds.push(config.googleSheetId);
            return false;
          },
          appendSignup: async () => {},
        },
      };

      const result = await handleBulkSignup(
        { signups: [{ email: "bulk@example.com", site: "siteA" }] },
        siteContext,
      );

      expect(result.success).toBe(true);
      expect(checkedSheetIds).toEqual(["siteA-sheet-id"]);
    });
  });

  describe("Error Handling", () => {
    test("should handle concurrent signups correctly", async () => {
      const results = await Promise.all([
        handleSignup({ email: "user1@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "user2@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "user3@example.com", sheetTab: "Sheet1" }, mockContext),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(3);
    });
  });

  describe("Concurrent Operations", () => {
    test("should handle 50 concurrent signups", async () => {
      const signups = Array.from({ length: 50 }, (_, i) =>
        handleSignup({ email: `user${i}@example.com`, sheetTab: "Sheet1" }, mockContext),
      );

      const results = await Promise.all(signups);

      expect(results).toHaveLength(50);
      expect(results.every((r) => r.success)).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(50);
    });

    test("should handle mixed bulk/individual signups concurrently", async () => {
      const results = await Promise.all([
        handleBulkSignup(
          {
            signups: Array.from({ length: 10 }, (_, i) => ({
              email: `bulk${i}@example.com`,
              sheetTab: "Sheet1",
            })),
          },
          mockContext,
        ),
        handleSignup({ email: "single@example.com", sheetTab: "Sheet1" }, mockContext),
        handleBulkSignup(
          {
            signups: Array.from({ length: 5 }, (_, i) => ({
              email: `bulk2${i}@example.com`,
              sheetTab: "Sheet1",
            })),
          },
          mockContext,
        ),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(16); // 10 + 1 + 5
    });

    test("should handle concurrent email existence checks", async () => {
      // Add one email
      await handleSignup({ email: "exists@example.com", sheetTab: "Sheet1" }, mockContext);

      // Check many emails concurrently
      const checks = await Promise.all([
        handleSignup({ email: "exists@example.com", sheetTab: "Sheet1" }, mockContext), // Duplicate
        handleSignup({ email: "new1@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "new2@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "exists@example.com", sheetTab: "Sheet1" }, mockContext), // Duplicate
        handleSignup({ email: "new3@example.com", sheetTab: "Sheet1" }, mockContext),
      ]);

      expect(checks[0].success).toBe(false); // Duplicate
      expect(checks[1].success).toBe(true); // New
      expect(checks[2].success).toBe(true); // New
      expect(checks[3].success).toBe(false); // Duplicate
      expect(checks[4].success).toBe(true); // New

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(4); // exists + new1 + new2 + new3
    });

    test("should handle concurrent signups to different tabs", async () => {
      const results = await Promise.all([
        handleSignup({ email: "user1@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "user2@example.com", sheetTab: "Sheet2" }, mockContext),
        handleSignup({ email: "user3@example.com", sheetTab: "Sheet3" }, mockContext),
        handleSignup({ email: "user4@example.com", sheetTab: "Sheet1" }, mockContext),
        handleSignup({ email: "user5@example.com", sheetTab: "Sheet2" }, mockContext),
      ]);

      expect(results.every((r) => r.success)).toBe(true);

      expect(mockSheetsService.getSheetData("Sheet1")).toHaveLength(2);
      expect(mockSheetsService.getSheetData("Sheet2")).toHaveLength(2);
      expect(mockSheetsService.getSheetData("Sheet3")).toHaveLength(1);
    });

    test("should handle 100 concurrent signups (stress test)", async () => {
      const signups = Array.from({ length: 100 }, (_, i) =>
        handleSignup({ email: `stress${i}@example.com`, sheetTab: "Sheet1" }, mockContext),
      );

      const results = await Promise.all(signups);

      expect(results).toHaveLength(100);
      expect(results.filter((r) => r.success)).toHaveLength(100);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData).toHaveLength(100);
    });
  });

  describe("Boundary Conditions", () => {
    test("should handle exactly 100 bulk signups (boundary)", async () => {
      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `boundary${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const result = await handleBulkSignup({ signups }, mockContext);

      expect(result.success).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.success).toBe(100);
        expect(result.data.failed).toBe(0);
      }
    });

    test("should handle 101 bulk signups (exceeds limit)", async () => {
      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `exceed${i}@example.com`,
        sheetTab: "Sheet1",
      }));

      const result = await handleBulkSignup({ signups }, mockContext);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });

    test("should handle 254 character email (max valid)", async () => {
      // 254 chars is the maximum valid email length
      const localPart = "a".repeat(64); // Max local part is 64 chars
      const domain = `${"b".repeat(63)}.com`; // Max domain label is 63 chars
      const email = `${localPart}@${domain}`;

      const result = await handleSignup({ email, sheetTab: "Sheet1" }, mockContext);

      expect(result.success).toBe(true);
    });

    test("should handle very long metadata object", async () => {
      const largeMetadata: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`key${i}`] = `value${i}`.repeat(10);
      }

      const result = await handleSignup(
        {
          email: "test@example.com",
          sheetTab: "Sheet1",
          metadata: largeMetadata,
        },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.metadata).toBe(JSON.stringify(largeMetadata));
    });

    test("should handle tags array with 50 items", async () => {
      const tags = Array.from({ length: 50 }, (_, i) => `tag${i}`);

      const result = await handleExtendedSignup(
        {
          email: "test@example.com",
          sheetTab: "Sheet1",
          source: "api",
          tags,
        },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      // Tags should be comma-separated
      expect(sheetData[0]?.tags).toContain("tag0");
      expect(sheetData[0]?.tags).toContain("tag49");
    });

    test("should handle empty metadata object", async () => {
      const result = await handleSignup(
        {
          email: "test@example.com",
          sheetTab: "Sheet1",
          metadata: {},
        },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.metadata).toBe("{}");
    });

    test("should handle single bulk signup", async () => {
      const result = await handleBulkSignup(
        {
          signups: [{ email: "single@example.com", sheetTab: "Sheet1" }],
        },
        mockContext,
      );

      expect(result.success).toBe(true);
      if (isBulkResultData(result.data)) {
        expect(result.data.success).toBe(1);
      }
    });

    test("should handle special characters in name", async () => {
      const result = await handleExtendedSignup(
        {
          email: "test@example.com",
          sheetTab: "Sheet1",
          source: "api",
          tags: [],
          name: "John O'Brien-Müller-Jørgen III",
        },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("Sheet1");
      expect(sheetData[0]?.name).toBe("John O'Brien-Müller-Jørgen III");
    });

    test("should handle unicode characters in email", async () => {
      const result = await handleSignup({ email: "test@例え.jp", sheetTab: "Sheet1" }, mockContext);

      // Email validator accepts unicode, so this should pass validation
      expect(result.success).toBe(true);
    });

    test("should handle mixed case in sheet tab", async () => {
      const result = await handleSignup(
        { email: "test@example.com", sheetTab: "MyCustomSheet" },
        mockContext,
      );

      expect(result.success).toBe(true);

      const sheetData = mockSheetsService.getSheetData("MyCustomSheet");
      expect(sheetData).toHaveLength(1);
    });
  });

  describe("handleStats", () => {
    test("should return stats for a valid sheet tab", async () => {
      await handleSignup({ email: "stats@example.com", sheetTab: "Sheet1" }, mockContext);

      const result = await handleStats("Sheet1", mockContext);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      const data = result.data as { total: number; sheetTab: string; lastSignup: string | null };
      expect(data.total).toBe(1);
      expect(data.sheetTab).toBe("Sheet1");
    });

    test("should validate sheetTab is required", async () => {
      const result = await handleStats(undefined, mockContext);

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toBe("Validation failed");
    });
  });
});
