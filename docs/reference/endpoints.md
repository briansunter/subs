# API Endpoints

Quick reference for all API endpoints.

## Base URL

```
http://localhost:3000          # Development
https://your-domain.com        # Production
```

## Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Basic email signup |
| `POST` | `/api/signup/extended` | Extended signup with additional fields |
| `POST` | `/api/signup/bulk` | Bulk signup (up to 100 emails) |
| `GET` | `/api/stats` | Get signup statistics |
| `GET` | `/api/health` | Health check |

---

## POST `/api/signup`

Basic email signup with email-only validation.

### Request

```http
POST /api/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "sheetTab": "Sheet1"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `sheetTab` | string | No | Target sheet tab (defaults to `DEFAULT_SHEET_TAB`) |

### Response

**Success (200)**

```json
{
  "success": true,
  "message": "Signup added successfully",
  "data": {
    "email": "user@example.com",
    "timestamp": "2025-01-12T10:30:00.000Z",
    "sheetTab": "Sheet1"
  }
}
```

**Error - Invalid Email (400)**

```json
{
  "success": false,
  "error": "Validation error",
  "message": "email: Invalid email address",
  "details": {
    "email": "Invalid email address"
  }
}
```

**Error - Duplicate (409)**

```json
{
  "success": false,
  "error": "Duplicate email",
  "message": "This email is already signed up",
  "details": {
    "email": "user@example.com"
  }
}
```

### Example

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Sheet1"
  }'
```

---

## POST `/api/signup/extended`

Extended signup with additional fields.

### Request

```http
POST /api/signup/extended
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "source": "website",
  "tags": ["newsletter", "beta"],
  "sheetTab": "Newsletter"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `name` | string | No | User's name |
| `source` | string | No | Signup source (e.g., "website", "referral") |
| `tags` | string[] | No | Array of tags |
| `sheetTab` | string | No | Target sheet tab |

### Response

**Success (200)**

```json
{
  "success": true,
  "message": "Signup added successfully",
  "data": {
    "email": "user@example.com",
    "name": "John Doe",
    "source": "website",
    "tags": ["newsletter", "beta"],
    "timestamp": "2025-01-12T10:30:00.000Z",
    "sheetTab": "Newsletter"
  }
}
```

### Example

```bash
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "source": "website",
    "tags": ["newsletter", "beta"],
    "sheetTab": "Newsletter"
  }'
```

---

## POST `/api/signup/bulk`

Bulk signup for multiple emails.

### Request

```http
POST /api/signup/bulk
Content-Type: application/json

{
  "signups": [
    {"email": "user1@example.com"},
    {"email": "user2@example.com"}
  ],
  "sheetTab": "Import"
}
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signups` | array | Yes | Array of signup objects (max 100) |
| `sheetTab` | string | No | Target sheet tab |

**Signup Object Fields**:
- `email` (required) - Valid email address
- `name` (optional) - User's name
- `source` (optional) - Signup source

### Response

**Success (200)**

```json
{
  "success": true,
  "message": "Bulk signup processed",
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      {
        "email": "user1@example.com",
        "success": true
      },
      {
        "email": "user2@example.com",
        "success": true
      },
      {
        "email": "user3@example.com",
        "success": false,
        "error": "Duplicate email"
      }
    ]
  }
}
```

**Error - Too Many (400)**

```json
{
  "success": false,
  "error": "Validation error",
  "message": "signups: Maximum 100 signups allowed per request"
}
```

### Example

```bash
curl -X POST http://localhost:3000/api/signup/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "signups": [
      {"email": "user1@example.com"},
      {"email": "user2@example.com"}
    ],
    "sheetTab": "Import"
  }'
```

---

## GET `/api/stats`

Get signup statistics for a sheet tab.

### Request

```http
GET /api/stats?sheetTab=Sheet1
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sheetTab` | string | Yes | Sheet tab to get stats for |

### Response

**Success (200)**

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

### Example

```bash
curl "http://localhost:3000/api/stats?sheetTab=Sheet1"
```

---

## GET `/api/health`

Health check endpoint.

### Request

```http
GET /api/health
```

### Response

**Success (200)**

```json
{
  "status": "ok",
  "timestamp": "2025-01-12T10:30:00.000Z"
}
```

### Example

```bash
curl http://localhost:3000/api/health
```

---

## Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request (validation error) |
| `409` | Conflict (duplicate email) |
| `500` | Internal Server Error |
| `503` | Service Unavailable (Google Sheets error) |

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message",
  "details": {
    // Additional error details
  }
}
```

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Validation error` | Invalid request data | Check request body matches schema |
| `Duplicate email` | Email already exists | Check if user is already signed up |
| `Invalid email address` | Email format is invalid | Validate email before sending |
| `Sheet tab not found` | Tab doesn't exist | API creates tabs automatically |
| `Permission denied` | Google Sheets access issue | Check service account permissions |

## Rate Limiting

The API does not include built-in rate limiting. Implement your own using Fastify plugins:

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});
```

## CORS

Configure CORS origins via `ALLOWED_ORIGINS` environment variable.

See [Configuration](/reference/configuration) for details.
