# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bun-based email signup API built with **ElysiaJS**, TypeScript, and Google Sheets. Validates email signups and stores them in Google Sheets with invisible bot protection via Cloudflare Turnstile.

## Commands

### Development
- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server

### Testing
- `bun test` - Run all tests (273 tests across 15 files)
- `bun test test/unit` - Run unit tests only
- `bun test test/integration` - Run integration tests only
- `bun test --coverage` - Run tests with coverage report
- `bun test <test-file-path>` - Run a specific test file (e.g., `bun test test/unit/routes/handlers.test.ts`)

### Docker
- `bun run docker:build` - Build Docker image
- `bun run docker:up` - Start containers with Docker Compose
- `bun run docker:down` - Stop Docker Compose containers
- `bun run docker:logs` - View Docker logs

## Code Quality

**Biome** is used for linting and formatting. Run with:
- `bunx biome check .` - Lint all files
- `bunx biome check --write .` - Auto-fix issues
- `bunx biome format --write .` - Format files

Biome config includes strict rules: `noForEach`, `useLiteralKeys`, `noExplicitAny` (except test mocks), `noNonNullAssertion`. Organize imports is enabled as an assist action.

## Architecture

### Layered Architecture with Dependency Injection

```
Request → Elysia Routes → Handlers (business logic) → Services (external integrations)
```

**Key Pattern**: Route handlers in `src/routes/handlers.ts` are extracted from Elysia routes for testability. They accept a `SignupContext` interface for dependency injection, allowing unit tests to provide mock services.

- `src/app.ts` - Elysia application factory with CORS, security, logging, metrics, error handling
- `src/routes/signup.elysia.ts` - Elysia route definitions with Zod validation
- `src/routes/handlers.ts` - Pure business logic functions (not coupled to Elysia)
- `src/services/sheets.ts` - Google Sheets integration (cached client instance)
- `src/services/turnstile.ts` - Cloudflare Turnstile verification
- `src/services/metrics.ts` - Prometheus metrics collection
- `src/schemas/signup.ts` - Zod validation schemas for all request/response types
- `src/static/html-form.ts` - HTML form content
- `src/static/embed-script.ts` - Embeddable JavaScript widget

### Elysia-Specific Patterns

**Route Definition**: Uses Elysia's chainable API with `.group()` for route prefixes:
```typescript
app.group("/api", (app) =>
  app.get("/health", () => handleHealthCheck().data)
     .post("/signup", async ({ body, context }) => handleSignup(body, context), {
       body: signupSchema,
     })
)
```

**Testing**: Uses Elysia's `handle()` method with Web Standard Request objects:
```typescript
const app = await getTestApp();
const response = await app.handle(new Request("http://localhost/api/health"));
expect(response.status).toBe(200);
```

**Error Handling**: Global `onError` hook catches validation errors and formats responses consistently.

**Feature Flags**: Uses `beforeHandle` guards to conditionally enable routes based on config flags.

### Configuration

`src/config.ts` uses Zod to validate environment variables on startup. The config is cached and exported via a Proxy for backwards compatibility. In tests, call `clearConfigCache()` before setting environment variables.

Feature flags (via environment variables):
- `ENABLE_EXTENDED_SIGNUP` - Enable extended signup endpoint (default: true)
- `ENABLE_BULK_SIGNUP` - Enable bulk signup endpoint (default: true)
- `ENABLE_METRICS` - Enable Prometheus metrics endpoint (default: true)

### Testing Patterns

**Integration tests** use Elysia's `handle()` method for fast HTTP simulation without spawning a server. See `test/helpers/test-app-elysia.ts` for the test app setup.

**Test helpers** available:
- `getTestApp(overrides?)` - Create a test Elysia app with optional context overrides
- `createGetRequest(path)` - Create a GET request
- `createPostRequest(path, body)` - Create a POST request with JSON body
- `parseJsonResponse<T>(response)` - Parse JSON response with type safety
- `VALID_TURNSTILE_TOKEN` - Cloudflare test token that always validates

**Test isolation**: Each test creates a fresh app instance. Mocks are reset in `beforeEach()` hooks.

### Type-Safe Routing with Zod

The project uses Zod schemas for runtime validation and TypeScript type inference. Elysia automatically infers handler parameter types from the schemas:

```typescript
import { signupSchema } from "../schemas/signup";

app.post("/signup", async ({ body }) => {
  // `body` is automatically typed to z.infer<typeof signupSchema>
  return handleSignup(body, context);
}, {
  body: signupSchema,
});
```

### Async Error Handling

All service calls are awaited. Errors are caught and logged without failing the request. Metrics are recorded for both successful and failed requests in `onAfterHandle` and `onError` hooks.

**Unit tests** mock services using the `SignupContext` interface. See `test/mocks/discord.ts` and `test/mocks/sheets.ts` for example mocks.

**Test helpers**:
- `getTestApp()` - Get or create Fastify app instance
- `injectRequest()` / `injectPost()` / `injectGet()` - Make test requests
- `setTestEnv()` / `clearTestEnv()` - Manage test environment variables
- `DEFAULT_TEST_ENV` - Default test environment configuration

### Type-Safe Routing with Zod

The project uses `fastify-type-provider-zod` for compile-time type safety. Routes are defined with Zod schemas in the route options, and Fastify automatically validates/serializes using those schemas. Custom error handling in `signupRoutes` formats Zod validation errors consistently.

### Async Error Handling

Discord notifications are fire-and-forget: they're awaited but errors are caught and logged without failing the request. This ensures signup failures aren't caused by notification issues.

## Environment Variables

Required:
- `GOOGLE_SHEET_ID` - Google Sheet ID
- `GOOGLE_CREDENTIALS_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key (use `\n` for line breaks in .env)

Optional:
- `DEFAULT_SHEET_TAB` - Default sheet tab name (default: "Sheet1")
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for notifications
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (default: "*")
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: "0.0.0.0")
- `LOG_LEVEL` - Pino log level (default: "info")
