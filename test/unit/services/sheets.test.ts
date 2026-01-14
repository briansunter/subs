/**
 * Unit tests for Google Sheets service (REST API version)
 * Tests actual service code with mocked fetch
 */

// Set up environment before any imports
process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@example.com";
process.env["GOOGLE_PRIVATE_KEY"] =
  "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n";
process.env["NODE_ENV"] = "test";
process.env["DEFAULT_SHEET_TAB"] = "Sheet1";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

// Import and clear config cache
import { clearConfigCache, type SignupConfig } from "../../../src/config";
import { createMockResponse, getRequestBody } from "../../helpers/test-app-elysia";

// Mock jose functions before importing sheets service
mock.module("jose", () => ({
  SignJWT: class MockSignJWT {
    constructor(private payload: Record<string, unknown>) {}
    setProtectedHeader(_header: Record<string, string>) {
      return this;
    }
    setIssuedAt(_time: number) {
      return this;
    }
    setExpirationTime(_time: number) {
      return this;
    }
    setIssuer(_email: string) {
      return this;
    }
    setAudience(_url: string) {
      return this;
    }
    async sign(_key: unknown) {
      return "mock-signed-jwt";
    }
  },
  importPKCS8: async (_key: string, _alg: string) => ({}), // Return mock key
}));

// Import the service functions
import { appendSignup, emailExists, initializeSheetTab } from "../../../src/services/sheets";

// Test configuration
const testConfig: SignupConfig = {
  port: 3000,
  host: "0.0.0.0",
  googleSheetId: "test-sheet-id",
  googleCredentialsEmail: "test@example.com",
  googlePrivateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  defaultSheetTab: "Sheet1",
  allowedOrigins: ["*"],
  enableExtendedSignup: true,
  enableBulkSignup: true,
  enableMetrics: true,
};

// Track fetch calls
type FetchCall = {
  url: string;
  options?: RequestInit;
};

const fetchCalls: FetchCall[] = [];

describe("Sheets Service - REST API Tests", () => {
  // Save original fetch
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Clear config cache to ensure clean environment
    clearConfigCache();

    // Clear fetch call tracking
    fetchCalls.length = 0;

    // Mock fetch
    globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
      fetchCalls.push({
        url: url.toString(),
        options,
      });

      const urlString = url.toString();

      // Mock token endpoint
      if (urlString.includes("oauth2.googleapis.com/token")) {
        return createMockResponse(200, {
          access_token: "mock-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        });
      }

      // Mock spreadsheet get
      if (
        urlString.includes("/spreadsheets/test-sheet-id") &&
        !urlString.includes(":batchUpdate") &&
        !urlString.includes("/values/")
      ) {
        return createMockResponse(200, {
          sheets: [
            { properties: { title: "Sheet1", sheetId: 1 } },
            { properties: { title: "Sheet2", sheetId: 2 } },
          ],
        });
      }

      // Mock values get
      if (
        urlString.includes("/values/") &&
        (!options || options.method !== "PUT") &&
        (!options || options.method !== "POST")
      ) {
        return createMockResponse(200, {
          values: [["Email"], ["existing@example.com"]],
        });
      }

      // Mock batch update
      if (urlString.includes(":batchUpdate")) {
        return createMockResponse(200, {});
      }

      // Mock values update
      if (options?.method === "PUT" && urlString.includes("/values/")) {
        return createMockResponse(200, {});
      }

      // Mock values append
      if (options?.method === "POST" && urlString.includes(":append")) {
        return createMockResponse(200, {
          updates: { updatedRows: 1 },
        });
      }

      // Default error
      return createMockResponse(404, { error: "Not found" });
    });
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe("initializeSheetTab", () => {
    test("should skip creation when sheet already exists", async () => {
      // Mock existing headers
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (urlString.includes("/values/Sheet1!A1%3AG1")) {
          return createMockResponse(200, {
            values: [["Email", "Timestamp", "Source", "Name", "Tags", "Metadata", "Sheet Tab"]],
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await initializeSheetTab("Sheet1", testConfig);

      // Verify spreadsheet get was called
      const getSheetCalls = fetchCalls.filter(
        (c) =>
          c.url.includes("/spreadsheets/test-sheet-id") &&
          !c.url.includes(":batchUpdate") &&
          !c.url.includes("/values/"),
      );
      expect(getSheetCalls.length).toBeGreaterThan(0);

      // Verify values get was called
      const valuesGetCalls = fetchCalls.filter(
        (c) => c.url.includes("/values/Sheet1!A1%3AG1") && c.options?.method !== "PUT",
      );
      expect(valuesGetCalls.length).toBeGreaterThan(0);

      // Should NOT create new sheet
      const batchUpdateCalls = fetchCalls.filter((c) => c.url.includes(":batchUpdate"));
      expect(batchUpdateCalls.length).toBe(0);

      // Should NOT add headers
      const updateCalls = fetchCalls.filter(
        (c) => c.options?.method === "PUT" && c.url.includes("/values/"),
      );
      expect(updateCalls.length).toBe(0);
    });

    test("should create new sheet when doesn't exist", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          // Sheet doesn't exist
          return createMockResponse(200, {
            sheets: [{ properties: { title: "OtherSheet", sheetId: 1 } }],
          });
        }

        if (urlString.includes(":batchUpdate")) {
          return createMockResponse(200, {});
        }

        if (urlString.includes("/values/NewSheet!A1%3AG1")) {
          // Empty sheet
          return createMockResponse(200, {
            values: [],
          });
        }

        if (options?.method === "PUT" && urlString.includes("/values/")) {
          return createMockResponse(200, {});
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await initializeSheetTab("NewSheet", testConfig);

      // Should create new sheet via batchUpdate
      const batchUpdateCalls = fetchCalls.filter((c) => c.url.includes(":batchUpdate"));
      expect(batchUpdateCalls.length).toBeGreaterThan(0);

      const batchUpdateBody = getRequestBody(batchUpdateCalls[0]?.options);
      expect(batchUpdateBody.requests).toEqual([
        {
          addSheet: {
            properties: {
              title: "NewSheet",
            },
          },
        },
      ]);

      // Should add headers via PUT
      const updateCalls = fetchCalls.filter(
        (c) => c.options?.method === "PUT" && c.url.includes("/values/"),
      );
      expect(updateCalls.length).toBeGreaterThan(0);

      const updateBody = getRequestBody(updateCalls[0]?.options);
      expect(updateBody.values).toEqual([
        ["Email", "Timestamp", "Source", "Name", "Tags", "Metadata", "Sheet Tab"],
      ]);
    });

    test("should add headers when sheet is empty", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (urlString.includes("/values/Sheet1!A1%3AG1") && options?.method !== "PUT") {
          // Empty values
          return createMockResponse(200, {
            values: null,
          });
        }

        if (options?.method === "PUT" && urlString.includes("/values/")) {
          return createMockResponse(200, {});
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await initializeSheetTab("Sheet1", testConfig);

      // Should add headers
      const updateCalls = fetchCalls.filter(
        (c) => c.options?.method === "PUT" && c.url.includes("/values/"),
      );
      expect(updateCalls.length).toBeGreaterThan(0);
    });

    test("should handle API errors gracefully", async () => {
      globalThis.fetch = mock(async () => {
        return createMockResponse(500, { error: "Internal Server Error" });
      });

      await expect(initializeSheetTab("Sheet1", testConfig)).rejects.toThrow();
    });
  });

  describe("appendSignup", () => {
    test("should append row with all fields", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email", "Timestamp"]],
          });
        }

        if (urlString.includes(":append")) {
          return createMockResponse(200, {
            updates: { updatedRows: 1 },
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await appendSignup(
        {
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
          source: "website",
          name: "John Doe",
          tags: ["newsletter", "beta"],
          metadata: { source: "landing-page" },
        },
        testConfig,
      );

      const appendCalls = fetchCalls.filter((c) => c.url.includes(":append"));
      expect(appendCalls.length).toBeGreaterThan(0);

      const appendBody = getRequestBody(appendCalls[0]?.options);
      expect(appendBody.values).toEqual([
        [
          "test@example.com",
          "2024-01-01T00:00:00.000Z",
          "website",
          "John Doe",
          "newsletter, beta",
          '{"source":"landing-page"}',
          "Sheet1",
        ],
      ]);
    });

    test("should use default source when not provided", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email"]],
          });
        }

        if (urlString.includes(":append")) {
          return createMockResponse(200, {
            updates: { updatedRows: 1 },
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await appendSignup(
        {
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
          tags: [],
        },
        testConfig,
      );

      const appendCalls = fetchCalls.filter((c) => c.url.includes(":append"));
      const appendBody = getRequestBody(appendCalls[0]?.options);
      expect(appendBody.values[0][2]).toBe("api"); // Default source
    });

    test("should handle empty tags array", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email"]],
          });
        }

        if (urlString.includes(":append")) {
          return createMockResponse(200, {
            updates: { updatedRows: 1 },
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await appendSignup(
        {
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
          tags: [],
        },
        testConfig,
      );

      const appendCalls = fetchCalls.filter((c) => c.url.includes(":append"));
      const appendBody = getRequestBody(appendCalls[0]?.options);
      expect(appendBody.values[0][4]).toBe(""); // Empty tags
    });

    test("should stringify metadata object", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email"]],
          });
        }

        if (urlString.includes(":append")) {
          return createMockResponse(200, {
            updates: { updatedRows: 1 },
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await appendSignup(
        {
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
          metadata: { key: "value" },
        },
        testConfig,
      );

      const appendCalls = fetchCalls.filter((c) => c.url.includes(":append"));
      const appendBody = getRequestBody(appendCalls[0]?.options);
      expect(appendBody.values[0][5]).toBe('{"key":"value"}');
    });

    test("should handle empty metadata", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email"]],
          });
        }

        if (urlString.includes(":append")) {
          return createMockResponse(200, {
            updates: { updatedRows: 1 },
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      await appendSignup(
        {
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
        },
        testConfig,
      );

      const appendCalls = fetchCalls.filter((c) => c.url.includes(":append"));
      const appendBody = getRequestBody(appendCalls[0]?.options);
      expect(appendBody.values[0][5]).toBe(""); // Empty metadata
    });

    test("should throw error on append failure", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (
          urlString.includes("/values/") &&
          options?.method !== "PUT" &&
          options?.method !== "POST"
        ) {
          return createMockResponse(200, {
            values: [["Email"]],
          });
        }

        // Return error for append
        return createMockResponse(500, { error: "Append failed" });
      });

      await expect(
        appendSignup({
          email: "test@example.com",
          timestamp: "2024-01-01T00:00:00.000Z",
          sheetTab: "Sheet1",
        }),
      ).rejects.toThrow("Failed to store signup data");
    });
  });

  describe("emailExists", () => {
    test("should return true when email found in sheet", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (urlString.includes("/values/Sheet1!A%3AA")) {
          return createMockResponse(200, {
            values: [
              ["Email"], // header
              ["test@example.com"], // data
            ],
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      const exists = await emailExists("test@example.com", undefined, testConfig);

      expect(exists).toBe(true);
    });

    test("should be case-insensitive when checking", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (urlString.includes("/values/")) {
          return createMockResponse(200, {
            values: [
              ["Email"],
              ["test@example.com"], // lowercase in sheet
            ],
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      const exists = await emailExists("TEST@EXAMPLE.COM", undefined, testConfig); // uppercase search

      expect(exists).toBe(true);
    });

    test("should return false when email not found", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [{ properties: { title: "Sheet1", sheetId: 1 } }],
          });
        }

        if (urlString.includes("/values/")) {
          return createMockResponse(200, {
            values: [["Email"], ["other@example.com"]],
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      const exists = await emailExists("test@example.com", undefined, testConfig);

      expect(exists).toBe(false);
    });

    test("should search all tabs when sheetTab not provided", async () => {
      let callCount = 0;
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [
              { properties: { title: "Sheet1", sheetId: 1 } },
              { properties: { title: "Sheet2", sheetId: 2 } },
            ],
          });
        }

        if (urlString.includes("/values/")) {
          callCount++;
          if (callCount === 1) {
            return createMockResponse(200, {
              values: [["Email"], ["other1@example.com"]],
            });
          }
          return createMockResponse(200, {
            values: [["Email"], ["test@example.com"]], // Found here!
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      const exists = await emailExists("test@example.com", undefined, testConfig);

      expect(exists).toBe(true);
      // Should have called values API at least twice (once for each sheet)
      expect(fetchCalls.filter((c) => c.url.includes("/values/")).length).toBeGreaterThanOrEqual(2);
    });

    test("should search specific tab when sheetTab provided", async () => {
      globalThis.fetch = mock(async (url: string | Request, options?: RequestInit) => {
        fetchCalls.push({ url: url.toString(), options });

        const urlString = url.toString();

        if (urlString.includes("oauth2.googleapis.com/token")) {
          return createMockResponse(200, {
            access_token: "mock-access-token",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }

        if (
          urlString.includes("/spreadsheets/test-sheet-id") &&
          !urlString.includes(":batchUpdate") &&
          !urlString.includes("/values/")
        ) {
          return createMockResponse(200, {
            sheets: [
              { properties: { title: "Sheet1", sheetId: 1 } },
              { properties: { title: "Sheet2", sheetId: 2 } },
            ],
          });
        }

        if (urlString.includes("/values/Sheet2!A%3AA")) {
          return createMockResponse(200, {
            values: [["Email"], ["test@example.com"]],
          });
        }

        return createMockResponse(404, { error: "Not found" });
      });

      const exists = await emailExists("test@example.com", "Sheet2", testConfig);

      expect(exists).toBe(true);
      // Should only check Sheet2
      const valuesCalls = fetchCalls.filter((c) => c.url.includes("/values/"));
      expect(valuesCalls.length).toBe(1);
      expect(valuesCalls[0].url).toContain("Sheet2");
    });

    test("should return false on API errors gracefully", async () => {
      globalThis.fetch = mock(async () => {
        return createMockResponse(500, { error: "API Error" });
      });

      const exists = await emailExists("test@example.com", undefined, testConfig);

      expect(exists).toBe(false); // Should return false, not throw
    });
  });
});
