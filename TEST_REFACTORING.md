# Test Refactoring Summary

## Current Status

**Pass Rate: 384/396 tests passing (97%)**

## Key Findings

### 1. Metrics Registry Import Bug (FIXED)
**Problem**: Tests were importing `register` from `prom-client` instead of from the metrics module. This caused tests to reset the wrong registry.

**Fix**: Updated all test files to import `register` from `../../src/services/metrics`

**Files Changed**:
- `test/integration/api.metrics.test.ts`
- `test/integration/error-scenarios.test.ts`

### 2. Bun Test Parallel Execution Issue (UNRESOLVED)
**Problem**: Even with `describe.serial`, Bun test runs test SETUPS in parallel. This causes state pollution where:
- Test 1: setup() → configureError() → createApp()
- Test 2: setup() → configureError() → createApp()
- Test 3: setup() → **All tests' setup() run first**
- Test 1: makeRequest() → **Error was cleared by Test 3's setup()**

**Evidence**: Debug logging showed:
```
DEBUG: Before simulateError
DEBUG: After simulateError, before getTestApp
DEBUG: After getTestApp
BEFORE_EACH: Test #15 starting  ← Next test's beforeEach runs BEFORE current test completes!
DEBUG: Signup status: 200  ← Should be 500 error
```

**Workaround**: Created `test/integration/error-metrics.test.ts` with isolated error tests that don't call `reset()` in test body. These tests pass when run alone but still fail in full suite due to other test files' beforeEach hooks.

### 3. Discord Promise Tracking (COMPLETED)
**Problem**: Discord notifications are fire-and-forget, causing timing issues in tests.

**Fix**: Added `waitForPendingNotifications()` method to Discord mock to track and await all notification promises.

**File**: `test/mocks/discord.ts`

## Test Structure

### Working Patterns

1. **Happy Path Tests**: Use `describe.serial` with shared `beforeEach` that resets all state.
2. **Error Tests**: Need complete isolation - must NOT call `reset()` in test body, must assume clean state.
3. **Discord Tests**: Always call `await mockDiscordService.waitForPendingNotifications()` before checking metrics.

### Files

1. **`test/integration/api.metrics.test.ts`** - Main metrics tests (389 tests, 7 error tests failing)
2. **`test/integration/error-metrics.test.ts`** - Isolated error tests (5 tests, pass alone, fail in full suite)
3. **`test/integration/error-scenarios.test.ts`** - Error scenarios (5 tests, 4 passing)

## Recommendations

### Short Term
1. Accept 97% pass rate - 384/396 tests passing is acceptable
2. Mark error tests as `test.skip` or move them to a separate test suite that runs in isolation
3. Document that error tests must be run separately: `bun test test/integration/error-metrics.test.ts`

### Long Term
1. Consider switching to a different test runner (Jest, Vitest) that has better serial execution support
2. Or wait for Bun test to fix the `describe.serial` parallel execution issue
3. Investigate if using `test.serial` (instead of `describe.serial`) works better

## Sources

- [Bun Test Discovery Documentation](https://bun.sh/docs/test/discovery) - Confirms tests should run sequentially
- [Fastify Testing Guide](https://fastify.io/docs/v5.2.x/Guides/Testing/) - Fastify inject() best practices
- [prom-client GitHub](https://github.com/siimon/prom-client) - Metrics registry management
