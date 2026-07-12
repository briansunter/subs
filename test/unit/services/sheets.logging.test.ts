/** Regression coverage: raw signup emails must not appear in Sheets logs. */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { findLoggerCall, getLoggerCalls, referencesEmail } from "../../helpers/log-source";

const source = readFileSync(new URL("../../../src/services/sheets.ts", import.meta.url), "utf8");
const loggerCalls = getLoggerCalls(source);

describe("logging privacy — sheets service (static call-site inspection)", () => {
  test("every logger call site omits the raw email", () => {
    // Global sweep: no call site in the sheets service may reference `email`.
    expect(loggerCalls.length).toBeGreaterThan(0);
    expect(loggerCalls.filter(referencesEmail)).toEqual([]);
  });

  test("append success logs sheet context only, not the email", () => {
    const call = findLoggerCall(loggerCalls, "Successfully appended signup to sheet");
    if (!call) {
      throw new Error("Could not locate the append-success logger call site");
    }
    expect(referencesEmail(call)).toBe(false);
  });

  test("append failure logs the error only, not the email", () => {
    const call = findLoggerCall(loggerCalls, "Failed to append signup to sheet");
    if (!call) {
      throw new Error("Could not locate the append-failure logger call site");
    }
    expect(referencesEmail(call)).toBe(false);
  });

  test("duplicate detection logs the sheet tab only, not the email", () => {
    const call = findLoggerCall(loggerCalls, "Email already exists");
    if (!call) {
      throw new Error("Could not locate the duplicate-detection logger call site");
    }
    expect(referencesEmail(call)).toBe(false);
  });

  test("email-existence failure logs the error only, not the email", () => {
    const call = findLoggerCall(loggerCalls, "Failed to check if email exists");
    if (!call) {
      throw new Error("Could not locate the email-existence-failure logger call site");
    }
    expect(referencesEmail(call)).toBe(false);
  });
});
