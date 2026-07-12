/**
 * Google Sheets service using REST API (no SDK)
 * Compatible with Cloudflare Workers
 */

import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";
import type { SignupConfig } from "../config";
import type { SheetRowData } from "../schemas/signup";
import {
  fetchWithTimeout,
  readResponseJsonWithTimeout,
  readResponseTextWithTimeout,
} from "../utils/fetch";
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

const SheetCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);

const ValueRangeSchema = z.object({
  range: z.string().optional(),
  majorDimension: z.string().optional(),
  values: z.union([z.array(z.array(SheetCellSchema)), z.null()]).optional(),
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
  identity: string;
} | null = null;

// Single-flight token acquisition: concurrent callers for the same credential
// identity share one in-flight token exchange instead of minting multiple tokens.
const inflightTokens = new Map<string, Promise<string>>();

// Single-flight sheet-tab initialization: concurrent callers initializing the
// same (credential, spreadsheet, tab) share one in-flight operation so they do
// not issue competing addSheet requests for a previously absent tab. The entry
// is removed on both success and failure, so a rejected initialization does not
// poison retries and the map never retains completed promises. This is
// in-flight coalescing only; successful initialization is not cached forever.
const inflightTabs = new Map<string, Promise<void>>();

/**
 * Stable identity for a service-account credential.
 *
 * Encodes the exact service-account email and private key as a JSON array so
 * every distinct (email, privateKey) pair maps to a distinct identity: a
 * rotated key for the same email cannot reuse a token cached for the prior
 * key. This is an exact, deterministic encoding with no hashing, so distinct
 * credentials never collide. The value is used only as an in-memory Map/cache
 * key and is never logged or exposed.
 */
function credentialIdentity(config: SignupConfig): string {
  return JSON.stringify([config.googleCredentialsEmail, config.googlePrivateKey]);
}

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
  const response = await fetchWithTimeout(OAUTH_TOKEN_URL, {
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
    // Consume the error body so the connection can be reused, but never log
    // it: provider error responses may echo request data or sensitive
    // diagnostics. Only status/statusText are logged as safe context.
    await readResponseTextWithTimeout(response).catch(() => {});
    logger.error(
      { status: response.status, statusText: response.statusText },
      "Failed to exchange JWT for access token",
    );
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
  }

  const json = await readResponseJsonWithTimeout(response);
  return TokenResponseSchema.parse(json);
}

/**
 * Get a valid access token, using cache if available.
 *
 * Concurrent requests for the same credential identity share a single
 * in-flight token exchange. The in-flight entry is cleared on both success
 * and failure so a rejected refresh cannot poison later requests.
 */
async function getAccessToken(config: SignupConfig): Promise<string> {
  const identity = credentialIdentity(config);

  // Return cached token if still valid
  if (tokenCache && tokenCache.identity === identity) {
    const now = Math.floor(Date.now() / 1000);
    if (tokenCache.expiresAt > now + TOKEN_EXPIRY_BUFFER) {
      return tokenCache.token;
    }
  }

  // Single-flight: share an in-flight exchange with concurrent callers.
  const existing = inflightTokens.get(identity);
  if (existing) {
    return existing;
  }

  const exchange = (async () => {
    try {
      logger.info("Obtaining new access token");
      const jwt = await generateSignedJWT(config);
      const tokenResponse = await exchangeJWTForToken(jwt);

      // Compute expiry from the time the token response is received, not from
      // when the refresh started, so the buffer reflects actual token lifetime.
      const receivedAt = Math.floor(Date.now() / 1000);
      tokenCache = {
        token: tokenResponse.access_token,
        expiresAt: receivedAt + tokenResponse.expires_in,
        identity,
      };
      logger.info("Access token obtained and cached");
      return tokenCache.token;
    } finally {
      inflightTokens.delete(identity);
    }
  })();

  inflightTokens.set(identity, exchange);
  return exchange;
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

  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // Handle 401 - the token used by this request was rejected. Retry once with
  // a fresh token. Only invalidate the cache when it still holds the token this
  // request used; a stale 401 from an older token must not evict a newer token
  // cached by another request in the meantime.
  if (response.status === 401) {
    if (tokenCache?.token === token) {
      logger.info("Token rejected, clearing cache and retrying");
      tokenCache = null;
    } else {
      logger.info("Token rejected, retrying with current cached token");
    }

    // Consume the original response body to avoid connection leak
    await readResponseTextWithTimeout(response).catch(() => {});

    const newToken = await getAccessToken(config);
    const retryResponse = await fetchWithTimeout(url, {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${newToken}`,
      },
    });

    if (!retryResponse.ok) {
      // Discard the error body (bounded) so the connection can be reused, but
      // never expose its contents: provider error responses may echo sensitive
      // data. Only status/statusText are surfaced in the thrown error.
      await readResponseTextWithTimeout(retryResponse).catch(() => {});
      throw new Error(
        `Sheets API request failed: ${retryResponse.status} ${retryResponse.statusText}`,
      );
    }

    const json = await readResponseJsonWithTimeout(retryResponse);
    return schema.parse(json);
  }

  if (!response.ok) {
    // Consume the error body so the connection can be reused, but never log
    // it: provider error responses may echo request data or sensitive
    // diagnostics. The URL was already logged here and carries no payloads.
    await readResponseTextWithTimeout(response).catch(() => {});
    logger.error(
      { status: response.status, statusText: response.statusText, url },
      "Sheets API request failed",
    );
    throw new Error(`Sheets API request failed: ${response.status} ${response.statusText}`);
  }

  const json = await readResponseJsonWithTimeout(response);
  return schema.parse(json);
}

/**
 * Format a sheet tab name for A1 notation ranges.
 * Unquoted names are allowed for simple identifiers only.
 */
function formatSheetTabForRange(sheetTab: string): string {
  if (/^[A-Za-z0-9_]+$/.test(sheetTab)) {
    return sheetTab;
  }

  // Google Sheets escapes apostrophes in quoted tab names by doubling them.
  return `'${sheetTab.replace(/'/g, "''")}'`;
}

function buildRange(sheetTab: string, columns: string): string {
  return `${formatSheetTabForRange(sheetTab)}!${columns}`;
}

async function getSheetTabTitles(config: SignupConfig): Promise<string[]> {
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
}

/**
 * Stable, unambiguous in-memory key for a sheet-tab initialization operation.
 *
 * Encodes the exact credential identity, spreadsheet id, and tab name as a JSON
 * array so every distinct (credential, spreadsheet, tab) triple maps to a
 * distinct key with no collisions. Including the credential identity prevents
 * sharing across credential rotations. The value is used only as an in-memory
 * single-flight Map key; it is never logged or exposed, and contains nothing
 * beyond data already held in the in-memory config.
 */
function tabInitKey(sheetTab: string, config: SignupConfig): string {
  return JSON.stringify([credentialIdentity(config), config.googleSheetId, sheetTab]);
}

/**
 * Issue an addSheet batchUpdate to create a sheet tab.
 *
 * Throws when the Sheets API rejects the request, including the cross-isolate
 * "a sheet with this name already exists" rejection that
 * {@link initializeSheetTab} recovers from. The caller decides whether a
 * rejection is recoverable.
 */
async function addSheetTab(sheetTab: string, config: SignupConfig): Promise<void> {
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

/**
 * Initialize a sheet tab with headers if it doesn't exist.
 *
 * Concurrent calls for the same (credential, spreadsheet, tab) share one
 * in-flight initialization so they do not issue competing addSheet requests for
 * a previously absent tab. Calls for different keys remain concurrent. The
 * shared entry is removed after both success and failure: a failed
 * initialization does not poison retries, and a successful one is not cached
 * forever — only in-flight calls are coalesced.
 *
 * Cross-isolate race recovery: if an addSheet fails because another isolate
 * created the tab between the initial listing and the addSheet, the tab titles
 * are re-read. The stale addSheet error is swallowed only when the target tab is
 * now present, in which case initialization continues with header setup. A
 * verification read that fails, or a tab that is still absent, rethrows the
 * original addSheet error so the underlying failure is never masked. The public
 * signature and header behavior are otherwise unchanged.
 */
export async function initializeSheetTab(sheetTab: string, config: SignupConfig): Promise<void> {
  const key = tabInitKey(sheetTab, config);

  // Single-flight: join an in-flight initialization for the same key, if any.
  const existing = inflightTabs.get(key);
  if (existing) {
    return existing;
  }

  const init = (async () => {
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
        try {
          await addSheetTab(sheetTab, config);
        } catch (addError) {
          // Cross-isolate race recovery: another Worker or process may have
          // created this tab between our listing and this addSheet, so the Sheets
          // API rejects the duplicate addSheet even though the tab now exists.
          // Re-read the tab titles; only if the target is now present is the
          // addSheet error stale and initialization can continue. A verification
          // read that fails, or a tab that is still absent, rethrows the original
          // addSheet error so the underlying failure is never hidden.
          let nowPresent = false;
          try {
            nowPresent = (await getSheetTabTitles(config)).includes(sheetTab);
          } catch {
            throw addError;
          }
          if (!nowPresent) {
            throw addError;
          }
          logger.info({ sheetTab }, "Sheet tab was concurrently created; continuing");
        }
      }

      // Add headers if the sheet is empty
      const range = buildRange(sheetTab, "A1:G1");
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
    } finally {
      inflightTabs.delete(key);
    }
  })();

  inflightTabs.set(key, init);
  return init;
}

/**
 * Append signup data to Google Sheet
 */
export async function appendSignup(
  data: SheetRowData & { sheetTab: string; sheetId: string; tags?: string[] },
  config: SignupConfig,
): Promise<void> {
  try {
    // Use provided sheetId or fall back to config default
    const sheetId = data.sheetId || config.googleSheetId;

    // Create config override with the resolved sheetId for initialization
    const configWithSheetId = { ...config, googleSheetId: sheetId };
    await initializeSheetTab(data.sheetTab, configWithSheetId);

    const range = buildRange(data.sheetTab, "A:A");

    await sheetsRequest(
      `/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      ValueRangeSchema,
      configWithSheetId,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          values: [
            [
              data.email,
              data.timestamp,
              data.source || "api",
              data.name || "",
              data.tags && data.tags.length > 0 ? data.tags.join(", ") : "",
              data.metadata || "",
              data.sheetTab,
            ],
          ],
        }),
      },
    );

    logger.info({ sheetTab: data.sheetTab, sheetId }, "Successfully appended signup to sheet");
  } catch (error) {
    logger.error({ error }, "Failed to append signup to sheet");
    throw new Error("Failed to store signup data");
  }
}

/**
 * Check whether an email exists in a specific tab, or in any tab when no tab
 * is supplied. Signup handlers intentionally preserve the latter behavior for
 * requests that omit `sheetTab`, while explicit tab requests remain tab-scoped.
 */
export async function emailExists(
  email: string,
  sheetTab: string | undefined,
  config: SignupConfig,
): Promise<boolean> {
  try {
    if (sheetTab) {
      const existingTabs = await getSheetTabTitles(config);
      if (!existingTabs.includes(sheetTab)) {
        return false;
      }
    }

    // If sheetTab is specified, only check that tab
    const tabsToCheck = sheetTab ? [sheetTab] : await getSheetTabTitles(config);

    const normalizedEmail = email.toLowerCase();

    for (const tab of tabsToCheck) {
      const result = await sheetsRequest(
        `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(buildRange(tab, "A:A"))}`,
        ValueRangeSchema,
        config,
      );

      const rows = result.values || [];
      for (const row of rows) {
        const rowEmail = row[0];
        if (typeof rowEmail === "string" && rowEmail.toLowerCase() === normalizedEmail) {
          logger.info({ sheetTab: tab }, "Email already exists");
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    logger.error({ error }, "Failed to check if email exists");
    throw new Error("Failed to check existing signups");
  }
}

export interface SignupStats {
  total: number;
  sheetTab: string;
  lastSignup: string | null;
}

/**
 * Get signup statistics for a specific tab
 */
export async function getSignupStats(sheetTab: string, config: SignupConfig): Promise<SignupStats> {
  try {
    // Missing tabs should return empty stats instead of surfacing a Sheets range parse error.
    const existingTabs = await getSheetTabTitles(config);
    if (!existingTabs.includes(sheetTab)) {
      return {
        total: 0,
        sheetTab,
        lastSignup: null,
      };
    }

    const range = buildRange(sheetTab, "A:B");
    const result = await sheetsRequest(
      `/spreadsheets/${config.googleSheetId}/values/${encodeURIComponent(range)}`,
      ValueRangeSchema,
      config,
    );

    const rows = result.values || [];
    // First row is header
    const dataRows = rows.length > 1 ? rows.slice(1) : [];

    let lastSignup: string | null = null;
    for (const row of dataRows) {
      const timestamp = row[1];
      if (typeof timestamp === "string" && (!lastSignup || timestamp > lastSignup)) {
        lastSignup = timestamp;
      }
    }

    return {
      total: dataRows.length,
      sheetTab,
      lastSignup,
    };
  } catch (error) {
    logger.error({ error, sheetTab }, "Failed to get signup stats");
    throw new Error("Failed to fetch signup stats");
  }
}
