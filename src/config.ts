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

  // Discord (optional)
  DISCORD_WEBHOOK_URL: z.string().optional(),

  // CORS
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((val) => val.split(",").map((origin) => origin.trim())),

  // Node environment
  NODE_ENV: z.string().default("development"),
  LOG_LEVEL: z.string().default("info"),
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

  // Discord
  discordWebhookUrl?: string;

  // CORS
  allowedOrigins: string[];
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
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
    allowedOrigins: env.ALLOWED_ORIGINS,
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

// For backwards compatibility, export a getter that accesses the cache
export const config: SignupConfig = new Proxy({} as never, {
  get(_target, prop) {
    return getConfig()[prop as keyof SignupConfig];
  },
});
