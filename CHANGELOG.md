# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- VitePress documentation site with comprehensive guides
- GitHub Actions workflow for automatic documentation deployment
- Enhanced README with badges and documentation links
- Contributing guidelines (CONTRIBUTING.md)
- Detailed setup guides for Google Sheets and Discord
- HTML form integration examples (React, Vue, Svelte)
- API reference documentation
- Configuration reference
- Deployment guide with multiple platform options
- Troubleshooting guide

## [1.0.0] - 2025-01-12

### Added

- Initial release of Bun Fastify Email Signup API
- Basic email signup endpoint (`POST /api/signup`)
- Extended signup endpoint with additional fields (`POST /api/signup/extended`)
- Bulk signup endpoint (`POST /api/signup/bulk`)
- Statistics endpoint (`GET /api/stats`)
- Health check endpoint (`GET /api/health`)
- Google Sheets integration with service account authentication
- Discord webhook notifications for new signups
- Zod validation for all API endpoints
- CORS support for cross-origin requests
- Embedded signup form with iframe support
- Multi-tab Google Sheets support
- Duplicate email detection
- Structured logging with Pino
- Docker support with multi-stage builds
- Docker Compose configuration
- Comprehensive test suite (unit and integration)
- Biome configuration for linting and formatting
- TypeScript strict mode configuration

### Features

- **Email Signup** - Validate and store email signups in Google Sheets
- **Zod Validation** - Type-safe request validation with Zod
- **Google Sheets Integration** - Store signups in configurable sheet tabs
- **Discord Notifications** - Optional webhook notifications for new signups
- **CORS Support** - Allow requests from any origin
- **Iframe Embedding** - Embed the signup form on any website
- **TypeScript Logging** - Structured logging with Pino
- **Docker Support** - Multi-stage Dockerfile for production
- **Comprehensive Tests** - Unit and integration tests with high coverage

### Architecture

- Layered architecture with dependency injection
- Route handlers extracted for testability
- Service layer for external integrations
- Type-safe routing with `fastify-type-provider-zod`
- Async error handling for Discord notifications

## [Future Plans]

### Planned Features

- [ ] Rate limiting middleware
- [ ] API key authentication
- [ ] Webhook retry mechanism
- [ ] Email verification flow
- [ ] Export to CSV functionality
- [ ] Admin dashboard UI
- [ ] Analytics and reporting
- [ ] Multi-language support
- [ ] Email template customization
- [ ] Webhook signature verification

---

## Version Guidelines

### Version Numbers

- **Major** (X.0.0) - Breaking changes
- **Minor** (0.X.0) - New features (backwards compatible)
- **Patch** (0.0.X) - Bug fixes (backwards compatible)

### Types of Changes

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security vulnerability fixes

## How to Update This Changelog

1. Add new entries under the `[Unreleased]` section
2. Categorize changes by type (Added, Changed, Deprecated, etc.)
3. When releasing, move entries to a new version section
4. Link version numbers to GitHub release tags

Example:

```markdown
## [Unreleased]

### Added
- New feature description

## [1.1.0] - 2025-01-15

### Added
- New feature from unreleased section
```
