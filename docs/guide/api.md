# API Reference

Complete reference for all API endpoints.

## Base URL

```
http://localhost:3000  # Development
https://your-domain.com  # Production
```

## Authentication

The API does not require authentication for signup operations. To secure your API:

1. **Use CORS** - Set `ALLOWED_ORIGINS` to specific domains
2. **Add Rate Limiting** - Implement a rate limiter in production
3. **Use HTTPS** - Always use HTTPS in production
4. **Add API Key** - Implement API key authentication if needed

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response

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

## Endpoints

### POST `/api/signup`

Basic email signup with email-only validation.

#### Request

```json
{
  "email": "user@example.com",
  "sheetTab": "Sheet1"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `sheetTab` | string | No | Target sheet tab (default: `DEFAULT_SHEET_TAB`) |

#### Response

**Success (200)**:

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

**Error (400)** - Invalid email:

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

**Error (409)** - Duplicate email:

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

#### Example

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Sheet1"
  }'
```

---

### POST `/api/signup/extended`

Extended signup with additional fields.

#### Request

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "source": "website",
  "tags": ["newsletter", "beta"],
  "sheetTab": "Newsletter"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `name` | string | No | User's name |
| `source` | string | No | Signup source (e.g., "website", "referral") |
| `tags` | string[] | No | Array of tags |
| `sheetTab` | string | No | Target sheet tab |

#### Response

**Success (200)**:

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

#### Example

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

### POST `/api/signup/bulk`

Bulk signup for multiple emails (up to 100).

#### Request

```json
{
  "signups": [
    {"email": "user1@example.com"},
    {"email": "user2@example.com"},
    {"email": "user3@example.com"}
  ],
  "sheetTab": "Import"
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signups` | array | Yes | Array of signup objects (max 100) |
| `sheetTab` | string | No | Target sheet tab |

Each signup object can contain:
- `email` (required) - Valid email address
- `name` (optional) - User's name
- `source` (optional) - Signup source

#### Response

**Success (200)**:

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

**Error (400)** - Too many signups:

```json
{
  "success": false,
  "error": "Validation error",
  "message": "signups: Maximum 100 signups allowed per request"
}
```

#### Example

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

### GET `/api/stats`

Get signup statistics for a sheet tab.

#### Request

```
GET /api/stats?sheetTab=Sheet1
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sheetTab` | string | Yes | Sheet tab to get stats for |

#### Response

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

#### Example

```bash
curl "http://localhost:3000/api/stats?sheetTab=Sheet1"
```

---

### GET `/api/health`

Health check endpoint.

#### Request

```
GET /api/health
```

#### Response

**Success (200)**:

```json
{
  "status": "ok",
  "timestamp": "2025-01-12T10:30:00.000Z"
}
```

#### Example

```bash
curl http://localhost:3000/api/health
```

---

## Validation Rules

### Email Validation

Emails are validated using a strict regex pattern:

```javascript
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

Requirements:
- Must contain exactly one `@` symbol
- Must have at least one character before `@`
- Must have at least one `.` after `@`
- No whitespace allowed

### Sheet Tab Validation

- Must be a non-empty string
- Special characters are allowed
- Max length: 100 characters

### Tags Validation

- Must be an array of strings
- Each tag must be a non-empty string
- Max 50 tags per signup
- Each tag max 50 characters

## Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 200 | - | Success |
| 400 | Validation error | Invalid request data |
| 409 | Duplicate email | Email already exists |
| 500 | Internal server error | Server error |
| 503 | Service unavailable | Google Sheets API error |

## Rate Limiting

The API does not include built-in rate limiting. For production use, implement rate limiting using:

```typescript
// Example using fastify-rate-limit
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '1 minute', // per minute
});
```

## CORS

Configure CORS origins in your `.env` file:

```bash
# Allow all origins (not recommended for production)
ALLOWED_ORIGINS=*

# Allow specific origins
ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com

# Allow multiple origins with subdomains
ALLOWED_ORIGINS=https://*.yourwebsite.com
```

## Testing Endpoints

### Using cURL

```bash
# Basic signup
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "sheetTab": "Sheet1"}'

# Extended signup
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'

# Bulk signup
curl -X POST http://localhost:3000/api/signup/bulk \
  -H "Content-Type: application/json" \
  -d '{"signups": [{"email": "test1@example.com"}]}'

# Get stats
curl "http://localhost:3000/api/stats?sheetTab=Sheet1"

# Health check
curl http://localhost:3000/api/health
```

### Using JavaScript

```javascript
// Basic signup
const response = await fetch('http://localhost:3000/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    sheetTab: 'Sheet1'
  }),
});

const data = await response.json();
console.log(data);
```

## Next Steps

- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[Deployment](/guide/deployment)** - Deploy to production
- **[Configuration](/reference/configuration)** - Environment variables reference
