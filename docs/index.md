---
layout: home

hero:
  name: "subs"
  text: "Production-ready email signup API with invisible bot protection"
  tagline: "Ship in minutes with Google Sheets and Cloudflare Turnstile"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/briansunter/subs
    - theme: alt
      text: API Reference
      link: /guide/api

features:
  - title: 🛡️ Invisible Protection
    details: "Cloudflare Turnstile blocks 99% of spam without CAPTCHAs or user friction. Privacy-first with zero tracking."
  - title: 📧 Smart Email Collection
    details: "Validate, deduplicate, and store emails with automatic sync. Multi-tab support for organizing signups by source."
  - title: 📊 Production-Ready
    details: "Prometheus metrics, structured JSON logging, health check endpoints, and Docker support built-in."
  - title: ✅ Type-Safe Validation
    details: "100% type-safe API with Zod validation and compile-time guarantees. Catch errors before runtime."
  - title: 🔌 Flexible Embedding
    details: "Embed forms anywhere - iframe, inline, direct POST, or JavaScript SDK. Works on any platform."
  - title: 📑 Multi-Tab Organization
    details: "Separate signups by source with configurable Google Sheets tabs. Automatic tab creation included."
  - title: 🚫 Duplicate Prevention
    details: "Automatic deduplication across all sheet tabs prevents duplicate email registrations."
  - title: 🧪 Comprehensive Testing
    details: "Unit and integration tests with high coverage. Mock services for isolated testing."
---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/briansunter/subs.git
cd subs

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env
# Edit .env with your Google Sheets credentials

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
│   │   └── sheets.ts       # Google Sheets integration
│   └── utils/
│       └── logger.ts       # Pino logging
├── test/                   # Comprehensive tests
├── docs/                   # Documentation site
└── index.ts                # Server entry point
```

## License

[MIT](https://github.com/briansunter/subs/blob/main/LICENSE)
