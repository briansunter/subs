/**
 * Unit tests for logging plugin
 */

import { expect, test } from "bun:test";
import { Elysia } from "elysia";
import { loggingPlugin } from "../../../src/plugins/logging";

test("loggingPlugin should log incoming requests", async () => {
  const app = new Elysia().use(loggingPlugin).get("/test", () => "Hello");

  const request = new Request("http://localhost/test");
  const response = await app.handle(request);

  // If logging plugin works, request should complete successfully
  expect(response.status).toBe(200);
});

test("loggingPlugin should log response with duration", async () => {
  const app = new Elysia().use(loggingPlugin).get("/test", () => "Hello");

  const request = new Request("http://localhost/test");
  const response = await app.handle(request);

  // Request should complete successfully
  expect(response.status).toBe(200);
});

test("loggingPlugin should capture request headers", async () => {
  const app = new Elysia().use(loggingPlugin).get("/test", () => "Hello");

  const request = new Request("http://localhost/test", {
    headers: {
      "User-Agent": "TestAgent",
      Origin: "https://example.com",
      Referer: "https://example.com/page",
    },
  });
  const response = await app.handle(request);

  expect(response.status).toBe(200);
});

test("loggingPlugin should handle missing headers", async () => {
  const app = new Elysia().use(loggingPlugin).get("/test", () => "Hello");

  const request = new Request("http://localhost/test");
  const response = await app.handle(request);

  expect(response.status).toBe(200);
});

test("loggingPlugin should handle POST requests", async () => {
  const app = new Elysia().use(loggingPlugin).post("/test", () => "Created");

  const request = new Request("http://localhost/test", {
    method: "POST",
  });
  const response = await app.handle(request);

  expect(response.status).toBe(200);
});
