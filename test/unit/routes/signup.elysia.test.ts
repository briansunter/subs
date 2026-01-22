/**
 * Unit tests for signup.elysia.ts route definitions
 *
 * Tests route configuration, feature guards, and content type headers
 * without testing the full handler logic (which is tested in handlers.test.ts)
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { clearConfigCache } from "../../../src/config";
import type { SignupContext } from "../../../src/routes/handlers";
import { createSignupRoutes } from "../../../src/routes/signup.elysia";
import { mockSheetsService } from "../../mocks/sheets";
import { mockTurnstileService } from "../../mocks/turnstile";

let mockContext: SignupContext;

beforeEach(() => {
  clearConfigCache();
  mockSheetsService.reset();
  mockTurnstileService.reset();

  // Set test environment variables
  process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
  process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@test.com";
  process.env["GOOGLE_PRIVATE_KEY"] = "test-key";
  process.env["ENABLE_EXTENDED_SIGNUP"] = "true";
  process.env["ENABLE_BULK_SIGNUP"] = "true";
  process.env["ENABLE_METRICS"] = "true";
  process.env["ENABLE_HSTS"] = "true";
  process.env["ENABLE_RATE_LIMITING"] = "false"; // Disable for route tests

  mockContext = {
    sheets: {
      appendSignup: mockSheetsService.appendSignup,
      emailExists: mockSheetsService.emailExists,
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
      enableExtendedSignup: true,
      enableBulkSignup: true,
      enableMetrics: true,
      enableHsts: true,
      enableRateLimiting: false,
      rateLimitWindowMs: 60000,
      rateLimitMaxRequests: 100,
    },
  };
});

afterEach(() => {
  clearConfigCache();
});

describe("Route Configuration", () => {
  test("should serve HTML form at root path", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const body = await response.text();
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain("signupForm");
  });

  test("should serve embed script at /embed.js", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/embed.js"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    const body = await response.text();
    expect(body).toContain("SignupEmbed");
  });

  test("should return health check at /api/health", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/health"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("should return config at /api/config", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/config"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      turnstileEnabled: boolean;
      defaultSheetTab: string;
    };
    expect(body.defaultSheetTab).toBe("Sheet1");
    expect(body.turnstileEnabled).toBe(false);
  });
});

describe("Feature Guards", () => {
  describe("Extended Signup", () => {
    test("should return 404 when extended signup is disabled", async () => {
      const disabledContext: SignupContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          enableExtendedSignup: false,
        },
      };
      const app = createSignupRoutes(disabledContext);

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      );

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });

    test("should allow extended signup when enabled", async () => {
      const app = createSignupRoutes(mockContext);

      const response = await app.handle(
        new Request("http://localhost/api/signup/extended", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      );

      // Should not be 404 (could be 200 or validation error depending on request)
      expect(response.status).not.toBe(404);
    });
  });

  describe("Bulk Signup", () => {
    test("should return 404 when bulk signup is disabled", async () => {
      const disabledContext: SignupContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          enableBulkSignup: false,
        },
      };
      const app = createSignupRoutes(disabledContext);

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups: [{ email: "test@example.com" }] }),
        }),
      );

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });

    test("should allow bulk signup when enabled", async () => {
      const app = createSignupRoutes(mockContext);

      const response = await app.handle(
        new Request("http://localhost/api/signup/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signups: [{ email: "test@example.com" }] }),
        }),
      );

      // Should not be 404
      expect(response.status).not.toBe(404);
    });
  });

  describe("Metrics", () => {
    test("should return 404 when metrics are disabled", async () => {
      const disabledContext: SignupContext = {
        ...mockContext,
        config: {
          ...mockContext.config,
          enableMetrics: false,
        },
      };
      const app = createSignupRoutes(disabledContext);

      const response = await app.handle(new Request("http://localhost/api/metrics"));

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });

    test("should return metrics when enabled", async () => {
      const app = createSignupRoutes(mockContext);

      const response = await app.handle(new Request("http://localhost/api/metrics"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
    });
  });
});

describe("Content Type Headers", () => {
  test("should return HTML content type for form", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/"));

    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  test("should return JavaScript content type for embed script", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/embed.js"));

    expect(response.headers.get("Content-Type")).toBe("application/javascript; charset=utf-8");
  });

  test("should return text/plain content type for metrics", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/metrics"));

    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });
});

describe("Validation", () => {
  test("should return 400 for invalid signup email", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });

  test("should return 400 for missing email", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
  });
});

describe("Embed Script Dynamic URL", () => {
  test("should use request host in embed script", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://mysite.com/embed.js"));

    const body = await response.text();
    expect(body).toContain("http://mysite.com");
  });

  test("should handle https protocol", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("https://secure.example.com/embed.js"));

    const body = await response.text();
    expect(body).toContain("https://secure.example.com");
  });
});
