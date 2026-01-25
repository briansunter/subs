/**
 * Shared type guard utilities
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
  return isObject(error) && "valueErrors" in error && Array.isArray(error["valueErrors"]);
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
  return isObject(error) && "valueError" in error && isObject(error["valueError"]);
}

/**
 * Type guard to check if object has a set property with status
 * (used in Elysia route context manipulation)
 */
export function hasSetProperty(
  obj: Record<string, unknown>,
): obj is { set: { status: number } & Record<string, unknown> } {
  return "set" in obj && isObject(obj["set"]) && "status" in obj["set"];
}
