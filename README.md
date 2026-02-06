# subs

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/briansunter/subs)
![CI](https://img.shields.io/github/actions/workflow/status/briansunter/subs/ci.yml?branch=master)
![Version](https://img.shields.io/npm/v/subs)
![License](https://img.shields.io/github/license/briansunter/subs)

Email signup API that stores subscribers in Google Sheets. Deploys to Cloudflare Workers or Docker. Built with [ElysiaJS](https://elysiajs.com), TypeScript, and [Bun](https://bun.sh).

- **Google Sheets storage** with automatic tab creation and deduplication
- **Cloudflare Turnstile** invisible bot protection (no CAPTCHAs)
- **Multiple embed options** - iframe, inline form, direct POST, or JS SDK
- **Prometheus metrics**, structured logging, and health checks

**[Documentation](https://briansunter.github.io/subs)** &#8226; **[API Reference](https://briansunter.github.io/subs/guide/api)** &#8226; **[Integration Guide](https://briansunter.github.io/subs/guide/integration)**

## Quick Start

```bash
git clone https://github.com/briansunter/subs.git
cd subs && bun install
cp .env.example .env  # add your Google Sheets credentials
bun run dev
```

Test it:

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "sheetTab": "Sheet1"}'
```

See the [Getting Started guide](https://briansunter.github.io/subs/guide/getting-started) for Google Sheets setup and configuration.

## Deploy

### Cloudflare Workers (recommended)

Click the deploy button above, then set secrets in the Cloudflare dashboard:

- `GOOGLE_SHEET_ID` - Your Google Sheet ID
- `GOOGLE_CREDENTIALS_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key

Or deploy manually:

```bash
bunx wrangler login
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY
bun run deploy:workers
```

### Docker

```bash
cp .env.example .env  # configure credentials
docker-compose up -d
```

See the [Deployment guide](https://briansunter.github.io/subs/guide/deployment) for custom domains, monitoring, and production configuration.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/signup` | Email signup |
| `POST` | `/api/signup/extended` | Signup with name, source, tags |
| `POST` | `/api/signup/bulk` | Bulk signup (up to 100) |
| `POST` | `/api/signup/form` | HTML form submission |
| `GET` | `/api/stats` | Signup statistics |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/config` | Public configuration |
| `GET` | `/metrics` | Prometheus metrics |

See the [API Reference](https://briansunter.github.io/subs/guide/api) for request/response details.

## Embed

```html
<!-- iframe -->
<script src="https://your-domain.com/embed.js"></script>
<div id="signup"></div>
<script>SignupEmbed.iframe('#signup');</script>

<!-- or direct POST -->
<form action="https://your-domain.com/api/signup/form" method="POST">
  <input type="email" name="email" required>
  <button type="submit">Subscribe</button>
</form>
```

See the [Integration guide](https://briansunter.github.io/subs/guide/integration) for React, Vue, Svelte examples and customization options.

## Development

```bash
bun test                    # run all tests
bun test test/unit          # unit tests only
bun test --coverage         # with coverage
bunx biome check .          # lint
bunx biome check --write .  # auto-fix
```

## License

MIT
