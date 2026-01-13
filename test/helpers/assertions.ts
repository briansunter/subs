/**
 * Custom test assertions for better test readability
 * Provides type-safe assertion helpers for common test scenarios
 */

import { expect } from "bun:test";

/**
 * Assert that a response indicates success
 */
export function assertSuccessResponse(
  data: { success: boolean }
): void {
  expect(data.success).toBe(true);
}

/**
 * Assert that a response indicates an error
 */
export function assertErrorResponse(
  data: { success: boolean; statusCode?: number },
  statusCode?: number
): void {
  expect(data.success).toBe(false);
  if (statusCode !== undefined) {
    expect(data.statusCode).toBe(statusCode);
  }
}

/**
 * Assert that a signup notification was sent for the given email
 */
export function assertSignupNotification(
  mockDiscord: {
    getNotifications: () => readonly { type: string; payload: unknown }[];
  },
  email: string
): void {
  const notifications = mockDiscord.getNotifications();
  const signupNotifications = notifications.filter((n) => n.type === "signup");

  expect(signupNotifications.length).toBeGreaterThan(0);

  const lastSignup = signupNotifications[signupNotifications.length - 1];
  if (!lastSignup) {
    throw new Error("No signup notification found");
  }

  const payload = lastSignup.payload as {
    embeds?: Array<{ fields?: Array<{ name: string; value: string }> }>;
  };

  expect(payload.embeds).toBeDefined();
  expect(payload.embeds?.[0]?.fields).toBeDefined();

  const emailField = payload.embeds?.[0]?.fields?.find((f) => f.name === "Email");
  expect(emailField?.value).toBe(email);
}

/**
 * Assert that an error notification was sent containing the message
 */
export function assertErrorNotification(
  mockDiscord: {
    getNotifications: () => readonly { type: string; payload: unknown }[];
  },
  message: string
): void {
  const notifications = mockDiscord.getNotifications();
  const errorNotifications = notifications.filter((n) => n.type === "error");

  expect(errorNotifications.length).toBeGreaterThan(0);

  const lastError = errorNotifications[errorNotifications.length - 1];
  if (!lastError) {
    throw new Error("No error notification found");
  }

  const payload = lastError.payload as {
    embeds?: Array<{ description: string }>;
  };

  expect(payload.embeds).toBeDefined();
  expect(payload.embeds?.[0]?.description).toContain(message);
}

/**
 * Assert that a response has the expected status code
 */
export function assertStatusCode(
  response: Response,
  expectedStatus: number
): void {
  expect(response.status).toBe(expectedStatus);
}

/**
 * Assert that response has a specific header
 */
export function assertHeader(
  response: Response,
  header: string,
  expectedValue: string | RegExp
): void {
  const headerValue = response.headers.get(header);
  expect(headerValue).toBeDefined();

  if (expectedValue instanceof RegExp) {
    expect(headerValue).toMatch(expectedValue);
  } else {
    expect(headerValue).toBe(expectedValue);
  }
}

/**
 * Assert that response is valid JSON
 */
export async function assertValidJson(
  response: Response
): Promise<unknown> {
  const contentType = response.headers.get("content-type");
  expect(contentType).toMatch(/application\/json/);

  const data = await response.json();
  return data;
}

/**
 * Assert that response contains expected data structure
 */
export function assertResponseShape<T extends Record<string, unknown>>(
  data: unknown,
  shape: { [K in keyof T]?: (value: T[K]) => void }
): void {
  expect(data).toBeDefined();
  expect(typeof data).toBe("object");

  for (const [key, validator] of Object.entries(shape)) {
    expect(data).toHaveProperty(key);

    if (validator) {
      validator((data as Record<string, unknown>)[key] as T[typeof key]);
    }
  }
}

/**
 * Type guard for successful handler responses
 */
export function isSuccessResponse(
  data: unknown
): data is { success: true; statusCode: number; message?: string; data?: unknown } {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    data.success === true
  );
}

/**
 * Type guard for error handler responses
 */
export function isErrorResponse(
  data: unknown
): data is { success: false; statusCode: number; error: string; details?: string[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    data.success === false
  );
}

/**
 * Type guard for health check response
 */
export function isHealthCheckResponse(
  data: unknown
): data is { status: string; timestamp: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    "timestamp" in data &&
    typeof data.status === "string" &&
    typeof data.timestamp === "string"
  );
}

/**
 * Type guard for stats response
 */
export function isStatsResponse(
  data: unknown
): data is { totalSignups: number; sheetTabs: string[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "totalSignups" in data &&
    "sheetTabs" in data &&
    typeof data.totalSignups === "number" &&
    Array.isArray(data.sheetTabs)
  );
}

/**
 * Type guard for bulk signup result response
 */
export function isBulkResultResponse(
  data: unknown
): data is { success: number; failed: number; duplicates: number; errors: string[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    "success" in data &&
    "failed" in data &&
    "duplicates" in data &&
    "errors" in data &&
    typeof data.success === "number" &&
    typeof data.failed === "number" &&
    typeof data.duplicates === "number" &&
    Array.isArray(data.errors)
  );
}
