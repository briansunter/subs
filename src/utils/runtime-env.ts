/**
 * Runtime environment helpers that are safe in Bun, Node-compatible Workers,
 * and Workers-like test runtimes where `process` may not exist.
 */

type RuntimeProcess = {
  env?: Record<string, string | undefined>;
};

export function getRuntimeEnv(): Record<string, string | undefined> {
  const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  return runtimeProcess?.env ?? {};
}
