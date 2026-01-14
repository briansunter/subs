/**
 * Signup API routes
 */

import type { FastifyInstance } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { bulkSignupSchema, extendedSignupSchema, signupSchema } from "../schemas/signup";
import { recordHttpRequest, register } from "../services/metrics";
import {
  createDefaultContext,
  handleBulkSignup,
  handleExtendedSignup,
  handleGetStats,
  handleHealthCheck,
  handleSignup,
  type SignupContext,
} from "./handlers";

/**
 * Options for signup routes registration
 */
export interface SignupRoutesOptions {
  /**
   * Optional context for dependency injection
   * If not provided, creates default context with real services
   */
  context?: SignupContext;
}

/**
 * Register signup routes
 */
export async function signupRoutes(fastify: FastifyInstance, options: SignupRoutesOptions = {}) {
  // Create context with real services, or use provided context for testing
  const context = options.context ?? createDefaultContext();

  // Add hooks to track HTTP request metrics
  fastify.addHook("onRequest", async (request, _reply) => {
    (request as { startTime?: number }).startTime = Date.now();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const duration =
      (Date.now() - ((request as { startTime?: number }).startTime || Date.now())) / 1000;
    const route = request.routeOptions?.url || request.url || "unknown";
    recordHttpRequest(request.method, route, reply.statusCode, duration);
  });

  // Set up Zod type provider for validation and serialization
  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  // Custom error handler for Zod validation errors
  fastify.setErrorHandler((err, _request, reply) => {
    const error = err as Error & {
      validation?: Array<{ params?: { field?: string }; message?: string }>;
    };

    // Handle Zod validation errors from fastify-type-provider-zod
    if (error.validation && error.validation.length > 0) {
      const details: string[] = [];
      for (const e of error.validation) {
        details.push(`${e.params?.field || "field"}: ${e.message || "invalid"}`);
      }
      reply.code(400).send({
        success: false,
        statusCode: 400,
        error: "Validation failed",
        details,
      });
      return;
    }

    // Handle other errors
    reply.send(error);
  });

  const fastifyZod = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * Health check endpoint
   */
  fastifyZod.get("/health", async (_request, reply) => {
    const result = handleHealthCheck();
    return reply.code(result.statusCode).send(result.data);
  });

  /**
   * Get public configuration
   * Returns safe public values like Turnstile site key (not secret keys)
   */
  fastifyZod.get("/config", async (_request, reply) => {
    const { turnstileSiteKey, defaultSheetTab } = context.config;
    return reply.send({
      turnstileSiteKey: turnstileSiteKey ?? null,
      turnstileEnabled: !!turnstileSiteKey,
      defaultSheetTab,
    });
  });

  /**
   * Prometheus metrics endpoint
   * Exposes metrics for Prometheus scraping
   */
  fastify.get("/metrics", async (_request, reply) => {
    reply.type("text/plain").send(await register.metrics());
  });

  /**
   * Get signup statistics
   */
  fastifyZod.get(
    "/stats",
    {
      schema: {
        querystring: signupSchema.pick({ sheetTab: true }).partial(),
      },
    } as const,
    async (request, reply) => {
      const { sheetTab } = request.query;
      const result = await handleGetStats(sheetTab, context);
      return reply
        .code(result.statusCode)
        .send(
          result.statusCode === 200
            ? { success: result.success, data: result.data }
            : { success: result.success, error: result.error },
        );
    },
  );

  /**
   * Basic signup endpoint - email only
   */
  fastifyZod.post(
    "/signup",
    {
      schema: {
        body: signupSchema,
      },
    },
    async (request, reply) => {
      const result = await handleSignup(request.body, context);
      return reply.code(result.statusCode).send(result);
    },
  );

  /**
   * Extended signup endpoint - with additional fields
   */
  fastifyZod.post(
    "/signup/extended",
    {
      schema: {
        body: extendedSignupSchema,
      },
    },
    async (request, reply) => {
      const result = await handleExtendedSignup(request.body, context);
      return reply.code(result.statusCode).send(result);
    },
  );

  /**
   * Bulk signup endpoint
   */
  fastifyZod.post(
    "/signup/bulk",
    {
      schema: {
        body: bulkSignupSchema,
      },
    },
    async (request, reply) => {
      const result = await handleBulkSignup(request.body, context);
      return reply.code(result.statusCode).send(result);
    },
  );
}
