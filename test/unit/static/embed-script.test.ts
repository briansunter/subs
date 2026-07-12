/**
 * Unit tests for embed script static content
 */

import { expect, test } from "bun:test";
import { getEmbedScript } from "../../../src/static/embed-script";

test("getEmbedScript should return valid JavaScript", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toBeDefined();
  expect(typeof script).toBe("string");
  expect(script.trim()).toStartWith("(function() {");
  expect(script.trim()).toEndWith("})();");
});

test("getEmbedScript should include API base URL", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("https://api.example.com/");
  expect(script).toContain("https://api.example.com/api/config");
  expect(script).toContain("https://api.example.com/api/signup/extended");
});

test("getEmbedScript should expose SignupEmbed.create", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("window.SignupEmbed");
  expect(script).toContain("SignupEmbed");
  expect(script).toContain("create: create");
  expect(script).toContain("inline: inline");
  expect(script).toContain("iframe: iframe");
});

test("getEmbedScript should create inline form function", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("function create(target, options)");
  expect(script).toContain("data-signup-form");
  expect(script).toContain("emailInput.name = 'email'");
});

test("getEmbedScript should handle form submission", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("addEventListener('submit'");
  expect(script).toContain("fetch(");
  expect(script).toContain("'Content-Type': 'application/json'");
  expect(script).toContain("data.turnstileToken");
});

test("getEmbedScript should include error handling", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("try {");
  expect(script).toContain("catch");
  expect(script).toContain("finally");
  expect(script).toContain("Turnstile is still loading. Please try again.");
});

test("getEmbedScript should keep debug logging opt-in", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("window.SignupEmbedDebug");
  expect(script).toContain("console.log('SignupEmbed loaded");
});

test("getEmbedScript should support configuration options", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("options.site");
  expect(script).toContain("options.sheetTab");
  expect(script).toContain("options.showName");
  expect(script).toContain("options.redirect");
  expect(script).toContain("options.api");
});

test("getEmbedScript should include inline form styles", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain(".signup-form-embed");
  expect(script).toContain("signup-embed-styles");
  expect(script).toContain("challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
});

test("getEmbedScript quotes API base URL safely for normal values", () => {
  const script = getEmbedScript("https://api.example.com");
  // The base URL is emitted as a quoted JS string literal, not raw text.
  expect(script).toContain('fetch("https://api.example.com/api/config")');
  expect(script).toContain('fetch("https://api.example.com/api/signup/extended", {');
  expect(script).toContain('"https://api.example.com/"');
});

test("getEmbedScript neutralizes a hostile API base URL", () => {
  // Contains single and double quotes, a backslash, a newline, and a
  // script-like sequence designed to break out of a raw string literal.
  const hostile = 'https://evil.com\');alert("pwned");//\n</script>\\bs';
  const script = getEmbedScript(hostile);

  // The generated code must remain syntactically valid JavaScript: the
  // breakout attempt cannot close the string literal or inject statements.
  expect(() => new Function(script)).not.toThrow();

  // The injected call must not survive as executable source. JSON.stringify
  // escapes the double quotes that would otherwise close the serialized
  // string, so the payload stays inside the string literal.
  expect(script).not.toContain('alert("pwned")');
  // A raw newline adjacent to the script-like sequence must be escaped, not
  // emitted literally as a control character in the source.
  expect(script).not.toContain("\n</script>");
});
