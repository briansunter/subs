/**
 * Unit tests for security plugin
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { clearConfigCache, getConfig } from "../../../src/config";
import { isValidOrigin, securityPlugin } from "../../../src/plugins/security";

beforeEach(() => {
  clearConfigCache();
  // Set test environment variables
  process.env.GOOGLE_SHEET_ID = "test-sheet-id";
  process.env.GOOGLE_CREDENTIALS_EMAIL = "test@test.com";
  process.env.GOOGLE_PRIVATE_KEY = "test-key";
  process.env.ALLOWED_ORIGINS = "https://example.com,https://test.com";
});

test("securityPlugin should set CSP header", async () => {
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  expect(response.headers.get("Content-Security-Policy")).toBeDefined();
  const csp = response.headers.get("Content-Security-Policy") || "";
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
});

test("securityPlugin should include valid origins in CSP", async () => {
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  const csp = response.headers.get("Content-Security-Policy") || "";
  expect(csp).toContain("https://example.com");
  expect(csp).toContain("https://test.com");
});

test("securityPlugin should filter invalid origins from CSP", async () => {
  process.env.ALLOWED_ORIGINS =
    "https://example.com,evil.com;script-src 'unsafe-eval',https://test.com";
  clearConfigCache();
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  const csp = response.headers.get("Content-Security-Policy") || "";
  // Should contain valid origins
  expect(csp).toContain("https://example.com");
  expect(csp).toContain("https://test.com");
  // Should NOT contain the malicious injection attempt
  expect(csp).not.toContain("script-src 'unsafe-eval'");
});

test("securityPlugin should handle wildcard origin", async () => {
  process.env.ALLOWED_ORIGINS = "*";
  clearConfigCache();
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  const csp = response.headers.get("Content-Security-Policy") || "";
  // Wildcard should not be included in frame-ancestors
  expect(csp).toContain("frame-ancestors 'self' ");
});

test("securityPlugin should remove X-Frame-Options header", async () => {
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  expect(response.headers.get("X-Frame-Options")).toBeNull();
});

test("securityPlugin should set X-Content-Type-Options header", async () => {
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
});

test("isValidOrigin should validate origin format", async () => {
  process.env.ALLOWED_ORIGINS = "https://example.com,http://localhost:3000,*,not-an-origin";
  clearConfigCache();
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  const csp = response.headers.get("Content-Security-Policy") || "";
  // Should include valid origins
  expect(csp).toContain("https://example.com");
  expect(csp).toContain("http://localhost:3000");
  // Should exclude invalid origin
  expect(csp).not.toContain("not-an-origin");
});

test("securityPlugin should handle empty allowed origins", async () => {
  process.env.ALLOWED_ORIGINS = "";
  clearConfigCache();
  const config = getConfig();
  const app = new Elysia().use((app) => securityPlugin(app, config)).get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  // Should still set CSP header
  expect(response.headers.get("Content-Security-Policy")).toBeDefined();
});

describe("isValidOrigin", () => {
  describe("valid origins", () => {
    test("should accept https URLs", () => {
      expect(isValidOrigin("https://example.com")).toBe(true);
      expect(isValidOrigin("https://www.example.com")).toBe(true);
      expect(isValidOrigin("https://sub.domain.example.com")).toBe(true);
    });

    test("should accept http URLs", () => {
      expect(isValidOrigin("http://example.com")).toBe(true);
      expect(isValidOrigin("http://localhost")).toBe(true);
    });

    test("should accept URLs with ports", () => {
      expect(isValidOrigin("https://example.com:443")).toBe(true);
      expect(isValidOrigin("http://localhost:3000")).toBe(true);
      expect(isValidOrigin("http://localhost:8080")).toBe(true);
      expect(isValidOrigin("https://example.com:65535")).toBe(true);
    });

    test("should accept wildcard", () => {
      expect(isValidOrigin("*")).toBe(true);
    });

    test("should accept CSP keywords", () => {
      expect(isValidOrigin("'self'")).toBe(true);
      expect(isValidOrigin("'none'")).toBe(true);
    });

    test("should accept hostnames with hyphens", () => {
      expect(isValidOrigin("https://my-domain.com")).toBe(true);
      expect(isValidOrigin("https://my-sub-domain.example.com")).toBe(true);
    });
  });

  describe("invalid origins - security threats", () => {
    test("should reject CSP injection attempts", () => {
      // Semicolon injection
      expect(isValidOrigin("https://evil.com;script-src 'unsafe-eval'")).toBe(false);
      // Quote injection
      expect(isValidOrigin("https://evil.com' script-src 'unsafe-eval")).toBe(false);
      // Space injection
      expect(isValidOrigin("https://evil.com script-src")).toBe(false);
    });

    test("should reject javascript protocol", () => {
      expect(isValidOrigin("javascript:alert(1)")).toBe(false);
    });

    test("should reject data protocol", () => {
      expect(isValidOrigin("data:text/html,<script>alert(1)</script>")).toBe(false);
    });

    test("should reject file protocol", () => {
      expect(isValidOrigin("file:///etc/passwd")).toBe(false);
    });

    test("should reject ftp protocol", () => {
      expect(isValidOrigin("ftp://example.com")).toBe(false);
    });

    test("should reject special characters", () => {
      expect(isValidOrigin("https://example.com<script>")).toBe(false);
      expect(isValidOrigin("https://example.com>")).toBe(false);
      expect(isValidOrigin("https://example.com|cmd")).toBe(false);
      expect(isValidOrigin("https://example.com\\path")).toBe(false);
    });
  });

  describe("invalid origins - malformed", () => {
    test("should reject origins without protocol", () => {
      expect(isValidOrigin("example.com")).toBe(false);
      expect(isValidOrigin("www.example.com")).toBe(false);
    });

    test("should reject empty string", () => {
      expect(isValidOrigin("")).toBe(false);
    });

    test("should reject protocol-only", () => {
      expect(isValidOrigin("https://")).toBe(false);
      expect(isValidOrigin("http://")).toBe(false);
    });

    test("should reject origins with paths", () => {
      expect(isValidOrigin("https://example.com/path")).toBe(false);
      expect(isValidOrigin("https://example.com/")).toBe(false);
    });

    test("should reject hostnames starting with hyphen", () => {
      expect(isValidOrigin("https://-example.com")).toBe(false);
    });

    test("should reject hostnames ending with hyphen", () => {
      expect(isValidOrigin("https://example-.com")).toBe(false);
    });

    test("should reject double slashes in hostname", () => {
      expect(isValidOrigin("https://example..com")).toBe(false);
    });
  });
});
