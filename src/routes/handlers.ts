/**
 * Route handler business logic
 * Extracted from Fastify routes for testability
 */

import type { ZodError } from "zod";
import { config } from "../config";
import {
  bulkSignupSchema,
  extendedSignupSchema,
  type ExtendedSignupInput,
  signupSchema,
  type SignupInput,
  type BulkSignupInput,
} from "../schemas/signup";
import {
  sendErrorNotification,
  sendSignupNotification,
} from "../services/discord";
import { appendSignup, emailExists, getSignupStats } from "../services/sheets";
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
    getSignupStats: typeof getSignupStats;
  };
  discord: {
    sendSignupNotification: typeof sendSignupNotification;
    sendErrorNotification: typeof sendErrorNotification;
  };
  config: {
    defaultSheetTab: string;
  };
}

/**
 * Default context with real services
 */
export function createDefaultContext(): SignupContext {
  return {
    sheets: { appendSignup, emailExists, getSignupStats },
    discord: { sendSignupNotification, sendErrorNotification },
    config: { defaultSheetTab: config.defaultSheetTab },
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
 * Handle basic signup
 */
export async function handleSignup(
  data: SignupInput,
  ctx: SignupContext
): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = signupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = (validationResult.error as ZodError<SignupInput>).issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      return {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details: errors,
      };
    }

    // Check if email already exists
    const exists = await ctx.sheets.emailExists(
      validationResult.data.email,
      validationResult.data.sheetTab
    );

    if (exists) {
      return {
        success: false,
        statusCode: 409,
        error: "Email already registered",
      };
    }

    // Store in Google Sheets
    await ctx.sheets.appendSignup({
      email: validationResult.data.email,
      timestamp: new Date().toISOString(),
      sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
      metadata: validationResult.data.metadata
        ? JSON.stringify(validationResult.data.metadata)
        : undefined,
    });

    // Send Discord notification (non-blocking, errors ignored)
    ctx.discord.sendSignupNotification({
      email: validationResult.data.email,
      sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
    }).catch((err) => {
      logger.error({ error: err }, "Failed to send Discord notification");
    });

    logger.info({ email: validationResult.data.email }, "New signup processed");

    return {
      success: true,
      statusCode: 200,
      message: "Successfully signed up!",
    };
  } catch (error) {
    logger.error({ error }, "Signup failed");

    // Send error notification to Discord (non-blocking)
    ctx.discord.sendErrorNotification({
      message: "Signup processing failed",
      context: { error: String(error) },
    }).catch((err) => {
      logger.error({ error: err }, "Failed to send error notification");
    });

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
  ctx: SignupContext
): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = extendedSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = (validationResult.error as ZodError<ExtendedSignupInput>).issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      return {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details: errors,
      };
    }

    // Check if email already exists
    const exists = await ctx.sheets.emailExists(
      validationResult.data.email,
      validationResult.data.sheetTab
    );

    if (exists) {
      return {
        success: false,
        statusCode: 409,
        error: "Email already registered",
      };
    }

    // Store in Google Sheets
    await ctx.sheets.appendSignup({
      email: validationResult.data.email,
      timestamp: new Date().toISOString(),
      sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
      name: validationResult.data.name,
      source: validationResult.data.source,
      tags: validationResult.data.tags,
      metadata: validationResult.data.metadata
        ? JSON.stringify(validationResult.data.metadata)
        : undefined,
    });

    // Send Discord notification (non-blocking)
    ctx.discord.sendSignupNotification({
      email: validationResult.data.email,
      sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
      name: validationResult.data.name,
      source: validationResult.data.source,
      tags: validationResult.data.tags,
    }).catch((err) => {
      logger.error({ error: err }, "Failed to send Discord notification");
    });

    logger.info({ email: validationResult.data.email }, "Extended signup processed");

    return {
      success: true,
      statusCode: 200,
      message: "Successfully signed up!",
    };
  } catch (error) {
    logger.error({ error }, "Extended signup failed");

    // Send error notification to Discord (non-blocking)
    ctx.discord.sendErrorNotification({
      message: "Extended signup processing failed",
      context: { error: String(error) },
    }).catch((err) => {
      logger.error({ error: err }, "Failed to send error notification");
    });

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
  ctx: SignupContext
): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = bulkSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = (validationResult.error as ZodError<BulkSignupInput>).issues.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      return {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details: errors,
      };
    }

    const results = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    for (const signup of validationResult.data.signups) {
      try {
        // Check if email already exists
        const exists = await ctx.sheets.emailExists(signup.email, signup.sheetTab);

        if (exists) {
          results.duplicates++;
          continue;
        }

        // Store in Google Sheets
        await ctx.sheets.appendSignup({
          email: signup.email,
          timestamp: new Date().toISOString(),
          sheetTab: signup.sheetTab || ctx.config.defaultSheetTab,
          metadata: signup.metadata ? JSON.stringify(signup.metadata) : undefined,
        });

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`${signup.email}: ${String(error)}`);
      }
    }

    logger.info(
      { total: results.success + results.failed, success: results.success },
      "Bulk signup processed"
    );

    return {
      success: true,
      statusCode: 200,
      message: `Processed ${results.success} signups`,
      data: results,
    };
  } catch (error) {
    logger.error({ error }, "Bulk signup failed");

    // Send error notification to Discord (non-blocking)
    ctx.discord.sendErrorNotification({
      message: "Bulk signup processing failed",
      context: { error: String(error) },
    }).catch((err) => {
      logger.error({ error: err }, "Failed to send error notification");
    });

    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}

/**
 * Handle get stats
 */
export async function handleGetStats(
  sheetTab: string | undefined,
  ctx: SignupContext
): Promise<HandlerResult> {
  try {
    const stats = await ctx.sheets.getSignupStats(sheetTab);
    return {
      success: true,
      statusCode: 200,
      data: stats,
    };
  } catch (error) {
    logger.error({ error }, "Failed to get stats");
    return {
      success: false,
      statusCode: 500,
      error: "Failed to retrieve statistics",
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
