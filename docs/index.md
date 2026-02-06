---
layout: home

hero:
  name: "subs"
  text: "Email signup API with Google Sheets"
  tagline: "Collect subscribers, store in Sheets, deploy to Cloudflare Workers in minutes"
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
  - title: Google Sheets Storage
    details: "Store signups in Google Sheets with automatic tab creation, headers, and duplicate prevention."
  - title: Invisible Bot Protection
    details: "Cloudflare Turnstile blocks spam without CAPTCHAs. Privacy-first with zero user tracking."
  - title: Embed Anywhere
    details: "iframe, inline form, direct POST, or JavaScript SDK. React, Vue, and Svelte examples included."
  - title: Type-Safe Validation
    details: "Zod schemas validate every request. TypeScript types inferred from schemas at compile time."
  - title: Production Observability
    details: "Prometheus metrics, structured JSON logging with Pino, health checks, and stats endpoints."
  - title: Deploy Anywhere
    details: "One-click Cloudflare Workers deploy, or Docker. Edge deployment with automatic scaling."
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
- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[Cloudflare Turnstile](/guide/turnstile)** - Invisible bot protection
- **[API Reference](/guide/api)** - All endpoints, request/response formats
- **[Deployment](/guide/deployment)** - Cloudflare Workers, Docker, VPS
