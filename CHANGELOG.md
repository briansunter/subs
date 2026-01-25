# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 (2026-01-25)


### Features

* add Cloudflare Workers deployment with ElysiaJS refactor ([c07db34](https://github.com/briansunter/subs/commit/c07db34e334e4fd12943b0dc0514749447fd0ed0))
* add feature flags for selective endpoint enabling ([cb203a9](https://github.com/briansunter/subs/commit/cb203a9db23b7bfa387327764bb0a7287dcf7acc))
* add optional Cloudflare Turnstile CAPTCHA support ([b68c603](https://github.com/briansunter/subs/commit/b68c60379d32a655385fb07382c7412b6161f8da))
* add Prometheus metrics with comprehensive testing ([487396b](https://github.com/briansunter/subs/commit/487396bc845983a77bc4090eb30ed04f6c45304b))
* add security hardening and rate limiting ([80dec1d](https://github.com/briansunter/subs/commit/80dec1d6395f84e5699745185872996b01297c06))


### Bug Fixes

* add afterEach hook to feature flags test to reset environment ([b0f7b2e](https://github.com/briansunter/subs/commit/b0f7b2e99fc610fe70eee05385bbd70de8299bd2))
* add feature flags to CI workflow and .env.example ([3f1eacc](https://github.com/briansunter/subs/commit/3f1eaccf1073849369bbb904ddefc99b4b3d119a))
* add test environment variables to CI workflow ([68bc741](https://github.com/briansunter/subs/commit/68bc741c70d0d9e43ff0909d6a38daa1d990349a))
* add test environment variables to coverage step ([07fbda5](https://github.com/briansunter/subs/commit/07fbda5eb664369814bd98687714c8c68c809aff))
* add test setup file to configure environment before module loading ([a147df9](https://github.com/briansunter/subs/commit/a147df93c8092abbc83a053aa4de998fc1ece7fd))
* add Turnstile tokens to metrics tests ([88ee9ea](https://github.com/briansunter/subs/commit/88ee9eaaf5d4ff70c66b7a77972a3b9d7b3173af))
* check if bun user exists before creating in Dockerfile ([9feefa4](https://github.com/briansunter/subs/commit/9feefa4f9f6ec36db3e422688e1084e6a8a01b85))
* deploy docs to GitHub Pages from master branch ([18f2675](https://github.com/briansunter/subs/commit/18f2675b5c7478be258598d02cac0806fef08f76))
* fix duplicate turnstileToken in metrics test ([f6343a6](https://github.com/briansunter/subs/commit/f6343a657127400f1521ffa78e344f5461a19fa4))
* import metrics module in test helper ([e79f8c2](https://github.com/briansunter/subs/commit/e79f8c2398c5cbbc36f51402c30fbbf6e7afa043))
* improve security validation and code quality ([a77d82f](https://github.com/briansunter/subs/commit/a77d82fdda9cd02253939691e807352f92f80ab8))
* increase test timeout for server startup in CI ([16cb4ac](https://github.com/briansunter/subs/commit/16cb4acbe67cb08ee3bf32e046b034f3b7c1cc47))
* make Docker workflow depend on successful CI completion ([c47efb2](https://github.com/briansunter/subs/commit/c47efb24ccabb432de9da92783bdea969e2343fc))
* pass config as parameter to sheets service functions ([2e6f208](https://github.com/briansunter/subs/commit/2e6f2086da3fa5a752e04808aba369f547ac6a87))
* remove cross-workflow dependency from Docker workflow ([7a2fd3a](https://github.com/briansunter/subs/commit/7a2fd3a631a8a0f72c7e069e2d96715347afc66b))
* remove feature flags from CI workflow to avoid conflicts ([a2d454e](https://github.com/briansunter/subs/commit/a2d454e07257febab56eca08584fb9ffbe2e10bc))
* remove unused test helper file ([af7a3c7](https://github.com/briansunter/subs/commit/af7a3c761801af635d28ff31eeee189d9019e820))
* resolve Biome linting issues in CI ([6af4742](https://github.com/briansunter/subs/commit/6af474200cfc7d20c398317f6b72a161eeb6d4e4))
* simplify release-please workflow ([9bbcc76](https://github.com/briansunter/subs/commit/9bbcc763f2d259f82484b392fb9f4f38b5c236ed))
* update CI badge to reference ci.yml on master branch ([d6e77d8](https://github.com/briansunter/subs/commit/d6e77d843e763faa0ef7ac7e0f415922e4f71adc))
* update Dockerfile to use bun.lock instead of bun.lockb ([e786d57](https://github.com/briansunter/subs/commit/e786d5779129d36ffe424017862a2b7a74513761))
* update release-please workflow to use valid actions ([90978a0](https://github.com/briansunter/subs/commit/90978a0bee8c70f4defbecb1a08a2126e721006b))
* use Debian-compatible user creation commands in Dockerfile ([69328d8](https://github.com/briansunter/subs/commit/69328d8d512db5fa4b5b9ffd4abf75bf4b3d3846))


### Performance Improvements

* add .dockerignore and update release-please action ([4e469d0](https://github.com/briansunter/subs/commit/4e469d0e35e5f83a4a2f4017f9417a7aef603b35))
* use Bun compile with minification for standalone binary ([164dc6b](https://github.com/briansunter/subs/commit/164dc6b33c3533549d4945a4e3f0b3947920572c))
* use multi-stage Docker build with Bun bundling ([d06a54e](https://github.com/briansunter/subs/commit/d06a54ea1843eb19f52e954d94f6a5063ab47a59))

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
