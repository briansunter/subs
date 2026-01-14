/**
 * Google Sheets service for storing signup data
 */

import { JWT } from "google-auth-library";
import { google } from "googleapis";
import type { SignupConfig } from "../config";
import type { SheetRowData } from "../schemas/signup";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("sheets");

// Cache for authenticated sheets client
let sheetsClient: Awaited<ReturnType<typeof createSheetsClient>> | null = null;

/**
 * Create and authenticate Google Sheets client
 */
async function createSheetsClient(config: SignupConfig) {
  const auth = new JWT({
    email: config.googleCredentialsEmail,
    key: config.googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    await auth.authorize();
    logger.info("Successfully authenticated with Google Sheets API");
    return sheets;
  } catch (error) {
    logger.error({ error }, "Failed to authenticate with Google Sheets API");
    throw new Error("Google Sheets authentication failed");
  }
}

/**
 * Get or create cached sheets client
 */
async function getSheetsClient(config: SignupConfig) {
  if (!sheetsClient) {
    sheetsClient = await createSheetsClient(config);
  }
  return sheetsClient;
}

/**
 * Initialize a sheet tab with headers if it doesn't exist
 */
export async function initializeSheetTab(sheetTab: string, config: SignupConfig): Promise<void> {
  try {
    const sheets = await getSheetsClient(config);

    // Check if sheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.googleSheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === sheetTab,
    );

    // Create sheet if it doesn't exist
    if (!sheetExists) {
      logger.info({ sheetTab }, "Creating new sheet tab");
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.googleSheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetTab,
                },
              },
            },
          ],
        },
      });
    }

    // Add headers if the sheet is empty
    const range = `${sheetTab}!A1:G1`;
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheetId,
      range,
    });

    if (!result.data.values || result.data.values.length === 0) {
      logger.info({ sheetTab }, "Adding headers to sheet tab");
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Email", "Timestamp", "Source", "Name", "Tags", "Metadata", "Sheet Tab"]],
        },
      });
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

    const sheets = await getSheetsClient(config);
    const range = `${data.sheetTab}!A:A`;

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            data.email,
            data.timestamp,
            data.source || "api",
            data.name || "",
            data.tags && data.tags.length > 0 ? data.tags.join(", ") : "",
            data.metadata ? JSON.stringify(data.metadata) : "",
            data.sheetTab,
          ],
        ],
      },
    });

    logger.info(
      { email: data.email, sheetTab: data.sheetTab },
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
export async function emailExists(email: string, sheetTab: string | undefined, config: SignupConfig): Promise<boolean> {
  try {
    const sheets = await getSheetsClient(config);

    // If sheetTab is specified, only check that tab
    const tabsToCheck = sheetTab ? [sheetTab] : await getAllSheetTabs(config);

    for (const tab of tabsToCheck) {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheetId,
        range: `${tab}!A:A`,
      });

      const rows = result.data.values || [];
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

/**
 * Get all sheet tabs in the spreadsheet
 */
async function getAllSheetTabs(config: SignupConfig): Promise<string[]> {
  try {
    const sheets = await getSheetsClient(config);
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.googleSheetId,
    });

    const titles: string[] = [];
    for (const sheet of spreadsheet.data.sheets || []) {
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
 * Get signup statistics
 */
export async function getSignupStats(sheetTab: string | undefined, config: SignupConfig): Promise<{
  totalSignups: number;
  sheetTabs: string[];
}> {
  try {
    const sheets = await getSheetsClient(config);
    const tabs = sheetTab ? [sheetTab] : await getAllSheetTabs(config);

    let totalSignups = 0;

    for (const tab of tabs) {
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheetId,
        range: `${tab}!A:A`,
      });

      // Subtract 1 for header row
      const rowCount = (result.data.values?.length || 0) - 1;
      totalSignups += Math.max(0, rowCount);
    }

    return {
      totalSignups,
      sheetTabs: await getAllSheetTabs(config),
    };
  } catch (error) {
    logger.error({ error }, "Failed to get signup stats");
    throw new Error("Failed to get signup statistics");
  }
}
