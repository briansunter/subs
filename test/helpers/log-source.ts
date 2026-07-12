/**
 * Small isolation-safe checks for logger call sites.
 *
 * This avoids runtime logger mocking (which is import-order dependent) without
 * maintaining a JavaScript parser in the test suite.
 */

const LOGGER_CALL_PATTERN = /logger\.(?:trace|debug|info|warn|error|fatal)\s*\([\s\S]*?\);/g;
const QUOTED_LITERAL_PATTERN = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;

export function getLoggerCalls(source: string): string[] {
  return source.match(LOGGER_CALL_PATTERN) ?? [];
}

export function findLoggerCall(calls: string[], needle: string): string | undefined {
  return calls.find((call) => call.includes(needle));
}

export function referencesEmail(call: string): boolean {
  return /\bemail\b/i.test(call.replace(QUOTED_LITERAL_PATTERN, ""));
}
