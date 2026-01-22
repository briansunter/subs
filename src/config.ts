/**
 * Environment configuration for the signup API
 */

import { z } from "zod";

/**
 * Helper for boolean environment variables
 * Converts string "true"/"false" to boolean with a default value
 */
const booleanEnv = (defaultValue = "true") =>
  z
    .string()
    .default(defaultValue)
    .transform((val) => val.toLowerCase() === "true");

/**
 * Zod schema for environment variable validation
 */
const envSchema = z.object({
  // Server
  PORT: z
    .string()
    .default("3000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0 && val < 65536, {
      message: "PORT must be a valid number between 1 and 65535",
    }),
  HOST: z.string().default("0.0.0.0"),

  // Google Sheets
  GOOGLE_SHEET_ID: z.string().min(1, "GOOGLE_SHEET_ID is required"),
  GOOGLE_CREDENTIALS_EMAIL: z
    .string()
    .min(1, "GOOGLE_CREDENTIALS_EMAIL is required")
    .email("GOOGLE_CREDENTIALS_EMAIL must be a valid email address"),
  GOOGLE_PRIVATE_KEY: z.string().min(1, "GOOGLE_PRIVATE_KEY is required"),
  DEFAULT_SHEET_TAB: z.string().default("Sheet1"),

  // Cloudflare Turnstile (optional)
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_TURNSTILE_SITE_KEY: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((val) =>
      val
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  // Node environment
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),

  // Feature flags
  ENABLE_EXTENDED_SIGNUP: booleanEnv(),
  ENABLE_BULK_SIGNUP: booleanEnv(),
  ENABLE_METRICS: booleanEnv(),
  ENABLE_HSTS: booleanEnv(),

  // Rate limiting
  ENABLE_RATE_LIMITING: booleanEnv(),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default("60000")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: "RATE_LIMIT_WINDOW_MS must be a positive number",
    }),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .default("100")
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0, {
      message: "RATE_LIMIT_MAX_REQUESTS must be a positive number",
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
  enableExtendedSignup: boolean;
  enableBulkSignup: boolean;
  enableMetrics: boolean;
  enableHsts: boolean;

  // Rate limiting
  enableRateLimiting: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
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
    enableHsts: env.ENABLE_HSTS,
    enableRateLimiting: env.ENABLE_RATE_LIMITING,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
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
