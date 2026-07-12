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
import { MAX_TURNSTILE_TOKEN_LENGTH } from "../../../src/schemas/signup";
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
  process.env["ENABLE_METRICS"] = "true";

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
      nodeEnv: "test",
      logLevel: "silent",
      allowedSheets: new Map(),
      sheetTabs: ["Sheet1"],
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
    const body = (await response.json()) as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ok");
  });

  test("should return stats at /api/stats", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/stats?sheetTab=Sheet1"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      data: { total: number; sheetTab: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.sheetTab).toBe("Sheet1");
  });

  test("should return config at /api/config", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/config"));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      turnstileEnabled: boolean;
      defaultSheetTab: string;
      sheetTabs: string[];
    };
    expect(body.defaultSheetTab).toBe("Sheet1");
    expect(body.turnstileEnabled).toBe(false);
    expect(body.sheetTabs).toEqual(["Sheet1"]);
  });
});

describe("Feature Guards", () => {
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

      const response = await app.handle(new Request("http://localhost/metrics"));

      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: string };
      expect(body.error).toBe("Not found");
    });

    test("should return metrics when enabled", async () => {
      const app = createSignupRoutes(mockContext);

      const response = await app.handle(new Request("http://localhost/metrics"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/plain");
    });
  });

  describe("Extended and Bulk Signup", () => {
    test("should allow extended signup (always enabled)", async () => {
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

    test("should allow bulk signup (always enabled)", async () => {
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
    const response = await app.handle(new Request("http://localhost/metrics"));

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

  test("should return 400 for missing stats sheetTab", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/stats"));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
  });

  test("should return 400 for an invalid stats sheetTab with forbidden characters", async () => {
    const app = createSignupRoutes(mockContext);
    const response = await app.handle(new Request("http://localhost/api/stats?sheetTab=Bad/Tab"));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
  });
});

describe("Turnstile token length limit", () => {
  test("should reject an overlong request-level token without calling any service", async () => {
    // Turnstile is configured, so the token would reach Cloudflare if schema
    // validation let it through. The length cap must reject it first.
    const secureContext: SignupContext = {
      ...mockContext,
      config: {
        ...mockContext.config,
        turnstileSecretKey: "test-secret",
        turnstileSiteKey: "test-site-key",
      },
    };
    const app = createSignupRoutes(secureContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH + 1),
        }),
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      success: boolean;
      error: string;
      details?: string[];
    };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
    expect(body.details?.some((d) => d.includes("Turnstile token is too long"))).toBe(true);

    // The overlong token is rejected before any service is contacted: Cloudflare
    // Turnstile is never asked to verify it, and Sheets is never read or written.
    expect(mockTurnstileService.getCallCount()).toBe(0);
    expect(mockSheetsService.getEmailExistsCalls()).toBe(0);
    expect(mockSheetsService.getAppendSignupCalls()).toBe(0);
  });

  test("should accept a Turnstile token at exactly the maximum length", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH),
        }),
      }),
    );

    expect(response.status).toBe(200);
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

describe("Form POST Endpoint", () => {
  test("should accept application/x-www-form-urlencoded", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "email=test@example.com&name=Test&sheetTab=Sheet1",
      }),
    );

    // Should not be 415 (unsupported media type)
    expect(response.status).not.toBe(415);
  });

  test("should reject unsupported content type", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "email=test@example.com",
      }),
    );

    expect(response.status).toBe(415);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Unsupported Media Type");
  });

  test("should accept mixed-case application/x-www-form-urlencoded", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": "Application/X-WWW-Form-Urlencoded" },
        body: "email=test@example.com&name=Test&sheetTab=Sheet1",
      }),
    );

    expect(response.status).toBe(200);
  });

  test("should accept application/x-www-form-urlencoded with charset parameter", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
        body: "email=test@example.com&name=Test&sheetTab=Sheet1",
      }),
    );

    expect(response.status).toBe(200);
  });

  test("should accept multipart/form-data with boundary parameter", async () => {
    const app = createSignupRoutes(mockContext);
    const boundary = "TestBoundary123";

    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="email"',
      "",
      "test@example.com",
      `--${boundary}`,
      'Content-Disposition: form-data; name="name"',
      "",
      "Test",
      `--${boundary}`,
      'Content-Disposition: form-data; name="sheetTab"',
      "",
      "Sheet1",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
      }),
    );

    expect(response.status).toBe(200);
  });

  test("should reject a near-miss content type containing the form-urlencoded substring", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded-extra" },
        body: "email=test@example.com&name=Test&sheetTab=Sheet1",
      }),
    );

    expect(response.status).toBe(415);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Unsupported Media Type");
  });

  test("should return 400 for multipart/form-data missing its boundary parameter", async () => {
    const app = createSignupRoutes(mockContext);

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        // multipart media type with no boundary -> body cannot be parsed
        headers: { "Content-Type": "multipart/form-data" },
        body: "email=test@example.com&name=Test",
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Malformed request body");
  });

  test("should return 400 for a malformed multipart body that does not match its boundary", async () => {
    const app = createSignupRoutes(mockContext);
    const boundary = "TestBoundary123";

    const response = await app.handle(
      new Request("http://localhost/api/signup/form", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        // Body lacks the boundary markers, so parsing fails
        body: "this is not a valid multipart payload\r\n",
      }),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Malformed request body");
  });
});
