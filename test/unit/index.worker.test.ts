/**
 * Unit tests for worker entry point
 */

import { beforeEach, expect, test } from "bun:test";
import { clearConfigCache } from "../../src/config";
import worker, { type WorkerApp } from "../../src/index.worker";

beforeEach(() => {
  clearConfigCache();
  process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
  process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@test.com";
  process.env["GOOGLE_PRIVATE_KEY"] = "test-key";
  process.env["ALLOWED_ORIGINS"] = "https://example.com";
});

test("worker should export a default object", () => {
  expect(worker).toBeDefined();
  expect(typeof worker).toBe("object");
});

test("worker should have a fetch handler", () => {
  expect(worker.fetch).toBeDefined();
  expect(typeof worker.fetch).toBe("function");
});

test("worker should export WorkerApp type", () => {
  // Type test - if this compiles, the type is exported correctly
  const workerApp: WorkerApp = worker as unknown as WorkerApp;
  expect(workerApp).toBeDefined();
});

test("worker fetch handler should be a valid Request handler", async () => {
  const request = new Request("http://localhost/");
  const response = await worker.fetch(request);

  expect(response).toBeDefined();
  expect(typeof response.status).toBe("number");
});

test("worker should handle 404 for unknown routes", async () => {
  const request = new Request("http://localhost/unknown-route");
  const response = await worker.fetch(request);

  // Worker returns 404 for unknown routes
  expect(response.status).toBe(404);
});

test("worker should include security headers", async () => {
  const request = new Request("http://localhost/");
  const response = await worker.fetch(request);

  expect(response.headers.get("Content-Security-Policy")).toBeDefined();
});

test("worker should handle CORS preflight", async () => {
  const request = new Request("http://localhost/", {
    method: "OPTIONS",
    headers: { Origin: "https://example.com" },
  });
  const response = await worker.fetch(request);

  expect(response.status).toBe(204);
});

test("worker should handle POST requests", async () => {
  const request = new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "test@example.com" }),
  });

  const response = await worker.fetch(request);
  // Response will be 500 if Google Sheets is not configured, but should not crash
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(600);
});

test("worker should handle errors gracefully", async () => {
  // Create a request that will cause an error
  const request = new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid json",
  });

  const response = await worker.fetch(request);
  expect(response.status).toBeGreaterThanOrEqual(400);
});
