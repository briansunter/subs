/**
 * Route handler business logic
 * Extracted from Elysia routes for testability
 */

import type { z } from "zod";
import { getConfig, type SignupConfig } from "../config";
import {
  type BulkSignupInput,
  bulkSignupSchema,
  type ExtendedSignupInput,
  extendedSignupSchema,
  type SignupInput,
  sheetTabSchema,
  signupSchema,
} from "../schemas/signup";
import {
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
  turnstile: {
    verifyTurnstileToken: typeof verifyTurnstileToken;
  };
  config: SignupConfig;
}

/**
 * Resolve site name to sheetId
 * Returns the sheetId from allowedSheets map, or default googleSheetId if no site specified
 * Returns error if site is specified but not in allowlist
 */
function resolveSiteToSheetId(
  site: string | undefined,
  config: SignupConfig,
): { sheetId: string } | { error: HandlerResult } {
  // If no site specified, use default sheet
  if (!site) {
    return { sheetId: config.googleSheetId };
  }

  // Look up site in allowed sheets
  const sheetId = config.allowedSheets.get(site);
  if (!sheetId) {
    return {
      error: {
        success: false,
        statusCode: 400,
        error: "Invalid site",
        details: [`site: Site '${site}' is not configured`],
      },
    };
  }

  return { sheetId };
}

/**
 * Default context with real services
 */
export function createDefaultContext(config?: SignupConfig): SignupContext {
  const currentConfig = config ?? getConfig();
  return {
    sheets: { appendSignup, emailExists, getSignupStats },
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
 * Signup data structure for Google Sheets
 */
interface SignupData {
  email: string;
  timestamp: string;
  sheetTab: string;
  sheetId: string;
  name?: string;
  source?: string;
  tags?: string[];
  metadata?: string;
}

interface BulkSignupResults {
  success: number;
  failed: number;
  duplicates: number;
  errors: string[];
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildBulkSignupResponse(results: BulkSignupResults): HandlerResult {
  const hasIssues = results.failed > 0 || results.duplicates > 0;
  const parts: string[] = [];

  if (results.success > 0) {
    parts.push(`${results.success} created`);
  }
  if (results.duplicates > 0) {
    parts.push(pluralize(results.duplicates, "duplicate"));
  }
  if (results.failed > 0) {
    parts.push(`${results.failed} failed`);
  }

  return {
    success: !hasIssues,
    statusCode: hasIssues ? 207 : 200,
    message: hasIssues
      ? `Processed signups (${parts.join(", ")})`
      : `Processed ${results.success} signups`,
    data: results,
  };
}

/**
 * Process-local keyed async locks that turn each email existence check plus
 * append into a single critical section, keyed by the resolved (sheet, email)
 * pair. This prevents two concurrent same-email check-then-append operations
 * in this process/Worker isolate from both observing "does not exist" and
 * appending a duplicate signup, including when one check searches all tabs.
 *
 * This is strictly best-effort, process-local deduplication. It does NOT
 * provide cross-process, cross-container, or cross-Worker uniqueness; Google
 * Sheets remains the source of truth.
 */
const signupLocks = new Map<string, Promise<unknown>>();

/**
 * Run `fn` while holding a process-local lock on `key`. Concurrent callers for
 * the same key execute serially in arrival order; callers for different keys
 * execute concurrently. Different keys are never serialized behind each other.
 *
 * The lock entry is always released and removed on success, duplicate, and
 * error paths: a rejected operation cannot poison later requests or leak keys
 * indefinitely. The `next` promise only ever resolves (never rejects), so
 * awaiting a prior holder cannot throw.
 */
async function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  // Current tail of this key's wait chain, if any.
  const previous = signupLocks.get(key);
  // Our release promise becomes the new tail that later callers chain onto.
  const { promise: next, resolve: release } = Promise.withResolvers<void>();
  signupLocks.set(key, next);

  try {
    if (previous) {
      await previous;
    }
    return await fn();
  } finally {
    release();
    // Drop our entry only if we are still the tail, so a later waiter that has
    // already registered its own tail is not removed out from under it.
    if (signupLocks.get(key) === next) {
      signupLocks.delete(key);
    }
  }
}

/**
 * Build an unambiguous process-local lock key from the resolved sheet ID and
 * normalized lowercase email. The lock is email-scoped rather than tab-scoped
 * because an omitted tab means the duplicate check searches every tab. This
 * serializes same-email operations across tabs while allowing different emails
 * to proceed concurrently. JSON.stringify escapes every component, so distinct
 * (sheet, email) pairs never collide.
 */
function buildSignupLockKey(sheetId: string, email: string): string {
  return JSON.stringify([sheetId, email.toLowerCase()]);
}

/**
 * Common signup processing flow
 * Handles validation, turnstile verification, duplicate checking, and storage
 *
 * @param data - The validated signup data
 * @param ctx - The signup context with services
 * @param route - The route path for metrics recording
 * @param buildSignupData - Function to build signup data from validated input
 * @param logMessage - Log message for successful signup
 */
async function processSignupRequest<
  T extends {
    email: string;
    sheetTab?: string;
    turnstileToken?: string;
    resolvedSheetId?: string;
  },
>(
  data: T,
  ctx: SignupContext,
  route: string,
  buildSignupData: (validated: T) => SignupData,
  logMessage: string,
): Promise<HandlerResult> {
  const startTime = Date.now();

  try {
    // Validate Turnstile token if configured. Done before acquiring the lock so
    // the lock is never held while verifying Turnstile.
    const turnstileResult = await validateTurnstileToken(data.turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    const resolvedConfig = data.resolvedSheetId
      ? { ...ctx.config, googleSheetId: data.resolvedSheetId }
      : ctx.config;
    // Lock the resolved (sheet, email) pair so the existence check and append
    // form one critical section. Process-local best effort.
    const lockKey = buildSignupLockKey(resolvedConfig.googleSheetId, data.email);

    const isDuplicate = await withKeyedLock(lockKey, async (): Promise<boolean> => {
      // Check if email already exists
      const sheetsStartTime = Date.now();
      let exists = false;
      try {
        exists = await ctx.sheets.emailExists(data.email, data.sheetTab, resolvedConfig);
        recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);
      } catch (error) {
        recordSheetsRequest("emailExists", false, (Date.now() - sheetsStartTime) / 1000);
        throw error;
      }

      if (exists) {
        return true;
      }

      // Store in Google Sheets
      const appendStartTime = Date.now();
      try {
        await ctx.sheets.appendSignup(buildSignupData(data), resolvedConfig);
        recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);
      } catch (error) {
        recordSheetsRequest("appendSignup", false, (Date.now() - appendStartTime) / 1000);
        throw error;
      }

      // Raw email is intentionally omitted from logs to avoid emitting PII.
      // The message string carries the operation; sheet/lock context is not PII.
      logger.info(logMessage);
      return false;
    });

    if (isDuplicate) {
      // Duplicates intentionally do not record a signup metric, matching prior behavior.
      return {
        success: false,
        statusCode: 409,
        error: "Email already registered",
      };
    }

    const duration = (Date.now() - startTime) / 1000;
    recordSignup(route, true, duration);

    return {
      success: true,
      statusCode: 200,
      message: "Successfully signed up!",
    };
  } catch (error) {
    logger.error({ error }, `${logMessage} failed`);

    const duration = (Date.now() - startTime) / 1000;
    recordSignup(route, false, duration);

    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}

/**
 * Handle basic signup
 */
export async function handleSignup(data: SignupInput, ctx: SignupContext): Promise<HandlerResult> {
  // Validate and apply transformations (email lowercasing, trimming)
  const validation = validateAndTransformSignup(data, signupSchema);
  if (!validation.success) {
    return validation.result;
  }

  // Resolve site to sheetId
  const siteResolution = resolveSiteToSheetId(validation.data.site, ctx.config);
  if ("error" in siteResolution) {
    return siteResolution.error;
  }

  return processSignupRequest(
    { ...validation.data, resolvedSheetId: siteResolution.sheetId },
    ctx,
    "/api/signup",
    (validated) => ({
      email: validated.email,
      timestamp: new Date().toISOString(),
      sheetTab: validated.sheetTab || ctx.config.defaultSheetTab,
      sheetId: validated.resolvedSheetId,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined,
    }),
    "New signup processed",
  );
}

/**
 * Handle extended signup with additional fields
 */
export async function handleExtendedSignup(
  data: ExtendedSignupInput,
  ctx: SignupContext,
): Promise<HandlerResult> {
  // Validate and apply transformations
  const validation = validateAndTransformSignup(data, extendedSignupSchema);
  if (!validation.success) {
    return validation.result;
  }

  // Resolve site to sheetId
  const siteResolution = resolveSiteToSheetId(validation.data.site, ctx.config);
  if ("error" in siteResolution) {
    return siteResolution.error;
  }

  return processSignupRequest(
    { ...validation.data, resolvedSheetId: siteResolution.sheetId },
    ctx,
    "/api/signup/extended",
    (validated) => ({
      email: validated.email,
      timestamp: new Date().toISOString(),
      sheetTab: validated.sheetTab || ctx.config.defaultSheetTab,
      sheetId: validated.resolvedSheetId,
      name: validated.name,
      source: validated.source,
      tags: validated.tags,
      metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined,
    }),
    "Extended signup processed",
  );
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
  const { signups, turnstileToken } = validation.data;

  try {
    const turnstileResult = await validateTurnstileToken(turnstileToken, ctx);
    if (turnstileResult) {
      return turnstileResult;
    }

    const results: BulkSignupResults = {
      success: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };
    const successfulSignups = new Set<string>();

    for (const signup of signups) {
      try {
        // Resolve site to sheetId
        const siteResolution = resolveSiteToSheetId(signup.site, ctx.config);
        if ("error" in siteResolution) {
          results.failed++;
          results.errors.push(`${signup.email}: Invalid site '${signup.site}'`);
          continue;
        }

        const targetSheetTab = signup.sheetTab || ctx.config.defaultSheetTab;
        // Keep in-request deduplication scoped to the target tab, while the
        // process-local lock below is scoped to sheet/email so all-tab checks
        // cannot race with operations targeting another tab.
        const requestDedupeKey = JSON.stringify([
          siteResolution.sheetId,
          targetSheetTab,
          signup.email,
        ]);

        if (successfulSignups.has(requestDedupeKey)) {
          results.duplicates++;
          continue;
        }

        const resolvedConfig = { ...ctx.config, googleSheetId: siteResolution.sheetId };

        const lockKey = buildSignupLockKey(siteResolution.sheetId, signup.email);
        const isDuplicate = await withKeyedLock(lockKey, async (): Promise<boolean> => {
          // Check if email already exists
          const sheetsStartTime = Date.now();
          let exists = false;
          try {
            exists = await ctx.sheets.emailExists(signup.email, signup.sheetTab, resolvedConfig);
            recordSheetsRequest("emailExists", true, (Date.now() - sheetsStartTime) / 1000);
          } catch (error) {
            recordSheetsRequest("emailExists", false, (Date.now() - sheetsStartTime) / 1000);
            throw error;
          }

          if (exists) {
            return true;
          }

          // Store in Google Sheets
          const appendStartTime = Date.now();
          try {
            await ctx.sheets.appendSignup(
              {
                email: signup.email,
                timestamp: new Date().toISOString(),
                sheetTab: targetSheetTab,
                sheetId: siteResolution.sheetId,
                metadata: signup.metadata ? JSON.stringify(signup.metadata) : undefined,
              },
              resolvedConfig,
            );
            recordSheetsRequest("appendSignup", true, (Date.now() - appendStartTime) / 1000);
          } catch (error) {
            recordSheetsRequest("appendSignup", false, (Date.now() - appendStartTime) / 1000);
            throw error;
          }

          return false;
        });

        if (isDuplicate) {
          results.duplicates++;
          continue;
        }

        successfulSignups.add(requestDedupeKey);
        results.success++;
      } catch (error) {
        results.failed++;
        // The submitted email remains in the API response (results.errors) for
        // client correlation, but is omitted from logs to avoid emitting PII.
        logger.error({ error }, "Individual signup failed in bulk operation");
        results.errors.push(
          `${signup.email}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    logger.info(
      {
        total: results.success + results.failed + results.duplicates,
        success: results.success,
        failed: results.failed,
        duplicates: results.duplicates,
      },
      "Bulk signup processed",
    );

    const duration = (Date.now() - startTime) / 1000;
    const response = buildBulkSignupResponse(results);
    const wasSuccessful = response.success;
    recordSignup("/api/signup/bulk", wasSuccessful, duration);
    return response;
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

/**
 * Handle stats query for a sheet tab
 */
export async function handleStats(
  sheetTab: string | undefined,
  ctx: SignupContext,
): Promise<HandlerResult> {
  if (!sheetTab?.trim()) {
    return {
      success: false,
      statusCode: 400,
      error: "Validation failed",
      details: ["sheetTab: Sheet tab is required"],
    };
  }

  // Reuse the same tab-name rules as signup inputs. This rejects forbidden
  // characters and overlong tab names before any Sheets service call, mapping
  // each issue into a `sheetTab: ...` detail.
  const tabValidation = sheetTabSchema.safeParse(sheetTab);
  if (!tabValidation.success) {
    const details = tabValidation.error.issues.map((issue) => `sheetTab: ${issue.message}`);
    return {
      success: false,
      statusCode: 400,
      error: "Validation failed",
      details,
    };
  }

  const startTime = Date.now();
  try {
    const stats = await ctx.sheets.getSignupStats(tabValidation.data, ctx.config);
    recordSheetsRequest("getSignupStats", true, (Date.now() - startTime) / 1000);
    return {
      success: true,
      statusCode: 200,
      data: stats,
    };
  } catch (error) {
    logger.error({ error, sheetTab }, "Failed to get stats");
    recordSheetsRequest("getSignupStats", false, (Date.now() - startTime) / 1000);
    return {
      success: false,
      statusCode: 500,
      error: "Internal server error",
    };
  }
}
