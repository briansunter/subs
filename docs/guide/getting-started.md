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
```

See [Configuration](/reference/configuration) for all options.

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
