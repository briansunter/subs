# Schemas

Zod validation schemas for request and response data.

## Overview

The API uses Zod for runtime validation and TypeScript type safety. All schemas are defined in `src/schemas/signup.ts`.

## Signup Schemas

### `signupSchema`

Validates basic signup requests.

```typescript
{
  email: string;      // Valid email address (required)
  sheetTab?: string;  // Target sheet tab (optional)
}
```

**Validation Rules**:
- `email` must be a valid email format
- `sheetTab` must be a non-empty string if provided
- Max length for `sheetTab`: 100 characters

**Example**:

```json
{
  "email": "user@example.com",
  "sheetTab": "Sheet1"
}
```

---

### `signupExtendedSchema`

Validates extended signup requests with additional fields.

```typescript
{
  email: string;      // Valid email address (required)
  name?: string;      // User's name (optional)
  source?: string;    // Signup source (optional)
  tags?: string[];    // Array of tags (optional)
  sheetTab?: string;  // Target sheet tab (optional)
}
```

**Validation Rules**:
- `email` must be a valid email format
- `name` max length: 100 characters
- `source` max length: 50 characters
- `tags` max 50 items, each max 50 characters
- `sheetTab` max length: 100 characters

**Example**:

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "source": "website",
  "tags": ["newsletter", "beta"],
  "sheetTab": "Newsletter"
}
```

---

### `bulkSignupSchema`

Validates bulk signup requests.

```typescript
{
  signups: Array<{
    email: string;   // Valid email address (required)
    name?: string;   // User's name (optional)
    source?: string; // Signup source (optional)
  }>;
  sheetTab?: string; // Target sheet tab (optional)
}
```

**Validation Rules**:
- `signups` must be an array with 1-100 items
- Each signup must have a valid `email`
- Other fields in each signup are optional

**Example**:

```json
{
  "signups": [
    {
      "email": "user1@example.com",
      "name": "User One"
    },
    {
      "email": "user2@example.com"
    }
  ],
  "sheetTab": "Import"
}
```

---

### `signupItemSchema`

Validates individual signup items within bulk requests.

```typescript
{
  email: string;   // Valid email address (required)
  name?: string;   // User's name (optional)
  source?: string; // Signup source (optional)
}
```

---

## Response Schemas

### `signupResponseSchema`

Standard success response for signup operations.

```typescript
{
  success: true;
  message: string;
  data: {
    email: string;
    timestamp: string;    // ISO 8601 format
    sheetTab: string;
    name?: string;
    source?: string;
    tags?: string[];
  };
}
```

**Example**:

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

---

### `bulkSignupResponseSchema`

Response for bulk signup operations.

```typescript
{
  success: true;
  message: string;
  data: {
    total: number;       // Total signups processed
    successful: number;  // Number of successful signups
    failed: number;      // Number of failed signups
    results: Array<{
      email: string;
      success: boolean;
      error?: string;    // Error message if failed
    }>;
  };
}
```

**Example**:

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

---

### `statsResponseSchema`

Response for stats endpoint.

```typescript
{
  success: true;
  data: {
    total: number;           // Total signups in sheet tab
    sheetTab: string;        // Sheet tab name
    lastSignup: string;      // ISO 8601 timestamp of last signup
  };
}
```

**Example**:

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

---

### `healthResponseSchema`

Response for health check endpoint.

```typescript
{
  status: "ok";
  timestamp: string;  // ISO 8601 format
}
```

**Example**:

```json
{
  "status": "ok",
  "timestamp": "2025-01-12T10:30:00.000Z"
}
```

---

## Error Schemas

### `errorResponseSchema`

Standard error response format.

```typescript
{
  success: false;
  error: string;           // Error type
  message: string;         // Human-readable message
  details?: Record<string, unknown>;  // Additional error details
}
```

**Example - Validation Error**:

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

**Example - Duplicate Email**:

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

---

## Validation Rules

### Email Validation

Emails are validated using a strict regex pattern:

```typescript
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

**Requirements**:
- Must contain exactly one `@` symbol
- Must have at least one character before `@`
- Must have at least one `.` after `@`
- No whitespace allowed

**Valid Examples**:
- `user@example.com`
- `user.name@example.com`
- `user+tag@example.co.uk`

**Invalid Examples**:
- `user@` (missing domain)
- `@example.com` (missing user)
- `user example.com` (missing `@`)
- `user@.com` (invalid domain)

### String Length Limits

| Field | Max Length |
|-------|------------|
| `email` | 255 characters |
| `name` | 100 characters |
| `source` | 50 characters |
| `sheetTab` | 100 characters |
| `tags[i]` | 50 characters each |

### Array Limits

| Array | Max Items |
|-------|-----------|
| `tags` | 50 items |
| `signups` (bulk) | 100 items |

---

## Using Schemas in TypeScript

The schemas are exported and can be used for type inference:

```typescript
import {
  signupSchema,
  signupExtendedSchema,
  bulkSignupSchema,
  type SignupInput,
  type SignupExtendedInput,
  type BulkSignupInput,
} from './schemas/signup.js';

// Type inference from schemas
type Signup = z.infer<typeof signupSchema>;
type SignupExtended = z.infer<typeof signupExtendedSchema>;
type BulkSignup = z.infer<typeof bulkSignupSchema>;

// Validate data
const result = signupSchema.safeParse({
  email: 'user@example.com',
  sheetTab: 'Sheet1',
});

if (result.success) {
  // data is valid and typed
  console.log(result.data.email);
} else {
  // handle validation errors
  console.error(result.error);
}
```

---

## Custom Validation

You can extend or modify schemas for custom validation:

```typescript
import { z } from 'zod';

// Custom email domain validation
const customSignupSchema = signupSchema.extend({
  email: z.string()
    .email()
    .refine(
      (email) => email.endsWith('@yourdomain.com'),
      'Email must be from yourdomain.com'
    ),
});

// Custom tag validation
const customExtendedSchema = signupExtendedSchema.extend({
  tags: z.array(z.string())
    .min(1, 'At least one tag is required')
    .max(5, 'Maximum 5 tags allowed')
    .refine(
      (tags) => tags.every((tag) => tag.length <= 20),
      'Each tag must be 20 characters or less'
    ),
});
```

---

## Schema Export Locations

All schemas are defined in:

```
src/schemas/signup.ts
```

Exported schemas:
- `signupSchema`
- `signupExtendedSchema`
- `bulkSignupSchema`
- `signupItemSchema`
- `signupResponseSchema`
- `bulkSignupResponseSchema`
- `statsResponseSchema`
- `healthResponseSchema`
- `errorResponseSchema`

Related types:
- `SignupInput`
- `SignupExtendedInput`
- `BulkSignupInput`
- `SignupResponse`
- `BulkSignupResponse`
- `StatsResponse`
- `HealthResponse`
- `ErrorResponse`
