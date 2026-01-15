/**
 * Google Sheets service using REST API (no SDK)
 * Compatible with Cloudflare Workers
 */

import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import type { SignupConfig } from "../config";
import type { SheetRowData } from "../schemas/signup";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("sheets");

// Constants
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes buffer before token expiry

// Zod schemas for Google Sheets API responses
const SpreadsheetSchema = z.object({
  sheets: z.array(
    z.object({
      properties: z
        .object({
          title: z.string().optional(),
          sheetId: z.number().optional(),
        })
        .optional(),
    }),
  ),
});

const ValueRangeSchema = z.object({
  range: z.string().optional(),
  majorDimension: z.string().optional(),
  values: z
    .union([z.array(z.array(z.union([z.string(), z.null(), z.undefined()]))), z.null()])
    .optional(),
});

const BatchUpdateResponseSchema = z.object({
  replies: z.array(z.unknown()).optional(),
});

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

// Token cache
let tokenCache: {
  token: string;
  expiresAt: number;
} | null = null;

/**
 * Generate a signed JWT for Google Service Account authentication
 * Compatible with Cloudflare Workers (uses Web Crypto API)
 */
async function generateSignedJWT(config: SignupConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  // Import the private key using Web Crypto API (Workers compatible)
  const privateKey = await importPKCS8(config.googlePrivateKey, "RS256");

  // Create and sign the JWT
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/spreadsheets",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(expiry)
    .setIssuer(config.googleCredentialsEmail)
    .setAudience(OAUTH_TOKEN_URL)
    .sign(privateKey);

  return jwt;
}

/**
 * Exchange signed JWT for an access token
 */
async function exchangeJWTForToken(jwt: string): Promise<z.infer<typeof TokenResponseSchema>> {
  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      "Failed to exchange JWT for access token",
    );
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return TokenResponseSchema.parse(json);
}

/**
 * Get a valid access token, using cache if available
 */
async function getAccessToken(config: SignupConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid
  if (tokenCache && tokenCache.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
    return tokenCache.token;
  }

  logger.info("Obtaining new access token");

  // Generate signed JWT
  const jwt = await generateSignedJWT(config);

  // Exchange for access token
  const tokenResponse = await exchangeJWTForToken(jwt);

  // Cache the token
  tokenCache = {
    token: tokenResponse.access_token,
    expiresAt: now + tokenResponse.expires_in,
  };

  logger.info("Access token obtained and cached");
  return tokenCache.token;
}

/**
 * Make an authenticated request to the Google Sheets API
 * Handles token refresh on 401 responses
 * Uses Zod schema for type-safe response validation
 */
async function sheetsRequest<T extends z.ZodTypeAny>(
  endpoint: string,
  schema: T,
  config: SignupConfig,
  options?: RequestInit,
): Promise<z.infer<T>> {
  const url = `${SHEETS_BASE_URL}${endpoint}`;
  const token = await getAccessToken(config);

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Handle 401 - token might be expired, clear cache and retry once
  if (response.status === 401 && tokenCache) {
    logger.info("Token expired, clearing cache and retrying");
    tokenCache = null;

    const newToken = await getAccessToken(config);
    const retryResponse = await fetch(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${newToken}`,
      },
    });

    if (!retryResponse.ok) {
      throw new Error(
        `Sheets API request failed: ${retryResponse.status} ${retryResponse.statusText}`,
      );
    }

    const json = await retryResponse.json();
    return schema.parse(json);
  }

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, body: errorText, url }, "Sheets API request failed");
    throw new Error(`Sheets API request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return schema.parse(json);
}

/**
 * Get all sheet tabs in the spreadsheet
 */
async function getAllSheetTabs(config: SignupConfig): Promise<string[]> {
  try {
    const spreadsheet = await sheetsRequest(
      `/spreadsheets/${config.googleSheetId}`,
      SpreadsheetSchema,
      config,
    );

    const titles: string[] = [];
    for (const sheet of spreadsheet.sheets || []) {
      const title = sheet.properties?.title;
      if (title) {
        titles.push(title);
      }
    }
    return titles;
  } catch (error) {
    logger.error({ error }, "Failed to get sheet tabs");
    return [config.defaultSheetTab];
  }
}

/**
 * Initialize a sheet tab with headers if it doesn't exist
 */
export async function initializeSheetTab(sheetTab: string, config: SignupConfig): Promise<void> {
  try {
    // Check if sheet exists
    const spreadsheet = await sheetsRequest(
      `/spreadsheets/${config.googleSheetId}`,
      SpreadsheetSchema,
      config,
    );

    const sheetExists =
      spreadsheet.sheets?.some((sheet) => sheet.properties?.title === sheetTab) ?? false;

    // Create sheet if it doesn't exist
    if (!sheetExists) {
      logger.info({ sheetTab }, "Creating new sheet tab");
      await sheetsRequest(
        `/spreadsheets/${config.googleSheetId}:batchUpdate`,
        BatchUpdateResponseSchema,
        config,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetTab,
                  },
                },
              },
            ],
          }),
        },
      );
    }

    // Add headers if the sheet is empty
    const range = `${sheetTab}!A1:G1`;
    const result = await sheetsRequest(
      `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(range)}`,
      ValueRangeSchema,
      config,
    );

    if (!result.values || result.values.length === 0) {
      logger.info({ sheetTab }, "Adding headers to sheet tab");
      await sheetsRequest(
        `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
        ValueRangeSchema,
        config,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [["Email", "Timestamp", "Source", "Name", "Tags", "Metadata", "Sheet Tab"]],
          }),
        },
      );
    }
  } catch (error) {
    logger.error({ error, sheetTab }, "Failed to initialize sheet tab");
    throw error;
  }
}

/**
 * Append signup data to Google Sheet
 */
export async function appendSignup(
  data: SheetRowData & { sheetTab: string; tags?: string[] },
  config: SignupConfig,
): Promise<void> {
  try {
    await initializeSheetTab(data.sheetTab, config);

    const range = `${data.sheetTab}!A:A`;

    // Normalize email to lowercase for consistent storage
    const normalizedEmail = data.email.toLowerCase();

    await sheetsRequest(
      `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      ValueRangeSchema,
      config,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [
            [
              normalizedEmail,
              data.timestamp,
              data.source || "api",
              data.name || "",
              data.tags && data.tags.length > 0 ? data.tags.join(", ") : "",
              data.metadata ? JSON.stringify(data.metadata) : "",
              data.sheetTab,
            ],
          ],
        }),
      },
    );

    logger.info(
      { email: normalizedEmail, sheetTab: data.sheetTab },
      "Successfully appended signup to sheet",
    );
  } catch (error) {
    logger.error({ error, email: data.email }, "Failed to append signup to sheet");
    throw new Error("Failed to store signup data");
  }
}

/**
 * Check if email already exists in any sheet tab
 */
export async function emailExists(
  email: string,
  sheetTab: string | undefined,
  config: SignupConfig,
): Promise<boolean> {
  try {
    // If sheetTab is specified, only check that tab
    const tabsToCheck = sheetTab ? [sheetTab] : await getAllSheetTabs(config);

    for (const tab of tabsToCheck) {
      const result = await sheetsRequest(
        `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(`${tab}!A:A`)}`,
        ValueRangeSchema,
        config,
      );

      const rows = result.values || [];
      for (const row of rows) {
        if (row[0]?.toLowerCase() === email.toLowerCase()) {
          logger.info({ email, sheetTab: tab }, "Email already exists");
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error({ error, email }, "Failed to check if email exists");
    // Don't throw error here, just return false to allow signup
    return false;
  }
}
