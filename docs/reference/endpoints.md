# API Endpoints

Quick reference for all API endpoints. For detailed documentation, see [API Reference](/guide/api).

## Summary

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

## Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Validation error |
| `409` | Duplicate email |
| `415` | Unsupported media type |
| `500` | Internal server error |
| `503` | Google Sheets API error |

## Error Format

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable message",
  "details": {}
}
```

## Request Fields

### Basic Signup (`/api/signup`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `sheetTab` | string | No | Target sheet tab |
| `site` | string | No | Site name (multi-site) |
| `metadata` | object | No | Arbitrary metadata |
| `turnstileToken` | string | No | Required if Turnstile is configured |

### Extended Signup (`/api/signup/extended`)

All basic fields plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | User's name |
| `source` | string | No | Signup source (default: `"api"`) |
| `tags` | string[] | No | Tags (max 50) |

### Bulk Signup (`/api/signup/bulk`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signups` | array | Yes | Array of signup objects (max 100) |
| `sheetTab` | string | No | Target sheet tab |

### Form Signup (`/api/signup/form`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `name` | string | No | User's name |
| `sheetTab` | string | No | Target sheet tab |
| `site` | string | No | Site name |
| `source` | string | No | Signup source (default: `"form"`) |
| `tags` | string | No | Comma-separated tags |

### Config Response (`/api/config`)

| Field | Type | Description |
|-------|------|-------------|
| `turnstileSiteKey` | string \| null | Turnstile site key |
| `turnstileEnabled` | boolean | Whether Turnstile is active |
| `defaultSheetTab` | string | Default sheet tab |
| `sheetTabs` | string[] | Available sheet tabs |

## CORS

Configure via `ALLOWED_ORIGINS` environment variable. See [Configuration](/reference/configuration).

## Rate Limiting

No built-in rate limiting. Use Cloudflare rate limiting (Workers) or a reverse proxy.
