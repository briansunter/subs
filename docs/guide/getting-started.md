# Getting Started

Get **subs** running locally in about 5 minutes.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- A Google account (for Google Sheets)

## Install

```bash
git clone https://github.com/briansunter/subs.git
cd subs
bun install
```

## Configure

Copy the example environment file and add your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Google Sheets (required)
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CREDENTIALS_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# CORS (use specific domains in production)
ALLOWED_ORIGINS=*

# Optional
DEFAULT_SHEET_TAB=Sheet1
PORT=3000
LOG_LEVEL=info
ENABLE_METRICS=true

# Cloudflare Turnstile (optional)
CLOUDFLARE_TURNSTILE_SITE_KEY=your_site_key
CLOUDFLARE_TURNSTILE_SECRET_KEY=your_secret_key
```

See [Google Sheets Setup](/guide/google-sheets) for how to create a service account and get credentials.

## Run

**Local development** (Bun with hot reload):
```bash
bun run dev
# http://localhost:3000
```

**Cloudflare Workers development**:
```bash
cp .env.example .dev.vars  # Workers uses .dev.vars
bun run dev:workers
# http://localhost:8787
```

## Verify

Open `http://localhost:3000` to see the built-in signup form, or check the health endpoint:

```bash
curl http://localhost:3000/api/health
```

```json
{"status": "ok", "timestamp": "2025-01-12T10:30:00.000Z"}
```

## Test a Signup

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "sheetTab": "Sheet1"}'
```

```json
{
  "success": true,
  "message": "Signup added successfully",
  "data": {
    "email": "test@example.com",
    "timestamp": "2025-01-12T10:30:00.000Z",
    "sheetTab": "Sheet1"
  }
}
```

Check your Google Sheet - the email should appear in the "Sheet1" tab.

## Run Tests

```bash
bun test                    # all tests
bun test test/unit          # unit tests
bun test test/integration   # integration tests
bun test --coverage         # with coverage
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Development server with hot reload |
| `bun run start` | Production server |
| `bun run dev:workers` | Cloudflare Workers dev server |
| `bun run deploy:workers` | Deploy to Cloudflare Workers |
| `bun run workers:tail` | Real-time logs from deployed Workers |
| `bun run workers:secret` | Set a Workers secret |
| `bun test` | Run all tests |
| `bunx biome check .` | Lint |
| `bunx biome check --write .` | Lint and auto-fix |
| `bun run docs:dev` | Documentation dev server |
| `bun run docs:build` | Build documentation |
| `bun run docker:up` | Start with Docker Compose |

## Code Quality

The project uses [Biome](https://biomejs.dev/) for linting and formatting:

```bash
bunx biome check .          # check
bunx biome check --write .  # auto-fix
bunx biome format --write . # format
```

## Project Structure

```
subs/
├── src/
│   ├── config.ts              # Zod-validated environment config
│   ├── app.ts                 # Elysia app factory (CORS, logging, security)
│   ├── index.worker.ts        # Cloudflare Worker entry point
│   ├── routes/
│   │   ├── signup.elysia.ts   # Route definitions
│   │   └── handlers.ts        # Business logic (DI via SignupContext)
│   ├── schemas/
│   │   └── signup.ts          # Zod request/response schemas
│   ├── services/
│   │   ├── sheets.ts          # Google Sheets API (jose JWT auth)
│   │   ├── turnstile.ts       # Cloudflare Turnstile verification
│   │   └── metrics.ts         # Prometheus metrics
│   ├── plugins/
│   │   ├── logging.ts         # Request/response logging
│   │   ├── metrics.ts         # Metrics middleware
│   │   └── security.ts        # Security headers
│   └── utils/
│       └── logger.ts          # Pino structured logging
├── test/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests (Elysia handle())
│   ├── mocks/                 # Mock services
│   └── helpers/               # Test app factory, request helpers
├── docs/                      # VitePress documentation
├── index.ts                   # Server entry point (Bun/Docker)
├── wrangler.toml              # Cloudflare Workers config
├── Dockerfile                 # Multi-stage Docker build
└── package.json
```

## Next Steps

1. **[Google Sheets Setup](/guide/google-sheets)** - Service account configuration
2. **[Cloudflare Turnstile](/guide/turnstile)** - Invisible bot protection
3. **[HTML Form Integration](/guide/integration)** - Embed forms on your website
4. **[API Reference](/guide/api)** - All endpoints and schemas
5. **[Deployment](/guide/deployment)** - Production deployment

## Troubleshooting

**Port in use**: `PORT=3001 bun run dev`

**Google Sheets errors**: Check that the sheet is shared with the service account email as "Editor". See [Google Sheets Troubleshooting](/guide/google-sheets#troubleshooting).

**Environment variables not loading**: Ensure `.env` is in the project root with no spaces around `=`.

More help: [Troubleshooting guide](/guide/troubleshooting) | [GitHub Issues](https://github.com/briansunter/subs/issues)
