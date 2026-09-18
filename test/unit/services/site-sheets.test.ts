/** Unit tests for dynamic per-site sheet-tab provisioning. */

import { describe, expect, mock, test } from "bun:test";
import type { SignupConfig } from "../../../src/config";

const initializeSheetTab = mock(async (_sheetTab: string, _config: SignupConfig) => {});
mock.module("../../../src/services/sheets", () => ({ initializeSheetTab }));

import { ensureSiteSheet } from "../../../src/services/site-sheets";

const config: SignupConfig = {
  port: 3000,
  host: "0.0.0.0",
  googleSheetId: "primary-sheet",
  googleCredentialsEmail: "test@example.com",
  googlePrivateKey: "private-key",
  defaultSheetTab: "newsletter",
  allowedOrigins: ["*"],
  enableMetrics: true,
  nodeEnv: "test",
  logLevel: "silent",
  allowedSheets: new Map(),
  autoProvisionSites: true,
  sheetTabs: ["newsletter"],
};

describe("Site Sheets Service", () => {
  test("normalizes a site slug and creates its tab in the primary workbook", async () => {
    const result = await ensureSiteSheet("  New-App ", config);

    expect(result).toEqual({ sheetId: "primary-sheet", sheetTab: "new-app" });
    expect(initializeSheetTab).toHaveBeenCalledWith("new-app", config);
  });

  test("rejects unsafe site names before touching Sheets", async () => {
    initializeSheetTab.mockClear();

    await expect(ensureSiteSheet("not a slug", config)).rejects.toThrow("lowercase slug");
    expect(initializeSheetTab).not.toHaveBeenCalled();
  });
});
