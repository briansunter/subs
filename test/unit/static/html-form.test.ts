/**
 * Unit tests for HTML form static content
 */

import { beforeEach, expect, test } from "bun:test";
import { clearConfigCache } from "../../../src/config";
import { HTML_FORM_CONTENT } from "../../../src/static/html-form";

beforeEach(() => {
  clearConfigCache();
  process.env.GOOGLE_SHEET_ID = "test-sheet-id";
  process.env.GOOGLE_CREDENTIALS_EMAIL = "test@test.com";
  process.env.GOOGLE_PRIVATE_KEY = "test-key";
  process.env.ALLOWED_ORIGINS = "https://example.com";
});

test("HTML_FORM_CONTENT should be a valid HTML string", () => {
  expect(HTML_FORM_CONTENT).toBeDefined();
  expect(typeof HTML_FORM_CONTENT).toBe("string");
  expect(HTML_FORM_CONTENT).toStartWith("<!DOCTYPE html>");
});

test("HTML_FORM_CONTENT should contain email form", () => {
  expect(HTML_FORM_CONTENT).toContain('<form id="signupForm"');
  expect(HTML_FORM_CONTENT).toContain('id="email"');
  expect(HTML_FORM_CONTENT).toContain('type="email"');
});

test("HTML_FORM_CONTENT should contain submit button", () => {
  expect(HTML_FORM_CONTENT).toContain('<button type="submit"');
  expect(HTML_FORM_CONTENT).toContain('id="submitBtn"');
});

test("HTML_FORM_CONTENT should have message elements", () => {
  expect(HTML_FORM_CONTENT).toContain('id="message"');
  expect(HTML_FORM_CONTENT).toContain('class="message"');
});

test("HTML_FORM_CONTENT should include CSS for message states", () => {
  expect(HTML_FORM_CONTENT).toContain(".message.success");
  expect(HTML_FORM_CONTENT).toContain(".message.error");
  expect(HTML_FORM_CONTENT).toContain(".message.show");
});

test("HTML_FORM_CONTENT should include CSS styles", () => {
  expect(HTML_FORM_CONTENT).toContain("<style>");
  expect(HTML_FORM_CONTENT).toContain("</style>");
  expect(HTML_FORM_CONTENT).toContain("background:");
});

test("HTML_FORM_CONTENT should have JavaScript for form submission", () => {
  expect(HTML_FORM_CONTENT).toContain("<script>");
  expect(HTML_FORM_CONTENT).toContain("addEventListener('submit'");
  expect(HTML_FORM_CONTENT).toContain("fetch(");
});

test("HTML_FORM_CONTENT should include allowed origins for postMessage", () => {
  expect(HTML_FORM_CONTENT).toContain("allowedOrigins");
  // Should contain the wildcard since we set ALLOWED_ORIGINS to https://example.com
  // But the HTML is generated at module load time with different env vars
  expect(HTML_FORM_CONTENT).toContain("includes('*')");
});

test("HTML_FORM_CONTENT should have proper HTML structure", () => {
  expect(HTML_FORM_CONTENT).toContain("<html");
  expect(HTML_FORM_CONTENT).toContain("<head>");
  expect(HTML_FORM_CONTENT).toContain("<body>");
  expect(HTML_FORM_CONTENT).toContain("</html>");
});

test("HTML_FORM_CONTENT should contain critical form elements", () => {
  expect(HTML_FORM_CONTENT).toContain("<form");
  expect(HTML_FORM_CONTENT).toContain('id="email"');
  expect(HTML_FORM_CONTENT).toContain('id="submitBtn"');
  expect(HTML_FORM_CONTENT).toContain('id="message"');
});
