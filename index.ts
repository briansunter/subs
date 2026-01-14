/**
 * Fastify server for email signup API
 * Supports CORS and iframe embedding for external sites
 */

import cors from "@fastify/cors";
import Fastify from "fastify";
import { getConfig } from "./src/config";
import { signupRoutes } from "./src/routes/signup";
import { logger } from "./src/utils/logger";

const config = getConfig();

const fastify = Fastify({
  logger: false, // Use our own logger
});

// Register CORS plugin with support for arbitrary origins
fastify.register(cors, {
  origin: config.allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours
});

// Security headers for iframe embed support
fastify.addHook("onSend", async (_request, reply, payload) => {
  // Remove frame options to allow iframe embedding
  reply.removeHeader("X-Frame-Options");

  // Set Content Security Policy to allow embedding from specific origins
  const csp = [
    `frame-ancestors 'self' ${config.allowedOrigins.filter((o: string) => o !== "*").join(" ")}`,
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
  ].join("; ");

  reply.header("Content-Security-Policy", csp);
  reply.header("X-Content-Type-Options", "nosniff");

  return payload;
});

// Request logging hook
fastify.addHook("onRequest", async (request, _reply) => {
  logger.info(
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
      headers: {
        "user-agent": request.headers["user-agent"],
        origin: request.headers.origin,
        referer: request.headers.referer,
      },
    },
    "Incoming request",
  );
});

// Response logging hook
fastify.addHook("onResponse", async (request, reply) => {
  const responseTime = reply.elapsedTime ?? 0;
  logger.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
    },
    "Request completed",
  );
});

// Register routes
fastify.register(signupRoutes, { prefix: "/api" });

// Serve the embeddable form HTML
fastify.get("/", async (_request, reply) => {
  reply.type("text/html");
  return `
<!DOCTYPE html>
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

          // Redirect if redirect URL is provided
          if (redirectUrl) {
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
      if (allowedOrigins.includes('*') ||
          allowedOrigins.includes(event.origin) ||
          config.allowedOrigins.includes('*')) {
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
    function notifyParent(type, data) {
      window.parent.postMessage({
        type: 'signup',
        status: type,
        data: data
      }, '*');
    }
  </script>
</body>
</html>
  `;
});

// Serve standalone embed script
fastify.get("/embed.js", async (request, reply) => {
  reply.type("application/javascript");
  const apiBaseUrl = `${request.protocol}://${request.headers.host}`;
  return `
(function() {
  function createSignupFrame(target) {
    const iframe = document.createElement('iframe');
    iframe.src = '${apiBaseUrl}/';
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '600px';
    iframe.style.overflow = 'hidden';

    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (container) {
      container.appendChild(iframe);
    } else {
      console.error('Signup embed: target not found');
    }

    return iframe;
  }

  function createInlineForm(target) {
    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!container) {
      console.error('Signup embed: target not found');
      return;
    }

    container.innerHTML = \`
      <style>
        .signup-form-embed {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
          margin: 0 auto;
        }
        .signup-form-embed input[type="email"],
        .signup-form-embed input[type="text"] {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .signup-form-embed button {
          width: 100%;
          padding: 12px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .signup-form-embed button:hover {
          background: #5568d3;
        }
        .signup-form-embed .message {
          padding: 10px;
          margin-top: 10px;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
        }
        .signup-form-embed .success {
          background: #d4edda;
          color: #155724;
        }
        .signup-form-embed .error {
          background: #f8d7da;
          color: #721c24;
        }
      </style>
      <form class="signup-form-embed" data-signup-form>
        <input type="email" name="email" placeholder="your@email.com" required />
        <input type="text" name="name" placeholder="Name (optional)" />
        <input type="hidden" name="sheetTab" value="Sheet1" />
        <button type="submit">Sign Up</button>
        <div class="message" style="display:none"></div>
      </form>
    \`;

    const form = container.querySelector('[data-signup-form]');
    const messageEl = container.querySelector('.message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        email: formData.get('email'),
        name: formData.get('name') || undefined,
        sheetTab: formData.get('sheetTab') || 'Sheet1',
        source: 'embed',
        tags: ['web-form']
      };

      form.querySelector('button').disabled = true;
      form.querySelector('button').textContent = 'Signing up...';
      messageEl.style.display = 'none';

      try {
        const response = await fetch('${apiBaseUrl}/api/signup/extended', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();

        messageEl.textContent = result.success
          ? (result.message || 'Successfully signed up!')
          : (result.error || 'An error occurred');
        messageEl.className = 'message ' + (result.success ? 'success' : 'error');
        messageEl.style.display = 'block';

        if (result.success) {
          form.reset();
        }
      } catch (err) {
        messageEl.textContent = 'Network error. Please try again.';
        messageEl.className = 'message error';
        messageEl.style.display = 'block';
      } finally {
        form.querySelector('button').disabled = false;
        form.querySelector('button').textContent = 'Sign Up';
      }
    });
  }

  // Expose functions globally
  window.SignupEmbed = {
    iframe: createSignupFrame,
    inline: createInlineForm
  };

  console.log('Signup Embed loaded. Use SignupEmbed.iframe(selector) or SignupEmbed.inline(selector)');
})();
  `;
});

// Start server
async function start() {
  try {
    await fastify.listen({
      port: config.port,
      host: config.host,
    });

    logger.info(`Server listening on ${config.host}:${config.port}`);
    logger.info(`Embed script: http://${config.host}:${config.port}/embed.js`);
    logger.info(`Form page: http://${config.host}:${config.port}/`);
  } catch (err) {
    logger.error({ error: err }, "Failed to start server");
    process.exit(1);
  }
}

start();
