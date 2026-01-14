/**
 * Integration tests for Prometheus metrics endpoint
 * Tests the /metrics endpoint and metrics recording
 *
 * Optimization: Single beforeEach for all tests to minimize overhead
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { register } from "../../src/services/metrics";
import { clearConfigCache, DEFAULT_TEST_ENV, getTestApp, setTestEnv } from "../helpers/test-app";
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

// Setup environment variables for all tests
setTestEnv(DEFAULT_TEST_ENV);
clearConfigCache();

// Global setup for all tests in this file
beforeEach(async () => {
  mockSheetsService.reset();
  mockDiscordService.reset();
  mockTurnstileService.reset();
  register.resetMetrics();
});

describe("Metrics Endpoint", () => {
  test("should return metrics in Prometheus text format", async () => {
    const app = await getTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/metrics",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("# HELP");
    expect(response.body).toContain("# TYPE");
  });

  test("should include default process metrics", async () => {
    const app = await getTestApp();

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("process_cpu_");
    expect(response.body).toContain("process_resident_memory_bytes");
  });

  test("should return 404 for POST to metrics endpoint", async () => {
    const app = await getTestApp();

    const response = await app.inject({ method: "POST", url: "/metrics" });
    expect(response.statusCode).toBe(404);
  });
});

describe("HTTP Request Metrics", () => {
  test("should record GET request metrics", async () => {
    const app = await getTestApp();

    await app.inject({ method: "GET", url: "/api/health" });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("http_requests_total");
    expect(response.body).toContain('method="GET"');
    expect(response.body).toContain('route="/api/health"');
  });

  test("should record POST request metrics", async () => {
    const app = await getTestApp();

    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "test@example.com", turnstileToken: "valid-token" },
    });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("http_requests_total");
    expect(response.body).toContain('method="POST"');
  });

  test("should track request duration", async () => {
    const app = await getTestApp();

    await app.inject({ method: "GET", url: "/api/health" });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("http_request_duration_seconds_bucket");
  });
});

describe("Signup Metrics", () => {
  test("should record successful signup metrics", async () => {
    const app = await getTestApp();

    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "test@example.com", turnstileToken: "valid-token" },
    });

    await mockDiscordService.waitForPendingNotifications();

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("signup_requests_total");
    expect(response.body).toContain('status="success"');
    expect(response.body).toContain("signup_duration_seconds");
  });
});

describe("Sheets API Metrics", () => {
  test("should record sheets API calls", async () => {
    const app = await getTestApp();

    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "test@example.com", turnstileToken: "valid-token" },
    });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("sheets_requests_total");
    expect(response.body).toContain('operation="emailExists"');
    expect(response.body).toContain('status="success"');
  });
});

describe("Discord Webhook Metrics", () => {
  test("should record successful webhook notification", async () => {
    const app = await getTestApp();
    mockTurnstileService.setSuccess();

    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "test@example.com", turnstileToken: "valid-token" },
    });

    await mockDiscordService.waitForPendingNotifications();

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("discord_webhook_total");
    expect(response.body).toContain('type="signup"');
    expect(response.body).toContain('status="success"');
  });
});

describe("Turnstile Metrics", () => {
  test("should record Turnstile verification", async () => {
    const app = await getTestApp();

    mockTurnstileService.setSuccess();

    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "test@example.com", turnstileToken: "valid-token" },
    });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain("turnstile_requests_total");
    expect(response.body).toContain('status="success"');
  });
});

describe("Metrics Labels", () => {
  test("should include correct labels for HTTP metrics", async () => {
    const app = await getTestApp();

    await app.inject({ method: "GET", url: "/api/health" });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain('method="GET"');
    expect(response.body).toContain('route="/api/health"');
    expect(response.body).toContain('status_code="200"');
  });

  test("should track different status codes", async () => {
    const app = await getTestApp();

    await app.inject({ method: "GET", url: "/api/health" });
    await app.inject({
      method: "POST",
      url: "/api/signup",
      payload: { email: "invalid" },
    });

    const response = await app.inject({ method: "GET", url: "/api/metrics" });

    expect(response.body).toContain('status_code="200"');
    expect(response.body).toContain('status_code="400"');
  });
});
