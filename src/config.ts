/**
 * Environment configuration for the signup API
 */

import { z } from "zod";
import { isValidWebOrigin } from "./utils/origin";
import { getRuntimeEnv } from "./utils/runtime-env";
import { INVALID_SHEET_TAB_MESSAGE, isValidSheetTabName } from "./utils/sheet-tab";

export type EnvSource = Record<string, string | undefined>;

const portValidationMessage = "PORT must be a valid number between 1 and 65535";

/**
 * Helper for boolean environment variables
 * Converts string "true"/"false" to boolean with a default value.
 * Invalid values fail fast instead of silently disabling features.
 */
const booleanEnv = (defaultValue = "true") =>
  z
    .string()
    .default(defaultValue)
    .transform((val) => val.trim().toLowerCase())
    .refine((val) => val === "true" || val === "false", {
      message: "Expected true or false",
    })
    .transform((val) => val === "true");

const optionalNonBlankString = z
  .string()
  .trim()
  .optional()
  .transform((val) => (val ? val : undefined));

const logLevelSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
);

/**
 * Zod schema for environment variable validation
 */
const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .trim()
    .default("3000")
    .refine((val) => /^\d+$/.test(val), {
      message: portValidationMessage,
    })
    .transform((val) => Number(val))
    .refine((val) => !Number.isNaN(val) && val > 0 && val < 65536, {
      message: portValidationMessage,
    }),
  HOST: z.string().trim().min(1, "HOST is required").default("0.0.0.0"),

  // Google Sheets
  GOOGLE_SHEET_ID: z.string().trim().min(1, "GOOGLE_SHEET_ID is required"),
  GOOGLE_CREDENTIALS_EMAIL: z
    .string()
    .trim()
    .min(1, "GOOGLE_CREDENTIALS_EMAIL is required")
    .email("GOOGLE_CREDENTIALS_EMAIL must be a valid email address"),
  GOOGLE_PRIVATE_KEY: z
    .string()
    .refine((val) => val.trim().length > 0, { message: "GOOGLE_PRIVATE_KEY is required" }),
  DEFAULT_SHEET_TAB: z
    .string()
    .trim()
    .default("Sheet1")
    .refine(isValidSheetTabName, { message: INVALID_SHEET_TAB_MESSAGE }),

  // Cloudflare Turnstile (optional)
  CLOUDFLARE_TURNSTILE_SECRET_KEY: optionalNonBlankString,
  CLOUDFLARE_TURNSTILE_SITE_KEY: optionalNonBlankString,

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .trim()
    .default("*")
    .transform((val) =>
      val
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .superRefine((origins, ctx) => {
      if (origins.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "ALLOWED_ORIGINS must include at least one origin or *",
        });
        return;
      }

      for (const origin of origins) {
        if (origin !== "*" && !isValidWebOrigin(origin)) {
          ctx.addIssue({
            code: "custom",
            message: `ALLOWED_ORIGINS contains invalid origin: ${origin}`,
          });
        }
      }
    }),

  // Node environment
  NODE_ENV: z.string().trim().min(1).default("development"),
  LOG_LEVEL: logLevelSchema,

  // Feature flags
  ENABLE_METRICS: booleanEnv(),

  // Multi-site support: "sheetId:siteName,sheetId:siteName,..."
  ALLOWED_SHEETS: z
    .string()
    .trim()
    .optional()
    .transform((val, ctx) => {
      if (!val) return new Map<string, string>();
      const map = new Map<string, string>();
      for (const pair of val.split(",")) {
        const parts = pair.split(":").map((s) => s.trim());
        const [sheetId, siteName] = parts;
        if (parts.length !== 2 || !sheetId || !siteName) {
          ctx.addIssue({
            code: "custom",
            message: `ALLOWED_SHEETS contains invalid mapping: ${pair}`,
          });
          continue;
        }

        if (sheetId && siteName) {
          map.set(siteName, sheetId);
        }
      }
      return map;
    }),

  // Configurable sheet tabs (comma-separated)
  SHEET_TABS: z
    .string()
    .trim()
    .optional()
    .transform((val, ctx) => {
      if (!val) return undefined;
      const tabs = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (tabs.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "SHEET_TABS must include at least one sheet tab",
        });
      }
      for (const tab of tabs) {
        if (!isValidSheetTabName(tab)) {
          ctx.addIssue({
            code: "custom",
            message: `${tab}: ${INVALID_SHEET_TAB_MESSAGE}`,
          });
        }
      }
      return tabs;
    }),
});

export interface SignupConfig {
  // Server
  port: number;
  host: string;

  // Google Sheets
  googleSheetId: string;
  googleCredentialsEmail: string;
  googlePrivateKey: string;
  defaultSheetTab: string;

  // Cloudflare Turnstile
  turnstileSecretKey?: string;
  turnstileSiteKey?: string;

  // CORS
  allowedOrigins: string[];

  // Feature flags
  enableMetrics: boolean;

  // Runtime
  nodeEnv: string;
  logLevel: string;

  // Multi-site support: siteName -> sheetId
  allowedSheets: Map<string, string>;

  // Configurable sheet tabs
  sheetTabs: string[];
}

export function loadEnv(envSource: EnvSource = getRuntimeEnv()): SignupConfig {
  // Parse and validate environment variables with Zod
  const env = envSchema.parse(envSource);

  // Replace \n with actual newlines in private key
  const formattedPrivateKey = env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

  return {
    port: env.PORT,
    host: env.HOST,
    googleSheetId: env.GOOGLE_SHEET_ID,
    googleCredentialsEmail: env.GOOGLE_CREDENTIALS_EMAIL,
    googlePrivateKey: formattedPrivateKey,
    defaultSheetTab: env.DEFAULT_SHEET_TAB,
    turnstileSecretKey: env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
    turnstileSiteKey: env.CLOUDFLARE_TURNSTILE_SITE_KEY,
    allowedOrigins: env.ALLOWED_ORIGINS,
    enableMetrics: env.ENABLE_METRICS,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
    allowedSheets: env.ALLOWED_SHEETS,
    sheetTabs: env.SHEET_TABS ?? [env.DEFAULT_SHEET_TAB],
  };
}

// Cached config
let cachedConfig: SignupConfig | undefined;

/**
 * Get the current configuration
 * Loads from environment on first call, returns cached value thereafter
 */
export function getConfig(): SignupConfig {
  if (!cachedConfig) {
    cachedConfig = loadEnv();
  }
  return cachedConfig;
}

/**
 * Clear the config cache
 * Call this in tests before setting environment variables
 */
export function clearConfigCache(): void {
  cachedConfig = undefined;
}
