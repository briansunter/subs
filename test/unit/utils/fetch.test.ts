/**
 * Unit tests for the bounded fetch helper.
 * Deterministic: uses tiny timeouts and a signal-respecting mock; never sleeps
 * for the real 10s default.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  FetchTimeoutError,
  fetchWithTimeout,
  readResponseJsonWithTimeout,
  readResponseTextWithTimeout,
} from "../../../src/utils/fetch";

const originalFetch = globalThis.fetch;

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("forwards input and options to fetch and resolves with the response", async () => {
    const expected = new Response("ok", { status: 200 });

    let capturedInput: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
      capturedInput = input;
      capturedInit = init;
      return Promise.resolve(expected);
    }) as typeof fetch;

    const response = await fetchWithTimeout("https://example.com/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(response).toBe(expected);
    expect(capturedInput).toBe("https://example.com/api");
    expect(capturedInit?.method).toBe("POST");
    expect(capturedInit?.headers).toEqual({ "Content-Type": "application/json" });
    expect(capturedInit?.body).toBe(JSON.stringify({ hello: "world" }));
    // A composed abort signal is always supplied, replacing any caller signal.
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    // Completed normally: the composed signal was never aborted.
    expect(capturedInit?.signal?.aborted).toBe(false);
  });

  test("aborts and rejects with a FetchTimeoutError when the request hangs", async () => {
    // Mock that mimics real fetch: it never resolves on its own, but rejects
    // with the composed signal's reason when that signal aborts.
    let observedSignal: AbortSignal | null | undefined;
    globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      observedSignal = signal;
      return new Promise<Response>((_resolve, reject) => {
        // Mirror real fetch: an already-aborted signal rejects immediately;
        // otherwise reject when the abort event fires.
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(signal?.reason);
        });
      });
    }) as typeof fetch;

    const promise = fetchWithTimeout("https://example.com/slow", undefined, 30);

    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);

    // The internal signal must have been aborted by the timer.
    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBeInstanceOf(FetchTimeoutError);
  });

  test("preserves a caller-supplied signal: aborting it aborts the request and propagates the reason", async () => {
    let observedSignal: AbortSignal | null | undefined;
    globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      observedSignal = signal;
      return new Promise<Response>((_resolve, reject) => {
        // Mirror real fetch: an already-aborted signal rejects immediately;
        // otherwise reject when the abort event fires.
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(signal?.reason);
        });
      });
    }) as typeof fetch;

    const caller = new AbortController();
    const reason = new Error("caller cancelled");
    // Long timeout so the only way to resolve is the caller aborting.
    const promise = fetchWithTimeout("https://example.com/api", { signal: caller.signal }, 5000);

    caller.abort(reason);

    await expect(promise).rejects.toBe(reason);

    // Caller's reason propagates to the composed signal.
    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBe(reason);
  });

  test("propagates an already-aborted caller signal immediately", async () => {
    let observedSignal: AbortSignal | null | undefined;
    globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      observedSignal = signal;
      return new Promise<Response>((_resolve, reject) => {
        // Mirror real fetch: an already-aborted signal rejects immediately.
        if (signal?.aborted) {
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(signal?.reason);
        });
      });
    }) as typeof fetch;

    const caller = new AbortController();
    const reason = new Error("pre-aborted");
    caller.abort(reason);

    await expect(
      fetchWithTimeout("https://example.com/api", { signal: caller.signal }, 5000),
    ).rejects.toBe(reason);

    expect(observedSignal?.aborted).toBe(true);
    expect(observedSignal?.reason).toBe(reason);
  });

  test("uses a 10,000 ms default timeout constant", () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
  });
});

describe("readResponseTextWithTimeout", () => {
  test("reads a normal text body within the bound", async () => {
    const response = new Response("hello body", { status: 200 });

    const text = await readResponseTextWithTimeout(response, 5000);

    expect(text).toBe("hello body");
  });

  test("decodes multi-chunk UTF-8 the same as response.text()", async () => {
    const expected = "héllo, 世界";
    const encoded = new TextEncoder().encode(expected);
    // Split into three chunks to exercise the streaming decoder.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded.slice(0, 3));
        controller.enqueue(encoded.slice(3, 7));
        controller.enqueue(encoded.slice(7));
        controller.close();
      },
    });

    const text = await readResponseTextWithTimeout(new Response(stream), 5000);

    expect(text).toBe(expected);
  });

  test("rejects with FetchTimeoutError and cancels a hanging body", async () => {
    let sourceCancelled = 0;
    let cancelReason: unknown;
    const stream = new ReadableStream({
      // Never enqueues and never closes => the body read hangs forever.
      start() {},
      cancel(reason) {
        sourceCancelled++;
        cancelReason = reason;
      },
    });

    // Long enough to be deterministic, short enough to keep the test fast.
    const promise = readResponseTextWithTimeout(new Response(stream), 30);

    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);

    // The helper owns the reader, so cancelling on timeout propagates to the
    // underlying source and the hung stream is not left running.
    expect(sourceCancelled).toBe(1);
    expect(cancelReason).toBeInstanceOf(FetchTimeoutError);
  });

  test("does not cancel when the read completes before the timeout", async () => {
    let sourceCancelled = 0;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("done quickly"));
        controller.close();
      },
      cancel() {
        sourceCancelled++;
      },
    });

    const text = await readResponseTextWithTimeout(new Response(stream), 5000);

    expect(text).toBe("done quickly");
    expect(sourceCancelled).toBe(0);
  });

  test("returns '' for a null body via the platform text()", async () => {
    const text = await readResponseTextWithTimeout(new Response(null), 5000);

    expect(text).toBe("");
  });

  test("falls back to response.text() when the body is not a ReadableStream", async () => {
    // A test double that only implements text() (no readable body stream).
    const double = { text: async () => "double-text" } as unknown as Response;

    const text = await readResponseTextWithTimeout(double, 5000);

    expect(text).toBe("double-text");
  });
});

describe("readResponseJsonWithTimeout", () => {
  test("parses a normal JSON body within the bound", async () => {
    const response = new Response(JSON.stringify({ ok: true, n: 7 }), { status: 200 });

    const json = await readResponseJsonWithTimeout(response, 5000);

    expect(json).toEqual({ ok: true, n: 7 });
  });

  test("rejects with FetchTimeoutError and cancels a hanging body", async () => {
    let sourceCancelled = 0;
    let cancelReason: unknown;
    const stream = new ReadableStream({
      // Never enqueues and never closes => the body read hangs forever.
      start() {},
      cancel(reason) {
        sourceCancelled++;
        cancelReason = reason;
      },
    });

    const promise = readResponseJsonWithTimeout(new Response(stream), 30);

    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);

    // The JSON read reuses the cancellable text-reader path (rather than
    // response.json(), which locks the body), so cancelling on timeout
    // propagates to the underlying source and the hung stream is not left
    // running.
    expect(sourceCancelled).toBe(1);
    expect(cancelReason).toBeInstanceOf(FetchTimeoutError);
  });

  test("preserves a parse error instead of masking it as a timeout", async () => {
    // A real body that decodes as valid text but is not valid JSON: the read
    // completes inside the bound, and JSON.parse surfaces a SyntaxError rather
    // than the helper converting it to a FetchTimeoutError.
    const response = new Response("invalid json", { status: 200 });

    await expect(readResponseJsonWithTimeout(response, 5000)).rejects.toBeInstanceOf(SyntaxError);
  });

  test("honors an own json() override on a real Response instead of parsing the body", async () => {
    // A real Response carries text() on its prototype, but a test may override
    // json() as an own property to inject specific error semantics. The helper
    // must honor that override (calling it and racing it against the timeout)
    // rather than bypassing it via the text-reader path, which would read the
    // underlying body and re-parse it, masking the override's thrown error.
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    Object.defineProperty(response, "json", {
      value: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expect(readResponseJsonWithTimeout(response, 5000)).rejects.toThrow("Unexpected token");
  });

  test("falls back to response.json() when text() is not callable", async () => {
    // A nonstandard test/double that only implements json() (no text()/body):
    // the helper races that json() promise against the timeout instead of
    // calling text(), so such doubles keep working. There is no stream to
    // cancel, so this exercises the no-op-cancellation fallback path.
    const double = { json: async () => ({ ok: true, n: 7 }) } as unknown as Response;

    const json = await readResponseJsonWithTimeout(double, 5000);

    expect(json).toEqual({ ok: true, n: 7 });
  });

  test("rejects with FetchTimeoutError when a json()-only double hangs", async () => {
    // A nonstandard double whose json() never settles: the no-op-cancellation
    // fallback still races that promise against the timeout and rejects with the
    // same FetchTimeoutError as the cancellable text-reader path, preserving the
    // shared timeout error and timer cleanup.
    const double = { json: () => new Promise<unknown>(() => {}) } as unknown as Response;

    const promise = readResponseJsonWithTimeout(double, 30);

    await expect(promise).rejects.toBeInstanceOf(FetchTimeoutError);
  });
});
