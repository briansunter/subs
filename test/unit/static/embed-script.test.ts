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

test("getEmbedScript should expose SignupEmbed.create", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("window.SignupEmbed");
  expect(script).toContain("SignupEmbed");
  expect(script).toContain("create: create");
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
});

test("getEmbedScript should include error handling", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("try {");
  expect(script).toContain("catch");
  expect(script).toContain("finally");
});

test("getEmbedScript should log when loaded", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("console.log('SignupEmbed loaded");
});

test("getEmbedScript should support configuration options", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain("options.site");
  expect(script).toContain("options.sheetTab");
  expect(script).toContain("options.showName");
});

test("getEmbedScript should include inline form styles", () => {
  const script = getEmbedScript("https://api.example.com");
  expect(script).toContain(".signup-form-embed");
  expect(script).toContain("signup-embed-styles");
});
