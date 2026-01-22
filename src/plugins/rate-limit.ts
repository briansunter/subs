/**
 * Elysia plugin for rate limiting
 *
 * Provides simple in-memory rate limiting compatible with Cloudflare Workers.
 * Uses a fixed window approach with automatic cleanup of expired entries.
 *
 * @see {@link https://elysiajs.com/plugins/overview | Elysia Plugin Overview}
 */

import type { Elysia } from "elysia";
import type { SignupConfig } from "../config";

/**
 * Rate limit entry for a single IP
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * In-memory rate limit store
 * Key: IP address, Value: rate limit entry
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get client IP from request headers
 * Handles common proxy headers (X-Forwarded-For, CF-Connecting-IP)
 *
 * @param request - Incoming request
 * @returns Client IP address or "unknown"
 */
export function getClientIp(request: Request): string {
  // Cloudflare's header takes precedence
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard proxy header (take first IP in chain)
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor.split(",");
    const first = parts[0];
    if (first) {
      const trimmed = first.trim();
      if (trimmed) return trimmed;
    }
  }

  // X-Real-IP is used by some proxies
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Check if a request should be rate limited
 *
 * @param ip - Client IP address
 * @param windowMs - Rate limit window in milliseconds
 * @param maxRequests - Maximum requests allowed per window
 * @returns Object with allowed status and retry-after seconds if limited
 */
export function checkRateLimit(
  ip: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; retryAfter?: number; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  // No existing entry or window expired - create new entry
  if (!entry || now - entry.windowStart >= windowMs) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  // Within window - check if limit exceeded
  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Increment count
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count };
}

/**
 * Clear expired entries from the rate limit store
 * Should be called periodically to prevent memory leaks
 *
 * @param windowMs - Rate limit window in milliseconds
 */
export function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart >= windowMs) {
      rateLimitStore.delete(ip);
    }
  }
}

/**
 * Clear all entries from the rate limit store
 * Useful for testing
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Get the current size of the rate limit store
 * Useful for monitoring
 */
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}

/**
 * Plugin that adds rate limiting to all requests
 *
 * Uses legacy plugin pattern to work around Elysia bug where
 * onBeforeHandle doesn't fire in plugin instances.
 *
 * Features:
 * - Fixed window rate limiting per IP
 * - Configurable window and request limits
 * - Returns 429 Too Many Requests when exceeded
 * - Adds Retry-After header when rate limited
 * - Adds X-RateLimit-* headers to all responses
 *
 * @param app - Elysia instance to decorate
 * @param config - Signup configuration with rate limit settings
 *
 * @see {@link https://github.com/elysiajs/elysia/issues/1382 | GitHub Issue #1382}
 *
 * @example
 * ```ts
 * import { rateLimitPlugin } from './plugins/rate-limit'
 * import { getConfig } from './config'
 *
 * new Elysia()
 *   .use((app) => rateLimitPlugin(app, getConfig()))
 *   .get('/', () => 'Hello')
 * ```
 */
export const rateLimitPlugin = (app: Elysia, config: SignupConfig) => {
  // Skip if rate limiting is disabled
  if (!config.enableRateLimiting) {
    return app;
  }

  // Periodic cleanup (every 5 minutes)
  const cleanupInterval = 5 * 60 * 1000;
  let lastCleanup = Date.now();

  return app.onBeforeHandle(({ request, set }) => {
    // Run cleanup periodically to prevent memory leaks
    const now = Date.now();
    if (now - lastCleanup >= cleanupInterval) {
      cleanupExpiredEntries(config.rateLimitWindowMs);
      lastCleanup = now;
    }

    const ip = getClientIp(request);
    const result = checkRateLimit(ip, config.rateLimitWindowMs, config.rateLimitMaxRequests);

    // Add rate limit headers to response
    set.headers["X-RateLimit-Limit"] = String(config.rateLimitMaxRequests);
    set.headers["X-RateLimit-Remaining"] = String(result.remaining);
    set.headers["X-RateLimit-Reset"] = String(Math.ceil((now + config.rateLimitWindowMs) / 1000));

    // Return 429 if rate limited
    if (!result.allowed) {
      set.status = 429;
      set.headers["Retry-After"] = String(result.retryAfter);
      return {
        success: false,
        statusCode: 429,
        error: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      };
    }
  });
};
