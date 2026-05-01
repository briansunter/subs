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
import {
  INVALID_SHEET_TAB_MESSAGE,
  isValidSheetTabName,
  MAX_SHEET_TAB_LENGTH,
} from "../utils/sheet-tab";

/**
 * Email validation with strict format checking
 * RFC 5321 specifies maximum email length of 254 characters
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(254, "Email address is too long (max 254 characters)")
  .email("Invalid email format")
  .toLowerCase();

const sheetTabSchema = z
  .string()
  .trim()
  .min(1, "Sheet tab name is required")
  .max(MAX_SHEET_TAB_LENGTH, `Sheet tab name cannot exceed ${MAX_SHEET_TAB_LENGTH} characters`)
  .refine(isValidSheetTabName, { message: INVALID_SHEET_TAB_MESSAGE });

const siteSchema = z.string().trim().min(1, "Site name is required").max(100);
const nameSchema = z.string().trim().min(1, "Name is required").max(200);
const sourceSchema = z.string().trim().min(1, "Source is required").max(100).default("api");
const tagSchema = z.string().trim().min(1, "Tag cannot be empty").max(100);
const turnstileTokenSchema = z.string().trim().min(1, "Turnstile token is required");

/**
 * Base signup schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  sheetTab: sheetTabSchema.optional(), // Default comes from config.defaultSheetTab
  site: siteSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: turnstileTokenSchema.optional(),
});

/**
 * Extended signup schema with additional fields
 */
export const extendedSignupSchema = signupSchema.extend({
  name: nameSchema.optional(),
  source: sourceSchema,
  tags: z.array(tagSchema).max(50, "Cannot have more than 50 tags").default([]),
});

/**
 * Bulk signup schema
 */
const bulkSignupItemSchema = signupSchema.omit({ turnstileToken: true });

export const bulkSignupSchema = z.object({
  signups: z
    .array(bulkSignupItemSchema)
    .min(1, "At least one signup is required")
    .max(100, "Cannot submit more than 100 signups at once"),
  turnstileToken: turnstileTokenSchema.optional(),
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
