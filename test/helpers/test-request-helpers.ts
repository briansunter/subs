/**
 * Test request helpers for cleaner, more maintainable tests
 *
 * Provides reusable helper functions for common test request patterns
 * following Elysia best practices.
 *
 * @see {@link https://elysiajs.com/patterns/unit-test | Elysia Unit Testing}
 */

import { VALID_TURNSTILE_TOKEN } from "./test-app-elysia";

/**
 * Helper to create a signup request with minimal required fields
 */
export function createSignupRequest(
  overrides: { email?: string; sheetTab?: string } = {},
): Request {
  const { email = "test@example.com", sheetTab = "Sheet1" } = overrides;

  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      sheetTab,
      turnstileToken: VALID_TURNSTILE_TOKEN,
    }),
  });
}

/**
 * Helper to create an extended signup request
 */
export function createExtendedSignupRequest(
  overrides: {
    email?: string;
    name?: string;
    sheetTab?: string;
    source?: string;
    tags?: string[];
  } = {},
): Request {
  const {
    email = "test@example.com",
    name = "Test User",
    sheetTab = "Sheet1",
    source = "api",
    tags = [],
  } = overrides;

  return new Request("http://localhost/api/signup/extended", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      name,
      sheetTab,
      source,
      tags,
      turnstileToken: VALID_TURNSTILE_TOKEN,
    }),
  });
}

/**
 * Helper to create a bulk signup request
 */
export function createBulkSignupRequest(
  signups: Array<{ email: string; sheetTab?: string }>,
): Request {
  return new Request("http://localhost/api/signup/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signups: signups.map((signup) => ({
        ...signup,
        turnstileToken: VALID_TURNSTILE_TOKEN,
      })),
    }),
  });
}
