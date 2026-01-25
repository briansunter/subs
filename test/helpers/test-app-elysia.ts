/**
 * Fast test app setup using Elysia's handle() method
 * Simulates HTTP requests without spawning a server
 *
 * @see {@link https://elysiajs.com/patterns/unit-test | Elysia Unit Testing}
 */

import { clearConfigCache as _clearConfigCache, getConfig } from "../../src/config";
import type { SignupContext } from "../../src/routes/handlers";
import { createSignupRoutes } from "../../src/routes/signup.elysia";
import { register } from "../../src/services/metrics";
import { mockSheetsService } from "../mocks/sheets";
import { mockTurnstileService } from "../mocks/turnstile";

// Re-export for convenience
export { _clearConfigCache as clearConfigCache, mockSheetsService, mockTurnstileService, register };

/**
 * Create a fresh test Elysia app instance
 *
 * Uses Elysia's handle() method for fast HTTP simulation without network overhead.
 * Each call creates a new instance to ensure test isolation.
 *
 * @example
 * ```ts
 * const app = await getTestApp();
 * const response = await app.handle(new Request("http://localhost/api/health"));
 * expect(response.status).toBe(200);
 * ```
 *
 * @param overrides - Optional context overrides for dependency injection
 * @returns Configured Elysia app instance
 */
export async function getTestApp(overrides?: Partial<SignupContext>) {
  const config = getConfig();
  const testContext: SignupContext = {
    sheets: {
      appendSignup: mockSheetsService.appendSignup,
      emailExists: mockSheetsService.emailExists,
    },
    turnstile: {
      verifyTurnstileToken: mockTurnstileService.verifyTurnstileToken,
    },
    config,
    ...overrides,
  };

  return createSignupRoutes(testContext);
}

/**
 * Set test environment variables
 */
export function setTestEnv(envOverrides: Record<string, string>): void {
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value;
  }
}

/**
 * Clear test environment variables
 */
export function clearTestEnv(keys: string[]): void {
  for (const key of keys) {
    delete process.env[key];
  }
}

/**
 * Default test environment
 */
export const DEFAULT_TEST_ENV = {
  NODE_ENV: "test",
  GOOGLE_SHEET_ID: "test-sheet-id",
  GOOGLE_CREDENTIALS_EMAIL: "test@example.com",
  GOOGLE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  ALLOWED_ORIGINS: "*",
  PORT: "3011",
  HOST: "0.0.0.0",
  CLOUDFLARE_TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  CLOUDFLARE_TURNSTILE_SITE_KEY: "1x0000000000000000000000000000000AA",
  ENABLE_METRICS: "true",
} as const;

/**
 * Setup test environment with optional overrides
 *
 * Applies DEFAULT_TEST_ENV with any custom overrides, clears config cache,
 * and resets all mocks. Use this in beforeEach hooks to ensure test isolation.
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *   setupTestEnv();
 * });
 *
 * // With overrides:
 * beforeEach(() => {
 *   setupTestEnv({ ENABLE_METRICS: "false" });
 * });
 * ```
 *
 * @param overrides - Optional environment variable overrides
 */
export function setupTestEnv(overrides?: Partial<typeof DEFAULT_TEST_ENV>): void {
  // Apply default test environment with any overrides
  const envToApply = { ...DEFAULT_TEST_ENV, ...overrides };
  for (const [key, value] of Object.entries(envToApply)) {
    process.env[key] = value;
  }

  // Clear config cache so new env vars are picked up
  _clearConfigCache();

  // Reset all mocks
  resetAllMocks();
}

/**
 * Cloudflare Turnstile test token that always passes
 * From: https://developers.cloudflare.com/turnstile/reference/testing
 */
export const VALID_TURNSTILE_TOKEN = "1x0000000000000000000000000000000AA";

/**
 * Helper to create a GET request
 *
 * @example
 * ```ts
 * const app = await getTestApp();
 * const response = await app.handle(createGetRequest("/api/health"));
 * ```
 */
export function createGetRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

/**
 * Helper to create a POST request with JSON body
 *
 * @example
 * ```ts
 * const response = await app.handle(createPostRequest("/api/signup", {
 *   email: "test@example.com",
 *   turnstileToken: VALID_TURNSTILE_TOKEN,
 * }));
 * ```
 */
export function createPostRequest(path: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Helper to parse JSON response with type safety
 *
 * Note: In production, consider using Zod schema validation here for additional type safety.
 * For tests, the generic type parameter provides sufficient type checking.
 *
 * @example
 * ```ts
 * const data = await parseJsonResponse<{ status: string }>(response);
 * expect(data.status).toBe("ok");
 * ```
 */
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  const json = await response.json();
  return json as T;
}

/**
 * Type-safe helper to extract request body from fetch options
 * Eliminates need for `as string` type assertions in tests
 *
 * @example
 * ```ts
 * const body = getRequestBody(fetchCalls[0]?.options);
 * expect(body.secret).toBe("test-secret");
 * ```
 */
export function getRequestBody(options: RequestInit | undefined): Record<string, unknown> {
  if (!options?.body) {
    return {};
  }
  // Body is string when using JSON.stringify in tests
  if (typeof options.body === "string") {
    return JSON.parse(options.body);
  }
  // Body might be other types in edge cases
  return {};
}

/**
 * Type-safe helper to get fetch call with body
 * Filters fetch calls to find those with POST/PUT/PATCH methods
 *
 * @example
 * ```ts
 * const postCalls = getFetchCallsWithBody(fetchCalls);
 * expect(postCalls.length).toBe(1);
 * ```
 */
export function getFetchCallsWithBody(
  calls: Array<{ url: string; options?: RequestInit }>,
): Array<{ url: string; options: RequestInit & { body: string } }> {
  return calls.filter(
    (call): call is { url: string; options: RequestInit & { body: string } } =>
      call.options?.method !== undefined &&
      ["POST", "PUT", "PATCH"].includes(call.options.method) &&
      typeof call.options.body === "string",
  );
}

/**
 * Type-safe helper to create a mock Response object
 */
export function createMockResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? "OK" : status === 401 ? "Unauthorized" : "Error",
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Type-safe helper to mock global fetch
 * Eliminates need for `as unknown as typeof fetch` type assertions
 *
 * @example
 * ```ts
 * mockGlobalFetch(async (url, options) => createMockResponse(200, { ok: true }));
 * ```
 */
export function mockGlobalFetch(
  implementation: (url: string | Request, options?: RequestInit) => Promise<Response>,
): void {
  global.fetch = implementation as typeof fetch;
}

/**
 * Type-safe helper to restore original fetch
 */
export function restoreOriginalFetch(originalFetch: typeof fetch): void {
  global.fetch = originalFetch;
}

/**
 * Reset all mock services to their initial state
 *
 * Utility function to reset all test mocks in one call.
 * Use in beforeEach hooks to ensure test isolation.
 *
 * @example
 * ```ts
 * beforeEach(() => {
 *   resetAllMocks();
 * });
 * ```
 */
export function resetAllMocks(): void {
  register.resetMetrics();
  mockSheetsService.reset();
  mockTurnstileService.reset();
}
