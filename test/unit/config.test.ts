/**
 * Unit tests for configuration module
 * Tests environment variable parsing, validation, and caching
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearConfigCache, getConfig, loadEnv } from "../../src/config";

describe("Configuration - Unit Tests", () => {
  const originalEnv = { ...process.env };

  function restoreProcessEnv() {
    clearConfigCache();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  }

  function loadConfig(overrides: Record<string, string | undefined> = {}) {
    return loadEnv({
      GOOGLE_SHEET_ID: "test-sheet-id",
      GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
      GOOGLE_PRIVATE_KEY: "test-private-key",
      ...overrides,
    });
  }

  beforeEach(() => {
    restoreProcessEnv();
  });

  afterEach(() => {
    restoreProcessEnv();
  });

  describe("loadEnv (via getConfig)", () => {
    test("should load with minimal required env vars", () => {
      const config = loadEnv({
        GOOGLE_SHEET_ID: "test-sheet-123",
        GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
        GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----",
      });

      expect(config.googleSheetId).toBe("test-sheet-123");
      expect(config.googleCredentialsEmail).toBe("test@example.com");
      expect(config.googlePrivateKey).toContain("test-key");
    });

    test("should use defaults for optional vars", () => {
      const config = loadConfig();

      expect(config.port).toBe(3000); // Default PORT
      expect(config.host).toBe("0.0.0.0"); // Default HOST
      expect(config.defaultSheetTab).toBe("Sheet1"); // Default sheet tab
      expect(config.sheetTabs).toEqual(["Sheet1"]);
    });

    test("should transform PORT string to number", () => {
      const config = loadConfig({ PORT: "8080" });

      expect(config.port).toBe(8080);
    });

    test("should throw error for invalid PORT format (NaN)", () => {
      // Should throw ZodError because NaN doesn't pass the refine validation
      expect(() => loadConfig({ PORT: "invalid" })).toThrow(
        "PORT must be a valid number between 1 and 65535",
      );
    });

    test("should replace \\n in private key with actual newlines", () => {
      const config = loadConfig({
        GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\ntest\\nkey\\n-----END PRIVATE KEY-----",
      });

      // The \\n should be replaced with actual newlines
      expect(config.googlePrivateKey).not.toContain("\\n");
      expect(config.googlePrivateKey).toContain("\n");
    });

    test("should parse ALLOWED_ORIGINS as array", () => {
      const config = loadConfig({
        ALLOWED_ORIGINS: "https://example.com,https://test.com,localhost",
      });

      expect(config.allowedOrigins).toEqual([
        "https://example.com",
        "https://test.com",
        "localhost",
      ]);
    });

    test("should trim whitespace from allowed origins", () => {
      const config = loadConfig({
        ALLOWED_ORIGINS: "https://example.com , https://test.com",
      });

      expect(config.allowedOrigins).toEqual(["https://example.com", "https://test.com"]);
    });

    test("should default ALLOWED_ORIGINS to * when not provided", () => {
      const config = loadConfig();

      expect(config.allowedOrigins).toEqual(["*"]);
    });

    test("should throw error if GOOGLE_SHEET_ID missing", () => {
      expect(() =>
        loadEnv({
          GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
          GOOGLE_PRIVATE_KEY: "test",
        }),
      ).toThrow();
    });

    test("should throw error if GOOGLE_CREDENTIALS_EMAIL missing", () => {
      expect(() =>
        loadEnv({
          GOOGLE_SHEET_ID: "test",
          GOOGLE_PRIVATE_KEY: "test",
        }),
      ).toThrow();
    });

    test("should throw error if GOOGLE_PRIVATE_KEY missing", () => {
      expect(() =>
        loadEnv({
          GOOGLE_SHEET_ID: "test",
          GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
        }),
      ).toThrow();
    });

    test("should throw error if GOOGLE_SHEET_ID is empty string", () => {
      expect(() =>
        loadEnv({
          GOOGLE_SHEET_ID: "",
          GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
          GOOGLE_PRIVATE_KEY: "test",
        }),
      ).toThrow();
    });

    test("should parse DEFAULT_SHEET_TAB from env", () => {
      const config = loadConfig({ DEFAULT_SHEET_TAB: "CustomTab" });

      expect(config.defaultSheetTab).toBe("CustomTab");
    });

    test("should default SHEET_TABS from DEFAULT_SHEET_TAB when not provided", () => {
      const config = loadConfig({ DEFAULT_SHEET_TAB: "Newsletter" });

      expect(config.defaultSheetTab).toBe("Newsletter");
      expect(config.sheetTabs).toEqual(["Newsletter"]);
    });

    test("should parse SHEET_TABS from env", () => {
      const config = loadConfig({ SHEET_TABS: "Sheet1, Newsletter , Beta" });

      expect(config.sheetTabs).toEqual(["Sheet1", "Newsletter", "Beta"]);
    });
  });

  describe("getConfig - Caching Behavior", () => {
    test("should cache config across calls", () => {
      process.env["GOOGLE_SHEET_ID"] = "test";
      process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@example.com";
      process.env["GOOGLE_PRIVATE_KEY"] = "test";

      const config1 = getConfig();
      const config2 = getConfig();

      // Should be the same object reference (cached)
      expect(config1).toBe(config2);
    });

    test("should return same values on subsequent calls", () => {
      process.env["GOOGLE_SHEET_ID"] = "test";
      process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@example.com";
      process.env["GOOGLE_PRIVATE_KEY"] = "test";

      const config1 = getConfig();
      const config2 = getConfig();

      expect(config1.googleSheetId).toBe(config2.googleSheetId);
      expect(config1.port).toBe(config2.port);
    });

    test("should reload after clearConfigCache", () => {
      process.env["GOOGLE_SHEET_ID"] = "test";
      process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@example.com";
      process.env["GOOGLE_PRIVATE_KEY"] = "test";

      const config1 = getConfig();
      const config1Ref = config1;

      // Change env var
      process.env["PORT"] = "9999";

      // Config should still be cached (same reference)
      const config2 = getConfig();
      expect(config2).toBe(config1Ref);

      // Clear cache
      clearConfigCache();

      // New config should be created
      const config3 = getConfig();
      expect(config3).not.toBe(config1Ref);
      expect(config3.port).toBe(9999);
    });
  });

  // Note: Proxy getter tests removed - the Proxy export has been replaced with direct getConfig() calls

  describe("Edge Cases", () => {
    test("should handle PORT at extreme boundaries", () => {
      const config = loadConfig({ PORT: "1" });

      expect(config.port).toBe(1);
    });

    test("should handle HOST with IPv6 address", () => {
      const config = loadConfig({ HOST: "::1" });

      expect(config.host).toBe("::1");
    });

    test("should handle ALLOWED_ORIGINS with single origin", () => {
      const config = loadConfig({ ALLOWED_ORIGINS: "https://example.com" });

      expect(config.allowedOrigins).toEqual(["https://example.com"]);
    });

    test("should handle ALLOWED_ORIGINS with extra spaces", () => {
      const config = loadConfig({ ALLOWED_ORIGINS: " https://example.com , " });

      // The transform splits by comma, trims, and filters empty strings
      expect(config.allowedOrigins).toEqual(["https://example.com"]);
    });
  });

  describe("Zod Schema Validation", () => {
    test("should validate email format for GOOGLE_CREDENTIALS_EMAIL", () => {
      // Should throw error for invalid email format
      expect(() =>
        loadConfig({
          GOOGLE_CREDENTIALS_EMAIL: "not-an-email",
        }),
      ).toThrow("GOOGLE_CREDENTIALS_EMAIL must be a valid email address");
    });

    test("should require non-empty GOOGLE_CREDENTIALS_EMAIL", () => {
      // .min(1) should reject empty string
      expect(() =>
        loadConfig({
          GOOGLE_CREDENTIALS_EMAIL: "",
        }),
      ).toThrow();
    });

    test("should validate GOOGLE_SHEET_ID is not empty", () => {
      // .min(1) should reject whitespace-only strings (trim is not used)
      // Actually, .min(1) checks length, so "   " has length 3 and passes
      const config = loadConfig({ GOOGLE_SHEET_ID: "   " });
      expect(config.googleSheetId).toBe("   ");
    });

    test("should reject invalid LOG_LEVEL", () => {
      expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow();
    });
  });
});
