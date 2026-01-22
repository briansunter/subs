/**
 * Elysia routes for email signup API
 *
 * Follows Elysia best practices:
 * - Elysia instance as controller
 * - Decoupled service functions (handlers)
 * - Type-safe Zod validation for requests
 * - Request destructuring (not passing entire Context)
 *
 * @see {@link https://elysiajs.com/essential/best-practice | Elysia Best Practices}
 * @see {@link https://elysiajs.com/essential/validation | Elysia Validation}
 */

import type { ElysiaConfig } from "elysia";
import { createApp } from "../app";
import { bulkSignupSchema, extendedSignupSchema, signupSchema } from "../schemas/signup";
import { register } from "../services/metrics";
import { getEmbedScript } from "../static/embed-script";
import { HTML_FORM_CONTENT } from "../static/html-form";
import { hasSetProperty, hasStatusProperty, isObject } from "../utils/type-guards";
import {
  createDefaultContext,
  handleBulkSignup,
  handleExtendedSignup,
  handleHealthCheck,
  handleSignup,
  type SignupContext,
} from "./handlers";

/**
 * Type for a beforeHandle guard function
 * Uses unknown for context to accept Elysia's full context type
 */
type GuardFunction = (context: unknown) => { error: string };

/**
 * Create a beforeHandle guard that returns 404 when feature is disabled
 * @param isEnabled - Whether the feature is enabled
 * @returns undefined if enabled, or an array of guard functions if disabled
 */
function createFeatureGuard(isEnabled: boolean): undefined | GuardFunction[] {
  return isEnabled
    ? undefined
    : [
        (context: unknown) => {
          // Use type guards to safely access nested properties
          if (isObject(context) && hasSetProperty(context) && hasStatusProperty(context["set"])) {
            context["set"]["status"] = 404;
          }
          return { error: "Not found" };
        },
      ];
}

/**
 * Parse form-urlencoded body
 */
function parseFormBody(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return result;
}

/**
 * Create Elysia app with all signup routes
 * @param context - Optional context for dependency injection (for testing)
 * @param elysiaOptions - Optional Elysia configuration options (e.g., { adapter: CloudflareAdapter })
 */
export const createSignupRoutes = (
  context?: SignupContext,
  elysiaOptions?: Partial<ElysiaConfig<"">>,
) => {
  const ctx = context ?? createDefaultContext();
  const config = ctx.config;

  return (
    createApp(elysiaOptions)
      .derive(() => ({ context: ctx }))
      // HTML form
      .get(
        "/",
        () =>
          new Response(HTML_FORM_CONTENT, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      )
      // Embed script
      .get("/embed.js", ({ request }) => {
        const url = new URL(request.url);
        const apiBaseUrl = `${url.protocol}//${url.host}`;
        return new Response(getEmbedScript(apiBaseUrl), {
          headers: { "Content-Type": "application/javascript; charset=utf-8" },
        });
      })
      .group("/api", (app) =>
        app
          // Health check
          .get("/health", () => handleHealthCheck().data)
          // Config endpoint
          .get("/config", () => ({
            turnstileSiteKey: config.turnstileSiteKey ?? null,
            turnstileEnabled: !!config.turnstileSiteKey,
            defaultSheetTab: config.defaultSheetTab,
            sheetTabs: config.sheetTabs,
          }))
          // Metrics endpoint (conditional on feature flag)
          .get(
            "/metrics",
            async () =>
              new Response(await register.metrics(), { headers: { "Content-Type": "text/plain" } }),
            {
              beforeHandle: createFeatureGuard(config.enableMetrics),
            },
          )
          // Basic signup
          .post(
            "/signup",
            async ({ body, context, set }) => {
              const result = await handleSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: signupSchema,
            },
          )
          // Extended signup
          .post(
            "/signup/extended",
            async ({ body, context, set }) => {
              const result = await handleExtendedSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: extendedSignupSchema,
            },
          )
          // Bulk signup
          .post(
            "/signup/bulk",
            async ({ body, context, set }) => {
              const result = await handleBulkSignup(body, context);
              if (result.statusCode) set.status = result.statusCode;
              return result;
            },
            {
              body: bulkSignupSchema,
            },
          )
          // Form POST endpoint (for HTML form submissions)
          .post("/signup/form", async ({ request, context, set }) => {
            const contentType = request.headers.get("content-type") || "";

            let parsedForm: Record<string, string>;

            if (contentType.includes("application/x-www-form-urlencoded")) {
              const text = await request.text();
              parsedForm = parseFormBody(text);
            } else if (contentType.includes("multipart/form-data")) {
              const data = await request.formData();
              parsedForm = {};
              for (const [key, value] of data.entries()) {
                if (typeof value === "string") {
                  parsedForm[key] = value;
                }
              }
            } else {
              set.status = 415;
              return {
                success: false,
                statusCode: 415,
                error: "Unsupported Media Type",
                details: ["Expected application/x-www-form-urlencoded or multipart/form-data"],
              };
            }

            // Convert form data to signup input
            const tagsValue = parsedForm["tags"];
            const signupData = {
              email: parsedForm["email"] || "",
              name: parsedForm["name"],
              sheetTab: parsedForm["sheetTab"] || config.defaultSheetTab,
              site: parsedForm["site"],
              source: parsedForm["source"] || "form",
              tags: tagsValue ? tagsValue.split(",").map((t) => t.trim()) : ["form-submit"],
            };

            const result = await handleExtendedSignup(signupData, context);
            if (result.statusCode) set.status = result.statusCode;
            return result;
          }),
      )
  );
};
