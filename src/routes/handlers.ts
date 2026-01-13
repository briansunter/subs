/**
 * Route handler business logic
 * Extracted from Fastify routes for testability
 */

import { getConfig, type SignupConfig } from "../config";
import {
  type BulkSignupInput,
  bulkSignupSchema,
  type ExtendedSignupInput,
  extendedSignupSchema,
  type SignupInput,
  signupSchema,
} from "../schemas/signup";
import { sendErrorNotification, sendSignupNotification } from "../services/discord";
import { appendSignup, emailExists, getSignupStats } from "../services/sheets";
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
    getSignupStats: typeof getSignupStats;
  };
  discord: {
    sendSignupNotification: typeof sendSignupNotification;
    sendErrorNotification: typeof sendErrorNotification;
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
    sheets: { appendSignup, emailExists, getSignupStats },
    discord: { sendSignupNotification, sendErrorNotification },
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

  // Verify the token with Cloudflare
  const result = await ctx.turnstile.verifyTurnstileToken(token, ctx.config.turnstileSecretKey);

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
 * Handle basic signup
 */
export async function handleSignup(data: SignupInput, ctx: SignupContext): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = signupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details: errors,
      };
    }

    // Validate Turnstile token if configured
    const turnstileResult = await validateTurnstileToken(validationResult.data.turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    // Check if email already exists
    const exists = await ctx.sheets.emailExists(
      validationResult.data.email,
      validationResult.data.sheetTab,
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
    ctx.discord
      .sendSignupNotification(
        {
          email: validationResult.data.email,
          sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
        },
        ctx.config.discordWebhookUrl,
      )
      .catch((err) => {
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
    ctx.discord
      .sendErrorNotification(
        {
          message: "Signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .catch((err) => {
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
  ctx: SignupContext,
): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = extendedSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
      return {
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details: errors,
      };
    }

    // Validate Turnstile token if configured
    const turnstileResult = await validateTurnstileToken(validationResult.data.turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    // Check if email already exists
    const exists = await ctx.sheets.emailExists(
      validationResult.data.email,
      validationResult.data.sheetTab,
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
    ctx.discord
      .sendSignupNotification(
        {
          email: validationResult.data.email,
          sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
          name: validationResult.data.name,
          source: validationResult.data.source,
          tags: validationResult.data.tags,
        },
        ctx.config.discordWebhookUrl,
      )
      .catch((err) => {
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
    ctx.discord
      .sendErrorNotification(
        {
          message: "Extended signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .catch((err) => {
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
  ctx: SignupContext,
): Promise<HandlerResult> {
  try {
    // Validate input with Zod
    const validationResult = bulkSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
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
      "Bulk signup processed",
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
    ctx.discord
      .sendErrorNotification(
        {
          message: "Bulk signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .catch((err) => {
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
  ctx: SignupContext,
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
