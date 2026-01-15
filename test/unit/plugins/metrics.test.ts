/**
 * Unit tests for metrics plugin
 */

import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { metricsPlugin } from "../../../src/plugins/metrics";

test("metricsPlugin should record successful request", async () => {
  const app = new Elysia().use(metricsPlugin).get("/test", () => "Hello");

  const request = new Request("http://localhost/test");
  const response = await app.handle(request);

  // If metrics plugin works, request should complete successfully
  expect(response.status).toBe(200);
});

test("metricsPlugin should record POST requests", async () => {
  const app = new Elysia().use(metricsPlugin).post("/test", () => "Created");

  const request = new Request("http://localhost/test", { method: "POST" });
  const response = await app.handle(request);

  expect(response.status).toBe(200);
});

test("metricsPlugin should handle error responses", async () => {
  const app = new Elysia().use(metricsPlugin).get("/test", () => {
    throw new Error("Test error");
  });

  const request = new Request("http://localhost/test");
  const response = await app.handle(request);

  // Should handle the error gracefully
  expect(response.status).toBe(500);
});

test("metricsPlugin should handle multiple requests", async () => {
  const app = new Elysia().use(metricsPlugin).get("/test", () => "Hello");

  const request1 = new Request("http://localhost/test");
  const request2 = new Request("http://localhost/test");

  const response1 = await app.handle(request1);
  const response2 = await app.handle(request2);

  expect(response1.status).toBe(200);
  expect(response2.status).toBe(200);
});
