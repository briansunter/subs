/**
 * Mock Discord webhook service for testing
 * Improved with proper test isolation
 */

interface NotificationEntry {
  type: "signup" | "error" | "custom";
  payload: unknown;
  timestamp: number;
  testId?: string; // Track which test generated this notification
}

let mockNotifications: NotificationEntry[] = [];
let mockError: Error | null = null;
let mockSignupError: Error | null = null;
let mockErrorNotificationError: Error | null = null;
let pendingPromises: Map<string, Promise<unknown>> = new Map();
let currentTestId: string = "";
let callCount = 0; // Track how many times sendSignupNotification is called (global)
let callCountSinceReset = 0; // Track calls since last reset (test-scoped)

export const mockDiscordService = {
  /**
   * Set a unique test ID to track notifications from this test
   * This helps isolate notifications between tests
   */
  setTestId(testId: string) {
    currentTestId = testId;
  },

  /**
   * Clear all test IDs from notifications
   */
  clearTestIds() {
    currentTestId = "";
  },

  reset() {
    // Wait for all pending promises to complete before clearing
    return Promise.allSettled(Array.from(pendingPromises.values())).then(() => {
      mockNotifications = [];
      mockError = null;
      mockSignupError = null;
      mockErrorNotificationError = null;
      pendingPromises.clear();
      callCount = 0; // Reset global call count
      callCountSinceReset = 0; // Reset test-scoped call count
    });
  },

  getCallCount() {
    return callCount;
  },

  /**
   * Get call count since last reset (test-scoped)
   * This is the recommended method for tests to use
   */
  getCallCountSinceReset() {
    return callCountSinceReset;
  },

  /**
   * Wait for all pending notification promises to settle
   * This allows tests to wait for async Discord operations to complete
   */
  async waitForPendingNotifications(): Promise<void> {
    await Promise.allSettled(Array.from(pendingPromises.values()));
    pendingPromises.clear();
  },

  /**
   * Get notifications from the current test only
   */
  getNotifications(): NotificationEntry[] {
    if (!currentTestId) {
      return mockNotifications;
    }
    return mockNotifications.filter((n) => n.testId === currentTestId);
  },

  /**
   * Get all notifications (for backwards compatibility)
   */
  getAllNotifications(): NotificationEntry[] {
    return mockNotifications;
  },

  /**
   * Get notification count from the current test only
   */
  getNotificationCount(): number {
    if (!currentTestId) {
      return mockNotifications.length;
    }
    return mockNotifications.filter((n) => n.testId === currentTestId).length;
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

  getNotificationsByType(type: "signup" | "error" | "custom"): NotificationEntry[] {
    if (!currentTestId) {
      return mockNotifications.filter((n) => n.type === type);
    }
    return mockNotifications.filter((n) => n.type === type && n.testId === currentTestId);
  },

  getLastNotification(): NotificationEntry | undefined {
    const notifications = this.getNotifications();
    return notifications[notifications.length - 1];
  },

  sendSignupNotification: async (
    data: {
      email: string;
      sheetTab: string;
      name?: string;
      source?: string;
      tags?: string[];
    },
    webhookUrl?: string,
  ) => {
    callCount++; // Increment global call count
    callCountSinceReset++; // Increment test-scoped call count

    // Capture test ID at CALL time, not EXECUTION time
    const capturedTestId = currentTestId;

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

      const notification: NotificationEntry = {
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
        testId: capturedTestId, // Use captured test ID from call time
      };

      mockNotifications.push(notification);
    })();

    // Track promise with a unique ID
    const promiseId = `signup-${Date.now()}-${Math.random()}`;
    pendingPromises.set(promiseId, promise);

    // When promise completes, remove it from the map
    promise.finally(() => {
      pendingPromises.delete(promiseId);
    });

    return promise;
  },

  sendErrorNotification: async (
    data: { message: string; context?: Record<string, unknown> },
    webhookUrl?: string,
  ) => {
    // Capture test ID at CALL time, not EXECUTION time
    const capturedTestId = currentTestId;

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

      const notification: NotificationEntry = {
        type: "error",
        payload: {
          username: "Signup Bot",
          embeds: [embed],
        },
        timestamp: Date.now(),
        testId: capturedTestId, // Use captured test ID from call time
      };

      mockNotifications.push(notification);
    })();

    const promiseId = `error-${Date.now()}-${Math.random()}`;
    pendingPromises.set(promiseId, promise);

    promise.finally(() => {
      pendingPromises.delete(promiseId);
    });

    return promise;
  },
};
