/**
 * Mock Discord webhook service for testing
 */

interface NotificationEntry {
  type: "signup" | "error" | "custom";
  payload: unknown;
  timestamp: number;
}

let mockNotifications: NotificationEntry[] = [];
let mockError: Error | null = null;
let mockSignupError: Error | null = null;
let mockErrorNotificationError: Error | null = null;
let pendingPromises: Promise<unknown>[] = [];

export const mockDiscordService = {
  reset() {
    mockNotifications = [];
    mockError = null;
    mockSignupError = null;
    mockErrorNotificationError = null;
    pendingPromises = [];
  },

  /**
   * Wait for all pending notification promises to settle
   * This allows tests to wait for async Discord operations to complete
   */
  async waitForPendingNotifications(): Promise<void> {
    await Promise.allSettled(pendingPromises);
    pendingPromises = [];
  },

  setError(error: Error | null) {
    mockError = error;
  },

  setSignupError(error: Error | null) {
    mockSignupError = error;
  },

  setErrorNotificationError(error: Error | null) {
    mockErrorNotificationError = error;
  },

  getNotifications(): NotificationEntry[] {
    return mockNotifications;
  },

  getNotificationCount(): number {
    return mockNotifications.length;
  },

  getLastNotification(): NotificationEntry | undefined {
    return mockNotifications[mockNotifications.length - 1];
  },

  // Get notifications by type
  getNotificationsByType(type: "signup" | "error" | "custom"): NotificationEntry[] {
    return mockNotifications.filter((n) => n.type === type);
  },

  // Mock implementation
  sendDiscordNotification: async (payload: unknown) => {
    if (mockError) throw mockError;

    mockNotifications.push({
      type: "custom",
      payload,
      timestamp: Date.now(),
    });
  },

  sendSignupNotification: async (data: {
    email: string;
    sheetTab: string;
    name?: string;
    source?: string;
    tags?: string[];
  }, webhookUrl?: string) => {
    // Skip if webhook URL not configured (mimics production behavior)
    if (!webhookUrl) {
      return;
    }

    // Check specific error first, then general error
    if (mockSignupError || mockError) throw mockSignupError || mockError;

    const promise = (async () => {
      const fields: Array<{ name: string; value: string; inline?: boolean }> = [
        { name: "Email", value: data.email, inline: true },
        { name: "Sheet Tab", value: data.sheetTab, inline: true },
      ];

      if (data.name) {
        fields.push({ name: "Name", value: data.name, inline: true });
      }

      if (data.source) {
        fields.push({ name: "Source", value: data.source, inline: true });
      }

      if (data.tags && data.tags.length > 0) {
        fields.push({ name: "Tags", value: data.tags.join(", "), inline: false });
      }

      mockNotifications.push({
        type: "signup",
        payload: {
          username: "Signup Bot",
          embeds: [
            {
              title: "🎉 New Signup!",
              description: "A new user has signed up",
              color: 5763719,
              fields,
              timestamp: new Date().toISOString(),
            },
          ],
        },
        timestamp: Date.now(),
      });
    })();

    pendingPromises.push(promise);
    return promise;
  },

  sendErrorNotification: async (data: { message: string; context?: Record<string, unknown> }, webhookUrl?: string) => {
    // Skip if webhook URL not configured (mimics production behavior)
    if (!webhookUrl) {
      return;
    }

    // Check specific error first, then general error
    if (mockErrorNotificationError || mockError) throw mockErrorNotificationError || mockError;

    const promise = (async () => {
      const embed: {
        title: string;
        description: string;
        color: number;
        timestamp: string;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
      } = {
        title: "❌ Signup Error",
        description: data.message,
        color: 15548997,
        timestamp: new Date().toISOString(),
      };

      if (data.context) {
        embed.fields = Object.entries(data.context).map(([key, value]) => ({
          name: key,
          value: String(value),
          inline: true,
        }));
      }

      mockNotifications.push({
        type: "error",
        payload: {
          username: "Signup Bot",
          embeds: [embed],
        },
        timestamp: Date.now(),
      });
    })();

    pendingPromises.push(promise);
    return promise;
  },
};

export { mockNotifications, mockError };
