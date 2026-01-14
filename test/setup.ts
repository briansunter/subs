/**
 * Test setup file
 * Ensures environment variables are set before any modules load
 *
 * This file is automatically loaded by Bun before running tests.
 * It sets up the test environment to ensure consistent behavior across
 * local development and CI.
 */

// Set test environment variables before any modules are imported
process.env["NODE_ENV"] = "test";
process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@example.com";
process.env["GOOGLE_PRIVATE_KEY"] =
  "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n";
process.env["ALLOWED_ORIGINS"] = "*";
process.env["PORT"] = "3011";
process.env["HOST"] = "0.0.0.0";
process.env["CLOUDFLARE_TURNSTILE_SECRET_KEY"] = "1x0000000000000000000000000000000AA";
process.env["CLOUDFLARE_TURNSTILE_SITE_KEY"] = "1x0000000000000000000000000000000AA";

// Feature flags - explicitly enable all endpoints for tests
process.env["ENABLE_EXTENDED_SIGNUP"] = "true";
process.env["ENABLE_BULK_SIGNUP"] = "true";
process.env["ENABLE_METRICS"] = "true";
