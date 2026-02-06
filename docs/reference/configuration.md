# Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and edit.

## Required

### `GOOGLE_SHEET_ID`

Google Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

```bash
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35
```

### `GOOGLE_CREDENTIALS_EMAIL`

Service account email from the JSON key file (`client_email` field).

```bash
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
```

### `GOOGLE_PRIVATE_KEY`

Service account private key with `\n` for line breaks. Copy directly from the JSON key file.

```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

## Optional

### `PORT`

Server port. Default: `3000`

```bash
PORT=8080
```

### `HOST`

Bind address. Default: `0.0.0.0`

```bash
HOST=127.0.0.1
```

### `ALLOWED_ORIGINS`

CORS allowed origins (comma-separated). Default: `*`

```bash
# Production
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com

# Development
ALLOWED_ORIGINS=*
```

### `DEFAULT_SHEET_TAB`

Default sheet tab when `sheetTab` is not specified. Default: `Sheet1`

```bash
DEFAULT_SHEET_TAB=Newsletter
```

### `CLOUDFLARE_TURNSTILE_SECRET_KEY`

Turnstile secret key for server-side token verification. Leave empty to disable Turnstile.

```bash
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `CLOUDFLARE_TURNSTILE_SITE_KEY`

Turnstile site key for frontend widget. Exposed via `/api/config`.

```bash
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
```

### `ENABLE_METRICS`

Enable Prometheus metrics endpoint (`/metrics`). Default: `true`

```bash
ENABLE_METRICS=false
```

### `ALLOWED_SHEETS`

Multi-site support: map site names to different Google Sheet IDs.

```bash
ALLOWED_SHEETS=abc123:blog,def456:landing-page
```

### `SHEET_TABS`

Available sheet tabs (comma-separated). Default: `Sheet1`

```bash
SHEET_TABS=Sheet1,Newsletter,Beta
```

### `LOG_LEVEL`

Pino log level. Default: `info`

Values: `fatal`, `error`, `warn`, `info`, `debug`, `trace`

```bash
LOG_LEVEL=warn
```

### `NODE_ENV`

Environment mode. Default: `development`

```bash
NODE_ENV=production
```

## Complete Example

```bash
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com

# Google Sheets (required)
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
DEFAULT_SHEET_TAB=Sheet1

# Cloudflare Turnstile (optional)
CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxx
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Features
ENABLE_METRICS=true
# ALLOWED_SHEETS=sheetId1:site1,sheetId2:site2
# SHEET_TABS=Sheet1,Newsletter,Beta

# Logging
LOG_LEVEL=warn
```

## Validation

The API validates all environment variables on startup using Zod. Missing or invalid required variables cause the server to fail with an error message.

| Variable | Validation |
|----------|------------|
| `GOOGLE_SHEET_ID` | Required, non-empty string |
| `GOOGLE_CREDENTIALS_EMAIL` | Required, valid email format |
| `GOOGLE_PRIVATE_KEY` | Required, non-empty string |
| `PORT` | Number 1-65535 |
| `ALLOWED_ORIGINS` | Comma-separated strings |
| `ENABLE_METRICS` | `"true"` or `"false"` |
| `ALLOWED_SHEETS` | `sheetId:siteName,...` format |
| `SHEET_TABS` | Comma-separated tab names |
| `LOG_LEVEL` | Valid Pino log level |

### Clearing Config Cache (Testing)

```typescript
import { clearConfigCache } from './src/config.js';

clearConfigCache();
// Set new environment variables before next getConfig() call
```

## Cloudflare Workers

For Workers deployments, set variables as secrets:

```bash
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY
```

For local Workers development, use `.dev.vars` instead of `.env`.

## Docker

Pass variables via `.env` file, `docker-compose.yml`, or `docker run -e`:

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env.production
```

## Security

- Never commit `.env` files - add to `.gitignore`
- Use different credentials for dev/production
- Rotate service account keys periodically
- Set `ALLOWED_ORIGINS` to specific domains in production
