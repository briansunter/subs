/**
 * Embed script for external sites
 * Creates inline signup forms with configurable options
 */

export const getEmbedScript = (apiBaseUrl: string): string => {
  return `
(function() {
  /**
   * Configuration options for SignupEmbed.create()
   * @typedef {Object} SignupOptions
   * @property {string} [site] - Site name that maps to a specific Google Sheet
   * @property {string} [sheetTab] - Which tab in the sheet (default: first available)
   * @property {boolean} [showName] - Show name field (default: true)
   */

  /**
   * Create an inline signup form
   * @param {string|HTMLElement} target - CSS selector or DOM element
   * @param {SignupOptions} [options] - Configuration options
   */
  function create(target, options) {
    options = options || {};
    const container = typeof target === 'string'
      ? document.querySelector(target)
      : target;

    if (!container) {
      console.error('SignupEmbed: target not found');
      return;
    }

    const showName = options.showName !== false;
    const site = options.site || '';
    const sheetTab = options.sheetTab || ''; // Empty = use server default

    const nameField = showName ? \`
      <input type="text" name="name" placeholder="Name (optional)" />
    \` : '';

    const siteInput = site ? \`
      <input type="hidden" name="site" value="\${site}" />
    \` : '';

    const styleId = 'signup-embed-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = \`
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
          box-sizing: border-box;
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
        .signup-form-embed button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .signup-form-embed .signup-message {
          padding: 10px;
          margin-top: 10px;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
        }
        .signup-form-embed .signup-success {
          background: #d4edda;
          color: #155724;
        }
        .signup-form-embed .signup-error {
          background: #f8d7da;
          color: #721c24;
        }
      \`;
      document.head.appendChild(styleEl);
    }

    const form = document.createElement('form');
    form.className = 'signup-form-embed';
    form.setAttribute('data-signup-form', '');

    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.name = 'email';
    emailInput.placeholder = 'your@email.com';
    emailInput.required = true;
    form.appendChild(emailInput);

    if (showName) {
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.name = 'name';
      nameInput.placeholder = 'Name (optional)';
      form.appendChild(nameInput);
    }

    if (sheetTab) {
      const sheetTabInput = document.createElement('input');
      sheetTabInput.type = 'hidden';
      sheetTabInput.name = 'sheetTab';
      sheetTabInput.value = sheetTab;
      form.appendChild(sheetTabInput);
    }

    if (site) {
      const siteInput = document.createElement('input');
      siteInput.type = 'hidden';
      siteInput.name = 'site';
      siteInput.value = site;
      form.appendChild(siteInput);
    }

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Sign Up';
    form.appendChild(submitBtn);

    const messageEl = document.createElement('div');
    messageEl.className = 'signup-message';
    messageEl.style.display = 'none';
    form.appendChild(messageEl);

    container.appendChild(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {
        email: formData.get('email'),
        name: formData.get('name') || undefined,
        sheetTab: formData.get('sheetTab') || undefined, // Let server use default
        site: formData.get('site') || undefined,
        source: 'embed',
        tags: ['web-form']
      };

      // Remove undefined properties
      Object.keys(data).forEach(key => {
        if (data[key] === undefined) delete data[key];
      });

      submitBtn.disabled = true;
      submitBtn.textContent = 'Signing up...';
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
        messageEl.className = 'signup-message ' + (result.success ? 'signup-success' : 'signup-error');
        messageEl.style.display = 'block';

        if (result.success) {
          form.reset();
        }
      } catch (err) {
        messageEl.textContent = 'Network error. Please try again.';
        messageEl.className = 'signup-message signup-error';
        messageEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
      }
    });

    return form;
  }

  // Expose SignupEmbed globally
  window.SignupEmbed = {
    create: create
  };

  console.log('SignupEmbed loaded. Use SignupEmbed.create(selector, options)');
  console.log('Options: { site: string, sheetTab: string, showName: boolean }');
})();
  `;
};
