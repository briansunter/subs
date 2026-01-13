# Configuration

Complete reference for all environment variables and configuration options.

## Environment Variables

Configuration is managed through environment variables in the `.env` file. Copy `.env.example` to `.env` and configure as needed.

```bash
cp .env.example .env
```

## Required Variables

### `GOOGLE_SHEET_ID`

The ID of your Google Sheet.

**Format**: String (Google Sheet ID)

**How to find**:
1. Open your Google Sheet
2. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

**Example**:
```bash
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35
```

---

### `GOOGLE_CREDENTIALS_EMAIL`

The service account email address for Google Sheets API authentication.

**Format**: Email address

**Where to find**: In your service account JSON key file (`client_email` field)

**Example**:
```bash
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
```

---

### `GOOGLE_PRIVATE_KEY`

The private key for Google Sheets API authentication.

**Format**: RSA private key with `\n` for line breaks

**Important**:
- Must include the full key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Use `\n` for line breaks in the `.env` file
- Keep this secure - never commit to version control

**Example**:
```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
```

**How to format**:
1. Copy the entire `private_key` value from your JSON key file
2. Paste it directly into `.env` (the `\n` characters are already included)
3. Wrap in quotes

---

## Optional Variables

### `PORT`

The port for the API server to listen on.

**Format**: Number (1-65535)

**Default**: `3000`

**Example**:
```bash
PORT=8080
```

---

### `HOST`

The host address to bind to.

**Format**: IP address or hostname

**Default**: `0.0.0.0`

**Common values**:
- `0.0.0.0` - Listen on all interfaces (default)
- `127.0.0.1` - Localhost only
- `::` - All IPv6 addresses

**Example**:
```bash
HOST=0.0.0.0
```

---

### `NODE_ENV`

The environment mode.

**Format**: String

**Values**:
- `development` - Development mode with verbose logging
- `production` - Production mode with optimized settings

**Default**: `development`

**Example**:
```bash
NODE_ENV=production
```

---

### `ALLOWED_ORIGINS`

CORS allowed origins for cross-origin requests.

**Format**: Comma-separated list of origins

**Default**: `*` (all origins)

**Examples**:
```bash
# Allow all origins (not recommended for production)
ALLOWED_ORIGINS=*

# Single domain
ALLOWED_ORIGINS=https://yourwebsite.com

# Multiple domains
ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com

# With subdomain wildcard
ALLOWED_ORIGINS=https://*.yourwebsite.com
```

**Security Note**: Use specific domains in production.

---

### `DEFAULT_SHEET_TAB`

The default sheet tab name when no `sheetTab` is specified.

**Format**: String

**Default**: `Sheet1`

**Example**:
```bash
DEFAULT_SHEET_TAB=Newsletter
```

---

### `DISCORD_WEBHOOK_URL`

Discord webhook URL for notifications (optional).

**Format**: Discord webhook URL

**Default**: (empty - notifications disabled)

**Example**:
```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz
```

**To disable**:
```bash
DISCORD_WEBHOOK_URL=
```

---

### `LOG_LEVEL`

The logging level for Pino logger.

**Format**: String

**Values**:
- `fatal` - Only fatal errors
- `error` - Errors and above
- `warn` - Warnings and above
- `info` - Informational messages and above (default)
- `debug` - Debug messages and above
- `trace` - All messages

**Default**: `info`

**Example**:
```bash
LOG_LEVEL=warn
```

---

## Complete `.env` Example

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# CORS - Comma-separated list of allowed origins
# Use * to allow all origins (not recommended for production)
ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com

# Google Sheets Configuration (Required)
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Default sheet tab name
DEFAULT_SHEET_TAB=Sheet1

# Discord Webhook (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz

# Logging
LOG_LEVEL=info
```

## Configuration Validation

The API validates environment variables on startup using Zod. If any required variables are missing or invalid, the server will fail to start with an error message.

### Validation Rules

| Variable | Validation |
|----------|------------|
| `GOOGLE_SHEET_ID` | Required, non-empty string |
| `GOOGLE_CREDENTIALS_EMAIL` | Required, valid email format |
| `GOOGLE_PRIVATE_KEY` | Required, non-empty string |
| `PORT` | Optional, number between 1-65535 |
| `HOST` | Optional, string |
| `NODE_ENV` | Optional, one of: `development`, `production` |
| `ALLOWED_ORIGINS` | Optional, comma-separated origins |
| `DEFAULT_SHEET_TAB` | Optional, non-empty string |
| `DISCORD_WEBHOOK_URL` | Optional, valid URL |
| `LOG_LEVEL` | Optional, valid log level |

### Clearing Configuration Cache

For testing, you can clear the config cache between tests:

```typescript
import { clearConfigCache } from './src/config.js';

clearConfigCache();
// Now you can set new environment variables
```

## Security Best Practices

### 1. Never Commit `.env` Files

Add to `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local
```

### 2. Use Different Configurations per Environment

```bash
# Development (.env)
NODE_ENV=development
ALLOWED_ORIGINS=*

# Production (.env.production)
NODE_ENV=production
ALLOWED_ORIGINS=https://yourwebsite.com
LOG_LEVEL=warn
```

### 3. Secure Sensitive Data

- Store `.env` files securely
- Use file permissions: `chmod 600 .env`
- Use secrets management in production (e.g., HashiCorp Vault, AWS Secrets Manager)

### 4. Rotate Credentials

- Regularly rotate Google service account keys
- Update Discord webhooks if compromised
- Review access permissions regularly

### 5. Validate in Production

Before deploying, verify all required variables are set:

```bash
# Test configuration
bun run start
```

## Docker Environment Variables

When using Docker, you can pass environment variables in several ways:

### Option 1: `.env` File

```bash
# .env
GOOGLE_SHEET_ID=your_sheet_id
# ...
```

```yaml
# docker-compose.yml
services:
  app:
    env_file:
      - .env
```

### Option 2: Direct in docker-compose.yml

```yaml
# docker-compose.yml
services:
  app:
    environment:
      - GOOGLE_SHEET_ID=your_sheet_id
      - PORT=3000
```

### Option 3: During docker run

```bash
docker run -e GOOGLE_SHEET_ID=your_sheet_id -e PORT=3000 signup-api
```

## CI/CD Configuration

For CI/CD pipelines, use secrets management:

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
env:
  GOOGLE_SHEET_ID: ${{ secrets.GOOGLE_SHEET_ID }}
  GOOGLE_CREDENTIALS_EMAIL: ${{ secrets.GOOGLE_CREDENTIALS_EMAIL }}
  GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
variables:
  GOOGLE_SHEET_ID: $GOOGLE_SHEET_ID
  GOOGLE_CREDENTIALS_EMAIL: $GOOGLE_CREDENTIALS_EMAIL
  GOOGLE_PRIVATE_KEY: $GOOGLE_PRIVATE_KEY
```

## Troubleshooting

### Variables Not Loading

**Problem**: Environment variables not being read.

**Solutions**:
1. Ensure `.env` is in the project root
2. Restart the server after changing `.env`
3. Check for syntax errors (no spaces around `=`)
4. Verify file is named `.env` (not `.env.txt`)

### Invalid Private Key

**Problem**: `Invalid credentials` error.

**Solutions**:
1. Ensure `\n` is used for line breaks
2. Wrap the key in quotes
3. Copy the entire key from the JSON file
4. Check for extra whitespace

### CORS Errors

**Problem**: Requests blocked by CORS policy.

**Solutions**:
1. Add your domain to `ALLOWED_ORIGINS`
2. Restart the server
3. Check browser console for the exact origin being blocked
