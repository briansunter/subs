# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bun-based email signup API built with **ElysiaJS**, TypeScript, and Google Sheets. Validates email signups and stores them in Google Sheets with invisible bot protection via Cloudflare Turnstile.

## Commands

### Development
- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server

### Testing
- `bun test` - Run all tests
- `bun test test/unit` - Run unit tests only
- `bun test test/integration` - Run integration tests only
- `bun test --coverage` - Run tests with coverage report
- `bun test <test-file-path>` - Run a specific test file

### Docker
- `bun run docker:build` - Build Docker image
- `bun run docker:up` - Start containers with Docker Compose
- `bun run docker:down` - Stop Docker Compose containers
- `bun run docker:logs` - View Docker logs

## Code Quality

**Biome** is used for linting and formatting:
- `bunx biome check .` - Lint all files
- `bunx biome check --write .` - Auto-fix issues
- `bunx biome format --write .` - Format files

Biome config includes strict rules: `noForEach`, `useLiteralKeys`, `noExplicitAny`, `noNonNullAssertion`.

## Architecture

### Layered Architecture with Dependency Injection

```
Request → Elysia Routes → Handlers (business logic) → Services (external integrations)
```

**Key Pattern**: Route handlers in `src/routes/handlers.ts` are extracted from Elysia routes for testability. They accept a `SignupContext` interface for dependency injection, allowing unit tests to provide mock services.

- `src/app.ts` - Elysia application factory with CORS, security, logging, metrics, error handling
- `src/routes/signup.elysia.ts` - Elysia route definitions with Zod validation
- `src/routes/handlers.ts` - Pure business logic functions (not coupled to Elysia)
- `src/services/sheets.ts` - Google Sheets REST API integration (Workers-compatible)
- `src/services/turnstile.ts` - Cloudflare Turnstile verification
- `src/services/metrics.ts` - Prometheus metrics collection
- `src/schemas/signup.ts` - Zod validation schemas for request types
- `src/static/html-form.ts` - HTML form content
- `src/static/embed-script.ts` - Embeddable JavaScript widget

### Testing Patterns

**Integration tests** use Elysia's `handle()` method for fast HTTP simulation without spawning a server:
```typescript
const app = await getTestApp();
const response = await app.handle(new Request("http://localhost/api/health"));
expect(response.status).toBe(200);
```

**Test helpers** (in `test/helpers/test-app-elysia.ts`):
- `getTestApp(overrides?)` - Create test Elysia app with optional context overrides
- `createGetRequest(path)` - Create a GET request
- `createPostRequest(path, body)` - Create a POST request with JSON body
- `parseJsonResponse<T>(response)` - Parse JSON response with type safety
- `VALID_TURNSTILE_TOKEN` - Cloudflare test token that always validates
- `setupTestEnv(overrides?)` - Set up test environment and reset mocks

**Test isolation**: Each test creates a fresh app instance. Mocks are reset in `beforeEach()` hooks.

### Configuration

`src/config.ts` uses Zod to validate environment variables on startup. The config is cached. In tests, call `clearConfigCache()` before setting environment variables.

Feature flag (via environment variable):
- `ENABLE_METRICS` - Enable Prometheus metrics endpoint (default: true)

## Environment Variables

Required:
- `GOOGLE_SHEET_ID` - Google Sheet ID
- `GOOGLE_CREDENTIALS_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key (use `\n` for line breaks in .env)

Optional:
- `DEFAULT_SHEET_TAB` - Default sheet tab name (default: "Sheet1")
- `ALLOWED_ORIGINS` - Comma-separated CORS origins (default: "*")
- `ALLOWED_SHEETS` - Multi-site support: "sheetId:siteName,sheetId:siteName,..."
- `SHEET_TABS` - Configurable sheet tabs (comma-separated)
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` - Turnstile secret key for bot protection
- `CLOUDFLARE_TURNSTILE_SITE_KEY` - Turnstile site key for frontend
- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: "0.0.0.0")
- `LOG_LEVEL` - Pino log level (default: "info")
