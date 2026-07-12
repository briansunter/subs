/** Regression coverage: raw signup emails must not appear in handler logs. */

import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { SignupConfig } from "../../../src/config";
import { handleBulkSignup } from "../../../src/routes/handlers";
import { findLoggerCall, getLoggerCalls, referencesEmail } from "../../helpers/log-source";
import { mockSheetsService } from "../../mocks/sheets";
import { mockTurnstileService } from "../../mocks/turnstile";

const source = readFileSync(new URL("../../../src/routes/handlers.ts", import.meta.url), "utf8");
const loggerCalls = getLoggerCalls(source);

// A distinctive email. The behavioral test confirms it stays in the API response
// for client correlation; the static tests confirm it is never logged.
const SENTINEL_EMAIL = "leak-target-7f3a@example.com";

const testConfig: SignupConfig = {
  port: 3000,
  host: "0.0.0.0",
  googleSheetId: "test-sheet-id",
  googleCredentialsEmail: "test@example.com",
  googlePrivateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n",
  defaultSheetTab: "Sheet1",
  allowedOrigins: ["*"],
  enableMetrics: true,
  nodeEnv: "test",
  logLevel: "silent",
  allowedSheets: new Map(),
  sheetTabs: ["Sheet1"],
};

describe("logging privacy — handlers (static call-site inspection)", () => {
  test("every logger call site omits the raw email", () => {
    // Global sweep: no call site in the handlers may reference `email`.
    expect(loggerCalls.length).toBeGreaterThan(0);
    expect(loggerCalls.filter(referencesEmail)).toEqual([]);
  });

  test("individual signup success logs the static message only", () => {
    const successCall = findLoggerCall(loggerCalls, "logger.info(logMessage);");
    if (!successCall) {
      throw new Error("Could not locate the individual-success logger.info(logMessage) call site");
    }
    expect(referencesEmail(successCall)).toBe(false);
  });

  test("bulk per-row failure logs the error only, not the email", () => {
    const failureCall = findLoggerCall(loggerCalls, "Individual signup failed");
    if (!failureCall) {
      throw new Error("Could not locate the bulk per-row failure logger.error call site");
    }
    expect(referencesEmail(failureCall)).toBe(false);
  });
});

describe("logging privacy — handlers (behavioral correlation)", () => {
  beforeEach(() => {
    mockSheetsService.reset();
    mockTurnstileService.reset();
  });

  test("handleBulkSignup keeps the submitted email in results.errors for client correlation", async () => {
    // The email stays in the API response (results.errors) so clients can map
    // failures back to their input rows. The logger is the real production
    // logger; this asserts response behavior only.
    mockSheetsService.setWriteError(new Error("write failed"));

    const result = await handleBulkSignup(
      { signups: [{ email: SENTINEL_EMAIL, sheetTab: "Sheet1" }] },
      {
        sheets: {
          appendSignup: mockSheetsService.appendSignup,
          emailExists: mockSheetsService.emailExists,
          getSignupStats: mockSheetsService.getSignupStats,
        },
        turnstile: { verifyTurnstileToken: mockTurnstileService.verifyTurnstileToken },
        config: testConfig,
      },
    );

    expect(result.success).toBe(false);
    const data = result.data as { errors: string[] };
    expect(data.errors.some((entry) => entry.includes(SENTINEL_EMAIL))).toBe(true);
  });
});
