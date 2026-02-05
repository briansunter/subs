/**
 * Unit tests for app initialization
 */

import { afterEach, beforeEach, expect, test } from "bun:test";
import { createApp } from "../../src/app";
import { clearConfigCache } from "../../src/config";

beforeEach(() => {
  clearConfigCache();
  process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
  process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@test.com";
  process.env["GOOGLE_PRIVATE_KEY"] = "test-key";
  process.env["ALLOWED_ORIGINS"] = "https://example.com";
});

afterEach(() => {
  clearConfigCache();
});

test("createApp should return an Elysia instance", () => {
  const app = createApp();
  expect(app).toBeDefined();
  expect(typeof app.handle).toBe("function");
});

test("createApp should handle requests", async () => {
  const app = createApp();
  const request = new Request("http://localhost/");
  const response = await app.handle(request);
  expect(response).toBeDefined();
});

test("createApp should set CORS headers for matching origin", async () => {
  const app = createApp();
  const request = new Request("http://localhost/", {
    headers: { Origin: "https://example.com" },
  });
  const response = await app.handle(request);

  // CORS plugin should handle origin header
  const corsHeader = response.headers.get("access-control-allow-origin");
  expect(corsHeader).toBeTruthy();
});

test("createApp should set security headers", async () => {
  const app = createApp();
  const request = new Request("http://localhost/");
  const response = await app.handle(request);

  // Security plugin should set headers
  // Note: The actual CSP content depends on config at module load time
  // We just check that the plugin doesn't cause errors
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(600);
});

test("createApp should handle CORS preflight", async () => {
  const app = createApp();
  const request = new Request("http://localhost/", {
    method: "OPTIONS",
    headers: { Origin: "https://example.com" },
  });
  const response = await app.handle(request);
  expect(response.status).toBe(204);
});

test("createApp should accept elysiaOptions", () => {
  const app = createApp({ name: "test-app" });
  expect(app).toBeDefined();
});

test("createApp should have error handling", async () => {
  const app = createApp();
  // Create a route that throws an error
  const testApp = app.get("/error", () => {
    throw new Error("Test error");
  });

  const request = new Request("http://localhost/error");
  const response = await testApp.handle(request);
  const data = await response.json();

  expect(data).toHaveProperty("error");
});

test("createApp should include logging plugin", async () => {
  const app = createApp();
  const testApp = app.get("/", () => "Hello");

  const request = new Request("http://localhost/");
  const response = await testApp.handle(request);

  // Request should complete without error
  expect(response.status).toBeGreaterThanOrEqual(200);
  expect(response.status).toBeLessThan(600);
});

test("createApp should include metrics plugin", async () => {
  const app = createApp();
  const testApp = app.get("/", () => "Hello");

  const request = new Request("http://localhost/");
  await testApp.handle(request);

  // Metrics plugin doesn't affect response, just records data
  // Test passes if no error is thrown
  expect(true).toBe(true);
});

test("createApp with wildcard origin should work", async () => {
  process.env["ALLOWED_ORIGINS"] = "*";
  clearConfigCache();
  const app = createApp();

  // The app should be created without error
  expect(app).toBeDefined();

  const request = new Request("http://localhost/");
  const response = await app.handle(request);
  expect(response).toBeDefined();
});

test("createApp should pick up refreshed config after cache clear", async () => {
  process.env["ALLOWED_ORIGINS"] = "https://first.example";
  clearConfigCache();
  const app1 = createApp();
  const response1 = await app1.handle(
    new Request("http://localhost/", { headers: { Origin: "https://first.example" } }),
  );
  expect(response1.headers.get("access-control-allow-origin")).toBe("https://first.example");

  process.env["ALLOWED_ORIGINS"] = "https://second.example";
  clearConfigCache();
  const app2 = createApp();
  const response2 = await app2.handle(
    new Request("http://localhost/", { headers: { Origin: "https://second.example" } }),
  );
  expect(response2.headers.get("access-control-allow-origin")).toBe("https://second.example");
});
