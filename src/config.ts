/**
 * Environment configuration for the signup API
 */

import { z } from "zod";

/**
 * Zod schema for environment variable validation
 */
const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10)),
  HOST: z.string().default("0.0.0.0"),

  // Google Sheets
  GOOGLE_SHEET_ID: z.string().min(1, "GOOGLE_SHEET_ID is required"),
  GOOGLE_CREDENTIALS_EMAIL: z.string().min(1, "GOOGLE_CREDENTIALS_EMAIL is required"),
  GOOGLE_PRIVATE_KEY: z.string().min(1, "GOOGLE_PRIVATE_KEY is required"),
  DEFAULT_SHEET_TAB: z.string().default("Sheet1"),

  // Cloudflare Turnstile (optional)
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_TURNSTILE_SITE_KEY: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((val) => val.split(",").map((origin) => origin.trim())),

  // Node environment
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),

  // Feature flags
  ENABLE_EXTENDED_SIGNUP: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
  ENABLE_BULK_SIGNUP: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
  ENABLE_METRICS: z
    .string()
    .default("true")
    .transform((val) => val.toLowerCase() === "true"),
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
  enableExtendedSignup: boolean;
  enableBulkSignup: boolean;
  enableMetrics: boolean;
}

function loadEnv(): SignupConfig {
  // Parse and validate environment variables with Zod
  const env = envSchema.parse(process.env);

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
    enableExtendedSignup: env.ENABLE_EXTENDED_SIGNUP,
    enableBulkSignup: env.ENABLE_BULK_SIGNUP,
    enableMetrics: env.ENABLE_METRICS,
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
    console.log("[src/config.ts] Loading config from environment:", {
      "process.env.ENABLE_BULK_SIGNUP": process.env["ENABLE_BULK_SIGNUP"],
      "process.env.ENABLE_EXTENDED_SIGNUP": process.env["ENABLE_EXTENDED_SIGNUP"],
      "process.env.ENABLE_METRICS": process.env["ENABLE_METRICS"],
    });
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
