/**
 * Embed script for external sites
 * Creates iframe or inline signup forms
 */

export const getEmbedScript = (apiBaseUrl: string): string => {
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
};
