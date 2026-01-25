/**
 * Unit tests for request-state utilities
 * Tests WeakMap-based request-scoped state management
 */

import { describe, expect, test } from "bun:test";
import {
  getRequestFlag,
  getRequestStartTime,
  setRequestFlag,
  setRequestStartTime,
} from "../../../src/utils/request-state";

describe("requestStartTime helpers", () => {
  test("should set and get request start time", () => {
    const request = new Request("http://localhost/test");
    const startTime = Date.now();

    setRequestStartTime(request, startTime);
    expect(getRequestStartTime(request)).toBe(startTime);
  });

  test("should return current time as default when not set", () => {
    const request = new Request("http://localhost/unset");
    const before = Date.now();
    const result = getRequestStartTime(request);
    const after = Date.now();

    // Result should be between before and after (inclusive)
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  test("should isolate start times between requests", () => {
    const request1 = new Request("http://localhost/test1");
    const request2 = new Request("http://localhost/test2");

    setRequestStartTime(request1, 1000);
    setRequestStartTime(request2, 2000);

    expect(getRequestStartTime(request1)).toBe(1000);
    expect(getRequestStartTime(request2)).toBe(2000);
  });
});

describe("request flag helpers", () => {
  test("should set and get flags", () => {
    const request = new Request("http://localhost/test");

    setRequestFlag(request, "testFlag", true);
    expect(getRequestFlag(request, "testFlag")).toBe(true);
  });

  test("should return false for unset flags", () => {
    const request = new Request("http://localhost/test");

    expect(getRequestFlag(request, "unsetFlag")).toBe(false);
  });

  test("should handle multiple flags per request", () => {
    const request = new Request("http://localhost/test");

    setRequestFlag(request, "flag1", true);
    setRequestFlag(request, "flag2", false);
    setRequestFlag(request, "flag3", true);

    expect(getRequestFlag(request, "flag1")).toBe(true);
    expect(getRequestFlag(request, "flag2")).toBe(false);
    expect(getRequestFlag(request, "flag3")).toBe(true);
  });

  test("should isolate flags between requests", () => {
    const request1 = new Request("http://localhost/test1");
    const request2 = new Request("http://localhost/test2");

    setRequestFlag(request1, "sharedFlag", true);
    setRequestFlag(request2, "sharedFlag", false);

    expect(getRequestFlag(request1, "sharedFlag")).toBe(true);
    expect(getRequestFlag(request2, "sharedFlag")).toBe(false);
  });

  test("should allow overwriting flag values", () => {
    const request = new Request("http://localhost/test");

    setRequestFlag(request, "mutableFlag", true);
    expect(getRequestFlag(request, "mutableFlag")).toBe(true);

    setRequestFlag(request, "mutableFlag", false);
    expect(getRequestFlag(request, "mutableFlag")).toBe(false);
  });
});
