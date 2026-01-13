# Contributing to Bun Fastify Email Signup API

Thank you for considering contributing to the Bun Fastify Email Signup API! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Code Style](#code-style)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Be collaborative

## How to Contribute

There are many ways to contribute:

1. **Report bugs** - Open an issue with detailed information
2. **Suggest features** - Open an issue to discuss
3. **Submit pull requests** - Fix bugs or add features
4. **Improve documentation** - Fix typos or add clarity
5. **Review pull requests** - Help review and test PRs from others

## Development Setup

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/briansunter/subs.git
cd subs

# Add upstream remote
git remote add upstream https://github.com/briansunter/subs.git
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your test credentials
```

For testing, you can use a test Google Sheet and test Discord webhook.

### 4. Start Development Server

```bash
bun run dev
```

The server will be available at `http://localhost:3000`

## Running Tests

### Run All Tests

```bash
bun test
```

### Run Unit Tests Only

```bash
bun test test/unit
```

### Run Integration Tests Only

```bash
bun test test/integration
```

### Run Tests with Coverage

```bash
bun test --coverage
```

### Run a Specific Test File

```bash
bun test test/unit/routes/handlers.test.ts
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for consistent code style.

### Check Code Style

```bash
bunx biome check .
```

### Auto-fix Issues

```bash
bunx biome check --write .
```

### Format Files

```bash
bunx biome format --write .
```

### TypeScript Style Guide

- Use `type` for type definitions, `interface` for object shapes
- Avoid `any` - use `unknown` if type is truly unknown
- Use strict null checking
- Prefer `const` over `let`
- Use template literals for string concatenation
- Use async/await over promises
- Use arrow functions for callbacks

## Project Architecture

### Layered Architecture

```
Request → Fastify Routes → Handlers (business logic) → Services (external integrations)
```

- **Routes** (`src/routes/signup.ts`) - Fastify route definitions with Zod type provider
- **Handlers** (`src/routes/handlers.ts`) - Pure business logic (not coupled to Fastify)
- **Services** (`src/services/`) - External integrations (Google Sheets, Discord)
- **Schemas** (`src/schemas/signup.ts`) - Zod validation schemas

### Dependency Injection

Handlers accept a `SignupContext` interface for dependency injection:

```typescript
interface SignupContext {
  sheetsService: SheetsService;
  discordService: DiscordService;
}

export async function handleBasicSignup(
  data: SignupInput,
  context: SignupContext
): Promise<SignupResponse> {
  // Business logic here
}
```

This allows unit tests to provide mock services.

## Writing Tests

### Unit Tests

Unit tests should test business logic in isolation using mocks:

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { handleBasicSignup } from "../../src/routes/handlers";
import { MockSheetsService } from "../mocks/sheets";
import { MockDiscordService } from "../mocks/discord";

describe("handleBasicSignup", () => {
  let sheetsService: MockSheetsService;
  let discordService: MockDiscordService;

  beforeEach(() => {
    sheetsService = new MockSheetsService();
    discordService = new MockDiscordService();
  });

  test("should add signup successfully", async () => {
    const result = await handleBasicSignup(
      { email: "test@example.com", sheetTab: "Sheet1" },
      { sheetsService, discordService }
    );

    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

Integration tests should test the full API using Fastify's inject:

```typescript
import { describe, test, expect } from "bun:test";
import { getTestApp, injectPost } from "../helpers/test-app";

describe("POST /api/signup", () => {
  test("should create signup", async () => {
    const response = await injectPost("/api/signup", {
      email: "test@example.com",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().success).toBe(true);
  });
});
```

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Build process or auxiliary tool changes

### Examples

```bash
feat(routes): add bulk signup endpoint

Add POST /api/signup/bulk endpoint for creating multiple signups at once.
Supports up to 100 emails per request.

Closes #123
```

```bash
fix(sheets): handle duplicate email errors

Return proper error response when email already exists in sheet.
```

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes

- Write clear, self-explanatory code
- Add tests for new functionality
- Update documentation if needed
- Run tests to ensure everything passes

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template:
   - Describe your changes
   - Reference any related issues
   - Add screenshots if applicable
5. Submit the PR

### Pull Request Guidelines

- **Keep it small** - Smaller PRs are easier to review
- **One thing at a time** - One feature or fix per PR
- **Add tests** - Ensure tests pass and coverage is maintained
- **Update docs** - Update README and docs for user-facing changes
- **Be patient** - Maintainers will review when available

### Review Process

1. Automated checks must pass (tests, linting)
2. At least one maintainer approval required
3. Address review feedback
4. Squash and merge when approved

## Documentation

### Code Comments

- Use comments to explain **why**, not **what**
- Document complex algorithms or business logic
- Keep comments up-to-date with code changes

### JSDoc

Use JSDoc for exported functions:

```typescript
/**
 * Handles basic email signup
 * @param data - Signup input data
 * @param context - Service dependencies
 * @returns Signup response with success status
 */
export async function handleBasicSignup(
  data: SignupInput,
  context: SignupContext
): Promise<SignupResponse> {
  // ...
}
```

### Documentation Site

To update documentation:

1. Edit files in `docs/` directory
2. Test locally: `bun run docs:dev`
3. Submit changes as PR

Documentation uses VitePress with Markdown.

## Reporting Issues

### Before Creating an Issue

1. Check existing issues to avoid duplicates
2. Check documentation for possible solutions
3. Search for similar issues that have been closed

### Creating an Issue

Use the issue templates and provide:

- **Clear title** - Descriptive and concise
- **Description** - Detailed explanation
- **Steps to reproduce** - For bugs
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Environment** - OS, Bun version, etc.
- **Logs** - Relevant error messages

### Feature Requests

For feature requests:

- Explain the use case
- Describe the proposed solution
- Consider alternatives
- Be open to discussion

## Getting Help

- **Documentation**: Check the [docs site](https://briansunter.github.io/subs)
- **Issues**: Search or create an issue
- **Discussions**: Use GitHub Discussions for questions

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Acknowledgments

Thank you for taking the time to contribute to this project! Every contribution helps make this project better for everyone.
