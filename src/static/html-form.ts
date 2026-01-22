/**
 * HTML form for email signup
 * Served at the root path for iframe embedding
 */

import { getConfig } from "../config";

const config = getConfig();

export const HTML_FORM_CONTENT = `<!DOCTYPE html>
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
          <option value="Sheet1">General</option>
          <option value="Beta">Beta Users</option>
          <option value="Enterprise">Enterprise</option>
        </select>
      </div>

      <button type="submit" id="submitBtn">
        <span id="btnText">Sign Up</span>
      </button>

      <div id="message" class="message"></div>
    </form>
  </div>

  <script>
    const form = document.getElementById('signupForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const messageEl = document.getElementById('message');

    // Get configuration from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const apiEndpoint = urlParams.get('api') || '/api/signup/extended';
    const redirectUrl = urlParams.get('redirect');

    // Validated parent origin for postMessage (set when receiving messages)
    let validatedParentOrigin = null;

    /**
     * Validate redirect URL to prevent open redirect attacks
     * Only allows relative paths (starting with /) or same-origin URLs
     */
    function isValidRedirectUrl(url) {
      if (!url) return false;
      // Allow relative paths (but not protocol-relative URLs like //)
      if (url.startsWith('/') && !url.startsWith('//')) return true;
      try {
        const redirectOrigin = new URL(url, window.location.origin).origin;
        return redirectOrigin === window.location.origin;
      } catch {
        return false;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const name = document.getElementById('name').value;
      const sheetTab = document.getElementById('sheetTab').value;

      // Show loading state
      submitBtn.disabled = true;
      btnText.innerHTML = '<span class="loading"></span>Signing up...';
      messageEl.className = 'message';
      messageEl.textContent = '';

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            name: name || undefined,
            sheetTab,
            source: 'embed',
            tags: ['web-form']
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          messageEl.textContent = data.message || 'Successfully signed up!';
          messageEl.classList.add('success', 'show');
          form.reset();

          // Redirect if redirect URL is provided and validated
          if (redirectUrl && isValidRedirectUrl(redirectUrl)) {
            setTimeout(() => {
              window.location.href = redirectUrl;
            }, 1500);
          }
        } else {
          messageEl.textContent = data.error || 'An error occurred. Please try again.';
          messageEl.classList.add('error', 'show');
        }
      } catch (error) {
        messageEl.textContent = 'Network error. Please try again.';
        messageEl.classList.add('error', 'show');
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = 'Sign Up';
      }
    });

    // Allow postMessage communication from parent iframe
    window.addEventListener('message', (event) => {
      // Validate origin for security
      const allowedOrigins = ${JSON.stringify(config.allowedOrigins)};
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

    // Notify parent when form is submitted successfully
    // Uses validated parent origin instead of wildcard for security
    function notifyParent(type, data) {
      const targetOrigin = validatedParentOrigin || '*';
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
