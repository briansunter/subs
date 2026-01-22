/**
 * Shared type guard utilities
 * Consolidated from app.ts and signup.elysia.ts to reduce duplication
 */

/**
 * Type guard to check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Type guard for Elysia valueErrors array structure (used in error handling)
 */
export function hasValueErrors(error: unknown): error is {
  valueErrors: {
    path?: string[] | string;
    message: string;
  }[];
} {
  if (isObject(error) && "valueErrors" in error) {
    const valueErrors = error["valueErrors"];
    return Array.isArray(valueErrors);
  }
  return false;
}

/**
 * Type guard for Elysia single valueError structure (used in error handling)
 */
export function hasValueError(error: unknown): error is {
  valueError: {
    path?: string[] | string;
    message: string;
  };
} {
  if (isObject(error) && "valueError" in error) {
    const valueError = error["valueError"];
    return isObject(valueError);
  }
  return false;
}

/**
 * Type guard to check if object has a set property that is an object
 * (used in Elysia route context manipulation)
 */
export function hasSetProperty(
  obj: Record<string, unknown>,
): obj is { set: Record<string, unknown> } {
  return "set" in obj && isObject(obj["set"]);
}

/**
 * Type guard to check if set has a status property that is a number
 * (used in Elysia route context manipulation)
 */
export function hasStatusProperty(
  set: Record<string, unknown>,
): set is { status: number } & Record<string, unknown> {
  return "status" in set && typeof set["status"] === "number";
}
