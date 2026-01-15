/**
 * Unit tests for request-state utilities
 * Tests WeakMap-based request-scoped state management
 */

import { describe, expect, test } from "bun:test";
import {
  getRequestFlag,
  getRequestStartTime,
  RequestState,
  requestStartTime,
  setRequestFlag,
  setRequestStartTime,
} from "../../../src/utils/request-state";

describe("RequestState", () => {
  describe("basic operations", () => {
    test("should store and retrieve values", () => {
      const state = new RequestState<string>();
      const request = new Request("http://localhost/test");

      state.set(request, "test-value");
      expect(state.get(request, "default")).toBe("test-value");
    });

    test("should return default value when not set", () => {
      const state = new RequestState<number>();
      const request = new Request("http://localhost/test");

      expect(state.get(request, 42)).toBe(42);
    });

    test("should check if request has a value", () => {
      const state = new RequestState<string>();
      const request = new Request("http://localhost/test");

      expect(state.has(request)).toBe(false);
      state.set(request, "value");
      expect(state.has(request)).toBe(true);
    });

    test("should delete values", () => {
      const state = new RequestState<string>();
      const request = new Request("http://localhost/test");

      state.set(request, "value");
      expect(state.has(request)).toBe(true);

      state.delete(request);
      expect(state.has(request)).toBe(false);
      expect(state.get(request, "default")).toBe("default");
    });

    test("should isolate state between requests", () => {
      const state = new RequestState<string>();
      const request1 = new Request("http://localhost/test1");
      const request2 = new Request("http://localhost/test2");

      state.set(request1, "value1");
      state.set(request2, "value2");

      expect(state.get(request1, "default")).toBe("value1");
      expect(state.get(request2, "default")).toBe("value2");
    });
  });

  describe("typed values", () => {
    test("should handle numeric values", () => {
      const state = new RequestState<number>();
      const request = new Request("http://localhost/test");

      state.set(request, 123);
      expect(state.get(request, 0)).toBe(123);
    });

    test("should handle object values", () => {
      const state = new RequestState<{ key: string }>();
      const request = new Request("http://localhost/test");

      state.set(request, { key: "value" });
      expect(state.get(request, { key: "default" })).toEqual({ key: "value" });
    });

    test("should handle boolean values", () => {
      const state = new RequestState<boolean>();
      const request = new Request("http://localhost/test");

      state.set(request, true);
      expect(state.get(request, false)).toBe(true);
    });
  });
});

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

  test("should use shared requestStartTime instance", () => {
    const request = new Request("http://localhost/shared");
    const startTime = 1234567890;

    // Use the exported instance directly
    requestStartTime.set(request, startTime);
    expect(getRequestStartTime(request)).toBe(startTime);
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
