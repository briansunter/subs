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
import {
  recordDiscordWebhook,
  recordSheetsRequest,
  recordSignup,
  recordTurnstileVerification,
} from "../services/metrics";
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
 * Handle basic signup
 */
export async function handleSignup(data: SignupInput, ctx: SignupContext): Promise<HandlerResult> {
  const startTime = Date.now();
  let _success = false;

  try {
    // Validate input with Zod
    const validationResult = signupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors: string[] = [];
      for (const e of validationResult.error.issues) {
        errors.push(`${e.path.join(".")}: ${e.message}`);
      }
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
    const sheetsStartTime = Date.now();
    let exists = false;
    try {
      exists = await ctx.sheets.emailExists(
        validationResult.data.email,
        validationResult.data.sheetTab,
        ctx.config,
      );
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
      await ctx.sheets.appendSignup({
        email: validationResult.data.email,
        timestamp: new Date().toISOString(),
        sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
        metadata: validationResult.data.metadata
          ? JSON.stringify(validationResult.data.metadata)
          : undefined,
      }, ctx.config);
      recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);
    } catch (error) {
      recordSheetsRequest("appendSignup", false, (Date.now() - appendStartTime) / 1000);
      throw error; // Re-throw to be caught by outer handler
    }

    // Send Discord notification (non-blocking, errors ignored)
    void ctx.discord
      .sendSignupNotification(
        {
          email: validationResult.data.email,
          sheetTab: validationResult.data.sheetTab || ctx.config.defaultSheetTab,
        },
        ctx.config.discordWebhookUrl,
      )
      .then(() => {
        recordDiscordWebhook("signup", true);
      })
      .catch((err) => {
        recordDiscordWebhook("signup", false);
        logger.error({ error: err }, "Failed to send Discord notification");
      });

    logger.info({ email: validationResult.data.email }, "New signup processed");

    _success = true;
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

    // Send error notification to Discord (non-blocking)
    void ctx.discord
      .sendErrorNotification(
        {
          message: "Signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .then(() => {
        recordDiscordWebhook("error", true);
      })
      .catch((err) => {
        recordDiscordWebhook("error", false);
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
  const startTime = Date.now();
  let _success = false;

  try {
    // Validate input with Zod
    const validationResult = extendedSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors: string[] = [];
      for (const e of validationResult.error.issues) {
        errors.push(`${e.path.join(".")}: ${e.message}`);
      }
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
    const sheetsStartTime = Date.now();
    let exists = false;
    try {
      exists = await ctx.sheets.emailExists(
        validationResult.data.email,
        validationResult.data.sheetTab,
        ctx.config,
      );
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
    }, ctx.config);
    recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);

    // Send Discord notification (non-blocking)
    void ctx.discord
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
      .then(() => {
        recordDiscordWebhook("signup", true);
      })
      .catch((err) => {
        recordDiscordWebhook("signup", false);
        logger.error({ error: err }, "Failed to send Discord notification");
      });

    logger.info({ email: validationResult.data.email }, "Extended signup processed");

    _success = true;
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

    // Send error notification to Discord (non-blocking)
    void ctx.discord
      .sendErrorNotification(
        {
          message: "Extended signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .then(() => {
        recordDiscordWebhook("error", true);
      })
      .catch((err) => {
        recordDiscordWebhook("error", false);
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
  const startTime = Date.now();

  try {
    // Validate input with Zod
    const validationResult = bulkSignupSchema.safeParse(data);
    if (!validationResult.success) {
      const errors: string[] = [];
      for (const e of validationResult.error.issues) {
        errors.push(`${e.path.join(".")}: ${e.message}`);
      }
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
        const sheetsStartTime = Date.now();
        const exists = await ctx.sheets.emailExists(signup.email, signup.sheetTab, ctx.config);
        recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);

        if (exists) {
          results.duplicates++;
          continue;
        }

        // Store in Google Sheets
        const appendStartTime = Date.now();
        await ctx.sheets.appendSignup({
          email: signup.email,
          timestamp: new Date().toISOString(),
          sheetTab: signup.sheetTab || ctx.config.defaultSheetTab,
          metadata: signup.metadata ? JSON.stringify(signup.metadata) : undefined,
        }, ctx.config);
        recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);

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

    const duration = (Date.now() - startTime) / 1000;
    recordSignup("/api/signup/bulk", true, duration);

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

    // Send error notification to Discord (non-blocking)
    void ctx.discord
      .sendErrorNotification(
        {
          message: "Bulk signup processing failed",
          context: { error: String(error) },
        },
        ctx.config.discordWebhookUrl,
      )
      .then(() => {
        recordDiscordWebhook("error", true);
      })
      .catch((err) => {
        recordDiscordWebhook("error", false);
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
  const startTime = Date.now();

  try {
    const sheetsStartTime = Date.now();
    const stats = await ctx.sheets.getSignupStats(sheetTab, ctx.config);
    recordSheetsRequest("getSignupStats", true, (Date.now() - sheetsStartTime) / 1000);

    return {
      success: true,
      statusCode: 200,
      data: stats,
    };
  } catch (error) {
    logger.error({ error }, "Failed to get stats");

    const duration = (Date.now() - startTime) / 1000;
    recordSheetsRequest("getSignupStats", false, duration);

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
