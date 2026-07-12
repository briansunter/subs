/**
 * Unit tests for signup schema validation
 */

import { describe, expect, test } from "bun:test";
import {
  bulkSignupSchema,
  extendedSignupSchema,
  MAX_METADATA_KEYS,
  MAX_METADATA_SERIALIZED_LENGTH,
  MAX_TURNSTILE_TOKEN_LENGTH,
  signupSchema,
} from "../../src/schemas/signup";

describe("Signup Schema Validation", () => {
  describe("signupSchema", () => {
    test("should validate valid email", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        sheetTab: "Sheet1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
        expect(result.data.sheetTab).toBe("Sheet1");
      }
    });

    test("should trim and normalize email with leading/trailing whitespace", () => {
      const result = signupSchema.safeParse({
        email: "  TEST@EXAMPLE.COM  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
      }
    });

    test("should leave sheetTab undefined when not provided (default applied at handler level)", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sheetTab).toBeUndefined();
      }
    });

    test("should accept optional metadata", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        metadata: { key: "value", count: 123 },
      });

      expect(result.success).toBe(true);
    });

    test("should reject invalid email format", () => {
      const result = signupSchema.safeParse({
        email: "not-an-email",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Invalid email format");
      }
    });

    test("should reject empty email", () => {
      const result = signupSchema.safeParse({
        email: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Email is required");
      }
    });

    test("should reject missing email", () => {
      const result = signupSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    test("should reject obviously invalid emails", () => {
      const invalidEmails = ["@example.com", "user@"];

      for (const email of invalidEmails) {
        const result = signupSchema.safeParse({ email });
        expect(result.success).toBe(false);
      }
    });

    test("should accept valid email formats", () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.com",
        "user+tag@example.com",
        "user123@test-domain.co.uk",
        "a@b.co",
      ];

      for (const email of validEmails) {
        const result = signupSchema.safeParse({ email });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("extendedSignupSchema", () => {
    test("should validate valid extended signup", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        name: "John Doe",
        sheetTab: "Beta",
        source: "website",
        tags: ["newsletter", "beta"],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
        expect(result.data.name).toBe("John Doe");
        expect(result.data.source).toBe("website");
        expect(result.data.tags).toEqual(["newsletter", "beta"]);
      }
    });

    test("should use default source when not provided", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe("api");
      }
    });

    test("should use default tags when not provided", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tags).toEqual([]);
      }
    });

    test("should accept optional name", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        name: "Jane Doe",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Jane Doe");
      }
    });

    test("should reject invalid source when name is provided", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        name: 123, // Invalid type
      });

      expect(result.success).toBe(false);
    });

    test("should reject non-array tags", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        tags: "not-an-array",
      });

      expect(result.success).toBe(false);
    });

    test("should trim name, source, and tags", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        name: "  Jane Doe  ",
        source: "  landing-page  ",
        tags: [" newsletter ", " beta "],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Jane Doe");
        expect(result.data.source).toBe("landing-page");
        expect(result.data.tags).toEqual(["newsletter", "beta"]);
      }
    });
  });

  describe("bulkSignupSchema", () => {
    test("should validate valid bulk signup", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [
          { email: "user1@example.com", sheetTab: "Sheet1" },
          { email: "user2@example.com", sheetTab: "Sheet2" },
          { email: "user3@example.com" },
        ],
        turnstileToken: "token",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signups).toHaveLength(3);
        expect(result.data.turnstileToken).toBe("token");
      }
    });

    test("should reject empty signups array", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [],
      });

      expect(result.success).toBe(false);
    });

    test("should reject more than 100 signups", () => {
      const signups = Array.from({ length: 101 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const result = bulkSignupSchema.safeParse({ signups });

      expect(result.success).toBe(false);
    });

    test("should accept exactly 100 signups", () => {
      const signups = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
      }));

      const result = bulkSignupSchema.safeParse({ signups });

      expect(result.success).toBe(true);
    });

    test("should reject signups with invalid email", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [{ email: "valid@example.com" }, { email: "invalid-email" }],
      });

      expect(result.success).toBe(false);
    });

    test("should reject when signups is not an array", () => {
      const result = bulkSignupSchema.safeParse({
        signups: "not-an-array",
      });

      expect(result.success).toBe(false);
    });

    test("should trim and reject blank request-level Turnstile tokens", () => {
      const trimmed = bulkSignupSchema.safeParse({
        signups: [{ email: "valid@example.com" }],
        turnstileToken: " token ",
      });
      expect(trimmed.success).toBe(true);
      if (trimmed.success) {
        expect(trimmed.data.turnstileToken).toBe("token");
      }

      const blank = bulkSignupSchema.safeParse({
        signups: [{ email: "valid@example.com" }],
        turnstileToken: "   ",
      });
      expect(blank.success).toBe(false);
    });
  });

  describe("Edge Cases and Security", () => {
    test("should reject email with SQL injection attempt", () => {
      const result = signupSchema.safeParse({
        email: "'; DROP TABLE users; --@example.com",
      });

      expect(result.success).toBe(false);
    });

    test("should reject email with script tag", () => {
      const result = signupSchema.safeParse({
        email: "<script>alert('xss')</script>@example.com",
      });

      expect(result.success).toBe(false);
    });

    test("should handle very long email addresses", () => {
      const longLocal = "a".repeat(64);
      const domain = `${"b".repeat(63)}.com`;
      const result = signupSchema.safeParse({
        email: `${longLocal}@${domain}`,
      });

      // Should still be valid format (even if unlikely)
      expect(result.success).toBe(true);
    });

    test("should trim whitespace from sheetTab", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        sheetTab: "  Sheet1  ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sheetTab).toBe("Sheet1");
      }
    });

    test("should reject invalid Google Sheets tab names", () => {
      const invalidTabs = ["Bad/Tab", "Bad\\Tab", "Bad?Tab", "Bad*Tab", "Bad[Tab]", "Bad]Tab"];

      for (const sheetTab of invalidTabs) {
        const result = signupSchema.safeParse({
          email: "test@example.com",
          sheetTab,
        });
        expect(result.success).toBe(false);
      }
    });

    test("should accept metadata with complex structure", () => {
      const complexMetadata = {
        user: {
          id: 123,
          profile: {
            settings: { theme: "dark" },
          },
        },
        timestamps: { created: "2025-01-13", updated: "2025-01-14" },
      };

      const result = signupSchema.safeParse({
        email: "test@example.com",
        metadata: complexMetadata,
      });

      expect(result.success).toBe(true);
    });

    test("should accept empty metadata object", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        metadata: {},
      });

      expect(result.success).toBe(true);
    });

    test("should accept null metadata", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        metadata: null,
      });

      // Zod treats null differently based on schema
      // metadata is optional but if provided, it's a record
      expect(result.success).toBe(false);
    });
  });

  describe("metadata bounds", () => {
    test("should accept exactly the maximum number of metadata keys", () => {
      const metadata = Object.fromEntries(
        Array.from({ length: MAX_METADATA_KEYS }, (_, i) => [`k${i}`, "v"]),
      );

      const result = signupSchema.safeParse({ email: "test@example.com", metadata });

      expect(result.success).toBe(true);
      expect(Object.keys(metadata)).toHaveLength(MAX_METADATA_KEYS);
    });

    test("should reject more than the maximum number of metadata keys", () => {
      const metadata = Object.fromEntries(
        Array.from({ length: MAX_METADATA_KEYS + 1 }, (_, i) => [`k${i}`, "v"]),
      );

      const result = signupSchema.safeParse({ email: "test@example.com", metadata });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes("top-level keys"))).toBe(
          true,
        );
      }
    });

    test("should accept metadata serialized at exactly the maximum length", () => {
      // {"k":""} wraps the value; pad it so the serialized object hits the limit.
      const overhead = '{"k":""}'.length;
      const metadata = { k: "x".repeat(MAX_METADATA_SERIALIZED_LENGTH - overhead) };

      const result = signupSchema.safeParse({ email: "test@example.com", metadata });

      expect(JSON.stringify(metadata)).toHaveLength(MAX_METADATA_SERIALIZED_LENGTH);
      expect(result.success).toBe(true);
    });

    test("should reject metadata serialized beyond the maximum length", () => {
      const overhead = '{"k":""}'.length;
      const metadata = { k: "x".repeat(MAX_METADATA_SERIALIZED_LENGTH - overhead + 1) };

      const result = signupSchema.safeParse({ email: "test@example.com", metadata });

      expect(JSON.stringify(metadata)).toHaveLength(MAX_METADATA_SERIALIZED_LENGTH + 1);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.message.includes("too long"))).toBe(true);
      }
    });

    test("should report a validation issue instead of throwing for circular metadata", () => {
      const metadata: Record<string, unknown> = {};
      metadata["self"] = metadata;

      const parse = () => signupSchema.safeParse({ email: "test@example.com", metadata });
      expect(parse).not.toThrow();
      const result = signupSchema.safeParse({ email: "test@example.com", metadata });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes("JSON-serializable")),
        ).toBe(true);
      }
    });

    test("should report a validation issue instead of throwing for BigInt metadata", () => {
      const metadata = { count: BigInt(1) };

      const parse = () => signupSchema.safeParse({ email: "test@example.com", metadata });
      expect(parse).not.toThrow();
      const result = signupSchema.safeParse({ email: "test@example.com", metadata });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes("JSON-serializable")),
        ).toBe(true);
      }
    });

    test("should report a validation issue when JSON.stringify returns undefined", () => {
      const metadata = { toJSON: () => undefined };

      const parse = () => signupSchema.safeParse({ email: "test@example.com", metadata });
      expect(parse).not.toThrow();
      const result = parse();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes("JSON-serializable")),
        ).toBe(true);
      }
    });
  });

  describe("turnstileToken length limit", () => {
    test("should accept a signup-schema token at exactly the maximum length", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH),
      });

      expect(result.success).toBe(true);
    });

    test("should reject a signup-schema token one character over the maximum", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH + 1),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes(`max ${MAX_TURNSTILE_TOKEN_LENGTH} characters`),
          ),
        ).toBe(true);
      }
    });

    test("should reject an overlong extended-signup token", () => {
      const result = extendedSignupSchema.safeParse({
        email: "test@example.com",
        turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH + 1),
      });

      expect(result.success).toBe(false);
    });

    test("should accept a bulk request-level token at exactly the maximum length", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [{ email: "valid@example.com" }],
        turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH),
      });

      expect(result.success).toBe(true);
    });

    test("should reject a bulk request-level token one character over the maximum", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [{ email: "valid@example.com" }],
        turnstileToken: "x".repeat(MAX_TURNSTILE_TOKEN_LENGTH + 1),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            issue.message.includes(`max ${MAX_TURNSTILE_TOKEN_LENGTH} characters`),
          ),
        ).toBe(true);
      }
    });

    test("should bound the trimmed token: surrounding whitespace on a max-length token is accepted", () => {
      // The bound is applied after trimming, so leading/trailing whitespace on a
      // token whose inner value is exactly at the limit still passes.
      const result = signupSchema.safeParse({
        email: "test@example.com",
        turnstileToken: `  ${"x".repeat(MAX_TURNSTILE_TOKEN_LENGTH)}  `,
      });

      expect(result.success).toBe(true);
    });

    test("should bound the trimmed token: a token that trims beyond the maximum is rejected", () => {
      // Whitespace does not sneak an overlong value past the limit.
      const result = signupSchema.safeParse({
        email: "test@example.com",
        turnstileToken: `  ${"x".repeat(MAX_TURNSTILE_TOKEN_LENGTH + 1)}  `,
      });

      expect(result.success).toBe(false);
    });
  });
});
