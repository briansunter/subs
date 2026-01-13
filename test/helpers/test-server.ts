/**
 * Test server utilities for integration tests
 * Provides helpers for spawning and managing test servers
 */

import { spawn } from "node:child_process";

export interface TestServer {
  process: ReturnType<typeof spawn> & { kill: () => void };
  url: string;
  port: number;
  close: () => Promise<void>;
  ready: () => Promise<boolean>;
}

/**
 * Default port to use for test servers
 */
export const DEFAULT_TEST_PORT = 3011;

/**
 * Maximum time to wait for server to be ready
 */
export const SERVER_READY_TIMEOUT = 10000;

/**
 * Polling interval for server readiness checks
 */
export const SERVER_READY_POLL_INTERVAL = 100;

/**
 * Create and start a test server
 *
 * @param port - Port to run server on (0 for random available port)
 * @param envOverrides - Environment variables to override
 * @returns TestServer instance with management methods
 */
export async function createTestServer(
  port: number = DEFAULT_TEST_PORT,
  envOverrides: Record<string, string> = {}
): Promise<TestServer> {
  const server = spawn("bun", ["run", "index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      ...envOverrides,
    },
    cwd: `${import.meta.dir}/../..`,
  }) as ReturnType<typeof spawn> & { kill: () => void };

  const url = `http://localhost:${port}`;

  return {
    process: server,
    url,
    port,
    close: async () => {
      server.kill();
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
    ready: async () => waitForServer(url),
  };
}

/**
 * Wait for server to be ready by polling health endpoint
 *
 * @param url - Base URL of the server
 * @param timeout - Maximum time to wait in milliseconds
 * @returns Promise that resolves when server is ready
 * @throws Error if server doesn't become ready within timeout
 */
export async function waitForServer(
  url: string,
  timeout: number = SERVER_READY_TIMEOUT
): Promise<boolean> {
  const startTime = Date.now();
  const healthUrl = `${url}/api/health`;

  while (Date.now() - startTime < timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SERVER_READY_POLL_INTERVAL);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet, wait before retrying
      await new Promise((resolve) => setTimeout(resolve, SERVER_READY_POLL_INTERVAL));
    }
  }

  throw new Error(`Server not ready after ${timeout}ms`);
}

/**
 * Make a test request to the server
 *
 * @param server - Test server instance
 * @param path - Request path (e.g., "/api/signup")
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function testRequest(
  server: TestServer,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${server.url}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

/**
 * Helper for POST requests
 *
 * @param server - Test server instance
 * @param path - Request path
 * @param data - Request body data
 * @returns Fetch response
 */
export async function testPost(
  server: TestServer,
  path: string,
  data: unknown
): Promise<Response> {
  return testRequest(server, path, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Helper for GET requests
 *
 * @param server - Test server instance
 * @param path - Request path
 * @returns Fetch response
 */
export async function testGet(
  server: TestServer,
  path: string
): Promise<Response> {
  return testRequest(server, path, {
    method: "GET",
  });
}
