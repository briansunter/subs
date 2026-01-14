/**
 * Unit tests for Prometheus metrics service
 * Tests PRODUCTION code (src/services/metrics.ts)
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  decrementActiveSignups,
  incrementActiveSignups,
  recordHttpRequest,
  recordSheetsRequest,
  recordSignup,
  recordTurnstileVerification,
  register,
} from "../../../src/services/metrics";

describe.serial("Metrics Service - Unit Tests", () => {
  beforeEach(() => {
    // Clear all metrics before each test
    register.resetMetrics();
  });

  describe("HTTP Request Metrics", () => {
    test("should record HTTP request", async () => {
      recordHttpRequest("POST", "/api/signup", 200, 0.123);

      const metrics = await register.metrics();
      expect(metrics).toContain(
        `http_requests_total{method="POST",route="/api/signup",status_code="200"} 1`,
      );
    });

    test("should record HTTP request duration", async () => {
      recordHttpRequest("POST", "/api/signup", 200, 0.456);

      const metrics = await register.metrics();
      expect(metrics).toContain("http_request_duration_seconds");
      expect(metrics).toContain(`method="POST"`);
      expect(metrics).toContain(`route="/api/signup"`);
    });

    test("should increment counter for each request", async () => {
      recordHttpRequest("GET", "/api/health", 200, 0.01);
      recordHttpRequest("GET", "/api/health", 200, 0.02);
      recordHttpRequest("GET", "/api/health", 200, 0.03);

      const metrics = await register.metrics();
      expect(metrics).toContain(
        `http_requests_total{method="GET",route="/api/health",status_code="200"} 3`,
      );
    });

    test("should track different status codes", async () => {
      recordHttpRequest("POST", "/api/signup", 200, 0.1);
      recordHttpRequest("POST", "/api/signup", 400, 0.05);
      recordHttpRequest("POST", "/api/signup", 500, 0.02);

      const metrics = await register.metrics();
      // Check for specific route with each status code to avoid test isolation issues
      expect(metrics).toContain(
        `http_requests_total{method="POST",route="/api/signup",status_code="200"} 1`,
      );
      expect(metrics).toContain(
        `http_requests_total{method="POST",route="/api/signup",status_code="400"} 1`,
      );
      expect(metrics).toContain(
        `http_requests_total{method="POST",route="/api/signup",status_code="500"} 1`,
      );
    });
  });

  describe("Signup Metrics", () => {
    test("should record signup request", async () => {
      recordSignup("/api/signup", true, 0.5);

      const metrics = await register.metrics();
      expect(metrics).toContain(`signup_requests_total{endpoint="/api/signup",status="success"} 1`);
    });

    test("should record failed signup", async () => {
      recordSignup("/api/signup", false, 0.2);

      const metrics = await register.metrics();
      expect(metrics).toContain(`signup_requests_total{endpoint="/api/signup",status="error"} 1`);
    });

    test("should record signup duration", async () => {
      recordSignup("/api/signup/extended", true, 1.234);

      const metrics = await register.metrics();
      expect(metrics).toContain("signup_duration_seconds");
      expect(metrics).toContain(`endpoint="/api/signup/extended"`);
    });

    test("should track multiple signups", async () => {
      recordSignup("/api/signup", true, 0.5);
      recordSignup("/api/signup", true, 0.6);
      recordSignup("/api/signup", false, 0.1);

      const metrics = await register.metrics();
      expect(metrics).toContain(`status="success"} 2`);
      expect(metrics).toContain(`status="error"} 1`);
    });
  });

  describe("Google Sheets Metrics", () => {
    test("should record sheets request", async () => {
      recordSheetsRequest("appendSignup", true, 0.8);

      const metrics = await register.metrics();
      expect(metrics).toContain(
        `sheets_requests_total{operation="appendSignup",status="success"} 1`,
      );
    });

    test("should record failed sheets request", async () => {
      recordSheetsRequest("emailExists", false, 1.2);

      const metrics = await register.metrics();
      expect(metrics).toContain(`sheets_requests_total{operation="emailExists",status="error"} 1`);
    });

    test("should record sheets request duration", async () => {
      recordSheetsRequest("getSignupStats", true, 2.5);

      const metrics = await register.metrics();
      expect(metrics).toContain("sheets_request_duration_seconds");
      expect(metrics).toContain(`operation="getSignupStats"`);
    });

    test("should track different operations", async () => {
      recordSheetsRequest("emailExists", true, 0.3);
      recordSheetsRequest("appendSignup", true, 0.8);
      recordSheetsRequest("getSignupStats", true, 1.5);

      const metrics = await register.metrics();
      expect(metrics).toContain(`operation="emailExists"`);
      expect(metrics).toContain(`operation="appendSignup"`);
      expect(metrics).toContain(`operation="getSignupStats"`);
    });
  });

  describe("Turnstile Metrics", () => {
    test("should record successful Turnstile verification", async () => {
      recordTurnstileVerification(true, 0.3);

      const metrics = await register.metrics();
      expect(metrics).toContain(`turnstile_requests_total{status="success"} 1`);
    });

    test("should record failed Turnstile verification", async () => {
      recordTurnstileVerification(false, 0.5);

      const metrics = await register.metrics();
      expect(metrics).toContain(`turnstile_requests_total{status="error"} 1`);
    });

    test("should record Turnstile validation duration", async () => {
      recordTurnstileVerification(true, 0.789);

      const metrics = await register.metrics();
      expect(metrics).toContain("turnstile_validation_duration_seconds");
    });
  });

  describe("Active Signups Gauge", () => {
    test("should increment active signups", async () => {
      incrementActiveSignups();

      const metrics = await register.metrics();
      expect(metrics).toContain("active_signups 1");
    });

    test("should decrement active signups", async () => {
      incrementActiveSignups();
      incrementActiveSignups();
      decrementActiveSignups();

      const metrics = await register.metrics();
      expect(metrics).toContain("active_signups 1");
    });

    test("should handle multiple increments and decrements", async () => {
      incrementActiveSignups();
      incrementActiveSignups();
      incrementActiveSignups();
      decrementActiveSignups();

      const metrics = await register.metrics();
      expect(metrics).toContain("active_signups 2");
    });
  });

  describe("Metrics Registry", () => {
    test("should include default process metrics", async () => {
      const metrics = await register.metrics();

      // Check for some default Prometheus metrics
      expect(metrics).toContain("process_cpu_");
      expect(metrics).toContain("process_resident_memory_bytes");
    });

    test("should return metrics in Prometheus text format", async () => {
      recordHttpRequest("GET", "/api/health", 200, 0.01);

      const metrics = await register.metrics();

      // Should have HELP comments
      expect(metrics).toContain("# HELP");
      // Should have TYPE comments
      expect(metrics).toContain("# TYPE");
      // Should have metric values
      expect(metrics).toContain("http_requests_total");
    });
  });
});
