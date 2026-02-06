# Schemas

Zod validation schemas for request and response data. All schemas are defined in `src/schemas/signup.ts`.

## Request Schemas

### `signupSchema`

Basic signup validation.

```typescript
{
  email: string;              // Valid email, max 254 chars, auto-lowercased
  sheetTab?: string;          // Target sheet tab
  site?: string;              // Site name (multi-site support)
  metadata?: Record<string, unknown>;  // Arbitrary metadata
  turnstileToken?: string;    // Cloudflare Turnstile token
}
```

### `extendedSignupSchema`

Extends `signupSchema` with additional fields.

```typescript
{
  // ...all signupSchema fields, plus:
  name?: string;              // User's name (max 100 chars)
  source?: string;            // Signup source (default: "api", max 50 chars)
  tags?: string[];            // Tags (max 50 items, 50 chars each)
}
```

### `bulkSignupSchema`

Array of signups for bulk operations.

```typescript
{
  signups: SignupInput[];     // 1-100 signup objects
}
```

## Response Schemas

### Success Response

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

### Bulk Response

```json
{
  "success": true,
  "message": "Bulk signup processed",
  "data": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "results": [
      {"email": "user1@example.com", "success": true},
      {"email": "user2@example.com", "success": true},
      {"email": "user3@example.com", "success": false, "error": "Duplicate email"}
    ]
  }
}
```

### Stats Response

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

### Health Response

```json
{"status": "ok", "timestamp": "2025-01-12T10:30:00.000Z"}
```

### Error Response

```json
{
  "success": false,
  "error": "Validation error",
  "message": "email: Invalid email address",
  "details": {"email": "Invalid email address"}
}
```

## Validation Rules

### Email

Pattern: `^[^\s@]+@[^\s@]+\.[^\s@]+$`

- Must contain exactly one `@` with characters before and after
- Must have at least one `.` after `@`
- No whitespace
- Max 254 characters
- Automatically lowercased and trimmed

### Field Limits

| Field | Max |
|-------|-----|
| `email` | 254 characters |
| `name` | 100 characters |
| `source` | 50 characters |
| `sheetTab` | 100 characters |
| `tags` item | 50 characters |
| `tags` array | 50 items |
| `signups` array | 100 items |

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

## Exports

From `src/schemas/signup.ts`:

**Schemas**: `signupSchema`, `extendedSignupSchema`, `bulkSignupSchema`

**Types**: `SignupInput`, `ExtendedSignupInput`, `BulkSignupInput`, `SheetRowData`
