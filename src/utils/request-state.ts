/**
 * Request-scoped state utilities
 *
 * Provides WeakMap helpers for Elysia plugins to store request lifecycle data.
 * This is the recommended Elysia pattern for request-scoped state.
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1476 | Request-scoped state discussion}
 */

/**
 * Request start time storage for duration calculations
 */
const requestStartTime = new WeakMap<Request, number>();

/**
 * Get request start time
 */
export function getRequestStartTime(request: Request): number {
  return requestStartTime.get(request) ?? Date.now();
}

/**
 * Set request start time
 */
export function setRequestStartTime(request: Request, startTime: number): void {
  requestStartTime.set(request, startTime);
}

/**
 * Flag storage: Request -> Map<string, boolean>
 */
const requestFlagStore = new WeakMap<Request, Map<string, boolean>>();

/**
 * Check if a flag is set for request
 */
export function getRequestFlag(request: Request, flagName: string): boolean {
  return requestFlagStore.get(request)?.get(flagName) ?? false;
}

/**
 * Set a flag for request
 */
export function setRequestFlag(request: Request, flagName: string, value: boolean): void {
  let flagMap = requestFlagStore.get(request);
  if (!flagMap) {
    flagMap = new Map();
    requestFlagStore.set(request, flagMap);
  }
  flagMap.set(flagName, value);
}
