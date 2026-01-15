/**
 * Request-scoped state utilities
 *
 * Provides reusable WeakMap helpers for Elysia plugins to store
 * request lifecycle data. This is the recommended Elysia pattern
 * for request-scoped state.
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1476 | Request-scoped state discussion}
 */

/**
 * Request-scoped state container
 */
export class RequestState<T> {
  private store = new WeakMap<Request, T>();

  /**
   * Get value for request, or return default
   */
  get(request: Request, defaultValue: T): T {
    return this.store.get(request) ?? defaultValue;
  }

  /**
   * Set value for request
   */
  set(request: Request, value: T): void {
    this.store.set(request, value);
  }

  /**
   * Check if request has a value
   */
  has(request: Request): boolean {
    return this.store.has(request);
  }

  /**
   * Delete value for request
   */
  delete(request: Request): void {
    this.store.delete(request);
  }
}

/**
 * Pre-typed request state for common use cases
 */

/**
 * Request start time for duration calculations
 */
export const requestStartTime = new RequestState<number>();

/**
 * Get request start time
 */
export function getRequestStartTime(request: Request): number {
  return requestStartTime.get(request, Date.now());
}

/**
 * Set request start time
 */
export function setRequestStartTime(request: Request, startTime: number): void {
  requestStartTime.set(request, startTime);
}

/**
 * Flag tracking with per-request flag maps
 * Maps: Request -> Map<string, boolean>
 */
const requestFlagStore = new WeakMap<Request, Map<string, boolean>>();

/**
 * Get the flag map for a request, creating it if needed
 */
function getFlagMap(request: Request): Map<string, boolean> {
  let flagMap = requestFlagStore.get(request);
  if (!flagMap) {
    flagMap = new Map();
    requestFlagStore.set(request, flagMap);
  }
  return flagMap;
}

/**
 * Check if a flag is set for request
 */
export function getRequestFlag(request: Request, flagName: string): boolean {
  const flagMap = requestFlagStore.get(request);
  return flagMap?.get(flagName) ?? false;
}

/**
 * Set a flag for request
 */
export function setRequestFlag(request: Request, flagName: string, value: boolean): void {
  const flagMap = getFlagMap(request);
  flagMap.set(flagName, value);
}
