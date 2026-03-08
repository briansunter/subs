# API Reference

## Base URL

```
http://localhost:3000          # Development
https://your-domain.com        # Production
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Email signup |
| `POST` | `/api/signup/extended` | Signup with name, source, tags |
| `POST` | `/api/signup/bulk` | Bulk signup (up to 100) |
| `POST` | `/api/signup/form` | HTML form submission |
| `GET` | `/api/stats` | Signup statistics |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Public configuration |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/` | Built-in HTML signup form |
| `GET` | `/embed.js` | Embeddable JavaScript widget |

---

## POST `/api/signup`

Basic email signup.

**Request**:
```json
{
  "email": "user@example.com",
  "sheetTab": "Sheet1"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `sheetTab` | string | No | Target sheet tab (default: `DEFAULT_SHEET_TAB`) |
| `site` | string | No | Site name for multi-site support |
| `metadata` | object | No | Arbitrary key-value metadata |
| `turnstileToken` | string | No | Required if Turnstile is configured |

**Success (200)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Successfully signed up!"
}
```

**Duplicate (409)**:
```json
{
  "success": false,
  "statusCode": 409,
  "error": "Email already registered"
}
```

**Validation error (400)**:
```json
{
  "success": false,
  "statusCode": 400,
  "error": "Validation failed",
  "details": ["email: Invalid email format"]
}
```

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "sheetTab": "Sheet1"}'
```

---

## POST `/api/signup/extended`

Signup with additional fields.

**Request**:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "source": "website",
  "tags": ["newsletter", "beta"],
  "sheetTab": "Newsletter"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `name` | string | No | User's name |
| `source` | string | No | Signup source (default: `"api"`) |
| `tags` | string[] | No | Tags (default: `[]`, max 50) |
| `sheetTab` | string | No | Target sheet tab |
| `site` | string | No | Site name for multi-site support |
| `metadata` | object | No | Arbitrary key-value metadata |
| `turnstileToken` | string | No | Required if Turnstile is configured |

**Success (200)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Successfully signed up!"
}
```

```bash
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "name": "John Doe", "source": "website", "tags": ["newsletter"], "sheetTab": "Newsletter"}'
```

---

## POST `/api/signup/bulk`

Bulk signup for multiple emails (1-100 per request).

**Request**:
```json
{
  "turnstileToken": "token-if-turnstile-is-enabled",
  "signups": [
    {"email": "user1@example.com"},
    {"email": "user2@example.com"}
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signups` | array | Yes | Array of signup objects (max 100) |
| `turnstileToken` | string | No | Required at the request level if Turnstile is configured |

Each signup object accepts the same fields as `/api/signup` except `turnstileToken`.

**Success (200)**:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Processed 2 signups",
  "data": {
    "success": 2,
    "failed": 0,
    "duplicates": 0,
    "errors": []
  }
}
```

**Partial success / duplicates (207)**:
```json
{
  "success": false,
  "statusCode": 207,
  "message": "Processed signups (1 created, 1 duplicates, 1 failed)",
  "data": {
    "success": 1,
    "failed": 1,
    "duplicates": 1,
    "errors": ["bad@example: Error: Failed to check existing signups"]
  }
}
```

```bash
curl -X POST http://localhost:3000/api/signup/bulk \
  -H "Content-Type: application/json" \
  -d '{"turnstileToken": "token-if-needed", "signups": [{"email": "user1@example.com"}, {"email": "user2@example.com"}]}'
```

---

## POST `/api/signup/form`

HTML form submission endpoint. Accepts `application/x-www-form-urlencoded` or `multipart/form-data`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `name` | string | No | User's name |
| `sheetTab` | string | No | Target sheet tab |
| `site` | string | No | Site name |
| `source` | string | No | Signup source (default: `"form"`) |
| `tags` | string | No | Comma-separated tags (default: `"form-submit"`) |
| `turnstileToken` | string | No | Direct Turnstile token |
| `cf-turnstile-response` | string | No | Cloudflare's default form field name |

```bash
curl -X POST http://localhost:3000/api/signup/form \
  -d "email=user@example.com&name=John+Doe&sheetTab=Newsletter"
```

---

## GET `/api/stats`

Signup statistics for a sheet tab.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sheetTab` | string | Yes | Sheet tab to query |

**Success (200)**:
```json
{
  "success": true,
  "data": {
    "total": 150,
    "sheetTab": "Sheet1",
    "lastSignup": "2025-01-12T10:30:00.000Z"
  }
}
```

```bash
curl "http://localhost:3000/api/stats?sheetTab=Sheet1"
```

---

## GET `/api/health`

**Success (200)**:
```json
{"status": "ok", "timestamp": "2025-01-12T10:30:00.000Z"}
```

---

## GET `/api/config`

Public configuration for frontend clients. Does not expose secrets.

**Success (200)**:
```json
{
  "turnstileSiteKey": "0x4AAAAAAAxxxxxxxx",
  "turnstileEnabled": true,
  "defaultSheetTab": "Sheet1",
  "sheetTabs": ["Sheet1"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `turnstileSiteKey` | string \| null | Turnstile site key (`null` if not configured) |
| `turnstileEnabled` | boolean | Whether Turnstile is enabled |
| `defaultSheetTab` | string | Default sheet tab name |
| `sheetTabs` | string[] | Available sheet tabs |

---

## Validation

### Email

Emails are trimmed, lowercased, and validated with Zod's email validator.

- Max 254 characters (RFC 5321)
- Leading and trailing whitespace is removed before validation
- Invalid or malformed addresses are rejected with `Validation failed`

### Field Limits

| Field | Max Length |
|-------|-----------|
| `email` | 254 characters |
| `name` | 100 characters |
| `source` | 50 characters |
| `sheetTab` | 100 characters |
| `tags` | 50 items, 50 chars each |
| `signups` (bulk) | 100 items |

## Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `207` | Bulk request completed with duplicates or per-row failures |
| `400` | Validation error |
| `409` | Duplicate email |
| `415` | Unsupported media type (form endpoint) |
| `500` | Internal server error |

## Error Format

All errors follow this structure:

```json
{
  "success": false,
  "statusCode": 400,
  "error": "Error type",
  "details": ["field: explanation"]
}
```

## CORS

Configure allowed origins via `ALLOWED_ORIGINS` environment variable:

```bash
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com
```

## Rate Limiting

No built-in rate limiting. Use Cloudflare's rate limiting for Workers deployments, or a reverse proxy (Nginx, Caddy) for Docker/VPS.

## TypeScript Usage

```typescript
import {
  signupSchema,
  extendedSignupSchema,
  bulkSignupSchema,
  type SignupInput,
  type ExtendedSignupInput,
  type BulkSignupInput,
} from './schemas/signup.js';

// Validate data
const result = signupSchema.safeParse({
  email: 'user@example.com',
  sheetTab: 'Sheet1',
});

if (result.success) {
  console.log(result.data.email);  // typed
} else {
  console.error(result.error);
}
```

### Extending Schemas

```typescript
import { z } from 'zod';

const customSchema = signupSchema.extend({
  email: z.string()
    .email()
    .refine(
      (email) => email.endsWith('@yourdomain.com'),
      'Email must be from yourdomain.com'
    ),
});
```

### Exports

From `src/schemas/signup.ts`:

**Schemas**: `signupSchema`, `extendedSignupSchema`, `bulkSignupSchema`

**Types**: `SignupInput`, `ExtendedSignupInput`, `BulkSignupInput`, `SheetRowData`

## Next Steps

- **[Embedding Forms](/guide/integration)** - Add signup forms to your site
- **[Deployment](/guide/deployment)** - Deploy to production
- **[Configuration](/reference/configuration)** - All environment variables
