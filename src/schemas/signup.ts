/**
 * Zod validation schemas for signup API
 *
 * Provides type-safe request validation using Zod schemas.
 * Response schemas are defined for documentation and type reference,
 * though runtime validation is handled by TypeScript handlers.
 *
 * @see {@link https://elysiajs.com/essential/validation | Elysia Validation}
 */

import { z } from "zod";

/**
 * Email validation with strict format checking
 * RFC 5321 specifies maximum email length of 254 characters
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .max(254, "Email address is too long (max 254 characters)")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
  .toLowerCase()
  .trim();

/**
 * Base signup schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  sheetTab: z.string().min(1, "Sheet tab name is required").optional().default("Sheet1"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

/**
 * Extended signup schema with additional fields
 */
export const extendedSignupSchema = signupSchema.extend({
  name: z.string().min(1, "Name is required").optional(),
  source: z.string().optional().default("api"),
  tags: z.array(z.string()).optional().default([]),
});

/**
 * Bulk signup schema
 */
export const bulkSignupSchema = z.object({
  signups: z
    .array(signupSchema)
    .min(1, "At least one signup is required")
    .max(100, "Cannot submit more than 100 signups at once"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type ExtendedSignupInput = z.infer<typeof extendedSignupSchema>;
export type BulkSignupInput = z.infer<typeof bulkSignupSchema>;

/**
 * Google Sheets row data type
 */
export interface SheetRowData {
  email: string;
  timestamp: string;
  source?: string;
  name?: string;
  tags?: string | string[];
  metadata?: string;
}

/**
 * Base response schema (shared fields)
 */
const baseResponseSchema = z.object({
  success: z.boolean(),
  statusCode: z.number(),
});

/**
 * Success response schema (200)
 */
export const successResponseSchema = baseResponseSchema.extend({
  success: z.literal(true),
  statusCode: z.literal(200),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

/**
 * Error response schema (400, 409, 500)
 */
export const errorResponseSchema = baseResponseSchema.extend({
  success: z.literal(false),
  statusCode: z.number(),
  error: z.string(),
  details: z.array(z.string()).optional(),
});

/**
 * Validation error response schema (400)
 */
export const validationErrorResponseSchema = errorResponseSchema.extend({
  statusCode: z.literal(400),
  error: z.literal("Validation failed"),
  details: z.array(z.string()),
});

/**
 * Turnstile error response schema (400)
 */
export const turnstileErrorResponseSchema = errorResponseSchema.extend({
  statusCode: z.literal(400),
  error: z.literal("Turnstile verification failed"),
  details: z.array(z.string()),
});

/**
 * Conflict error response schema (409)
 */
export const conflictErrorResponseSchema = errorResponseSchema.extend({
  statusCode: z.literal(409),
  error: z.literal("Email already registered"),
});

/**
 * Internal server error response schema (500)
 */
export const internalErrorResponseSchema = errorResponseSchema.extend({
  statusCode: z.literal(500),
  error: z.literal("Internal server error"),
});

/**
 * Combined error response schema (union of all error types)
 */
export const signUpErrorResponseSchema = z.union([
  validationErrorResponseSchema,
  turnstileErrorResponseSchema,
  conflictErrorResponseSchema,
  internalErrorResponseSchema,
]);

/**
 * Bulk signup result data schema
 */
export const bulkResultDataSchema = z.object({
  success: z.number(),
  failed: z.number(),
  duplicates: z.number(),
  errors: z.array(z.string()),
});

/**
 * Bulk signup response schema (200)
 */
export const bulkSuccessResponseSchema = successResponseSchema.extend({
  message: z.string(),
  data: bulkResultDataSchema,
});

/**
 * Combined signup response schema (success or any error)
 */
export const signupResponseSchema = z.union([successResponseSchema, signUpErrorResponseSchema]);

/**
 * Health check response schema (200)
 */
export const healthCheckResponseSchema = z.object({
  success: z.literal(true),
  statusCode: z.literal(200),
  data: z.object({
    status: z.literal("ok"),
    timestamp: z.string(),
  }),
});
