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

export const sheetTabSchema = z
  .string()
  .trim()
  .min(1, "Sheet tab name is required")
  .max(MAX_SHEET_TAB_LENGTH, `Sheet tab name cannot exceed ${MAX_SHEET_TAB_LENGTH} characters`)
  .refine(isValidSheetTabName, { message: INVALID_SHEET_TAB_MESSAGE });

const siteSchema = z.string().trim().min(1, "Site name is required").max(100);
const nameSchema = z.string().trim().min(1, "Name is required").max(200);
const sourceSchema = z.string().trim().min(1, "Source is required").max(100).default("api");
const tagSchema = z.string().trim().min(1, "Tag cannot be empty").max(100);

/**
 * Maximum length of a user-supplied Turnstile token, in characters.
 *
 * Caps the request-level Turnstile token before it is forwarded to Cloudflare,
 * so an oversized value is rejected as a normal validation issue instead of
 * being sent to (and stored by) the verification endpoint. Applied after the
 * token is trimmed, so the bound is on the normalized value. Exported so tests
 * and documentation can reference the exact limit.
 */
export const MAX_TURNSTILE_TOKEN_LENGTH = 4096;

const turnstileTokenSchema = z
  .string()
  .trim()
  .min(1, "Turnstile token is required")
  .max(
    MAX_TURNSTILE_TOKEN_LENGTH,
    `Turnstile token is too long (max ${MAX_TURNSTILE_TOKEN_LENGTH} characters)`,
  );

/**
 * Bounds on signup metadata before it is serialized into a Google Sheets cell.
 *
 * Metadata is persisted as a single JSON string in one sheet cell, so both the
 * number of top-level keys and the serialized length are capped to keep the cell
 * tractable and to prevent metadata from being used as an unbounded storage
 * vector. Exported so tests and documentation can reference the exact limits.
 */
export const MAX_METADATA_KEYS = 50;
export const MAX_METADATA_SERIALIZED_LENGTH = 10_000;

/**
 * Safely JSON-serialize metadata, returning null when the value cannot be
 * serialized. Circular references and BigInt values make JSON.stringify throw;
 * for those pathological-but-possible direct-call values we surface an ordinary
 * validation issue rather than letting schema validation throw.
 */
function serializeMetadata(value: Record<string, unknown>): string | null {
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}

/**
 * Bounded metadata schema: a string-keyed record of arbitrary JSON values.
 *
 * Rejects more than {@link MAX_METADATA_KEYS} top-level keys and serialized
 * payloads longer than {@link MAX_METADATA_SERIALIZED_LENGTH}. Values that
 * cannot be JSON-serialized at all (circular references, BigInt) are reported as
 * a normal validation issue instead of throwing out of safeParse.
 */
const metadataSchema = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  if (Object.keys(value).length > MAX_METADATA_KEYS) {
    ctx.addIssue({
      code: "custom",
      message: `Metadata cannot have more than ${MAX_METADATA_KEYS} top-level keys`,
    });
  }

  const serialized = serializeMetadata(value);
  if (serialized === null) {
    ctx.addIssue({
      code: "custom",
      message:
        "Metadata must be JSON-serializable (circular references and BigInt values are not allowed)",
    });
    return;
  }

  if (serialized.length > MAX_METADATA_SERIALIZED_LENGTH) {
    ctx.addIssue({
      code: "custom",
      message: `Serialized metadata is too long (max ${MAX_METADATA_SERIALIZED_LENGTH} characters)`,
    });
  }
});

/**
 * Base signup schema
 */
export const signupSchema = z.object({
  email: emailSchema,
  sheetTab: sheetTabSchema.optional(), // Default comes from config.defaultSheetTab
  site: siteSchema.optional(),
  metadata: metadataSchema.optional(),
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
