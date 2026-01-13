/**
 * Signup API routes
 */

import type { FastifyInstance } from "fastify";
import {
  createDefaultContext,
  handleExtendedSignup,
  handleGetStats,
  handleHealthCheck,
  handleSignup,
  handleBulkSignup,
} from "./handlers";

/**
 * Register signup routes
 */
export async function signupRoutes(fastify: FastifyInstance) {
  // Create context with real services
  const context = createDefaultContext();

  /**
   * Health check endpoint
   */
  fastify.get("/health", async (_request, reply) => {
    const result = handleHealthCheck();
    return reply.code(result.statusCode).send(result.data);
  });

  /**
   * Get signup statistics
   */
  fastify.get(
    "/stats",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            sheetTab: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { sheetTab } = request.query as { sheetTab?: string };
      const result = await handleGetStats(sheetTab, context);
      return reply.code(result.statusCode).send(
        result.statusCode === 200
          ? { success: result.success, data: result.data }
          : { success: result.success, error: result.error }
      );
    }
  );

  /**
   * Basic signup endpoint - email only
   */
  fastify.post("/signup", async (request, reply) => {
    const result = await handleSignup(request.body as any, context);
    return reply.code(result.statusCode).send(result);
  });

  /**
   * Extended signup endpoint - with additional fields
   */
  fastify.post("/signup/extended", async (request, reply) => {
    const result = await handleExtendedSignup(request.body as any, context);
    return reply.code(result.statusCode).send(result);
  });

  /**
   * Bulk signup endpoint
   */
  fastify.post("/signup/bulk", async (request, reply) => {
    const result = await handleBulkSignup(request.body as any, context);
    return reply.code(result.statusCode).send(result);
  });
}
