---
layout: home

hero:
  name: "Bun Fastify Email Signup API"
  text: "High-performance email signup API with Google Sheets and Discord"
  tagline: "Built with Bun, Fastify, TypeScript, and Zod validation"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/yourusername/subs
    - theme: alt
      text: API Reference
      link: /guide/api

features:
  - title: Email Signup
    details: Validate and store email signups in Google Sheets with automatic deduplication and multi-tab support.
  - title: Google Sheets Integration
    details: Store signups directly in your Google Sheets with configurable tabs and automatic header creation.
  - title: Discord Notifications
    details: Optional real-time webhook notifications for new signups and errors, keeping your team informed.
  - title: Type-Safe Validation
    details: Built with Zod for compile-time type safety and runtime validation of all API requests.
  - title: Multiple Embedding Options
    details: Embed forms on any website using iframes, inline forms, direct POST, or JavaScript fetch.
  - title: Production Ready
    details: Docker support, comprehensive tests, structured logging, and security best practices included.
  - title: High Performance
    details: Built on Bun runtime and Fastify framework for maximum performance and minimal resource usage.
  - title: CORS Support
    details: Configurable CORS origins for cross-origin requests and flexible form embedding.
  - title: Bulk Operations
    details: Support for bulk email signups up to 100 emails at once with detailed success/error reporting.
---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/subs.git
cd subs

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env
# Edit .env with your Google Sheets and Discord credentials

# Start the development server
bun run dev
```

The API will be available at `http://localhost:3000`

## Quick Example

### Simple Email Signup

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Sheet1"
  }'
```

### Embed the Form

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.iframe('#signup-container');
</script>
```

## What's Next?

- **[Getting Started](/guide/getting-started)** - Complete setup guide
- **[Google Sheets Setup](/guide/google-sheets)** - Detailed Google Sheets configuration
- **[Discord Setup](/guide/discord)** - Configure Discord webhook notifications
- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[API Reference](/guide/api)** - Complete API documentation

## Key Features

### Multiple Signup Types

- **Basic**: Email-only signup
- **Extended**: Email + name + source + tags
- **Bulk**: Up to 100 emails at once

### Flexible Storage

- Store in Google Sheets with multiple tabs
- Automatic tab and header creation
- Duplicate email prevention
- Metadata tracking (timestamp, source, etc.)

### Developer Friendly

- TypeScript with strict mode
- Comprehensive test suite
- Hot reload in development
- Structured logging with Pino
- Biome for linting and formatting

## Project Structure

```
subs/
├── src/
│   ├── config.ts           # Environment configuration
│   ├── routes/
│   │   ├── signup.ts       # Fastify route definitions
│   │   └── handlers.ts     # Business logic
│   ├── schemas/
│   │   └── signup.ts       # Zod validation schemas
│   ├── services/
│   │   ├── sheets.ts       # Google Sheets integration
│   │   └── discord.ts      # Discord webhook service
│   └── utils/
│       └── logger.ts       # Pino logging
├── test/                   # Comprehensive tests
├── docs/                   # Documentation site
└── index.ts                # Server entry point
```

## License

[MIT](https://github.com/yourusername/subs/blob/main/LICENSE)
