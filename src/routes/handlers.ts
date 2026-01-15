/**
 * Route handler business logic
 * Extracted from Fastify routes for testability
 */

import type { z } from "zod";
import { getConfig, type SignupConfig } from "../config";
import {
  type BulkSignupInput,
  bulkSignupSchema,
  type ExtendedSignupInput,
  extendedSignupSchema,
  type SignupInput,
  signupSchema,
} from "../schemas/signup";
import {
  recordSheetsRequest,
  recordSignup,
  recordTurnstileVerification,
} from "../services/metrics";
import { appendSignup, emailExists } from "../services/sheets";
import { verifyTurnstileToken } from "../services/turnstile";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("handlers");

/**
 * Context interface for dependency injection
 * Allows mocking services in tests
 */
export interface SignupContext {
  sheets: {
    appendSignup: typeof appendSignup;
    emailExists: typeof emailExists;
  };
  turnstile: {
    verifyTurnstileToken: typeof verifyTurnstileToken;
  };
  config: SignupConfig;
}

/**
 * Default context with real services
 */
export function createDefaultContext(): SignupContext {
  const currentConfig = getConfig();
  return {
    sheets: { appendSignup, emailExists },
    turnstile: { verifyTurnstileToken },
    config: currentConfig,
  };
}

/**
 * Handler result type
 */
export interface HandlerResult {
  success: boolean;
  statusCode: number;
  message?: string;
  error?: string;
  details?: string[];
  data?: unknown;
}

/**
 * Validate Turnstile token if configured
 * @param token - The Turnstile token from request
 * @param ctx - The signup context
 * @returns Handler result if validation fails, undefined if validation passes or is not configured
 */
async function validateTurnstileToken(
  token: string | undefined,
  ctx: SignupContext,
): Promise<HandlerResult | undefined> {
  // If Turnstile is not configured, skip validation
  if (!ctx.config.turnstileSecretKey) {
    return undefined;
  }

  // If Turnstile is configured but no token provided, return error
  if (!token) {
    return {
      success: false,
      statusCode: 400,
      error: "Turnstile verification failed",
      details: ["turnstileToken: Token is required"],
    };
  }

  const startTime = Date.now();

  // Verify the token with Cloudflare
  const result = await ctx.turnstile.verifyTurnstileToken(token, ctx.config.turnstileSecretKey);

  const duration = (Date.now() - startTime) / 1000;
  recordTurnstileVerification(result.success, duration);

  if (!result.success) {
    return {
      success: false,
      statusCode: 400,
      error: "Turnstile verification failed",
      details: [`turnstileToken: ${result.error || "Invalid or expired token"}`],
    };
  }

  // Token is valid, continue
  return undefined;
}

/**
 * Validate and transform input using Zod
 * Elysia validates in routes, but handlers also validate for:
 * 1. Unit tests that call handlers directly
 * 2. Applying transformations (like .toLowerCase(), .trim())
 */
function validateAndTransformSignup<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; result: HandlerResult } {
  const validationResult = schema.safeParse(data);
  if (!validationResult.success) {
    const details = validationResult.error.issues.map(
      (e) => `${e.path.join(".") || "field"}: ${e.message}`,
    );
    return {
      success: false,
      result: {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details,
      },
    };
  }
  return { success: true, data: validationResult.data };
}

/**
 * Handle basic signup
 */
export async function handleSignup(data: SignupInput, ctx: SignupContext): Promise<HandlerResult> {
  const startTime = Date.now();

  // Validate and apply transformations (email lowercasing, trimming)
  const validation = validateAndTransformSignup(data, signupSchema);
  if (!validation.success) {
    return validation.result;
  }
  const { email, sheetTab, metadata, turnstileToken } = validation.data;

  try {
    // Validate Turnstile token if configured
    const turnstileResult = await validateTurnstileToken(turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    // Check if email already exists
    const sheetsStartTime = Date.now();
    let exists = false;
    try {
      exists = await ctx.sheets.emailExists(email, sheetTab, ctx.config);
      recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);
    } catch (error) {
      recordSheetsRequest("emailExists", false, (Date.now() - sheetsStartTime) / 1000);
      throw error; // Re-throw to be caught by outer handler
    }

    if (exists) {
      return {
        success: false,
        statusCode: 409,
        error: "Email already registered",
      };
    }

    // Store in Google Sheets
    const appendStartTime = Date.now();
    try {
      await ctx.sheets.appendSignup(
        {
          email,
          timestamp: new Date().toISOString(),
          sheetTab: sheetTab || ctx.config.defaultSheetTab,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
        ctx.config,
      );
      recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);
    } catch (error) {
      recordSheetsRequest("appendSignup", false, (Date.now() - appendStartTime) / 1000);
      throw error; // Re-throw to be caught by outer handler
    }

    logger.info({ email }, "New signup processed");

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup", true, duration);

    return {
      success: true,
      statusCode: 200,
      message: "Successfully signed up!",
    };
  } catch (error) {
    logger.error({ error }, "Signup failed");

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup", false, duration);

    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}

/**
 * Handle extended signup with additional fields
 */
export async function handleExtendedSignup(
  data: ExtendedSignupInput,
  ctx: SignupContext,
): Promise<HandlerResult> {
  const startTime = Date.now();

  // Validate and apply transformations
  const validation = validateAndTransformSignup(data, extendedSignupSchema);
  if (!validation.success) {
    return validation.result;
  }
  const { email, sheetTab, name, source, tags, metadata, turnstileToken } = validation.data;

  try {
    // Validate Turnstile token if configured
    const turnstileResult = await validateTurnstileToken(turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    // Check if email already exists
    const sheetsStartTime = Date.now();
    let exists = false;
    try {
      exists = await ctx.sheets.emailExists(email, sheetTab, ctx.config);
      recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);
    } catch (error) {
      recordSheetsRequest("emailExists", false, (Date.now() - sheetsStartTime) / 1000);
      throw error; // Re-throw to be caught by outer handler
    }

    if (exists) {
      return {
        success: false,
        statusCode: 409,
        error: "Email already registered",
      };
    }

    // Store in Google Sheets
    const appendStartTime = Date.now();
    try {
      await ctx.sheets.appendSignup(
        {
          email,
          timestamp: new Date().toISOString(),
          sheetTab: sheetTab || ctx.config.defaultSheetTab,
          name,
          source,
          tags,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        },
        ctx.config,
      );
      recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);
    } catch (error) {
      recordSheetsRequest("appendSignup", false, (Date.now() - appendStartTime) / 1000);
      throw error; // Re-throw to be caught by outer handler
    }

    logger.info({ email }, "Extended signup processed");

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup/extended", true, duration);

    return {
      success: true,
      statusCode: 200,
      message: "Successfully signed up!",
    };
  } catch (error) {
    logger.error({ error }, "Extended signup failed");

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup/extended", false, duration);

    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}

/**
 * Handle bulk signup
 */
export async function handleBulkSignup(
  data: BulkSignupInput,
  ctx: SignupContext,
): Promise<HandlerResult> {
  const startTime = Date.now();

  // Validate and apply transformations
  const validation = validateAndTransformSignup(data, bulkSignupSchema);
  if (!validation.success) {
    return validation.result;
  }
  const { signups } = validation.data;

  try {
    const results: {
      success: number;
      failed: number;
      duplicates: number;
      errors: string[];
    } = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    for (const signup of signups) {
      try {
        // Check if email already exists
        const sheetsStartTime = Date.now();
        const exists = await ctx.sheets.emailExists(signup.email, signup.sheetTab, ctx.config);
        recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);

        if (exists) {
          results.duplicates++;
          continue;
        }

        // Store in Google Sheets
        const appendStartTime = Date.now();
        await ctx.sheets.appendSignup(
          {
            email: signup.email,
            timestamp: new Date().toISOString(),
            sheetTab: signup.sheetTab || ctx.config.defaultSheetTab,
            metadata: signup.metadata ? JSON.stringify(signup.metadata) : undefined,
          },
          ctx.config,
        );
        recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);

        results.success++;
      } catch (error) {
        results.failed++;
        logger.error({ error, email: signup.email }, "Individual signup failed in bulk operation");
        results.errors.push(`${signup.email}: ${String(error)}`);
      }
    }

    logger.info(
      { total: results.success + results.failed, success: results.success, failed: results.failed },
      "Bulk signup processed",
    );

    const duration = (Date.now() - startTime) / 1000;
    // Only record success if there were no failures
    const wasSuccessful = results.failed === 0;
    recordSignup("/api/signup/bulk", wasSuccessful, duration);

    return {
      success: true,
      statusCode: 200,
      message: `Processed ${results.success} signups`,
      data: results,
    };
  } catch (error) {
    logger.error({ error }, "Bulk signup failed");

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup/bulk", false, duration);

    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}

/**
 * Handle health check
 */
export function handleHealthCheck(): HandlerResult {
  return {
    success: true,
    statusCode: 200,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  };
}
