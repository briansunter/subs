/**
 * Zod validation schemas for signup API
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
  metadata: z.record(z.string(), z.any()).optional(),
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
