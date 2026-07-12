/**
 * Bounded upstream request helpers.
 *
 * Two layers of timeout protection for upstream Google Sheets and Cloudflare
 * Turnstile calls:
 *
 * 1. {@link fetchWithTimeout} bounds the request itself with an
 *    AbortController-backed timer. That timer is cleared as soon as the
 *    Response resolves, so it does NOT cover the subsequent response-body read.
 * 2. {@link readResponseTextWithTimeout} / {@link readResponseJsonWithTimeout}
 *    bound the body read that fetchWithTimeout leaves unbounded: a provider
 *    that sends headers promptly but then stalls while streaming the body could
 *    otherwise hold the request open indefinitely.
 *
 * Implemented with AbortController + a timer (rather than AbortSignal.any) so
 * it runs on both Bun and Cloudflare Workers.
 */

/**
 * Default timeout for upstream requests, in milliseconds.
 *
 * Kept as an explicit constant so the bound is easy to find and adjust. A
 * hung external request is aborted after this many milliseconds instead of
 * waiting forever. Deliberately not configurable via an environment variable.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * Abort reason used when the timeout fires. Surfaced through the existing
 * service catch/error paths so callers see a meaningful message in logs.
 */
export class FetchTimeoutError extends Error {
  override readonly name = "FetchTimeoutError";

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
  }
}

/**
 * fetch wrapper that aborts the request after a bounded timeout.
 *
 * A fresh AbortController is composed with any caller-supplied
 * `RequestInit.signal`: if the caller's signal aborts first, that reason is
 * propagated; if the timer fires first, the request is aborted with a
 * {@link FetchTimeoutError}. The listener forwarding the caller's abort and
 * the timeout timer are always cleaned up in `finally`.
 *
 * All other `RequestInit` options are passed through unchanged; only the
 * `signal` is replaced with the composed one.
 *
 * @param input - Request target (string, URL, or Request).
 * @param init - Standard fetch options. An incoming `signal` is composed with
 *   the timeout rather than discarded.
 * @param timeoutMs - Milliseconds before the request is aborted. Defaults to
 *   {@link DEFAULT_FETCH_TIMEOUT_MS}.
 * @returns The upstream `Response`, or rejects when the request errors or is
 *   aborted by either the caller or the timeout.
 */
export async function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const callerSignal = init?.signal;

  // Forward caller aborts to the internal controller so the caller's reason
  // wins when it aborts before the timeout.
  const onCallerAbort = () => {
    if (!controller.signal.aborted) {
      controller.abort(callerSignal?.reason);
    }
  };

  if (callerSignal?.aborted) {
    // Caller already aborted; propagate immediately.
    controller.abort(callerSignal.reason);
  } else if (callerSignal) {
    callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  const timer = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(new FetchTimeoutError(timeoutMs));
    }
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  }
}

/**
 * Race a response-body read against a timeout, cancelling the body on timeout.
 *
 * Shared by {@link readResponseTextWithTimeout} and
 * {@link readResponseJsonWithTimeout}. The timer is always cleared in `finally`.
 * The losing race branch (the body read, when the timeout wins) never surfaces
 * as an unhandled rejection: a no-op rejection handler is attached up front, and
 * any cancellation rejection is swallowed.
 *
 * Note this is distinct from {@link fetchWithTimeout}: that timer is cleared once
 * the Response resolves and does not bound the body read performed here.
 */
async function raceReadWithCancellation<T>(
  readPromise: Promise<T>,
  cancel: (reason: FetchTimeoutError) => Promise<void>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Constructed once so the timed-out rejection and the cancel reason are the
  // same instance, identified by reference equality below.
  const timeoutError = new FetchTimeoutError(timeoutMs);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), timeoutMs);
  });

  // Absorb a late rejection from the read promise so it never becomes an
  // unhandled rejection after the timeout wins the race.
  void readPromise.catch(() => {});

  try {
    return await Promise.race([readPromise, timeout]);
  } catch (error) {
    if (error === timeoutError) {
      // Cancel the underlying body so a hung stream is not left running. The
      // cancel may reject (e.g. if the underlying source's cancel throws);
      // swallow that — the read itself is already bounded by the race above.
      await cancel(timeoutError).catch(() => {});
    }
    throw error;
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Read a response body as text within a bounded timeout.
 *
 * fetchWithTimeout bounds only the request: its timer is cleared as soon as the
 * Response resolves, so the subsequent body read is otherwise unbounded. A
 * provider that sends headers promptly but then stalls while streaming the body
 * could hold the request open indefinitely. This helper races the body read
 * against the same default bound and, on timeout, rejects with
 * {@link FetchTimeoutError} and cancels the stream so a hung body is not left
 * running.
 *
 * To cancel reliably on timeout the body is read through a reader this helper
 * owns: cancelling `response.body` directly would reject while `text()` holds
 * the stream locked. When the body is not a ReadableStream this helper can lock
 * (a null body, or a test double that only implements `text()`), it falls back
 * to the platform's `text()` read, which is still bounded by the race;
 * cancellation is then best-effort.
 *
 * @param response - The upstream Response whose body should be read.
 * @param timeoutMs - Milliseconds before the read is aborted. Defaults to
 *   {@link DEFAULT_FETCH_TIMEOUT_MS}.
 * @returns The decoded body text, or rejects with {@link FetchTimeoutError} on
 *   timeout (or with the underlying read error).
 */
export async function readResponseTextWithTimeout(
  response: Response,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<string> {
  const body = response.body;
  if (body instanceof ReadableStream) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const readPromise = (async () => {
      let text = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          text += decoder.decode(chunk.value, { stream: true });
        }
      }
      // Flush any trailing bytes held by the decoder.
      text += decoder.decode();
      return text;
    })();

    return raceReadWithCancellation(readPromise, (reason) => reader.cancel(reason), timeoutMs);
  }

  // Nothing to lock and cancel (null body, or a test double): defer to the
  // platform read, still bounded by the race.
  return raceReadWithCancellation(response.text(), () => Promise.resolve(), timeoutMs);
}

/**
 * Read and parse a response body as JSON within a bounded timeout.
 *
 * Reads the body through the same cancellable text-reader path as
 * {@link readResponseTextWithTimeout} and then parses the buffered text through
 * an in-memory `new Response(text).json()`. Reusing that read path matters: the
 * reader is owned by this helper, so on timeout the underlying stream can be
 * cancelled outright rather than left locked by `response.json()` (whose lock
 * makes `response.body.cancel()` reject, leaving a hung body read running in the
 * background). The in-memory parse uses a fresh Response with a complete body,
 * so it never re-reads or locks the original stream and cannot hang.
 *
 * A nonstandard test/double that implements `json()` but not `text()`/`body` —
 * so there is no cancellable text-reader path to take — falls back to racing
 * that `json()` promise against the same timeout. There is no readable stream
 * to cancel in that case, so the cancellation callback is a no-op.
 *
 * A hung body rejects with {@link FetchTimeoutError}; a malformed body surfaces
 * the platform's parse SyntaxError rather than masking it as a timeout.
 *
 * @param response - The upstream Response whose body should be parsed.
 * @param timeoutMs - Milliseconds before the read is aborted. Defaults to
 *   {@link DEFAULT_FETCH_TIMEOUT_MS}.
 * @returns The parsed JSON value, or rejects with {@link FetchTimeoutError} on
 *   timeout (or with the underlying read/parse error).
 */
export async function readResponseJsonWithTimeout(
  response: Response,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<unknown> {
  // A Response whose json() is overridden as an own/instance property (e.g. a
  // real Response test double whose json() throws a specific error): honor that
  // override and race it against the timeout. This must come before the
  // text-reader path below, which would otherwise read the underlying body and
  // re-parse it via a fresh Response.json(), bypassing the override and masking
  // whatever error semantics it carries. There is no owned readable stream to
  // cancel here, so the cancellation callback is a no-op.
  if (Object.hasOwn(response, "json") && typeof response.json === "function") {
    return raceReadWithCancellation(response.json(), () => Promise.resolve(), timeoutMs);
  }

  // A real Response (or a double that mirrors text()) reads the body through
  // the cancellable text-reader and parses it, so a hanging stream can be
  // cancelled rather than left locked by response.json().
  if (typeof response.text === "function") {
    const text = await readResponseTextWithTimeout(response, timeoutMs);
    // Parse through an in-memory Response.json() rather than JSON.parse so the
    // malformed-body error keeps the platform's parsing semantics (message and
    // identity). The body is a fully-buffered string on a brand-new Response,
    // so this read resolves immediately — it never re-reads or locks the
    // original upstream stream, and it cannot hang.
    return new Response(text).json();
  }

  // Nonstandard test/double that implements json() but not text()/body: race
  // that json() promise against the same timeout. There is no readable stream
  // to cancel here, so the cancellation callback is a no-op.
  if (typeof response.json === "function") {
    return raceReadWithCancellation(response.json(), () => Promise.resolve(), timeoutMs);
  }

  throw new TypeError("Response is missing both text() and json() methods");
}
