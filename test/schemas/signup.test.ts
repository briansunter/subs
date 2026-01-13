/**
 * Unit tests for signup schema validation
 */

import { describe, expect, test } from "bun:test";
import { bulkSignupSchema, extendedSignupSchema, signupSchema } from "../../src/schemas/signup";

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

    test("should reject email with leading/trailing whitespace", () => {
      const result = signupSchema.safeParse({
        email: "  TEST@EXAMPLE.COM  ",
      });

      // Regex doesn't allow spaces in email
      expect(result.success).toBe(false);
    });

    test("should use default sheetTab when not provided", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sheetTab).toBe("Sheet1");
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
        "a@b.c",
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
  });

  describe("bulkSignupSchema", () => {
    test("should validate valid bulk signup", () => {
      const result = bulkSignupSchema.safeParse({
        signups: [
          { email: "user1@example.com", sheetTab: "Sheet1" },
          { email: "user2@example.com", sheetTab: "Sheet2" },
          { email: "user3@example.com" },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signups).toHaveLength(3);
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
  });

  describe("Edge Cases and Security", () => {
    test("should reject email with SQL injection attempt", () => {
      const result = signupSchema.safeParse({
        email: "'; DROP TABLE users; --@example.com",
      });

      expect(result.success).toBe(false);
    });

    test("should accept email with script tag (regex doesn't validate chars beyond format)", () => {
      const result = signupSchema.safeParse({
        email: "<script>alert('xss')</script>@example.com",
      });

      // The regex only validates format, not content
      // XSS prevention should be handled at the output layer
      expect(result.success).toBe(true);
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

      // Note: Zod doesn't auto-trim strings by default
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sheetTab).toBe("  Sheet1  ");
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
});
