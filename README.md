# subs

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/briansunter/subs)
![CI](https://img.shields.io/github/actions/workflow/status/briansunter/subs/ci.yml?branch=master)
![Version](https://img.shields.io/npm/v/subs)
![License](https://img.shields.io/github/license/briansunter/subs)

Email signup API backed by Google Sheets. Deploy to Cloudflare Workers or Docker. Built with [ElysiaJS](https://elysiajs.com), TypeScript, and [Bun](https://bun.sh).

- **Google Sheets** - automatic tab creation, headers, and deduplication
- **Bot protection** - Cloudflare Turnstile, invisible, no CAPTCHAs
- **Embed anywhere** - JS SDK, HTML form, fetch API, or iframe
- **Observability** - Prometheus metrics, structured logging, health checks

**[Documentation](https://briansunter.github.io/subs)** &#8226; **[API Reference](https://briansunter.github.io/subs/guide/api)** &#8226; **[Integration Guide](https://briansunter.github.io/subs/guide/integration)**

## Deploy to Cloudflare Workers

Click the deploy button above, or deploy manually:

```bash
bunx wrangler login
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY
bun run deploy:workers
```

Your API is live at `https://subs-api.YOUR_SUBDOMAIN.workers.dev` with automatic HTTPS, 300+ edge locations, and a free tier of 100k requests/day.

## Embed

Add the script and a target `div`:

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup"></div>
<script>
  SignupEmbed.create('#signup');
</script>
```

Options: `showName` (boolean), `sheetTab` (string), `site` (string for multi-sheet setups).

Or use a plain HTML form:

```html
<form action="https://your-domain.com/api/signup/form" method="POST">
  <input type="email" name="email" required>
  <button type="submit">Subscribe</button>
</form>
```

See the [Integration guide](https://briansunter.github.io/subs/guide/integration) for all options, iframe mode, React/Vue/Svelte examples, and custom fetch.

## Docker

```bash
git clone https://github.com/briansunter/subs.git
cd subs
cp .env.example .env.production  # add your Google Sheets credentials
docker compose up -d
```

Or build and run directly:

```bash
docker build -t subs .
docker run -d -p 3000:3000 --env-file .env.production --restart unless-stopped subs
```

## Local Development

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

See the [Getting Started guide](https://briansunter.github.io/subs/guide/getting-started) for Google Sheets setup and configuration. Also works with **[Fly.io](https://briansunter.github.io/subs/guide/deployment#fly-io)**, **[Render](https://briansunter.github.io/subs/guide/deployment#render)**, or any VPS. See the [Deployment guide](https://briansunter.github.io/subs/guide/deployment).

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
