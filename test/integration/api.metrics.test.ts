/**
 * Integration tests for Prometheus metrics endpoint
 * Tests the /metrics endpoint and metrics recording
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearConfigCache,
  createGetRequest,
  createPostRequest,
  DEFAULT_TEST_ENV,
  getTestApp,
  setTestEnv,
} from "../helpers/test-app-elysia";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

// Setup environment variables for all tests
setTestEnv(DEFAULT_TEST_ENV);
clearConfigCache();

// Global setup for all tests in this file
beforeEach(async () => {
  mockSheetsService.reset();
  mockTurnstileService.reset();
  // Note: We don't reset metrics here because we're testing that metrics ARE recorded
  // The unit tests in test/unit/services/metrics.test.ts handle testing the metrics functions themselves
});

describe("Metrics Endpoint", () => {
  test("should return metrics in Prometheus text format", async () => {
    const app = await getTestApp();
    const response = await app.handle(createGetRequest("/api/metrics"));

    expect(response.status).toBe(200);
    const contentType = response.headers.get("content-type");
    expect(contentType).toContain("text/plain");

    const text = await response.text();
    expect(text).toContain("# HELP");
    expect(text).toContain("# TYPE");
  });

  test("should include default process metrics", async () => {
    const app = await getTestApp();
    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("process_cpu_");
    expect(text).toContain("process_resident_memory_bytes");
  });

  test("should return 404 for POST to metrics endpoint", async () => {
    const app = await getTestApp();
    const response = await app.handle(
      new Request("http://localhost/api/metrics", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("HTTP Request Metrics", () => {
  test("should record GET request metrics", async () => {
    const app = await getTestApp();

    await app.handle(createGetRequest("/api/health"));

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("http_requests_total");
    expect(text).toContain('method="GET"');
    expect(text).toContain('route="/api/health"');
  });

  test("should record POST request metrics", async () => {
    const app = await getTestApp();

    await app.handle(
      createPostRequest("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      }),
    );

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("http_requests_total");
    expect(text).toContain('method="POST"');
  });

  test("should track request duration", async () => {
    const app = await getTestApp();

    await app.handle(createGetRequest("/api/health"));

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("http_request_duration_seconds_bucket");
  });
});

describe("Signup Metrics", () => {
  test("should record successful signup metrics", async () => {
    const app = await getTestApp();

    await app.handle(
      createPostRequest("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      }),
    );

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("signup_requests_total");
    expect(text).toContain('status="success"');
    expect(text).toContain("signup_duration_seconds");
  });
});

describe("Sheets API Metrics", () => {
  test("should record sheets API calls", async () => {
    const app = await getTestApp();

    await app.handle(
      createPostRequest("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      }),
    );

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("sheets_requests_total");
    expect(text).toContain('operation="emailExists"');
    expect(text).toContain('status="success"');
  });
});

describe("Turnstile Metrics", () => {
  test("should record Turnstile verification", async () => {
    const app = await getTestApp();

    mockTurnstileService.setSuccess();

    await app.handle(
      createPostRequest("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      }),
    );

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain("turnstile_requests_total");
    expect(text).toContain('status="success"');
  });
});

describe("Metrics Labels", () => {
  test("should include correct labels for HTTP metrics", async () => {
    const app = await getTestApp();

    await app.handle(createGetRequest("/api/health"));

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain('method="GET"');
    expect(text).toContain('route="/api/health"');
    expect(text).toContain('status_code="200"');
  });

  test("should track different status codes", async () => {
    const app = await getTestApp();

    await app.handle(createGetRequest("/api/health"));
    await app.handle(
      createPostRequest("/api/signup", {
        email: "invalid",
      }),
    );

    const response = await app.handle(createGetRequest("/api/metrics"));
    const text = await response.text();

    expect(text).toContain('status_code="200"');
    expect(text).toContain('status_code="400"');
  });
});
