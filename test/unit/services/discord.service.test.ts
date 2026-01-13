/**
 * Unit tests for Discord webhook service
 * Tests PRODUCTION code (src/services/discord.ts) with mocked fetch and config
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Store original fetch and original webhook URL
const originalFetch = global.fetch;
const originalWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

// Use globalThis to avoid closure capture issues
interface FetchCall {
  url: string;
  options: RequestInit;
}

declare global {
  var __testFetchCalls: FetchCall[];
}

function getFetchCalls(): FetchCall[] {
  if (!globalThis.__testFetchCalls) {
    globalThis.__testFetchCalls = [];
  }
  return globalThis.__testFetchCalls;
}

function resetFetchCalls(): void {
  globalThis.__testFetchCalls = [];
}

function createMockFetch(): typeof fetch {
  return ((url: string, options?: RequestInit) => {
    // Always get fresh reference to fetchCalls
    const fetchCalls = getFetchCalls();
    fetchCalls.push({ url, options: options || {} });

    // Return different responses based on URL
    if (url.includes("error")) {
      return Promise.resolve({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => "OK",
    } as Response);
  }) as typeof fetch;
}

describe("Discord Service - Unit Tests", () => {
  beforeEach(() => {
    resetFetchCalls();

    // Set environment variables before importing the service
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test";

    // Mock fetch function
    global.fetch = createMockFetch();
  });

  afterEach(() => {
    // Restore original fetch and webhook URL
    global.fetch = originalFetch;
    if (originalWebhookUrl === undefined) {
      delete process.env.DISCORD_WEBHOOK_URL;
    } else {
      process.env.DISCORD_WEBHOOK_URL = originalWebhookUrl;
    }

    // Clear fetch calls
    delete globalThis.__testFetchCalls;

    // Clear module cache to reset service (Bun doesn't have jest.resetModules)
    const servicePath = require.resolve("../../../src/services/discord");
    const configPath = require.resolve("../../../src/config");
    const loggerPath = require.resolve("../../../src/utils/logger");
    delete (require as any).cache[servicePath];
    delete (require as any).cache[configPath];
    delete (require as any).cache[loggerPath];
  });

  // Helper to load the service with fresh config
  async function loadService() {
    return await import("../../../src/services/discord");
  }

  describe("sendDiscordNotification", () => {
    test("should send notification with correct payload", async () => {
      const { sendDiscordNotification } = await loadService();

      await sendDiscordNotification({
        username: "Test Bot",
        content: "Test message",
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);
      expect(fetchCalls[0]?.url).toBe("https://discord.com/api/webhooks/test");
      expect(fetchCalls[0]?.options.method).toBe("POST");
      expect(fetchCalls[0]?.options.headers).toEqual({
        "Content-Type": "application/json",
      });

      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      expect(body.username).toBe("Test Bot");
      expect(body.content).toBe("Test message");
    });

    test("should skip notification when webhook URL not configured", async () => {
      // Set webhook URL to empty
      process.env.DISCORD_WEBHOOK_URL = "";

      const { sendDiscordNotification } = await loadService();

      await sendDiscordNotification({
        username: "Test Bot",
        content: "Test message",
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(0);
    });

    test("should handle webhook error without throwing", async () => {
      // Set webhook URL to error endpoint
      process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/error";

      const { sendDiscordNotification } = await loadService();

      // Should not throw despite error
      await sendDiscordNotification({
        username: "Test Bot",
        content: "Test message",
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);
    });

    test("should handle network error without throwing", async () => {
      // Mock fetch to throw network error
      global.fetch = (() => Promise.reject(new Error("Network error"))) as typeof fetch;

      const { sendDiscordNotification } = await loadService();

      // Should not throw despite network error
      await sendDiscordNotification({
        username: "Test Bot",
        content: "Test message",
      });
    });

    test("should send notification with embeds", async () => {
      const { sendDiscordNotification } = await loadService();

      await sendDiscordNotification({
        username: "Test Bot",
        embeds: [
          {
            title: "Test Title",
            description: "Test Description",
            color: 123456,
            fields: [{ name: "Field1", value: "Value1", inline: true }],
          },
        ],
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);

      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      expect(body.embeds).toHaveLength(1);
      expect(body.embeds[0]?.title).toBe("Test Title");
      expect(body.embeds[0]?.description).toBe("Test Description");
      expect(body.embeds[0]?.color).toBe(123456);
    });
  });

  describe("sendSignupNotification", () => {
    test("should format basic signup notification", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);

      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      expect(body.username).toBe("Signup Bot");
      expect(body.embeds).toHaveLength(1);

      const embed = body.embeds[0];
      expect(embed.title).toBe("🎉 New Signup!");
      expect(embed.description).toBe("A new user has signed up");
      expect(embed.color).toBe(5763719);
      expect(embed.fields).toContainEqual({
        name: "Email",
        value: "test@example.com",
        inline: true,
      });
      expect(embed.fields).toContainEqual({
        name: "Sheet Tab",
        value: "Sheet1",
        inline: true,
      });
    });

    test("should include name when provided", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
        name: "John Doe",
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toContainEqual({
        name: "Name",
        value: "John Doe",
        inline: true,
      });
    });

    test("should include source when provided", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
        source: "website",
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toContainEqual({
        name: "Source",
        value: "website",
        inline: true,
      });
    });

    test("should include tags when provided", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
        tags: ["newsletter", "beta"],
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toContainEqual({
        name: "Tags",
        value: "newsletter, beta",
        inline: false,
      });
    });

    test("should handle empty tags array", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
        tags: [],
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      // Should not include tags field when empty
      const tagsField = embed.fields?.find((f: { name: string }) => f.name === "Tags");
      expect(tagsField).toBeUndefined();
    });

    test("should include all optional fields", async () => {
      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "user@example.com",
        sheetTab: "Beta",
        name: "Jane Doe",
        source: "api",
        tags: ["beta-tester", "early-adopter"],
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toHaveLength(5); // Email, Sheet Tab, Name, Source, Tags
      expect(embed.timestamp).toBeDefined();
      expect(new Date(embed.timestamp)).toBeInstanceOf(Date);
    });

    test("should not throw when webhook fails", async () => {
      process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/error";

      const { sendSignupNotification } = await loadService();

      await sendSignupNotification({
        email: "test@example.com",
        sheetTab: "Sheet1",
      });
    });
  });

  describe("sendErrorNotification", () => {
    test("should format error notification", async () => {
      const { sendErrorNotification } = await loadService();

      await sendErrorNotification({
        message: "Test error occurred",
      });

      const fetchCalls = getFetchCalls();
      expect(fetchCalls.length).toBe(1);

      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      expect(body.username).toBe("Signup Bot");
      expect(body.embeds).toHaveLength(1);

      const embed = body.embeds[0];
      expect(embed.title).toBe("❌ Signup Error");
      expect(embed.description).toBe("Test error occurred");
      expect(embed.color).toBe(15548997);
      expect(embed.timestamp).toBeDefined();
    });

    test("should include context fields when provided", async () => {
      const { sendErrorNotification } = await loadService();

      await sendErrorNotification({
        message: "Error occurred",
        context: {
          email: "user@example.com",
          statusCode: 500,
          endpoint: "/api/signup",
        },
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toHaveLength(3);
      expect(embed.fields).toContainEqual({
        name: "email",
        value: "user@example.com",
        inline: true,
      });
      expect(embed.fields).toContainEqual({
        name: "statusCode",
        value: "500",
        inline: true,
      });
      expect(embed.fields).toContainEqual({
        name: "endpoint",
        value: "/api/signup",
        inline: true,
      });
    });

    test("should convert context values to strings", async () => {
      const { sendErrorNotification } = await loadService();

      await sendErrorNotification({
        message: "Error",
        context: {
          count: 123,
          active: true,
          data: { key: "value" },
        },
      });

      const fetchCalls = getFetchCalls();
      const body = JSON.parse(fetchCalls[0]?.options.body as string ?? "{}");
      const embed = body.embeds[0];

      expect(embed.fields).toHaveLength(3);
      expect(embed.fields).toContainEqual({
        name: "count",
        value: "123",
        inline: true,
      });
      expect(embed.fields).toContainEqual({
        name: "active",
        value: "true",
        inline: true,
      });
      expect(embed.fields).toContainEqual({
        name: "data",
        value: "[object Object]",
        inline: true,
      });
    });

    test("should not throw when webhook fails", async () => {
      process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/error";

      const { sendErrorNotification } = await loadService();

      await sendErrorNotification({
        message: "Error",
      });
    });
  });
});
