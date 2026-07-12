/**
 * HTML form for email signup
 * Served at the root path for iframe embedding
 */

import type { SignupConfig } from "../config";

/**
 * Escape HTML entities to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Serialize a value for safe embedding inside an inline <script> element.
 * JSON.stringify yields a valid JS literal, but on its own it does not stop a
 * value containing "</script>", "<", ">", "&", or the Unicode line separators
 * U+2028/U+2029 from terminating the script element or breaking the JS string
 * literal. Escape those characters as JS escape sequences after serialization
 * so the runtime value is unchanged while the source stays inert.
 */
function scriptValue(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Generate HTML form content with dynamic sheet tabs
 */
export function getHtmlFormContent(config: SignupConfig): string {
  // Select the configured default tab rather than always the first tab. Use the
  // first matching occurrence; if the default is absent from sheetTabs (e.g. a
  // hand-built SignupConfig), fall back to index 0 so the select keeps one
  // selected option and submitted value stays safe.
  const defaultTabIndex = config.sheetTabs.indexOf(config.defaultSheetTab);
  const selectedIndex = defaultTabIndex === -1 ? 0 : defaultTabIndex;
  const sheetTabOptions = config.sheetTabs
    .map(
      (tab, i) =>
        `<option value="${escapeHtml(tab)}"${i === selectedIndex ? " selected" : ""}>${escapeHtml(tab)}</option>`,
    )
    .join("\n          ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signup Form</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 400px;
      width: 100%;
    }
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 24px;
      text-align: center;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      text-align: center;
      font-size: 14px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      color: #555;
      font-weight: 500;
      margin-bottom: 8px;
      font-size: 14px;
    }
    input[type="email"],
    input[type="text"],
    select {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e1e8ed;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    button:active {
      transform: translateY(0);
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .message {
      padding: 12px;
      border-radius: 8px;
      margin-top: 20px;
      font-size: 14px;
      text-align: center;
      display: none;
    }
    .message.success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .message.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .message.show {
      display: block;
    }
    .loading {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #fff;
      border-radius: 50%;
      border-top-color: transparent;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .hidden {
      display: none;
    }
    #turnstileGroup {
      display: none;
    }
    .turnstile-note {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: 8px;
      color: #856404;
      font-size: 13px;
      padding: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sign Up</h1>
    <p class="subtitle">Join our newsletter</p>

    <form id="signupForm">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="your@email.com"
          autocomplete="email"
        >
      </div>

      <div class="form-group">
        <label for="name">Name (optional)</label>
        <input
          type="text"
          id="name"
          name="name"
          placeholder="John Doe"
          autocomplete="name"
        >
      </div>

      <div class="form-group">
        <label for="sheetTab">List</label>
        <select id="sheetTab" name="sheetTab">
          ${sheetTabOptions}
        </select>
      </div>

      <div class="form-group" id="turnstileGroup">
        <div id="turnstileContainer"></div>
      </div>

      <button type="submit" id="submitBtn">
        <span id="btnText">Sign Up</span>
        <span id="btnLoading" class="loading hidden"></span>
      </button>

      <div id="message" class="message"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('signupForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnLoading = document.getElementById('btnLoading');
    const messageEl = document.getElementById('message');
    const turnstileGroup = document.getElementById('turnstileGroup');
    const turnstileContainer = document.getElementById('turnstileContainer');

    // Get configuration from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const turnstileRequired = ${scriptValue(Boolean(config.turnstileSecretKey))};
    const turnstileSiteKey = ${scriptValue(config.turnstileSiteKey ?? null)};
    const apiParam = urlParams.get('api');
    const apiEndpoint = isValidApiEndpoint(apiParam) ? apiParam : '/api/signup/extended';
    const redirectUrl = urlParams.get('redirect');
    const site = urlParams.get('site');
    const initialSheetTab = urlParams.get('sheetTab');
    let turnstileScriptPromise = null;
    let turnstileWidgetId = null;
    let turnstileLoadError = null;

    if (initialSheetTab) {
      const sheetTabSelect = document.getElementById('sheetTab');
      if (sheetTabSelect && Array.from(sheetTabSelect.options).some(opt => opt.value === initialSheetTab)) {
        sheetTabSelect.value = initialSheetTab;
      }
    }

    // Validated parent origin for postMessage (set when the parent completes
    // the origin handshake). When null, notifyParent derives a trustworthy
    // origin from document.referrer instead of ever posting to a wildcard.
    let validatedParentOrigin = null;

    // Origins permitted to embed this form and receive postMessage
    // notifications. Hoisted to script scope so both the parent handshake and
    // the referrer-based fallback consult the same allow list.
    const allowedOrigins = ${scriptValue(config.allowedOrigins)};

    /**
     * Validate redirect URL to prevent open redirect attacks.
     * Only allows relative paths or same-origin absolute URLs.
     */
    function isValidRedirectUrl(url) {
      if (!url) return false;
      // Reject protocol-relative URLs (//host/path) outright. They inherit the
      // page's scheme, so a same-host variant like //example.com/thanks would
      // resolve to the form origin and pass a pure origin comparison.
      if (url.startsWith('//')) return false;
      try {
        // Browsers (and the URL parser) normalize backslashes to slashes in
        // special-scheme URLs, so /\\evil.example resolves to https://evil.example.
        // A starts-with-slash check cannot catch that, so validate the parsed
        // origin instead to permit only relative paths and same-origin absolute URLs.
        const redirectOrigin = new URL(url, window.location.origin).origin;
        return redirectOrigin === window.location.origin;
      } catch {
        return false;
      }
    }

    function isValidApiEndpoint(url) {
      if (!url) return false;
      // Reject protocol-relative URLs (//host/path) outright. They inherit the
      // page's scheme, so a same-host variant like //example.com/api would
      // resolve to the form origin and pass a pure origin comparison.
      if (url.startsWith('//')) return false;
      try {
        // Browsers (and the URL parser) normalize backslashes to slashes in
        // special-scheme URLs, so /\\evil.example resolves to https://evil.example.
        // A starts-with-slash check cannot catch that, so validate the parsed
        // origin instead to permit only relative API paths and same-origin
        // absolute URLs.
        const endpointOrigin = new URL(url, window.location.origin).origin;
        return endpointOrigin === window.location.origin;
      } catch {
        return false;
      }
    }

    async function loadTurnstileScript() {
      if (!turnstileRequired) {
        return false;
      }

      if (window.turnstile) {
        return true;
      }

      if (turnstileScriptPromise) {
        return turnstileScriptPromise;
      }

      turnstileScriptPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });

      return turnstileScriptPromise;
    }

    async function setupTurnstile() {
      if (!turnstileRequired) {
        return;
      }

      turnstileGroup.style.display = 'block';

      if (!turnstileSiteKey) {
        turnstileLoadError = 'Turnstile is required but not fully configured.';
        turnstileContainer.textContent = turnstileLoadError;
        turnstileContainer.className = 'turnstile-note';
        return;
      }

      const loaded = await loadTurnstileScript();
      if (!loaded || !window.turnstile) {
        turnstileLoadError = 'Failed to load Turnstile. Please reload and try again.';
        turnstileContainer.textContent = turnstileLoadError;
        turnstileContainer.className = 'turnstile-note';
        return;
      }

      turnstileContainer.className = '';
      turnstileContainer.textContent = '';
      turnstileWidgetId = window.turnstile.render(turnstileContainer, {
        sitekey: turnstileSiteKey,
        callback: () => {},
        'expired-callback': () => {},
        'error-callback': () => {},
      });
    }

    function getTurnstileToken() {
      if (!turnstileRequired) {
        return null;
      }

      if (turnstileLoadError) {
        throw new Error(turnstileLoadError);
      }

      if (!window.turnstile || turnstileWidgetId === null) {
        throw new Error('Turnstile is still loading. Please try again.');
      }

      const token = window.turnstile.getResponse(turnstileWidgetId);
      if (!token) {
        throw new Error('Please complete the Turnstile check.');
      }

      return token;
    }

    function resetTurnstile() {
      if (!turnstileRequired || !window.turnstile || turnstileWidgetId === null) {
        return;
      }

      window.turnstile.reset(turnstileWidgetId);
    }

    const turnstileReady = setupTurnstile();

    function showLoading() {
      submitBtn.disabled = true;
      btnText.textContent = 'Signing up...';
      btnLoading.classList.remove('hidden');
      messageEl.className = 'message';
      messageEl.textContent = '';
    }

    function hideLoading() {
      submitBtn.disabled = false;
      btnText.textContent = 'Sign Up';
      btnLoading.classList.add('hidden');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await turnstileReady;

      const email = document.getElementById('email').value;
      const name = document.getElementById('name').value;
      const sheetTab = document.getElementById('sheetTab').value;

      showLoading();

      try {
        const body = {
          email,
          name: name || undefined,
          sheetTab,
          source: 'embed',
          tags: ['web-form']
        };

        const turnstileToken = getTurnstileToken();
        if (turnstileToken) {
          body.turnstileToken = turnstileToken;
        }

        // Add site if provided
        if (site) {
          body.site = site;
        }

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body)
        });

        const data = await response.json();

        if (response.ok && data.success) {
          messageEl.textContent = data.message || 'Successfully signed up!';
          messageEl.className = 'message success show';
          form.reset();

          // Notify parent iframe of success
          notifyParent('success', { email });

          // Redirect if redirect URL is provided and validated
          if (redirectUrl && isValidRedirectUrl(redirectUrl)) {
            setTimeout(() => {
              window.location.href = redirectUrl;
            }, 1500);
          }
        } else {
          const firstDetail = Array.isArray(data.details) && data.details.length > 0
            ? data.details[0]
            : null;
          messageEl.textContent = firstDetail || data.error || 'An error occurred. Please try again.';
          messageEl.className = 'message error show';

          // Notify parent iframe of error
          notifyParent('error', { error: data.error });
        }
      } catch (error) {
        messageEl.textContent = error instanceof Error ? error.message : 'Network error. Please try again.';
        messageEl.className = 'message error show';
      } finally {
        resetTurnstile();
        hideLoading();
      }
    });

    // Allow postMessage communication from the parent iframe only. Accepting
    // messages from any other frame would let an unrelated window complete the
    // origin handshake and prime validatedParentOrigin, or exfiltrate form data
    // via the getFormData reply.
    window.addEventListener('message', (event) => {
      // Only the actual parent window may complete the handshake or request
      // form data. event.source is set by the browser and cannot be spoofed by
      // the sender, so it reliably identifies the message's true source.
      if (event.source !== window.parent) {
        return;
      }
      // Validate origin for security
      if (allowedOrigins.includes('*') || allowedOrigins.includes(event.origin)) {
        // Store validated parent origin for secure postMessage responses
        validatedParentOrigin = event.origin;

        if (event.data === 'getFormData') {
          // Send form data back to parent
          window.parent.postMessage({
            type: 'formData',
            email: document.getElementById('email').value
          }, event.origin);
        }
      }
    });

    // Resolve a concrete, trustworthy origin to target for parent
    // notifications, or null when no such origin can be established. Never
    // returns a wildcard: posting to "*" would broadcast the submitted email
    // to any window listening for messages.
    //
    // Precedence:
    //   1. Top-level form use (window.parent === window): there is no parent
    //      to notify, so direct top-level use is unaffected.
    //   2. A parent-handshake-validated origin: event.origin is browser-verified
    //      when the handshake message arrived, so it is always trusted.
    //   3. The embedding page's origin derived from document.referrer, but only
    //      when it is an explicitly allowed origin (or the deployment allows
    //      any origin via "*"). Missing, unparseable, opaque, or disallowed
    //      referrers yield no notification.
    function resolveParentOrigin() {
      // Top-level browsing context: nothing to notify.
      if (window.parent === window) {
        return null;
      }
      if (validatedParentOrigin) {
        return validatedParentOrigin;
      }
      // Derive the embedding page's origin from the referrer the browser
      // recorded when loading this iframe.
      if (!document.referrer) {
        return null;
      }
      let referrerOrigin;
      try {
        referrerOrigin = new URL(document.referrer).origin;
      } catch {
        return null;
      }
      // Reject opaque origins (the string "null" from data:/sandboxed sources)
      // and any origin not on the allow list. The wildcard entry permits any
      // concrete origin; otherwise require an exact match.
      if (
        referrerOrigin &&
        referrerOrigin !== 'null' &&
        (allowedOrigins.includes('*') || allowedOrigins.includes(referrerOrigin))
      ) {
        return referrerOrigin;
      }
      return null;
    }

    // Notify parent when the form is submitted. Posts only to the concrete
    // origin resolved above, or sends nothing when no trustworthy origin exists.
    function notifyParent(type, data) {
      const targetOrigin = resolveParentOrigin();
      if (!targetOrigin) {
        return;
      }
      window.parent.postMessage({
        type: 'signup',
        status: type,
        data: data
      }, targetOrigin);
    }
  </script>
</body>
</html>
`;
}

// Backwards compatibility: export a default constant without reading env at module load time.
const DEFAULT_HTML_FORM_CONFIG: SignupConfig = {
  port: 3000,
  host: "0.0.0.0",
  googleSheetId: "",
  googleCredentialsEmail: "",
  googlePrivateKey: "",
  defaultSheetTab: "Sheet1",
  turnstileSecretKey: undefined,
  turnstileSiteKey: undefined,
  allowedOrigins: ["*"],
  enableMetrics: true,
  nodeEnv: "development",
  logLevel: "info",
  allowedSheets: new Map(),
  sheetTabs: ["Sheet1"],
};

export const HTML_FORM_CONTENT = getHtmlFormContent(DEFAULT_HTML_FORM_CONFIG);
