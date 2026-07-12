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
import { getHtmlFormContent } from "../static/html-form";
import { hasSetProperty, isObject } from "../utils/type-guards";
import {
  createDefaultContext,
  handleBulkSignup,
  handleExtendedSignup,
  handleHealthCheck,
  handleSignup,
  handleStats,
  type SignupContext,
} from "./handlers";

/**
 * Type for a beforeHandle guard function
 * Uses unknown for context to accept Elysia's full context type
 */
type GuardFunction = (context: unknown) => { success: false; statusCode: 404; error: string };

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
          // Use type guard to safely access nested properties
          if (isObject(context) && hasSetProperty(context)) {
            context["set"]["status"] = 404;
          }
          return { success: false, statusCode: 404, error: "Not found" };
        },
      ];
}

/**
 * Parse form-urlencoded body
 */
function parseFormBody(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

/**
 * Extract the media type from a Content-Type header value.
 *
 * Content-Type is case-insensitive per RFC 7231 and may carry optional
 * parameters (e.g. `; charset=utf-8` or `; boundary=...`). Comparing the raw
 * header with `includes` both rejects valid mixed-case media types and accepts
 * unrelated types that merely contain the substring. Normalizing to lowercase
 * and comparing only the media-type portion (everything before the first `;`)
 * makes the match exact while still honoring parameterized variants.
 *
 * @param contentType - Raw Content-Type header value (may be empty)
 * @returns Lowercased media type (e.g. `application/json`) or empty string
 */
function getMediaType(contentType: string): string {
  const semicolonIndex = contentType.indexOf(";");
  const mediaType = semicolonIndex === -1 ? contentType : contentType.slice(0, semicolonIndex);
  return mediaType.trim().toLowerCase();
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
  const metricsRouteOptions = {
    beforeHandle: createFeatureGuard(config.enableMetrics),
  };
  const metricsHandler = async () =>
    new Response(await register.metrics(), { headers: { "Content-Type": "text/plain" } });

  return (
    createApp(elysiaOptions, config)
      .derive(() => ({ context: ctx }))
      // HTML form
      .get(
        "/",
        () =>
          new Response(getHtmlFormContent(config), {
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
      // Root metrics endpoint (for Prometheus defaults)
      .get("/metrics", metricsHandler, metricsRouteOptions)
      .group("/api", (app) =>
        app
          // Health check
          .get("/health", ({ set }) => {
            const result = handleHealthCheck();
            if (result.statusCode) set.status = result.statusCode;
            return result;
          })
          // Stats endpoint
          .get("/stats", async ({ request, context, set }) => {
            const url = new URL(request.url);
            const sheetTab = url.searchParams.get("sheetTab") ?? undefined;
            const result = await handleStats(sheetTab, context);
            if (result.statusCode) set.status = result.statusCode;
            return result;
          })
          // Config endpoint
          .get("/config", () => ({
            turnstileSiteKey: config.turnstileSiteKey ?? null,
            turnstileEnabled: !!config.turnstileSecretKey,
            defaultSheetTab: config.defaultSheetTab,
            sheetTabs: config.sheetTabs,
          }))
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
            const mediaType = getMediaType(request.headers.get("content-type") || "");

            // Strict media-type dispatch: only the two supported form types are
            // accepted. Anything else is rejected with 415 before any body is
            // read, leaving the strict media-type parser behavior unchanged.
            if (
              mediaType !== "application/x-www-form-urlencoded" &&
              mediaType !== "multipart/form-data"
            ) {
              set.status = 415;
              return {
                success: false,
                statusCode: 415,
                error: "Unsupported Media Type",
                details: ["Expected application/x-www-form-urlencoded or multipart/form-data"],
              };
            }

            let parsedForm: Record<string, string>;

            // Wrap only the body-parsing operations so a malformed or unparseable
            // body (e.g. multipart missing its boundary) yields a 400 instead of
            // leaking as a 500. Downstream signup/service errors are intentionally
            // left outside this guard.
            try {
              if (mediaType === "application/x-www-form-urlencoded") {
                const text = await request.text();
                parsedForm = parseFormBody(text);
              } else {
                const data = await request.formData();
                parsedForm = {};
                for (const [key, value] of data.entries()) {
                  if (typeof value === "string") {
                    parsedForm[key] = value;
                  }
                }
              }
            } catch {
              set.status = 400;
              return {
                success: false,
                statusCode: 400,
                error: "Malformed request body",
              };
            }

            // Convert form data to signup input
            const tagsValue = parsedForm["tags"];
            const turnstileToken =
              parsedForm["turnstileToken"] || parsedForm["cf-turnstile-response"];
            const signupData = {
              email: parsedForm["email"] || "",
              name: parsedForm["name"],
              sheetTab: parsedForm["sheetTab"] || config.defaultSheetTab,
              site: parsedForm["site"],
              source: parsedForm["source"] || "form",
              tags: tagsValue ? tagsValue.split(",").map((t) => t.trim()) : ["form-submit"],
              turnstileToken,
            };

            const result = await handleExtendedSignup(signupData, context);
            if (result.statusCode) set.status = result.statusCode;
            return result;
          }),
      )
  );
};
