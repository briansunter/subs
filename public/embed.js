/**
 * SignupEmbed - Dead-simple signup form embedding with auto-injected Turnstile
 *
 * Usage:
 *   <div id="signup-form"></div>
 *   <script src="https://your-domain.com/embed.js"></script>
 *   <script>
 *     SignupEmbed.init('#signup-form', {
 *       endpoint: '/api/signup/extended',
 *       sheetTab: 'Newsletter',
 *       fields: ['email', 'name'],
 *     });
 *   </script>
 */

(() => {
  const SignupEmbed = {
    version: "1.0.0",
    turnstileLoaded: false,
    turnstileLoading: false,

    /**
     * Default configuration
     */
    defaults: {
      endpoint: "/api/signup",
      sheetTab: undefined,
      fields: ["email"],
      submitText: "Sign Up",
      successMessage: "Thanks for signing up!",
      errorMessage: "Something went wrong. Please try again.",
      mode: "inline", // 'inline' or 'iframe'
      turnstile: {
        enabled: true,
        invisible: true,
        siteKey: null, // fetched from API if not provided
        theme: "light",
        size: "normal",
      },
      style: {
        containerClass: "signup-form",
        inputClass: "signup-input",
        buttonClass: "signup-button",
        messageClass: "signup-message",
      },
      onSuccess: null,
      onError: null,
    },

    /**
     * Fetch configuration from API (for Turnstile site key)
     */
    async fetchConfig(baseUrl) {
      try {
        const response = await fetch(`${baseUrl}/api/config`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
      } catch (error) {
        console.warn("Failed to fetch config:", error);
        return null;
      }
    },

    /**
     * Load Turnstile script dynamically
     */
    loadTurnstile() {
      if (this.turnstileLoaded || this.turnstileLoading) {
        return this.turnstileLoaded;
      }

      this.turnstileLoading = true;

      return new Promise((resolve) => {
        if (window.turnstile) {
          this.turnstileLoaded = true;
          resolve(true);
          return;
        }

        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => {
          this.turnstileLoaded = true;
          resolve(true);
        };
        script.onerror = () => {
          console.warn("Failed to load Turnstile");
          resolve(false);
        };
        document.head.appendChild(script);
      });
    },

    /**
     * Merge options with defaults
     */
    mergeOptions(options) {
      const merged = { ...this.defaults };

      // Deep merge nested objects
      merged.turnstile = { ...this.defaults.turnstile, ...options.turnstile };
      merged.style = { ...this.defaults.style, ...options.style };

      // Merge top-level options
      for (const key in options) {
        if (key === "turnstile" || key === "style") continue;
        merged[key] = options[key];
      }

      return merged;
    },

    /**
     * Initialize the signup form
     */
    async init(selector, options = {}) {
      const config = this.mergeOptions(options);
      const container = document.querySelector(selector);

      if (!container) {
        console.error(`SignupEmbed: Container "${selector}" not found`);
        return;
      }

      // Fetch Turnstile config if not provided
      if (config.turnstile.enabled && !config.turnstile.siteKey) {
        const baseUrl = window.location.origin;
        const serverConfig = await this.fetchConfig(baseUrl);

        if (serverConfig?.turnstileSiteKey) {
          config.turnstile.siteKey = serverConfig.turnstileSiteKey;
          config.turnstile.enabled = serverConfig.turnstileEnabled;
        } else {
          config.turnstile.enabled = false;
        }
      }

      // Load Turnstile if enabled
      if (config.turnstile.enabled && config.turnstile.siteKey) {
        await this.loadTurnstile();
        if (!this.turnstileLoaded) {
          console.warn("Turnstile failed to load, continuing without CAPTCHA");
          config.turnstile.enabled = false;
        }
      }

      // Create form based on mode
      if (config.mode === "iframe") {
        this.createIframeForm(container, config);
      } else {
        this.createInlineForm(container, config);
      }
    },

    /**
     * Create inline form
     */
    createInlineForm(container, config) {
      // Clear container
      container.innerHTML = "";

      // Create form element
      const form = document.createElement("form");
      form.className = config.style.containerClass;
      form.dataset.signupForm = "";

      // Add fields
      for (const field of config.fields) {
        const input = this.createField(field, config);
        if (input) form.appendChild(input);
      }

      // Add hidden sheetTab field if specified
      if (config.sheetTab) {
        const sheetTabInput = document.createElement("input");
        sheetTabInput.type = "hidden";
        sheetTabInput.name = "sheetTab";
        sheetTabInput.value = config.sheetTab;
        form.appendChild(sheetTabInput);
      }

      // Add Turnstile container (for visible mode)
      if (config.turnstile.enabled && !config.turnstile.invisible && config.turnstile.siteKey) {
        const turnstileDiv = document.createElement("div");
        turnstileDiv.className = "cf-turnstile";
        turnstileDiv.dataset.siteKey = config.turnstile.siteKey;
        if (config.turnstile.theme) turnstileDiv.dataset.theme = config.turnstile.theme;
        turnstileDiv.id = `turnstile-widget-${Math.random().toString(36).substring(2, 11)}`;
        form.appendChild(turnstileDiv);
        config.turnstile.widgetId = turnstileDiv.id;
      }

      // Add submit button
      const button = document.createElement("button");
      button.type = "submit";
      button.className = config.style.buttonClass;
      button.textContent = config.submitText;
      form.appendChild(button);

      // Add message container
      const messageDiv = document.createElement("div");
      messageDiv.className = config.style.messageClass;
      messageDiv.dataset.signupMessage = "";
      messageDiv.style.display = "none";
      form.appendChild(messageDiv);

      // Attach submit handler
      form.addEventListener("submit", (e) => this.handleSubmit(e, form, config));

      // Render Turnstile widget if visible mode
      if (
        config.turnstile.enabled &&
        !config.turnstile.invisible &&
        config.turnstile.siteKey &&
        window.turnstile
      ) {
        window.turnstile.render(`#${config.turnstile.widgetId}`, {
          sitekey: config.turnstile.siteKey,
          theme: config.turnstile.theme,
        });
      }

      container.appendChild(form);
    },

    /**
     * Create a form field
     */
    createField(field, config) {
      const wrapper = document.createElement("div");
      wrapper.className = `${config.style.containerClass}-field`;

      const input = document.createElement("input");
      input.className = config.style.inputClass;
      input.name = field;

      // Set field type and attributes based on field name
      switch (field) {
        case "email":
          input.type = "email";
          input.placeholder = "Email";
          input.required = true;
          input.autocomplete = "email";
          break;
        case "name":
          input.type = "text";
          input.placeholder = "Name";
          input.autocomplete = "name";
          break;
        case "source":
          input.type = "text";
          input.placeholder = "How did you hear about us?";
          break;
        default:
          input.type = "text";
          input.placeholder = field.charAt(0).toUpperCase() + field.slice(1);
      }

      wrapper.appendChild(input);
      return wrapper;
    },

    /**
     * Create iframe form
     */
    createIframeForm(container, config) {
      container.innerHTML = "";

      const iframe = document.createElement("iframe");
      iframe.style.border = "none";
      iframe.style.width = "100%";
      iframe.style.height = "300px";
      iframe.style.overflow = "hidden";

      // Build iframe URL with config
      const params = new URLSearchParams({
        endpoint: config.endpoint,
        fields: config.fields.join(","),
        submitText: config.submitText,
        mode: "iframe",
      });

      if (config.sheetTab) params.set("sheetTab", config.sheetTab);
      if (config.turnstile.enabled && config.turnstile.siteKey) {
        params.set("turnstileSiteKey", config.turnstile.siteKey);
        params.set("turnstileInvisible", config.turnstile.invisible.toString());
      }

      iframe.src = `/embed/form?${params.toString()}`;
      container.appendChild(iframe);

      // Listen for messages from iframe
      window.addEventListener("message", (e) => {
        if (e.data.type === "signup-success" && config.onSuccess) {
          config.onSuccess(e.data.data);
        } else if (e.data.type === "signup-error" && config.onError) {
          config.onError(e.data.error);
        }
      });
    },

    /**
     * Handle form submission
     */
    async handleSubmit(event, form, config) {
      event.preventDefault();

      const messageDiv = form.querySelector("[data-signup-message]");
      const submitButton = form.querySelector('button[type="submit"]');

      // Show loading state
      submitButton.disabled = true;
      submitButton.textContent = "Signing up...";
      if (messageDiv) {
        messageDiv.style.display = "none";
        messageDiv.textContent = "";
      }

      try {
        // Get Turnstile token if enabled
        let turnstileToken = null;

        if (config.turnstile.enabled && config.turnstile.siteKey && window.turnstile) {
          if (config.turnstile.invisible) {
            // Invisible mode - execute challenge
            turnstileToken = await new Promise((resolve) => {
              window.turnstile.execute(config.turnstile.siteKey, {
                callback: (token) => resolve(token),
                "error-callback": () => resolve(null),
              });
            });
          } else {
            // Visible mode - get response from rendered widget
            turnstileToken = window.turnstile.getResponse(`#${config.turnstile.widgetId}`);
          }
        }

        // Build form data
        const formData = new FormData(form);
        const data = {};
        for (const [key, value] of formData.entries()) {
          data[key] = value;
        }

        // Add Turnstile token if obtained
        if (turnstileToken) {
          data.turnstileToken = turnstileToken;
        }

        // Submit request
        const response = await fetch(config.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
          // Show success message
          if (messageDiv) {
            messageDiv.textContent = config.successMessage;
            messageDiv.style.display = "block";
            messageDiv.style.color = "green";
          }

          // Reset form
          form.reset();

          // Reset Turnstile widget if visible
          if (config.turnstile.enabled && !config.turnstile.invisible && window.turnstile) {
            window.turnstile.reset(`#${config.turnstile.widgetId}`);
          }

          // Call success callback
          if (config.onSuccess) {
            config.onSuccess(result);
          }
        } else {
          throw new Error(result.error || "Signup failed");
        }
      } catch (error) {
        // Show error message
        const errorMessage = error.message || config.errorMessage;
        if (messageDiv) {
          messageDiv.textContent = errorMessage;
          messageDiv.style.display = "block";
          messageDiv.style.color = "red";
        }

        // Call error callback
        if (config.onError) {
          config.onError(error);
        }
      } finally {
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = config.submitText;
      }
    },
  };

  // Export to window
  window.SignupEmbed = SignupEmbed;
})();
