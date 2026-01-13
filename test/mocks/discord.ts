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

export const mockDiscordService = {
  reset() {
    mockNotifications = [];
    mockError = null;
  },

  setError(error: Error | null) {
    mockError = error;
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

  // Verify notification content
  assertLastNotificationContains(text: string): boolean {
    const last = mockNotifications[mockNotifications.length - 1];
    if (!last) return false;
    return JSON.stringify(last.payload).includes(text);
  },

  // Count notifications by email
  countNotificationsForEmail(email: string): number {
    return mockNotifications.filter((n) => {
      if (n.type !== "signup") return false;
      const embeds = (n.payload as { embeds?: Array<{ fields?: unknown[] }> }).embeds;
      if (!embeds || !embeds[0]?.fields) return false;
      const fields = embeds[0].fields as Array<{ value: string }>;
      return fields.some((f) => f.value === email);
    }).length;
  },

  // Get all emails from signup notifications
  getEmailsFromSignupNotifications(): string[] {
    return mockNotifications
      .filter((n) => n.type === "signup")
      .map((n) => {
        const embeds = (n.payload as { embeds?: Array<{ fields?: unknown[] }> }).embeds;
        if (!embeds || !embeds[0]?.fields) return null;
        const fields = embeds[0].fields as Array<{ name: string; value: string }>;
        const emailField = fields.find((f) => f.name === "Email");
        return emailField?.value ?? null;
      })
      .filter((email): email is string => email !== null);
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
  }) => {
    if (mockError) throw mockError;

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
  },

  sendErrorNotification: async (data: { message: string; context?: Record<string, unknown> }) => {
    if (mockError) throw mockError;

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
  },
};

export { mockNotifications, mockError };
