---
layout: home

hero:
  name: "subs"
  text: "Email signup API with Google Sheets"
  tagline: "Collect email signups, store in Google Sheets, deploy anywhere in minutes"
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Deploy to Cloudflare
      link: /guide/deployment#cloudflare-workers-recommended
    - theme: alt
      text: View on GitHub
      link: https://github.com/briansunter/subs

features:
  - title: Google Sheets Storage
    details: "Store signups in Google Sheets with automatic tab creation, headers, and duplicate prevention"
  - title: Invisible Bot Protection
    details: "Cloudflare Turnstile blocks spam without CAPTCHAs. Privacy-first, no user tracking"
  - title: Embed Anywhere
    details: "JS SDK, HTML form, custom fetch, or iframe. React, Vue, and Svelte examples included"
  - title: Type-Safe Validation
    details: "Zod schemas validate every request. TypeScript types inferred from schemas at compile time"
  - title: Production Observability
    details: "Prometheus metrics, structured JSON logging with Pino, health checks, and stats endpoints"
  - title: Deploy Anywhere
    details: "Cloudflare Workers, Docker, Fly.io, Render, or any VPS. Edge deployment with automatic scaling"
---

## Quick Start

```bash
git clone https://github.com/briansunter/subs.git
cd subs && bun install
cp .env.example .env   # add Google Sheets credentials
bun run dev            # http://localhost:3000
```

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "sheetTab": "Sheet1"}'
```

## Guides

- **[Getting Started](/guide/getting-started)** - Setup, credentials, first signup
- **[Google Sheets Setup](/guide/google-sheets)** - Service account and sheet configuration
- **[Deployment](/guide/deployment)** - Cloudflare Workers, Docker, and more
- **[Embedding Signup Forms](/guide/integration)** - JS SDK, HTML forms, framework examples
- **[Cloudflare Turnstile](/guide/turnstile)** - Invisible bot protection
- **[API Reference](/guide/api)** - All endpoints, request/response formats
