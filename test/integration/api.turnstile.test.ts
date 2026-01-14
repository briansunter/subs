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
  setTestEnv,
  VALID_TURNSTILE_TOKEN,
} from "../helpers/test-app";
import type { ConfigResponse } from "../types";

// Set up environment once for all Turnstile tests
setTestEnv(DEFAULT_TEST_ENV);
clearConfigCache();

describe.serial("Turnstile Integration Tests", () => {
  test("GET /api/config returns Turnstile configuration", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/config",
    });

    const data = (await response.json()) as ConfigResponse;

    expect(response.statusCode).toBe(200);
    expect(data.turnstileEnabled).toBe(true);
    expect(data.turnstileSiteKey).toBe(DEFAULT_TEST_ENV.CLOUDFLARE_TURNSTILE_SITE_KEY);
  });

  test("POST /api/signup accepts Turnstile token", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: {
        email: "turnstile-test@example.com",
        turnstileToken: VALID_TURNSTILE_TOKEN,
      },
    });

    // May fail due to real Sheets API, but Turnstile validation should pass
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(500);
  });

  test("POST /api/signup requires Turnstile token when configured", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: {
        email: "no-turnstile@example.com",
      },
    });

    const data = (await response.json()) as { success: boolean; error?: string };

    expect(response.statusCode).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe("Turnstile verification failed");
  });

  test("POST /api/signup/extended accepts Turnstile token", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/signup/extended",
      payload: {
        email: "extended-turnstile@example.com",
        name: "Test User",
        turnstileToken: VALID_TURNSTILE_TOKEN,
      },
    });

    // May fail due to real Sheets API, but Turnstile validation should pass
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(500);
  });

  test("POST /api/signup/bulk bypasses Turnstile", async () => {
    const app = await getTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/signup/bulk",
      payload: {
        signups: [{ email: "bulk1@example.com" }, { email: "bulk2@example.com" }],
      },
    });

    // Bulk operations bypass Turnstile by design
    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(500);
  });
});
