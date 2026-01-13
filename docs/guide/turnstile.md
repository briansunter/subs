# Cloudflare Turnstile Setup

**This is a superpower of subs**: Invisible bot protection that blocks 99% of spam without CAPTCHAs or user friction. Your users won't even know it's there.

## Why Turnstile? 🛡️

**subs** integrates Cloudflare Turnstile out of the box because it's the smartest way to protect your signups:

| Feature | Turnstile | reCAPTCHA | Traditional CAPTCHA |
|---------|-----------|-----------|---------------------|
| **User Friction** | Invisible (99% pass rate) | Low | High (puzzles) |
| **Privacy** | No tracking | Tracks users | Varies |
| **Setup Time** | 2 minutes | 5 minutes | 10+ minutes |
| **Free Tier** | 1M assessments/month | 1M/month | Usually paid |
| **European Servers** | Yes | Limited | Varies |

### The Bottom Line

- **Blocks 99% of spam** - Turnstile's smart detection catches bots before they signup
- **Invisible to users** - No "select all traffic lights" puzzles or annoying checkboxes
- **Privacy-first** - Zero user tracking, GDPR compliant
- **Free for most use cases** - 1 million free assessments per month

## How It Works

Cloudflare Turnstile uses advanced techniques to distinguish humans from bots:

1. **Smart Analysis** - Evaluates request patterns, browser fingerprint, and behavior
2. **Invisible Challenge** - Most users pass without any interaction
3. **Fallback Options** - Shows checkbox only when suspicious (managed mode)
4. **Server Validation** - **subs** automatically verifies tokens with Cloudflare

## Prerequisites

- A Cloudflare account (free account works)
- Access to [Cloudflare Dashboard](https://dash.cloudflare.com/)

## Step 1: Create a Turnstile Site

### 1.1 Navigate to Turnstile

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. In the left sidebar, click on **"Turnstile"**
3. Click **"Add site"** (or **"Create site"**)

### 1.2 Configure Your Site

Fill in the site details:

1. **Site name**: Give your site a name (e.g., "Email Signup API")
2. **Domain**: Add your production domain (e.g., `example.com`)
3. **Development Mode**: Add `localhost` for testing

### 1.3 Select Widget Mode

Choose the widget mode that fits your use case:

#### Managed Challenge (Recommended)

Turnstile decides whether to show a widget or run invisibly based on the risk score:

- **Best for**: Most websites
- **User experience**: Invisible for most users, shows interstitial only when suspicious
- **When to use**: You want maximum protection with minimal friction

#### Non-Interactive

Always runs invisibly without showing any widget:

- **Best for**: Trusted users, internal tools
- **User experience**: Completely invisible
- **When to use**: You want minimal friction and are okay with some bots passing

#### Invisible

Runs in the background and only shows a widget if necessary:

- **Best for**: Balanced security and UX
- **User experience**: Mostly invisible, may show checkbox
- **When to use**: You want to fallback to visible challenge if needed

#### Visible (Checkbox)

Always shows a checkbox widget:

- **Best for**: High-security scenarios
- **User experience**: Requires user interaction
- **When to use**: You want users to always verify they're human

### 1.4 Get Your Keys

After creating the site, you'll receive two keys:

1. **Site Key** (Public) - Used in your frontend forms
2. **Secret Key** (Private) - Used in your backend API

Save these keys - you'll need them for the next step.

## Step 2: Configure Environment Variables

Add the Turnstile keys to your `.env` file:

```bash
# Cloudflare Turnstile Configuration
# Required for spam protection
TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Optional: Disable Turnstile Verification

To disable Turnstile verification, leave both variables empty or remove them:

```bash
# Disable Turnstile verification
TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

## Step 3: Add Turnstile to Your Frontend

### HTML Form Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Email Signup</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
<body>
  <form id="signup-form" action="/api/signup" method="POST">
    <input type="email" name="email" placeholder="Enter your email" required>

    <!-- Turnstile Widget -->
    <div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>

    <button type="submit">Sign Up</button>
  </form>
</body>
</html>
```

### JavaScript Example

```javascript
// Load Turnstile script
const script = document.createElement('script');
script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
script.async = true;
script.defer = true;
document.head.appendChild(script);

// Render widget programmatically
turnstile.render('#turnstile-container', {
  sitekey: 'YOUR_SITE_KEY',
  callback: (token) => {
    // Token received, submit form
    document.getElementById('signup-form').submit();
  },
  'error-callback': () => {
    // Handle error
    console.error('Turnstile error');
  }
});
```

### React Example

```tsx
import { useEffect, useRef } from 'react';

export default function SignupForm() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    // Render widget when script loads
    script.onload = () => {
      if (window.turnstile && containerRef.current) {
        window.turnstile.render(containerRef.current, {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: 'light',
        });
      }
    };

    return () => {
      document.head.removeChild(script);
    };
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

## Step 4: Send Token to API

The Turnstile widget generates a token that you must send to your API along with the signup data:

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "turnstileToken": "0.AB3xxxxxxxxxxxxxxxxxxx..."
  }'
```

The API will automatically verify the token with Cloudflare before processing the signup.

## Testing Turnstile

### Using Test Keys

Cloudflare provides test keys that always pass or fail for development:

**Always Passes**:
```bash
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

**Always Fails**:
```bash
TURNSTILE_SITE_KEY=2x00000000000000000000AB
TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA
```

**Timeouts (for testing error handling)**:
```bash
TURNSTILE_SITE_KEY=3x00000000000000000000FF
TURNSTILE_SECRET_KEY=3x0000000000000000000000000000000AA
```

### Test with cURL

```bash
# Test with valid token
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "turnstileToken": "valid-test-token"
  }'

# Test with invalid token
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "turnstileToken": "invalid-token"
  }'
```

### Expected Responses

**Valid Token**:
```json
{
  "success": true,
  "message": "Signup added successfully",
  "data": {
    "email": "test@example.com",
    "timestamp": "2025-01-12T10:30:00.000Z"
  }
}
```

**Invalid Token**:
```json
{
  "success": false,
  "error": {
    "code": "TURNSTILE_VERIFICATION_FAILED",
    "message": "Failed to verify Turnstile token",
    "details": "Invalid token or verification failed"
  }
}
```

**Missing Token** (when Turnstile is enabled):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "turnstileToken is required when Turnstile is enabled",
    "details": [
      {
        "field": "turnstileToken",
        "message": "Required"
      }
    ]
  }
}
```

## Widget Types Explained

### Managed Challenge (Recommended)

This is the default and smartest option. Turnstile analyzes the request and decides:

- **Low risk**: Passes invisibly (no user interaction)
- **Medium risk**: Shows a non-interactive challenge
- **High risk**: Shows a visible checkbox or puzzle

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-callback="javascriptCallback">
</div>
```

### Invisible Mode

Runs entirely in the background. The user won't see anything:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-binding="true"
     data-execution="execute">
</div>
```

### Visible Mode (Checkbox)

Always shows a checkbox widget:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-appearance="execution">
</div>
```

## Domain Configuration

### Adding Domains

1. Go to Cloudflare Dashboard > Turnstile
2. Click on your site
3. Under **"Domains"**, click **"Add domain"**
4. Add your production domain (e.g., `example.com`)

### Localhost Testing

For local development, add `localhost` to your domains:

1. In the same **Domains** section
2. Add `localhost` as a domain
3. This allows testing without HTTPS

### Multiple Domains

You can add multiple domains to a single Turnstile site:

- `example.com`
- `www.example.com`
- `app.example.com`
- `localhost` (for development)

Each domain will use the same site key and secret key.

## Customizing the Widget

### Theme

Change the widget appearance:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-theme="dark">
</div>
```

Options: `light`, `dark`, `auto`

### Language

Set the widget language:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-language="es">
</div>
```

Options: Auto-detect, or specific language codes (e.g., `en`, `es`, `fr`, `de`)

### Tab Index

Control keyboard navigation:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-tabindex="1">
</div>
```

### Retry Behavior

Configure automatic retry on failure:

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-retry="auto">
</div>
```

Options: `auto`, `never`

### Retry Interval

Set how long to wait before retrying (in milliseconds):

```html
<div class="cf-turnstile"
     data-sitekey="YOUR_SITE_KEY"
     data-retry-interval="1000">
</div>
```

## Security Best Practices

### 1. Never Commit Secret Keys

Always add `.env` to `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
```

### 2. Use Environment-Specific Keys

Use different Turnstile sites for different environments:

```bash
# Development - use test keys
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

# Production - use real keys
TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Validate on the Server

Always validate the Turnstile token on the server, even if the client-side widget passes. The API automatically does this for you.

### 4. Rate Limiting

Turnstile is your first line of defense, but consider adding rate limiting:

```typescript
// Example: Add rate limiting per IP
const rateLimiter = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(ip) || [];

  // Remove requests older than 1 minute
  const recent = requests.filter(time => now - time < 60000);

  // Allow max 10 requests per minute
  if (recent.length >= 10) {
    return false;
  }

  recent.push(now);
  rateLimiter.set(ip, recent);
  return true;
}
```

### 5. Monitor Verification Failures

Keep an eye on Turnstile verification failures in your logs:

```typescript
if (!turnstileSuccess) {
  logger.warn('Turnstile verification failed', {
    email: data.email,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  });
}
```

## Troubleshooting

### Error: "Invalid Turnstile token"

**Cause**: Token is malformed, expired, or already used.

**Solutions**:
1. Make sure the token is sent from the client correctly
2. Check that the token hasn't expired (tokens are valid for 5 minutes)
3. Verify the token hasn't been used before (tokens are single-use)
4. Check that your secret key is correct

### Error: "Turnstile verification failed"

**Cause**: Cloudflare rejected the token.

**Solutions**:
1. Verify your secret key is correct
2. Check that the domain is configured in Turnstile
3. Make sure the site key matches the secret key (same site)
4. Check Cloudflare dashboard for any service issues

### Widget Not Showing

**Check 1**: Script is loading

```html
<!-- Make sure the script is included -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

**Check 2**: Container element exists

```html
<!-- Make sure the container div exists -->
<div class="cf-turnstile" data-sitekey="YOUR_SITE_KEY"></div>
```

**Check 3**: Site key is correct

```bash
# Verify the site key in your .env file
echo $TURNSTILE_SITE_KEY
```

### Token Not Generated

**Check 1**: Browser console for errors

Open the browser console and look for Turnstile errors:

```javascript
// Check if Turnstile loaded
console.log(window.turnstile);
```

**Check 2**: Network requests

Check the Network tab in DevTools for Turnstile requests:

- Should see a request to `https://challenges.cloudflare.com`
- Check for 404 or other error codes

**Check 3**: Ad blockers

Some ad blockers might block Turnstile. Test with ad blockers disabled.

### Localhost Not Working

**Problem**: Turnstile fails on localhost but works on production domains.

**Solution**:
1. Add `localhost` to your Turnstile site domains
2. Make sure you're using `http://localhost`, not `http://127.0.0.1`
3. Check that your test keys are correct (use the official test keys for development)

## Advanced Configuration

### Multiple Turnstile Sites

For different environments or features, create multiple Turnstile sites:

```bash
# Main signup form
TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Contact form (different site)
TURNSTILE_CONTACT_SITE_KEY=0x4AAAABByyyyyyyyyyyyyy
TURNSTILE_CONTACT_SECRET_KEY=0x4AAAABByyyyyyyyyyyyyyyyyyyyyyyyyy
```

### Conditional Turnstile

Enable Turnstile only for specific sources:

```typescript
export async function handleSignup(data: SignupData): Promise<SignupResult> {
  const config = await getConfig();

  // Only require Turnstile for public signups
  const requireTurnstile = data.source === 'public';

  if (requireTurnstile && !data.turnstileToken) {
    throw new ValidationError('Turnstile token is required');
  }

  if (requireTurnstile) {
    await verifyTurnstileToken(data.turnstileToken);
  }

  // Process signup...
}
```

### Custom Verification Logic

Add additional checks after Turnstile verification:

```typescript
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  // Verify with Cloudflare
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    return false;
  }

  // Additional checks
  if (result.hostname !== 'example.com') {
    logger.warn('Turnstile hostname mismatch', { hostname: result.hostname });
    return false;
  }

  return true;
}
```

### Integration with Analytics

Track Turnstile performance:

```typescript
export async function handleSignup(data: SignupData): Promise<SignupResult> {
  const startTime = Date.now();

  try {
    const turnstileValid = await verifyTurnstileToken(data.turnstileToken);

    // Track verification time
    const verificationTime = Date.now() - startTime;
    analytics.track('turnstile_verification', {
      duration: verificationTime,
      success: turnstileValid,
    });

    if (!turnstileValid) {
      throw new ValidationError('Turnstile verification failed');
    }

    // Process signup...
  } catch (error) {
    analytics.track('turnstile_error', {
      error: error.message,
    });
    throw error;
  }
}
```

## Comparison with reCAPTCHA

### Why Switch from reCAPTCHA?

| Feature | Turnstile | reCAPTCHA v3 |
|---------|-----------|--------------|
| User Friction | Minimal | Minimal |
| Privacy | No tracking | Tracks users |
| Pricing | Free (1M/mo) | Free (1M/mo) |
| Setup | 2 minutes | 5 minutes |
| Widget Options | 4 modes | 2 modes |
| European Servers | Yes | Limited |

### Migration from reCAPTCHA

If you're currently using reCAPTCHA:

1. Create a Turnstile account
2. Get your Turnstile keys
3. Replace the reCAPTCHA script:

```html
<!-- OLD: reCAPTCHA -->
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
<div class="g-recaptcha" data-sitekey="YOUR_RECAPTCHA_SITE_KEY"></div>

<!-- NEW: Turnstile -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<div class="cf-turnstile" data-sitekey="YOUR_TURNSTILE_SITE_KEY"></div>
```

4. Update your backend verification:

```typescript
// OLD: reCAPTCHA
const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`);

// NEW: Turnstile
const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
  method: 'POST',
  body: JSON.stringify({ secret, response: token }),
});
```

## Monitoring and Analytics

### Cloudflare Dashboard

Track your Turnstile usage in the Cloudflare Dashboard:

1. Go to Turnstile > Your Site
2. View **Analytics** for:
   - Total challenges
   - Pass rate
   - Fail rate
   - Challenge solve time

### Custom Metrics

Add custom tracking to your API:

```typescript
export async function handleSignup(data: SignupData): Promise<SignupResult> {
  const turnstileStart = Date.now();

  try {
    await verifyTurnstileToken(data.turnstileToken);

    // Track successful verification
    logger.info('Turnstile verified', {
      email: data.email,
      duration: Date.now() - turnstileStart,
      source: data.source,
    });
  } catch (error) {
    // Track failed verification
    logger.warn('Turnstile failed', {
      email: data.email,
      error: error.message,
      source: data.source,
    });
    throw error;
  }
}
```

## Next Steps

- **[Google Sheets Setup](/guide/google-sheets)** - Configure Google Sheets integration
- **[Discord Setup](/guide/discord)** - Add Discord notifications
- **[API Reference](/guide/api)** - Complete API documentation
- **[Deployment](/guide/deployment)** - Deploy your API to production
