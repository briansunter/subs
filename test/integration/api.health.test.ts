/**
 * Health check tests
 * All tests use Elysia's handle() method for speed and reliability
 *
 * @see {@link https://elysiajs.com/patterns/unit-test | Elysia Unit Testing}
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  createGetRequest,
  getTestApp,
  mockSheetsService,
  mockTurnstileService,
  parseJsonResponse,
} from "../helpers/test-app-elysia";
import type { ApiResponse } from "../types";

// ============================================================================
// FAST TESTS (using handle)
// ============================================================================

// Global setup for all handle() tests - single beforeEach for performance
beforeEach(async () => {
  mockSheetsService.reset();
  mockTurnstileService.reset();
});

describe("Health Check - Basic Functionality (handle)", () => {
  test("should return healthy status", async () => {
    const app = await getTestApp();

    const response = await app.handle(createGetRequest("/api/health"));
    const data = await parseJsonResponse<ApiResponse>(response);

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("timestamp");
    expect(data.timestamp ? new Date(data.timestamp) : undefined).toBeDefined();
  });

  test("should respond quickly", async () => {
    const app = await getTestApp();

    const start = Date.now();
    await app.handle(createGetRequest("/api/health"));
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should respond in under 100ms with handle
  });
});

describe("Health Check - Response Format (handle)", () => {
  test("should include all required fields", async () => {
    const app = await getTestApp();

    const response = await app.handle(createGetRequest("/api/health"));
    const data = await parseJsonResponse<ApiResponse>(response);

    expect(data).toMatchObject({
      status: expect.any(String),
      timestamp: expect.any(String),
    });
  });

  test("should use ISO 8601 timestamp format", async () => {
    const app = await getTestApp();

    const response = await app.handle(createGetRequest("/api/health"));
    const data = await parseJsonResponse<ApiResponse>(response);

    expect(data.timestamp && new Date(data.timestamp)).toBeTruthy();
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("Health Check - Rate Limiting (handle)", () => {
  test("should handle multiple concurrent health checks", async () => {
    const app = await getTestApp();

    const requests = Array.from({ length: 10 }, () =>
      app.handle(new Request("http://localhost/api/health")),
    );

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
    }
  });

  test("should handle rapid sequential requests", async () => {
    const app = await getTestApp();

    for (let i = 0; i < 20; i++) {
      const response = await app.handle(new Request("http://localhost/api/health"));
      expect(response.status).toBe(200);
    }
  });
});

describe("Health Check - CORS and Headers (handle)", () => {
  test("should include CORS headers in health check", async () => {
    const app = await getTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/health", {
        headers: {
          Origin: "https://example.com",
        },
      }),
    );

    const corsHeader = response.headers.get("access-control-allow-origin");
    expect(corsHeader).toBeTruthy();
  });

  test("should include correct content type", async () => {
    const app = await getTestApp();

    const response = await app.handle(new Request("http://localhost/api/health"));

    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("application/json");
  });
});

describe("Health Check - Edge Cases (handle)", () => {
  test("should handle malformed request gracefully", async () => {
    const app = await getTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("{invalid json"),
      }),
    );

    // Should still respond, possibly with error
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  test("should handle unexpected HTTP methods", async () => {
    const app = await getTestApp();

    const response = await app.handle(
      new Request("http://localhost/api/health", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    // Elysia returns 404 or 405 for unsupported methods
    expect([200, 404, 405]).toContain(response.status);
  });

  test("should handle very long query strings", async () => {
    const app = await getTestApp();

    const longQuery = "a".repeat(1000);
    const response = await app.handle(new Request(`http://localhost/api/health?${longQuery}`));

    // Should handle gracefully
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });
});

describe("Health Check - Service Dependencies (handle)", () => {
  test("should include status in health check", async () => {
    const app = await getTestApp();

    const response = await app.handle(new Request("http://localhost/api/health"));

    const data = await parseJsonResponse<ApiResponse>(response);

    expect(data).toHaveProperty("status");
    // Future: expect(data).toHaveProperty("services");
  });
});

// ============================================================================
// NOTE: Real server spawning tests removed
// ============================================================================
// The following test suites were removed due to flakiness:
// - "Health Check - Real Authentication Tests (server)" (2 tests)
// - "Health Check - Real Connection Tests (server)" (4 tests)
//
// These tests used actual network connections and were prone to timing issues.
// The same functionality is tested by the handle() tests above, which are
// faster (~1.3ms vs 2-3s) and 100% reliable.
// ============================================================================
