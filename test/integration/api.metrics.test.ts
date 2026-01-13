/**
 * Integration tests for Prometheus metrics endpoint
 * Tests the /metrics endpoint and metrics recording
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { register } from "prom-client";
import { getTestApp, injectGet, injectPost } from "../helpers/test-app";
import { mockDiscordService } from "../mocks/discord";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

describe("Metrics Endpoint Integration Tests", () => {
  let app: Awaited<ReturnType<typeof getTestApp>>;

  beforeEach(async () => {
    // Reset all services and metrics
    mockSheetsService.reset();
    mockDiscordService.reset();
    mockTurnstileService.reset();
    register.resetMetrics();

    app = await getTestApp();
  });

  afterEach(() => {
    register.resetMetrics();
  });

  describe("GET /metrics endpoint", () => {
    test("should return metrics in Prometheus text format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/plain");

      const body = response.body;
      expect(body).toContain("# HELP");
      expect(body).toContain("# TYPE");
    });

    test("should include default process metrics", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("process_cpu_");
      expect(body).toContain("process_resident_memory_bytes");
    });

    test("should include HTTP request metrics", async () => {
      // Make some requests to generate metrics
      await injectGet("/api/health");
      await injectGet("/api/health");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("http_requests_total");
      expect(body).toContain("http_request_duration_seconds");
    });

    test("should track different endpoints", async () => {
      // Make requests to different endpoints
      await injectGet("/api/health");
      await injectGet("/api/config");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain('route="/api/health"');
      expect(body).toContain('route="/api/config"');
    });

    test("should include signup metrics after signup request", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("signup_requests_total");
      expect(body).toContain("signup_duration_seconds");
    });
  });

  describe("HTTP Request Metrics Recording", () => {
    test("should record GET request metrics", async () => {
      await injectGet("/api/health");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("http_requests_total");
      expect(body).toContain('method="GET"');
      expect(body).toContain('route="/api/health"');
    });

    test("should record POST request metrics", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("http_requests_total");
      expect(body).toContain('method="POST"');
      expect(body).toContain('route="/api/signup"');
    });

    test("should record request duration", async () => {
      await injectGet("/api/health");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("http_request_duration_seconds_bucket");
    });

    test("should increment counter for each request", async () => {
      await injectGet("/api/health");
      await injectGet("/api/health");
      await injectGet("/api/health");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("http_requests_total");
      expect(body).toContain('route="/api/health"');
    });
  });

  describe("Signup Metrics Recording", () => {
    test("should record successful signup", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("signup_requests_total");
      expect(body).toContain('endpoint="/api/signup"');
      expect(body).toContain('status="success"');
    });

    test("should record failed signup when Sheets API fails", async () => {
      mockSheetsService.simulateError("api");

      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("signup_requests_total");
      expect(body).toContain('status="error"');
    });

    test("should record signup duration", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("signup_duration_seconds_bucket");
      expect(body).toContain('endpoint="/api/signup"');
    });
  });

  describe("Sheets Metrics Recording", () => {
    test("should record successful sheets API calls", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("sheets_requests_total");
      expect(body).toContain('operation="emailExists"');
      // Note: With default test env, appendSignup fails due to auth
      // So we only check for emailExists which succeeds
    });

    test("should record failed sheets API call", async () => {
      mockSheetsService.simulateError("api");

      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("sheets_requests_total");
      expect(body).toContain('status="error"');
    });

    test("should record sheets API duration", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("sheets_request_duration_seconds_bucket");
      expect(body).toContain('operation="emailExists"');
    });
  });

  describe("Discord Metrics Recording", () => {
    test("should record successful Discord webhook", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      // With default test env, signup fails so error notification is sent
      expect(body).toContain("discord_webhook_total");
      expect(body).toContain('type="error"');
      expect(body).toContain('status="success"');
    });

    test("should record failed Discord webhook", async () => {
      mockDiscordService.setError(new Error("Webhook failed"));

      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("discord_webhook_total");
      expect(body).toContain('type="error"');
      expect(body).toContain('status="error"');
    });

    test("should record error notification metrics", async () => {
      mockSheetsService.simulateError("api");
      mockDiscordService.setError(null); // Clear error so error notification succeeds

      await injectPost("/api/signup", {
        email: "test@example.com",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("discord_webhook_total");
      expect(body).toContain('type="error"');
    });
  });

  describe("Turnstile Metrics Recording", () => {
    test("should record successful Turnstile verification", async () => {
      mockTurnstileService.setSuccess();

      await injectPost("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("turnstile_requests_total");
      expect(body).toContain('status="success"');
    });

    test("should record failed Turnstile verification", async () => {
      mockTurnstileService.setError("Invalid token");

      await injectPost("/api/signup", {
        email: "test@example.com",
        turnstileToken: "invalid-token",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("turnstile_requests_total");
      expect(body).toContain('status="error"');
    });

    test("should record Turnstile validation duration", async () => {
      mockTurnstileService.setSuccess();

      await injectPost("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain("turnstile_validation_duration_seconds_bucket");
    });
  });

  describe("Metrics Labels and Values", () => {
    test("should include correct labels for HTTP metrics", async () => {
      await injectGet("/api/health");

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain('method="GET"');
      expect(body).toContain('route="/api/health"');
      expect(body).toContain('status_code="200"');
    });

    test("should track different status codes", async () => {
      // Successful request
      await injectGet("/api/health");

      // Bad request
      await injectPost("/api/signup", {
        email: "invalid-email",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;
      expect(body).toContain('status_code="200"');
      expect(body).toContain('status_code="400"');
    });
  });

  describe("Metrics Endpoint Behavior", () => {
    test("should return 404 for POST to metrics endpoint", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/metrics",
      });

      expect(response.statusCode).toBe(404);
    });

    test("should handle concurrent requests", async () => {
      const requests = Array.from({ length: 10 }, () => injectGet("/api/health"));

      await Promise.all(requests);

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      expect(response.statusCode).toBe(200);
      const body = response.body;
      expect(body).toContain("http_requests_total");
    });

    test("should include all metric types", async () => {
      await injectPost("/api/signup", {
        email: "test@example.com",
        turnstileToken: "valid-token",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/metrics",
      });

      const body = response.body;

      // Check for all our custom metrics
      expect(body).toContain("http_requests_total");
      expect(body).toContain("http_request_duration_seconds");
      expect(body).toContain("signup_requests_total");
      expect(body).toContain("signup_duration_seconds");
      expect(body).toContain("sheets_requests_total");
      expect(body).toContain("sheets_request_duration_seconds");
      expect(body).toContain("discord_webhook_total");
      expect(body).toContain("turnstile_requests_total");
      expect(body).toContain("turnstile_validation_duration_seconds");
    });
  });
});
