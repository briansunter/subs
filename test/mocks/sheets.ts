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

// Simple call counters
let appendSignupCalls = 0;
let emailExistsCalls = 0;

export const mockSheetsService = {
  reset() {
    mockSheetData.clear();
    mockAuthError = null;
    mockWriteError = null;
    appendSignupCalls = 0;
    emailExistsCalls = 0;
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

  // Simple call counting
  getAppendSignupCalls(): number {
    return appendSignupCalls;
  },

  getEmailExistsCalls(): number {
    return emailExistsCalls;
  },

  // Mock implementations
  initializeSheetTab: async (sheetTab: string, _config: unknown) => {
    if (mockAuthError) throw mockAuthError;
    if (!mockSheetData.has(sheetTab)) {
      mockSheetData.set(sheetTab, []);
    }
  },

  appendSignup: async (
    data: {
      email: string;
      timestamp: string;
      sheetTab: string;
      source?: string;
      name?: string;
      tags?: string[];
      metadata?: string;
    },
    _config: unknown,
  ) => {
    appendSignupCalls++;
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
    emailExistsCalls++;
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
};
