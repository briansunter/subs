/**
 * Environment configuration for the signup API
 */

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
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  // Google Sheets configuration
  const googleSheetId = process.env.GOOGLE_SHEET_ID;
  if (!googleSheetId) {
    throw new Error("GOOGLE_SHEET_ID is required");
  }

  const googleCredentialsEmail = process.env.GOOGLE_CREDENTIALS_EMAIL;
  if (!googleCredentialsEmail) {
    throw new Error("GOOGLE_CREDENTIALS_EMAIL is required");
  }

  const googlePrivateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!googlePrivateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is required");
  }

  // Replace \n with actual newlines in private key
  const formattedPrivateKey = googlePrivateKey.replace(/\\n/g, "\n");

  const defaultSheetTab = process.env.DEFAULT_SHEET_TAB || "Sheet1";

  // Discord webhook (optional)
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

  // CORS allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : ["*"];

  return {
    port,
    host,
    googleSheetId,
    googleCredentialsEmail,
    googlePrivateKey: formattedPrivateKey,
    defaultSheetTab,
    discordWebhookUrl,
    allowedOrigins,
  };
}

export const config = loadEnv();
