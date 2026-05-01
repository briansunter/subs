/**
 * Google Sheets tab name validation.
 *
 * Google Sheets rejects these characters in sheet titles: : \ / ? * [ ]
 */

export const MAX_SHEET_TAB_LENGTH = 100;
export const INVALID_SHEET_TAB_CHARS = /[:\\/?*[\]]/;
export const INVALID_SHEET_TAB_MESSAGE = "Sheet tab name cannot contain : \\ / ? * [ ]";

export function isValidSheetTabName(sheetTab: string): boolean {
  const trimmed = sheetTab.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= MAX_SHEET_TAB_LENGTH &&
    !INVALID_SHEET_TAB_CHARS.test(trimmed)
  );
}
