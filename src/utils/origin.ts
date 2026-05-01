/**
 * Origin validation helpers for CORS and CSP configuration.
 */

const WEB_ORIGIN_PATTERN =
  /^https?:\/\/(?:[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*|\[[0-9A-Fa-f:.]+])(?::\d{1,5})?$/;

/**
 * Validate a browser web origin such as https://example.com or http://localhost:3000.
 */
export function isValidWebOrigin(origin: string): boolean {
  if (!WEB_ORIGIN_PATTERN.test(origin)) {
    return false;
  }

  try {
    const url = new URL(origin);
    if (url.port === "") {
      return true;
    }

    const port = Number(url.port);
    return Number.isInteger(port) && port > 0 && port <= 65535;
  } catch {
    return false;
  }
}

/**
 * Validate a source that is safe in CSP frame-ancestors.
 */
export function isValidOrigin(origin: string): boolean {
  if (origin === "*") {
    return true;
  }

  if (origin === "'self'" || origin === "'none'") {
    return true;
  }

  return isValidWebOrigin(origin);
}
