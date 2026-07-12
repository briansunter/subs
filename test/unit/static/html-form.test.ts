/**
 * Unit tests for HTML form static content
 */

import { beforeEach, expect, test } from "bun:test";
import { clearConfigCache, type SignupConfig } from "../../../src/config";
import { getHtmlFormContent, HTML_FORM_CONTENT } from "../../../src/static/html-form";

beforeEach(() => {
  clearConfigCache();
  process.env["GOOGLE_SHEET_ID"] = "test-sheet-id";
  process.env["GOOGLE_CREDENTIALS_EMAIL"] = "test@test.com";
  process.env["GOOGLE_PRIVATE_KEY"] = "test-key";
  process.env["ALLOWED_ORIGINS"] = "https://example.com";
});

function buildConfig(overrides: Partial<SignupConfig> = {}): SignupConfig {
  return {
    port: 3000,
    host: "0.0.0.0",
    googleSheetId: "sheet-id",
    googleCredentialsEmail: "test@example.com",
    googlePrivateKey: "private-key",
    defaultSheetTab: "Sheet1",
    turnstileSecretKey: undefined,
    turnstileSiteKey: undefined,
    allowedOrigins: ["*"],
    enableMetrics: true,
    nodeEnv: "test",
    logLevel: "silent",
    allowedSheets: new Map(),
    sheetTabs: ["Sheet1"],
    ...overrides,
  };
}

/**
 * Extract a named function's source from the generated inline script by
 * balancing braces, so the runtime validator logic can be exercised directly
 * with a mocked window.location.origin instead of only string-matched.
 */
function extractFunctionSource(html: string, name: string): string {
  const start = html.indexOf(`function ${name}(`);
  if (start === -1) {
    throw new Error(`function ${name} not found in HTML`);
  }
  let i = html.indexOf("{", start);
  if (i === -1) {
    throw new Error(`opening brace for ${name} not found`);
  }
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") {
      depth++;
    } else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        return html.slice(start, i + 1);
      }
    }
  }
  throw new Error(`unbalanced braces for ${name}`);
}

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

test("getHtmlFormContent should include Turnstile configuration when enabled", () => {
  const html = getHtmlFormContent({
    port: 3000,
    host: "0.0.0.0",
    googleSheetId: "sheet-id",
    googleCredentialsEmail: "test@example.com",
    googlePrivateKey: "private-key",
    defaultSheetTab: "Newsletter",
    turnstileSecretKey: "secret-key",
    turnstileSiteKey: "site-key",
    allowedOrigins: ["https://example.com"],
    enableMetrics: true,
    nodeEnv: "test",
    logLevel: "silent",
    allowedSheets: new Map(),
    sheetTabs: ["Newsletter", "Beta"],
  });

  expect(html).toContain('id="turnstileGroup"');
  expect(html).toContain('id="turnstileContainer"');
  expect(html).toContain("const turnstileRequired = true");
  expect(html).toContain('"site-key"');
});

test("getHtmlFormContent should validate iframe api overrides", () => {
  const html = getHtmlFormContent({
    port: 3000,
    host: "0.0.0.0",
    googleSheetId: "sheet-id",
    googleCredentialsEmail: "test@example.com",
    googlePrivateKey: "private-key",
    defaultSheetTab: "Sheet1",
    turnstileSecretKey: undefined,
    turnstileSiteKey: undefined,
    allowedOrigins: ["*"],
    enableMetrics: true,
    nodeEnv: "test",
    logLevel: "silent",
    allowedSheets: new Map(),
    sheetTabs: ["Sheet1"],
  });

  expect(html).toContain("function isValidApiEndpoint");
  expect(html).toContain(
    "const apiEndpoint = isValidApiEndpoint(apiParam) ? apiParam : '/api/signup/extended';",
  );
  // The validator no longer trusts a raw slash prefix (which admits
  // /\evil.example after backslash normalization); protocol-relative URLs are
  // rejected up front and the parsed origin is validated instead.
  expect(html).toContain("if (url.startsWith('//')) return false;");
  expect(html).not.toContain("if (url.startsWith('/') && !url.startsWith('//')) return true;");
  expect(html).toContain("return endpointOrigin === window.location.origin;");
});

test("getHtmlFormContent neutralizes a hostile Turnstile site key in the inline script", () => {
  const html = getHtmlFormContent(
    buildConfig({
      turnstileSecretKey: "secret",
      turnstileSiteKey: '</script><script>alert("pwned")</script>',
    }),
  );

  // The hostile value must not terminate the inline <script> element.
  expect(html).not.toContain("</script><script>");
  // The injected call must not appear with live (unescaped) quotes.
  expect(html).not.toContain('alert("pwned")');

  // The inline script must remain syntactically valid JavaScript.
  const openTag = "<script>";
  const start = html.indexOf(openTag) + openTag.length;
  const end = html.lastIndexOf("</script>");
  const inlineScript = html.slice(start, end);
  expect(() => new Function(inlineScript)).not.toThrow();
});

test("getHtmlFormContent neutralizes hostile allowed origins in the inline script", () => {
  const html = getHtmlFormContent(
    buildConfig({
      allowedOrigins: ['https://good.com",</script><script>alert("pwned")</script>'],
    }),
  );

  expect(html).not.toContain("</script><script>");
  expect(html).not.toContain('alert("pwned")');
});

test("getHtmlFormContent escapes U+2028 and U+2029 in serialized config values", () => {
  // U+2028/U+2029 are line separators that break JS string literals; build
  // them with explicit escapes so the test source stays visible ASCII.
  const hostileKey = "a\u2028b\u2029c";
  const html = getHtmlFormContent(
    buildConfig({ turnstileSecretKey: "secret", turnstileSiteKey: hostileKey }),
  );

  // The raw separator characters must not appear verbatim in the output.
  expect(html).not.toContain("\u2028");
  expect(html).not.toContain("\u2029");
  // scriptValue emits them as JS escape sequences instead.
  expect(html).toContain("\\u2028");
  expect(html).toContain("\\u2029");
});

test("getHtmlFormContent selects the configured default sheet tab instead of the first tab", () => {
  const html = getHtmlFormContent(
    buildConfig({
      defaultSheetTab: "Newsletter",
      sheetTabs: ["Sheet1", "Newsletter", "Beta"],
    }),
  );

  // The configured default (Newsletter) is the selected option.
  expect(html).toContain('<option value="Newsletter" selected>Newsletter</option>');
  // Sheet1 is first in the list but must not be selected when it is not the default.
  expect(html).toContain('<option value="Sheet1">Sheet1</option>');
  expect(html).not.toContain('<option value="Sheet1" selected>');
  // Option ordering is preserved; Beta remains present and unselected.
  expect(html).toContain('<option value="Beta">Beta</option>');
  expect(html).not.toContain('<option value="Beta" selected>');
});

test("getHtmlFormContent falls back to the first tab when the default is absent from sheetTabs", () => {
  const html = getHtmlFormContent(
    buildConfig({
      defaultSheetTab: "Missing",
      sheetTabs: ["Sheet1", "Newsletter", "Beta"],
    }),
  );

  // With an unmatched default, the select must still have exactly one selected
  // option, falling back to index 0.
  expect(html).toContain('<option value="Sheet1" selected>Sheet1</option>');
  expect(html).not.toContain('<option value="Newsletter" selected>');
  expect(html).not.toContain('<option value="Beta" selected>');
});

test("isValidRedirectUrl rejects backslash-normalized and protocol-relative open redirects", () => {
  const html = getHtmlFormContent(buildConfig());

  // The redirect validator must not short-circuit on a starts-with-slash check:
  // such a check admits /\evil.example, which the URL parser normalizes to an
  // external origin. Validate by origin instead.
  const redirectSource = extractFunctionSource(html, "isValidRedirectUrl");
  // Protocol-relative URLs (//host) are rejected up front, before the parsed
  // origin is even considered.
  expect(redirectSource).toContain("if (url.startsWith('//')) return false;");
  expect(redirectSource).not.toContain(
    "if (url.startsWith('/') && !url.startsWith('//')) return true;",
  );
  expect(redirectSource).toContain("return redirectOrigin === window.location.origin;");

  // Drive the emitted validator directly with a mocked origin so the dangerous
  // inputs are checked at runtime, not just by source inspection.
  const makeValidator = new Function("window", `${redirectSource}; return isValidRedirectUrl;`);
  const isValid = makeValidator({ location: { origin: "https://example.com" } });

  // Same-origin redirects are preserved: relative paths and same-origin
  // absolute URLs both resolve to the form origin.
  expect(isValid("/thank-you")).toBe(true);
  expect(isValid("/path?from=embed#section")).toBe(true);
  expect(isValid("https://example.com/thanks")).toBe(true);

  // Protocol-relative URLs are rejected outright, even same-host variants
  // that would otherwise resolve to the form origin.
  expect(isValid("//example.com/thanks")).toBe(false);

  // Backslash-normalized external origins are rejected. These all start with a
  // slash (but not "//") yet resolve to https://evil.example.
  expect(isValid("/\\evil.example")).toBe(false);
  expect(isValid("/\\\\evil.example")).toBe(false);
  expect(isValid("\\\\evil.example")).toBe(false);

  // Protocol-relative and absolute external origins are rejected.
  expect(isValid("//evil.example")).toBe(false);
  expect(isValid("https://evil.example")).toBe(false);
  expect(isValid("http://evil.example/path")).toBe(false);

  // Dangerous schemes resolve to an opaque origin and are rejected.
  expect(isValid("javascript:alert(1)")).toBe(false);

  // Empty input is rejected (the non-empty guard is preserved).
  expect(isValid("")).toBe(false);
});

test("isValidApiEndpoint rejects backslash-normalized and protocol-relative origins", () => {
  const html = getHtmlFormContent(buildConfig());

  // The API endpoint validator must not short-circuit on a starts-with-slash
  // check: such a check admits /\evil.example, which the URL parser normalizes
  // to an external origin and would send the signup POST off-site. Validate by
  // origin instead.
  const apiSource = extractFunctionSource(html, "isValidApiEndpoint");
  // Protocol-relative URLs (//host) are rejected up front, before the parsed
  // origin is even considered.
  expect(apiSource).toContain("if (url.startsWith('//')) return false;");
  expect(apiSource).not.toContain("if (url.startsWith('/') && !url.startsWith('//')) return true;");
  expect(apiSource).toContain("return endpointOrigin === window.location.origin;");

  // Drive the emitted validator directly with a mocked origin so the dangerous
  // inputs are checked at runtime, not just by source inspection.
  const makeValidator = new Function("window", `${apiSource}; return isValidApiEndpoint;`);
  const isValid = makeValidator({ location: { origin: "https://example.com" } });

  // Valid root-relative API paths are preserved, including query and fragment.
  expect(isValid("/api/signup/extended")).toBe(true);
  expect(isValid("/api/signup/extended?site=foo#frag")).toBe(true);

  // Same-origin absolute URLs are preserved.
  expect(isValid("https://example.com/api/signup/extended")).toBe(true);

  // Protocol-relative URLs are rejected outright, even same-host variants
  // that would otherwise resolve to the form origin (and thus pass a pure
  // origin comparison).
  expect(isValid("//example.com/api/signup/extended")).toBe(false);

  // Backslash-normalized external origins are rejected. These start with a
  // slash (but not "//") yet resolve to https://evil.example.
  expect(isValid("/\\evil.example")).toBe(false);
  expect(isValid("/\\\\evil.example")).toBe(false);
  expect(isValid("\\\\evil.example")).toBe(false);

  // Protocol-relative and absolute external origins are rejected: a POST to
  // these would leak signup data off-site.
  expect(isValid("//evil.example")).toBe(false);
  expect(isValid("https://evil.example")).toBe(false);
  expect(isValid("http://evil.example/path")).toBe(false);

  // Dangerous schemes resolve to an opaque origin and are rejected.
  expect(isValid("javascript:alert(1)")).toBe(false);

  // Empty input is rejected (the non-empty guard is preserved).
  expect(isValid("")).toBe(false);
});

interface NotifierCall {
  data: unknown;
  target: string;
}

interface NotifierOptions {
  handshakeOrigin?: string | null;
  origins?: string[];
  referrer?: string;
  topLevel?: boolean;
}

/**
 * Drive the emitted notifyParent -> resolveParentOrigin -> postMessage path
 * with mocked window/document state. The parent's postMessage is captured so
 * tests can assert exactly which concrete origin (if any) received the signup
 * notification, and that no wildcard target is ever used.
 */
function makeNotifier(
  html: string,
  options: NotifierOptions = {},
): {
  calls: NotifierCall[];
  notify: (type: string, data: unknown) => void;
} {
  const { handshakeOrigin = null, origins = ["*"], referrer = "", topLevel = false } = options;
  const calls: NotifierCall[] = [];
  const spy = (data: unknown, target: string): void => {
    calls.push({ data, target });
  };

  // The emitted code only touches window.parent (and, in top-level use,
  // window.postMessage). Build the minimal mock that satisfies both shapes.
  const parentWindow = { postMessage: spy };
  const mockWindow: { parent?: unknown; postMessage?: typeof spy } = topLevel
    ? { postMessage: spy }
    : { parent: parentWindow };
  if (topLevel) {
    // window.parent === window in a top-level browsing context.
    mockWindow.parent = mockWindow;
  }
  const mockDocument = { referrer };

  const resolveSource = extractFunctionSource(html, "resolveParentOrigin");
  const notifySource = extractFunctionSource(html, "notifyParent");
  const factory = new Function(
    "window",
    "document",
    "allowedOrigins",
    "validatedParentOrigin",
    `${resolveSource}\n${notifySource}\nreturn notifyParent;`,
  );
  const notify = factory(mockWindow, mockDocument, origins, handshakeOrigin) as (
    type: string,
    data: unknown,
  ) => void;
  return { calls, notify };
}

test("notifyParent never falls back to a wildcard postMessage target", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["https://example.com"] }));

  const notifySource = extractFunctionSource(html, "notifyParent");
  // The wildcard fallback is gone. notifyParent delegates to a resolver that
  // returns a concrete origin or null and never hands "*" to postMessage.
  expect(notifySource).not.toContain("|| '*'");
  expect(notifySource).not.toContain("'*'");
  expect(notifySource).toContain("resolveParentOrigin()");
  // The obsolete fallback expression must not survive anywhere in the script.
  expect(html).not.toContain("validatedParentOrigin || '*'");

  const resolveSource = extractFunctionSource(html, "resolveParentOrigin");
  expect(resolveSource).toContain("window.parent === window");
  expect(resolveSource).toContain("document.referrer");
  expect(resolveSource).toContain("new URL(document.referrer).origin");
  expect(resolveSource).toContain("allowedOrigins.includes('*')");
  expect(resolveSource).toContain("allowedOrigins.includes(referrerOrigin)");
});

test("the parent handshake accepts messages only from window.parent", () => {
  const html = getHtmlFormContent(buildConfig());
  // Without this guard any sibling frame could post a handshake from an
  // allowed origin and prime validatedParentOrigin. event.source is the only
  // reliable, browser-enforced signal that the sender is the actual parent.
  expect(html).toContain("event.source !== window.parent");
});

test("notifyParent posts to the handshake-validated parent origin", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["https://example.com"] }));
  const { calls, notify } = makeNotifier(html, {
    handshakeOrigin: "https://example.com",
    origins: ["https://example.com"],
    // A disallowed referrer must be ignored in favor of the handshake origin.
    referrer: "https://evil.example/page",
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(1);
  expect(calls[0]?.target).toBe("https://example.com");
});

test("notifyParent falls back to an allowed document.referrer origin", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["https://example.com"] }));
  const { calls, notify } = makeNotifier(html, {
    origins: ["https://example.com"],
    referrer: "https://example.com/blog/embed",
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(1);
  expect(calls[0]?.target).toBe("https://example.com");
});

test("notifyParent accepts any concrete referrer under a wildcard config", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["*"] }));
  const { calls, notify } = makeNotifier(html, {
    origins: ["*"],
    referrer: "https://anywhere.example/embed",
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(1);
  // Concrete origin only — the literal "*" target must never be used.
  expect(calls[0]?.target).toBe("https://anywhere.example");
});

test("notifyParent posts nothing when document.referrer is a disallowed origin", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["https://example.com"] }));
  const { calls, notify } = makeNotifier(html, {
    origins: ["https://example.com"],
    referrer: "https://evil.example/page",
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(0);
});

test("notifyParent posts nothing when document.referrer is missing", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["https://example.com"] }));
  const { calls, notify } = makeNotifier(html, {
    origins: ["https://example.com"],
    referrer: "",
  });
  notify("error", { error: "boom" });

  expect(calls).toHaveLength(0);
});

test("notifyParent posts nothing for an opaque referrer origin", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["*"] }));
  // A data: referrer parses to an opaque origin ("null"); even under a
  // wildcard config it must not be trusted as a postMessage target.
  const { calls, notify } = makeNotifier(html, {
    origins: ["*"],
    referrer: "data:text/plain,hi",
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(0);
});

test("notifyParent is a no-op for direct top-level form use", () => {
  const html = getHtmlFormContent(buildConfig({ allowedOrigins: ["*"] }));
  // Top-level use: window.parent === window, and a referrer may still be
  // present from whatever page linked the form. There is no parent to notify.
  const { calls, notify } = makeNotifier(html, {
    origins: ["*"],
    referrer: "https://example.com/linked-from-here",
    topLevel: true,
  });
  notify("success", { email: "a@b.com" });

  expect(calls).toHaveLength(0);
});
