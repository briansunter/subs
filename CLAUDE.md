# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bun-based email signup API built with Fastify, TypeScript, Google Sheets, and Discord webhooks. Validates email signups, stores them in Google Sheets, and optionally sends Discord notifications.

## Commands

### Development
- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server

### Testing
- `bun test` - Run all tests
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

Biome config includes strict rules: `noForEach`, `useLiteralKeys`, `noExplicitAny`, `noNonNullAssertion`. Organize imports is enabled as an assist action.

## Architecture

### Layered Architecture with Dependency Injection

```
Request → Fastify Routes → Handlers (business logic) → Services (external integrations)
```

**Key Pattern**: Route handlers in `src/routes/handlers.ts` are extracted from Fastify routes for testability. They accept a `SignupContext` interface for dependency injection, allowing unit tests to provide mock services.

- `src/routes/signup.ts` - Fastify route definitions with Zod type provider
- `src/routes/handlers.ts` - Pure business logic functions (not coupled to Fastify)
- `src/services/sheets.ts` - Google Sheets integration (cached client instance)
- `src/services/discord.ts` - Discord webhook notifications (fire-and-forget)
- `src/schemas/signup.ts` - Zod validation schemas for all request/response types

### Configuration

`src/config.ts` uses Zod to validate environment variables on startup. The config is cached and exported via a Proxy for backwards compatibility. In tests, call `clearConfigCache()` before setting environment variables.

### Testing Patterns

**Integration tests** use Fastify's `inject()` method for fast HTTP simulation without spawning a server. See `test/helpers/test-app.ts` for the test app setup.

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
