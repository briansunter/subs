/**
 * Mock Google Sheets service for testing
 */

// Mock data store
const mockSheetData: Map<
  string,
  Array<{
    email: string;
    timestamp: string;
    source?: string;
    name?: string;
    tags?: string;
    metadata?: string;
  }>
> = new Map();

// Error state
let mockAuthError: Error | null = null;
let mockWriteError: Error | null = null;

// Operation history tracking (optional, disabled by default for performance)
interface OperationEntry {
  operation: "initializeSheetTab" | "appendSignup" | "emailExists" | "getSignupStats";
  timestamp: number;
  data?: Record<string, unknown>;
}
const operationLog: OperationEntry[] = [];
let enableOperationLogging = false;

export const mockSheetsService = {
  reset() {
    mockSheetData.clear();
    mockAuthError = null;
    mockWriteError = null;
    operationLog.length = 0;
    enableOperationLogging = false;
  },

  // Enable operation logging for tests that need to verify calls
  enableOperationLogging() {
    enableOperationLogging = true;
  },

  setAuthError(error: Error | null) {
    mockAuthError = error;
  },

  setWriteError(error: Error | null) {
    mockWriteError = error;
  },

  // Simulate specific API errors
  simulateError(type: "auth" | "quota" | "api" | "network" | null) {
    if (!type) {
      mockAuthError = null;
      mockWriteError = null;
      return;
    }

    const errors = {
      auth: new Error("Authentication failed"),
      quota: new Error("Quota exceeded"),
      api: new Error("API error"),
      network: new Error("Network error"),
    };
    mockAuthError = errors[type];
  },

  getSheetData(sheetTab: string) {
    return mockSheetData.get(sheetTab) || [];
  },

  // Track operation history
  getOperationHistory(): OperationEntry[] {
    return Array.from(operationLog);
  },

  // Verify specific calls
  assertCalledWithEmail(email: string): boolean {
    return operationLog.some(
      (op) => op.operation === "appendSignup" && op.data?.["email"] === email,
    );
  },

  // Count operations by type
  countOperations(operation: OperationEntry["operation"]): number {
    return operationLog.filter((op) => op.operation === operation).length;
  },

  // Mock implementation
  initializeSheetTab: async (sheetTab: string, _config: unknown) => {
    if (enableOperationLogging) {
      operationLog.push({
        operation: "initializeSheetTab",
        timestamp: Date.now(),
        data: { sheetTab },
      });
    }

    if (mockAuthError) throw mockAuthError;
    if (!mockSheetData.has(sheetTab)) {
      mockSheetData.set(sheetTab, []);
    }
  },

  appendSignup: async (data: {
    email: string;
    timestamp: string;
    sheetTab: string;
    source?: string;
    name?: string;
    tags?: string[];
    metadata?: string;
  }, _config: unknown) => {
    if (enableOperationLogging) {
      operationLog.push({
        operation: "appendSignup",
        timestamp: Date.now(),
        data: { email: data.email, sheetTab: data.sheetTab },
      });
    }

    if (mockAuthError) throw mockAuthError;
    if (mockWriteError) throw mockWriteError;

    const tab = data.sheetTab;
    if (!mockSheetData.has(tab)) {
      mockSheetData.set(tab, []);
    }

    mockSheetData.get(tab)?.push({
      email: data.email,
      timestamp: data.timestamp,
      source: data.source,
      name: data.name,
      tags: data.tags?.join(", "),
      metadata: data.metadata,
    });
  },

  emailExists: async (email: string, sheetTab: string | undefined, _config: unknown) => {
    if (enableOperationLogging) {
      operationLog.push({
        operation: "emailExists",
        timestamp: Date.now(),
        data: { email, sheetTab },
      });
    }

    if (mockAuthError) throw mockAuthError;

    const tabs = sheetTab ? [sheetTab] : Array.from(mockSheetData.keys());

    for (const tab of tabs) {
      const rows = mockSheetData.get(tab) || [];
      for (const row of rows) {
        if (row.email.toLowerCase() === email.toLowerCase()) {
          return true;
        }
      }
    }

    return false;
  },

  getSignupStats: async (sheetTab: string | undefined, _config: unknown) => {
    if (enableOperationLogging) {
      operationLog.push({
        operation: "getSignupStats",
        timestamp: Date.now(),
        data: { sheetTab },
      });
    }

    if (mockAuthError) throw mockAuthError;

    const tabs = sheetTab ? [sheetTab] : Array.from(mockSheetData.keys());
    let totalSignups = 0;

    for (const tab of tabs) {
      const rows = mockSheetData.get(tab) || [];
      totalSignups += rows.length;
    }

    return {
      totalSignups,
      sheetTabs: Array.from(mockSheetData.keys()),
    };
  },
};

// Export for use in tests
export { mockSheetData, mockAuthError, mockWriteError, operationLog };
