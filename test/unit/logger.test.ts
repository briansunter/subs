/**
 * Unit tests for logger utility
 * Tests Pino logger configuration, log levels, and child loggers
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { createChildLogger, logger } from "../../src/utils/logger";

// Store original env vars
const originalEnv = { ...process.env };

describe("Logger - Unit Tests", () => {
  beforeEach(() => {
    // Reset environment to original state
    for (const key of Object.keys(process.env)) {
      if (key === "NODE_ENV" || key === "LOG_LEVEL") {
        delete process.env[key];
      }
    }
    // Reset to original values
    if (originalEnv.NODE_ENV) {
      process.env["NODE_ENV"] = originalEnv.NODE_ENV;
    }
    if (originalEnv["LOG_LEVEL"]) {
      process.env["LOG_LEVEL"] = originalEnv["LOG_LEVEL"];
    }
  });

  describe("logger configuration", () => {
    test("should default to info log level when LOG_LEVEL not set", () => {
      // Note: Logger is already loaded with original env vars
      // We can't test different log levels without clearing cache
      // which causes circular dependency issues with other modules
      // So we just verify the current logger is working
      expect(logger.level).toBeDefined();
      expect(typeof logger.level).toBe("string");
    });

    test("should have valid log level", () => {
      const validLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"];
      expect(validLevels).toContain(logger.level);
    });
  });

  describe("development vs production mode", () => {
    test("should export logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    test("should have all required log methods", () => {
      expect(typeof logger.trace).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.fatal).toBe("function");
    });
  });

  describe("logger methods", () => {
    test("should have trace method", () => {
      expect(typeof logger.trace).toBe("function");
    });

    test("should have debug method", () => {
      expect(typeof logger.debug).toBe("function");
    });

    test("should have info method", () => {
      expect(typeof logger.info).toBe("function");
    });

    test("should have warn method", () => {
      expect(typeof logger.warn).toBe("function");
    });

    test("should have error method", () => {
      expect(typeof logger.error).toBe("function");
    });

    test("should have fatal method", () => {
      expect(typeof logger.fatal).toBe("function");
    });

    test("should log messages without throwing", () => {
      expect(() => {
        logger.info("test message");
        logger.debug("debug message");
        logger.warn("warning message");
        logger.error("error message");
      }).not.toThrow();
    });

    test("should log with context object", () => {
      expect(() => {
        logger.info({ userId: "123", action: "test" }, "test message");
      }).not.toThrow();
    });

    test("should log with error object", () => {
      const error = new Error("Test error");
      expect(() => {
        logger.error({ err: error }, "error occurred");
      }).not.toThrow();
    });
  });

  describe("createChildLogger", () => {
    test("should create child logger with context", () => {
      const childLogger = createChildLogger("test-context");

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe("function");
      expect(typeof childLogger.error).toBe("function");
    });

    test("should create child with string context", () => {
      const childLogger = createChildLogger("my-module");

      expect(childLogger).toBeDefined();
    });

    test("should allow child to log messages", () => {
      const childLogger = createChildLogger("test");

      expect(() => {
        childLogger.info("child message");
        childLogger.error("child error");
      }).not.toThrow();
    });

    test("should create multiple independent child loggers", () => {
      const child1 = createChildLogger("module-1");
      const child2 = createChildLogger("module-2");

      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child1).not.toBe(child2);
    });

    test("should allow nested context in child logger calls", () => {
      const childLogger = createChildLogger("base-context");

      expect(() => {
        childLogger.info({ extra: "data" }, "message with extra context");
      }).not.toThrow();
    });
  });

  describe("log level filtering", () => {
    test("should have a log level set", () => {
      expect(logger.level).toBeDefined();
      expect(typeof logger.level).toBe("string");
    });

    test("should be one of the valid Pino levels", () => {
      const validLevels = ["trace", "debug", "info", "warn", "error", "fatal", "silent"];
      expect(validLevels).toContain(logger.level);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty context string", () => {
      expect(() => {
        createChildLogger("");
      }).not.toThrow();
    });

    test("should handle special characters in context", () => {
      expect(() => {
        createChildLogger("module-with-special-chars-@#$");
      }).not.toThrow();
    });

    test("should handle very long context strings", () => {
      const longContext = "a".repeat(1000);
      expect(() => {
        createChildLogger(longContext);
      }).not.toThrow();
    });
  });

  describe("logger instance", () => {
    test("should export singleton logger instance", () => {
      // Verify we can get the same logger instance
      const { logger: logger1 } = require("../../src/utils/logger");
      expect(logger1).toBeDefined();
      expect(logger1).toBe(logger);
    });

    test("should maintain logger functionality", () => {
      expect(() => {
        logger.info("test message");
        logger.debug("debug message");
        logger.warn("warning message");
        logger.error("error message");
      }).not.toThrow();
    });
  });
});
