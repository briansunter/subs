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
  expect(script).toContain("https://api.example.com/api/signup/extended");
});

test("getEmbedScript should expose SignupEmbed global", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("window.SignupEmbed");
  expect(script).toContain("SignupEmbed.iframe");
  expect(script).toContain("SignupEmbed.inline");
});

test("getEmbedScript should create iframe function", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("function createSignupFrame");
  expect(script).toContain("createElement('iframe')");
  expect(script).toContain("iframe.src");
});

test("getEmbedScript should create inline form function", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("function createInlineForm");
  expect(script).toContain("data-signup-form");
  expect(script).toContain('name="email"');
});

test("getEmbedScript should handle form submission", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("addEventListener('submit'");
  expect(script).toContain("fetch(");
  expect(script).toContain("'Content-Type': 'application/json'");
});

test("getEmbedScript should include error handling", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("try {");
  expect(script).toContain("catch");
  expect(script).toContain("finally");
});

test("getEmbedScript should log when loaded", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("console.log('Signup Embed loaded");
});

test("getEmbedScript should set iframe styles", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("style.border");
  expect(script).toContain("style.width");
  expect(script).toContain("style.overflow");
});
