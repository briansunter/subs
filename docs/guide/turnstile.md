# Cloudflare Turnstile

Invisible bot protection that blocks spam without CAPTCHAs or user friction.

## Why Turnstile?

| | Turnstile | reCAPTCHA | Traditional CAPTCHA |
|-|-----------|-----------|---------------------|
| **User friction** | Invisible | Low | High (puzzles) |
| **Privacy** | No tracking | Tracks users | Varies |
| **Free tier** | 1M/month | 1M/month | Usually paid |
| **Setup time** | 2 minutes | 5 minutes | 10+ minutes |

Turnstile uses smart analysis to distinguish humans from bots. Most users pass without any interaction.

## Setup

### 1. Create a Turnstile Site

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Turnstile** in the sidebar, then **Add site**
3. Enter your site name and domain(s) - add `localhost` for development
4. Choose a widget mode:
   - **Managed** (recommended) - invisible for most users, shows challenge only when suspicious
   - **Non-interactive** - always invisible
   - **Invisible** - background check, may show checkbox
   - **Visible** - always shows a checkbox
5. Copy the **Site Key** (public) and **Secret Key** (private)

### 2. Configure Environment

Add to `.env`:

```bash
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

To disable Turnstile, leave both variables empty or remove them.

### 3. Add to Your Frontend

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<form id="signup-form" action="/api/signup" method="POST">
  <input type="email" name="email" placeholder="Email" required>
  <div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
  <button type="submit">Sign Up</button>
</form>
```

The widget generates a `turnstileToken` that is sent with the form. The API verifies it with Cloudflare before processing the signup.

### JavaScript Example

```javascript
// Render widget programmatically
turnstile.render('#turnstile-container', {
  sitekey: 'YOUR_SITE_KEY',
  callback: (token) => {
    // Include token in your API request
    fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken: token })
    });
  }
});
```

### React Example

```tsx
import { useEffect, useRef } from 'react';

export default function SignupForm() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      if (window.turnstile && containerRef.current) {
        window.turnstile.render(containerRef.current, {
          sitekey: process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY,
        });
      }
    };

    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <form action="/api/signup" method="POST">
      <input type="email" name="email" required />
      <div ref={containerRef} />
      <button type="submit">Sign Up</button>
    </form>
  );
}
```

## Testing

Cloudflare provides test keys for development:

| Behavior | Site Key | Secret Key |
|----------|----------|------------|
| Always passes | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always fails | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| Timeouts | `3x00000000000000000000FF` | `3x0000000000000000000000000000000AA` |

```bash
# Test with token
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "turnstileToken": "valid-test-token"}'
```

## Widget Customization

```html
<!-- Dark theme -->
<div class="cf-turnstile" data-sitekey="KEY" data-theme="dark"></div>

<!-- Language -->
<div class="cf-turnstile" data-sitekey="KEY" data-language="es"></div>

<!-- Auto retry -->
<div class="cf-turnstile" data-sitekey="KEY" data-retry="auto"></div>
```

Theme options: `light`, `dark`, `auto`

## Troubleshooting

**"Invalid Turnstile token"**: Token may be expired (5 min TTL), already used (single-use), or malformed. Check that the secret key matches the site key (same Turnstile site).

**Widget not showing**: Verify the Turnstile script is loaded, the container div exists, and the site key is correct. Some ad blockers may interfere - test with them disabled.

**Localhost not working**: Add `localhost` to your Turnstile site domains. Use `http://localhost`, not `http://127.0.0.1`.

## Migrating from reCAPTCHA

Replace the script and widget div:

```html
<!-- reCAPTCHA (old) -->
<script src="https://www.google.com/recaptcha/api.js"></script>
<div class="g-recaptcha" data-sitekey="RECAPTCHA_KEY"></div>

<!-- Turnstile (new) -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
<div class="cf-turnstile" data-sitekey="TURNSTILE_KEY"></div>
```

The server-side verification is handled automatically by subs.

## Next Steps

- **[Google Sheets Setup](/guide/google-sheets)** - Configure storage
- **[API Reference](/guide/api)** - All endpoints
- **[Deployment](/guide/deployment)** - Production deployment
