# Getting Started

Get **subs** running in minutes. Three options from fastest to most flexible.

## Prerequisites

- A Google account with a [service account and Sheet configured](/guide/google-sheets)

## 1. Cloudflare Workers (Recommended)

No server to manage. Automatic HTTPS, 300+ edge locations, free tier of 100k requests/day.

```bash
git clone https://github.com/briansunter/subs.git
cd subs && bun install
bunx wrangler login
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY
bun run deploy:workers
```

Your API is live at `https://subs-api.YOUR_SUBDOMAIN.workers.dev`. See [Deployment](/guide/deployment#cloudflare-workers-recommended) for one-click deploy, custom domains, and monitoring.

## 2. Docker

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

Your API is at `http://localhost:3000`. See [Deployment](/guide/deployment#docker) for Docker Compose, reverse proxy, and production setup.

## 3. Local Development

Requires [Bun](https://bun.sh/) runtime.

```bash
git clone https://github.com/briansunter/subs.git
cd subs && bun install
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CREDENTIALS_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
```

Start the dev server:

```bash
bun run dev
# http://localhost:3000
```

See [Configuration](/reference/configuration) for all environment variables.

## Verify

Check the health endpoint:

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

See `package.json` for all available scripts.

## Next Steps

- **[Deployment](/guide/deployment)** - Production deployment
- **[Embedding Forms](/guide/integration)** - Add signup forms to your site
- **[API Reference](/guide/api)** - All endpoints and schemas

## Troubleshooting

**Port in use**: `PORT=3001 bun run dev`

**Google Sheets errors**: Check that the sheet is shared with the service account email as "Editor". See [Google Sheets Troubleshooting](/guide/google-sheets#troubleshooting).

**Environment variables not loading**: Ensure `.env` is in the project root with no spaces around `=`.

More help: [Troubleshooting](/guide/troubleshooting) | [GitHub Issues](https://github.com/briansunter/subs/issues)
