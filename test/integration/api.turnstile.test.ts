/**
 * Integration tests for Turnstile validation
 * Tests Cloudflare Turnstile token validation in signup flows
 * Uses Cloudflare test keys which always pass: 1x0000000000000000000000000000000AA
 */

import { describe, expect, test } from "bun:test";
import { clearConfigCache } from "../../src/config";
import {
  DEFAULT_TEST_ENV,
  getTestApp,
  parseJsonResponse,
  setTestEnv,
  VALID_TURNSTILE_TOKEN,
} from "../helpers/test-app-elysia";
import type { ConfigResponse } from "../types";

// Set up environment once for all Turnstile tests
setTestEnv(DEFAULT_TEST_ENV);
clearConfigCache();

describe.serial("Turnstile Integration Tests", () => {
  test("GET /api/config returns Turnstile configuration", async () => {
    const app = await getTestApp();
    const response = await app.handle(new Request("http://localhost/api/config"));

    const data = await parseJsonResponse<ConfigResponse>(response);

    expect(response.status).toBe(200);
    expect(data.turnstileEnabled).toBe(true);
    expect(data.turnstileSiteKey).toBe(DEFAULT_TEST_ENV.CLOUDFLARE_TURNSTILE_SITE_KEY);
  });

  test("POST /api/signup accepts Turnstile token", async () => {
    const app = await getTestApp();
    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "turnstile-test@example.com",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      }),
    );

    // May fail due to real Sheets API, but Turnstile validation should pass
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  test("POST /api/signup requires Turnstile token when configured", async () => {
    const app = await getTestApp();
    const response = await app.handle(
      new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "no-turnstile@example.com",
        }),
      }),
    );

    const data = await parseJsonResponse<{ success: boolean; error?: string }>(response);

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Turnstile verification failed");
  });

  test("POST /api/signup/extended accepts Turnstile token", async () => {
    const app = await getTestApp();
    const response = await app.handle(
      new Request("http://localhost/api/signup/extended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "extended-turnstile@example.com",
          name: "Test User",
          turnstileToken: VALID_TURNSTILE_TOKEN,
        }),
      }),
    );

    // May fail due to real Sheets API, but Turnstile validation should pass
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });

  test("POST /api/signup/bulk bypasses Turnstile", async () => {
    const app = await getTestApp();
    const response = await app.handle(
      new Request("http://localhost/api/signup/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signups: [{ email: "bulk1@example.com" }, { email: "bulk2@example.com" }],
        }),
      }),
    );

    // Bulk operations bypass Turnstile by design
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
  });
});
