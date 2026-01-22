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
  ENABLE_METRICS: booleanEnv(),

  // Multi-site support: "sheetId:siteName,sheetId:siteName,..."
  ALLOWED_SHEETS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return new Map<string, string>();
      const map = new Map<string, string>();
      for (const pair of val.split(",")) {
        const [sheetId, siteName] = pair.split(":").map((s) => s.trim());
        if (sheetId && siteName) {
          map.set(siteName, sheetId);
        }
      }
      return map;
    }),

  // Configurable sheet tabs (comma-separated)
  SHEET_TABS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return ["Sheet1"];
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
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

  // Multi-site support: siteName -> sheetId
  allowedSheets: Map<string, string>;

  // Configurable sheet tabs
  sheetTabs: string[];
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
    enableMetrics: env.ENABLE_METRICS,
    allowedSheets: env.ALLOWED_SHEETS,
    sheetTabs: env.SHEET_TABS,
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
