/**
 * Dynamic per-site sheet-tab provisioning.
 *
 * Static ALLOWED_SHEETS mappings remain the first-choice routing contract. For
 * unknown sites, this service creates a deterministic tab in the primary
 * workbook. The Sheets API and initializeSheetTab's race recovery make the
 * tab itself the durable site-to-destination mapping, so no per-site Nix
 * configuration or secondary registry is required.
 */

import type { SignupConfig } from "../config";
import { initializeSheetTab } from "./sheets";

const SITE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

export interface SiteSheetResolution {
  sheetId: string;
  sheetTab: string;
}

/**
 * Ensure an app/site has its own tab in the primary workbook and return the
 * destination used by the signup handler.
 */
export async function ensureSiteSheet(
  site: string,
  config: SignupConfig,
): Promise<SiteSheetResolution> {
  const sheetTab = site.trim().toLowerCase();
  if (!SITE_KEY_PATTERN.test(sheetTab)) {
    throw new Error("Site must use a lowercase slug containing only letters, numbers, and hyphens");
  }

  await initializeSheetTab(sheetTab, config);
  return {
    sheetId: config.googleSheetId,
    sheetTab,
  };
}
