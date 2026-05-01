/**
 * Shared type definitions for integration tests
 */

/**
 * Standard API response interface for most endpoints
 */
export interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  details?: string[];
  status?: string;
  timestamp?: string;
  data?: unknown;
}

/**
 * Bulk signup API response with detailed results
 */
export interface BulkApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  details?: string[];
  statusCode?: number;
  data?: {
    success?: number;
    failed?: number;
    duplicates?: number;
    errors?: string[];
  };
}

/**
 * Config endpoint response
 */
export interface ConfigResponse {
  turnstileSiteKey?: string | null;
  turnstileEnabled: boolean;
  defaultSheetTab: string;
  sheetTabs: string[];
}

/**
 * Stats endpoint response
 */
export interface StatsResponse {
  success?: boolean;
  error?: string;
  data?: {
    total: number;
    sheetTab: string;
    lastSignup: string | null;
  };
}

/**
 * Metrics endpoint response
 */
export interface MetricsResponse {
  success?: boolean;
  error?: string;
  data?: string; // Prometheus text format
}
