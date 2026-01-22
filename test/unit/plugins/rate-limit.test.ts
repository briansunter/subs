/**
 * Unit tests for rate limit plugin
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { clearConfigCache, getConfig } from "../../../src/config";
import {
  checkRateLimit,
  cleanupExpiredEntries,
  clearRateLimitStore,
  getClientIp,
  getRateLimitStoreSize,
  rateLimitPlugin,
} from "../../../src/plugins/rate-limit";

beforeEach(() => {
  clearConfigCache();
  clearRateLimitStore();
  // Set test environment variables
  process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
  process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@test.com";
  process.env["GOOGLE_PRIVATE_KEY"] = "test-key";
  process.env["ENABLE_RATE_LIMITING"] = "true";
  process.env["RATE_LIMIT_WINDOW_MS"] = "60000";
  process.env["RATE_LIMIT_MAX_REQUESTS"] = "10";
});

afterEach(() => {
  clearRateLimitStore();
  clearConfigCache();
});

describe("getClientIp", () => {
  test("should return cf-connecting-ip when present", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
        "x-forwarded-for": "5.6.7.8",
      },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  test("should return first IP from x-forwarded-for when cf-connecting-ip absent", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12",
      },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  test("should return x-real-ip when other headers absent", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-real-ip": "1.2.3.4",
      },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  test("should return unknown when no IP headers present", () => {
    const request = new Request("http://localhost/");
    expect(getClientIp(request)).toBe("unknown");
  });

  test("should handle empty x-forwarded-for", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-forwarded-for": "",
      },
    });
    expect(getClientIp(request)).toBe("unknown");
  });

  test("should trim whitespace from IP addresses", () => {
    const request = new Request("http://localhost/", {
      headers: {
        "x-forwarded-for": "  1.2.3.4  , 5.6.7.8",
      },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });
});

describe("checkRateLimit", () => {
  test("should allow first request", () => {
    const result = checkRateLimit("test-ip", 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  test("should track request count", () => {
    checkRateLimit("test-ip", 60000, 10);
    checkRateLimit("test-ip", 60000, 10);
    const result = checkRateLimit("test-ip", 60000, 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(7);
  });

  test("should block when limit exceeded", () => {
    // Make 10 requests to reach the limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit("test-ip", 60000, 10);
    }
    // 11th request should be blocked
    const result = checkRateLimit("test-ip", 60000, 10);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  test("should track IPs independently", () => {
    // Make 10 requests from IP 1
    for (let i = 0; i < 10; i++) {
      checkRateLimit("ip-1", 60000, 10);
    }
    // IP 1 should be blocked
    expect(checkRateLimit("ip-1", 60000, 10).allowed).toBe(false);
    // IP 2 should still be allowed
    expect(checkRateLimit("ip-2", 60000, 10).allowed).toBe(true);
  });

  test("should reset after window expires", async () => {
    // Use a short window for testing
    const shortWindow = 100; // 100ms

    // Make requests to reach limit
    for (let i = 0; i < 3; i++) {
      checkRateLimit("test-ip", shortWindow, 3);
    }
    expect(checkRateLimit("test-ip", shortWindow, 3).allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be allowed again
    const result = checkRateLimit("test-ip", shortWindow, 3);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe("cleanupExpiredEntries", () => {
  test("should remove expired entries", async () => {
    const shortWindow = 50; // 50ms

    // Add some entries
    checkRateLimit("ip-1", shortWindow, 10);
    checkRateLimit("ip-2", shortWindow, 10);
    expect(getRateLimitStoreSize()).toBe(2);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Cleanup should remove expired entries
    cleanupExpiredEntries(shortWindow);
    expect(getRateLimitStoreSize()).toBe(0);
  });

  test("should keep non-expired entries", async () => {
    const longWindow = 60000; // 60 seconds

    // Add entries with long window
    checkRateLimit("ip-1", longWindow, 10);
    checkRateLimit("ip-2", longWindow, 10);

    // Cleanup should keep them
    cleanupExpiredEntries(longWindow);
    expect(getRateLimitStoreSize()).toBe(2);
  });
});

describe("rateLimitPlugin", () => {
  test("should add rate limit headers to response", async () => {
    const config = getConfig();
    const app = new Elysia().use((app) => rateLimitPlugin(app, config)).get("/", () => "Hello");

    const request = new Request("http://localhost/");
    const response = await app.handle(request);

    expect(response.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
  });

  test("should return 429 when rate limited", async () => {
    process.env["RATE_LIMIT_MAX_REQUESTS"] = "3";
    clearConfigCache();
    const config = getConfig();
    const app = new Elysia().use((app) => rateLimitPlugin(app, config)).get("/", () => "Hello");

    // Make requests up to limit
    for (let i = 0; i < 3; i++) {
      const request = new Request("http://localhost/", {
        headers: { "x-forwarded-for": "test-ip" },
      });
      await app.handle(request);
    }

    // Next request should be rate limited
    const request = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "test-ip" },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();

    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain("Too many requests");
  });

  test("should not apply rate limiting when disabled", async () => {
    process.env["ENABLE_RATE_LIMITING"] = "false";
    process.env["RATE_LIMIT_MAX_REQUESTS"] = "1";
    clearConfigCache();
    const config = getConfig();
    const app = new Elysia().use((app) => rateLimitPlugin(app, config)).get("/", () => "Hello");

    // Make multiple requests
    for (let i = 0; i < 5; i++) {
      const request = new Request("http://localhost/");
      const response = await app.handle(request);
      expect(response.status).toBe(200);
    }
  });

  test("should track different IPs separately", async () => {
    process.env["RATE_LIMIT_MAX_REQUESTS"] = "2";
    clearConfigCache();
    const config = getConfig();
    const app = new Elysia().use((app) => rateLimitPlugin(app, config)).get("/", () => "Hello");

    // Exhaust limit for IP 1
    for (let i = 0; i < 2; i++) {
      const request = new Request("http://localhost/", {
        headers: { "x-forwarded-for": "ip-1" },
      });
      await app.handle(request);
    }

    // IP 1 should be blocked
    const request1 = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "ip-1" },
    });
    const response1 = await app.handle(request1);
    expect(response1.status).toBe(429);

    // IP 2 should still be allowed
    const request2 = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "ip-2" },
    });
    const response2 = await app.handle(request2);
    expect(response2.status).toBe(200);
  });

  test("should use cf-connecting-ip header for Cloudflare", async () => {
    process.env["RATE_LIMIT_MAX_REQUESTS"] = "2";
    clearConfigCache();
    const config = getConfig();
    const app = new Elysia().use((app) => rateLimitPlugin(app, config)).get("/", () => "Hello");

    // Make requests with Cloudflare header
    for (let i = 0; i < 2; i++) {
      const request = new Request("http://localhost/", {
        headers: { "cf-connecting-ip": "cf-ip" },
      });
      await app.handle(request);
    }

    // Should be rate limited based on cf-connecting-ip
    const request = new Request("http://localhost/", {
      headers: { "cf-connecting-ip": "cf-ip" },
    });
    const response = await app.handle(request);
    expect(response.status).toBe(429);
  });
});

describe("clearRateLimitStore", () => {
  test("should clear all entries", () => {
    checkRateLimit("ip-1", 60000, 10);
    checkRateLimit("ip-2", 60000, 10);
    expect(getRateLimitStoreSize()).toBe(2);

    clearRateLimitStore();
    expect(getRateLimitStoreSize()).toBe(0);
  });
});
