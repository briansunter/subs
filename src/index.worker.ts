/**
 * Cloudflare Worker entry point
 *
 * Uses Elysia's Cloudflare adapter for Workers deployment.
 * Reuses all existing routes and configuration from the main app.
 *
 * @see {@link https://elysiajs.com/integrations/cloudflare-worker | Elysia Cloudflare Workers Integration}
 */

import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { createSignupRoutes } from "./routes/signup.elysia";

// Create the app with Cloudflare adapter and compile for Workers
const worker = createSignupRoutes(undefined, { adapter: CloudflareAdapter }).compile();

// Export the default fetch handler for Cloudflare Workers
export default {
  fetch: worker.fetch,
};

// Export the app type for TypeScript consumers
export type WorkerApp = typeof worker;
