# subs

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/briansunter/subs)
![CI/CD](https://img.shields.io/github/actions/workflow/status/briansunter/subs/test.yml?branch=main)
![Version](https://img.shields.io/npm/v/subs)
![License](https://img.shields.io/github/license/briansunter/subs)
![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-blue)

Production-ready email signup API with invisible bot protection. Built with Bun, ElysiaJS, Google Sheets, and TypeScript.

## Why subs?

**Invisible Protection** 🛡️
- Cloudflare Turnstile blocks 99% of spam
- No CAPTCHAs or friction for users
- Privacy-first with zero tracking

**Flexible Embedding** 🔌
- 4+ options: iframe, inline, direct POST, or JavaScript SDK
- Works on any website or platform
- Multi-tab Google Sheets organization

**Production-Ready** 📊
- Prometheus metrics built-in
- Structured JSON logging
- Health check and stats endpoints

**Type-Safe** ✅
- Zod validation with compile-time guarantees
- 100% type-safe API
- Automatic duplicate prevention

## Features

- **Smart Email Collection** - Validate, deduplicate, and store emails with automatic sync
- **Zod Validation** - 100% type-safe request validation with compile-time guarantees
- **Google Sheets Integration** - Store signups in configurable sheet tabs with automatic creation
- **Cloudflare Turnstile** - Invisible bot protection that blocks 99% of spam
- **Flexible Embedding** - iframe, inline, direct POST, or JavaScript SDK
- **Prometheus Metrics** - Production observability with comprehensive metrics
- **Duplicate Prevention** - Automatic deduplication across all sheet tabs
- **CORS Support** - Configurable origins for secure cross-origin requests
- **TypeScript Logging** - Structured logging with Pino for production debugging
- **Docker Support** - Multi-stage build with optimized standalone binary
- **Cloudflare Workers Support** - Edge deployment with automatic scaling (NEW!)
- **Comprehensive Tests** - Unit and integration tests with high coverage

## Documentation

Full documentation is available at **[https://briansunter.github.io/subs](https://briansunter.github.io/subs)**

- **[Getting Started](https://briansunter.github.io/subs/guide/getting-started)** - Quick setup guide
- **[Google Sheets Setup](https://briansunter.github.io/subs/guide/google-sheets)** - Complete Google Sheets configuration
- **[HTML Form Integration](https://briansunter.github.io/subs/guide/integration)** - Embed forms on your website
- **[API Reference](https://briansunter.github.io/subs/guide/api)** - Complete API documentation
- **[Deployment](https://briansunter.github.io/subs/guide/deployment)** - Deploy to production

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/briansunter/subs.git
cd subs
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `GOOGLE_SHEET_ID` - Your Google Sheet ID
- `GOOGLE_CREDENTIALS_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (or `*` for all)

For detailed setup instructions, see the **[Google Sheets Setup Guide](https://briansunter.github.io/subs/guide/google-sheets)**.

### 3. Set Up Google Sheets

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Sheets API
4. Create a Service Account:
   - Go to IAM & Admin > Service Accounts
   - Create a service account
   - Download the JSON key file
5. Share your Google Sheet with the service account email
6. Copy the credentials to your `.env` file

For a complete step-by-step guide with screenshots, see **[Google Sheets Setup](https://briansunter.github.io/subs/guide/google-sheets)**.

### 4. Run the Server

```bash
# Development with hot reload
bun run dev

# Production
bun run start
```

The API will be available at `http://localhost:3000`

## API Endpoints

### POST `/api/signup`
Basic email signup (email only)

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Sheet1"
  }'
```

### POST `/api/signup/extended`
Extended signup with additional fields

```bash
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe",
    "sheetTab": "Sheet1",
    "source": "website",
    "tags": ["newsletter", "beta"]
  }'
```

### POST `/api/signup/bulk`
Bulk signup (up to 100 emails)

```bash
curl -X POST http://localhost:3000/api/signup/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "signups": [
      {"email": "user1@example.com"},
      {"email": "user2@example.com"}
    ]
  }'
```

### GET `/api/stats`
Get signup statistics

```bash
curl http://localhost:3000/api/stats?sheetTab=Sheet1
```

### GET `/api/health`
Health check endpoint

```bash
curl http://localhost:3000/api/health
```

For complete API documentation, see **[API Reference](https://briansunter.github.io/subs/guide/api)**.

## HTML Form Integration

You can integrate the signup form into your website in several ways:

### Option 1: Iframe Embed

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.iframe('#signup-container');
</script>
```

### Option 2: Inline Form Embed

```html
<script src="https://your-domain.com/embed.js"></script>
<div id="signup-container"></div>
<script>
  SignupEmbed.inline('#signup-container');
</script>
```

### Option 3: Direct Form POST

```html
<form action="https://your-domain.com/api/signup/extended" method="POST">
  <input type="email" name="email" required>
  <input type="text" name="name">
  <input type="hidden" name="sheetTab" value="Sheet1">
  <button type="submit">Sign Up</button>
</form>
```

### Option 4: JavaScript Fetch

```html
<form id="signup-form">
  <input type="email" id="email" required>
  <button type="submit">Sign Up</button>
</form>

<script>
document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;

  const response = await fetch('https://your-domain.com/api/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      sheetTab: 'Sheet1'
    })
  });

  const data = await response.json();
  console.log(data);
});
</script>
```

For more integration examples including React, Vue, and Svelte, see **[HTML Form Integration Guide](https://briansunter.github.io/subs/guide/integration)**.

### Customizing the Embedded Form

You can customize the form using URL parameters:

```
https://your-domain.com/?api=/api/signup/extended&redirect=/thank-you
```

- `api` - Custom API endpoint
- `redirect` - URL to redirect after successful signup

## Google Sheets Configuration

The API supports multiple sheet tabs within a single spreadsheet:

1. Create a new Google Sheet
2. Share it with your service account email (with "Editor" permission)
3. Use the `sheetTab` parameter to specify which tab to use

The API will automatically:
- Create tabs if they don't exist
- Add headers to new tabs
- Track metadata (timestamp, source, tags, etc.)

Each row in your sheet will contain:
| Email | Timestamp | Source | Name | Tags | Metadata | Sheet Tab |
|-------|-----------|--------|------|------|----------|-----------|

For detailed Google Sheets setup instructions, see **[Google Sheets Setup Guide](https://briansunter.github.io/subs/guide/google-sheets)**.

## Docker Deployment

### Build and Run with Docker Compose

```bash
# Create .env file
cp .env.example .env
# Edit .env with your values

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Build and Run with Docker

```bash
# Build image
docker build -t signup-api .

# Run container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name signup-api \
  signup-api
```

For more deployment options (VPS, Render, Railway, Fly.io), see **[Deployment Guide](https://briansunter.github.io/subs/guide/deployment)**.

## Cloudflare Workers Deployment

Cloudflare Workers provides edge deployment with automatic scaling and global distribution.

### Prerequisites

1. Install Wrangler CLI:
   ```bash
   bun install
   bunx wrangler login
   ```

2. Create `.dev.vars` for local development:
   ```bash
   cp .env.example .dev.vars
   # Edit .dev.vars with your values
   ```

3. Set production secrets:
   ```bash
   bun run workers:secret GOOGLE_SHEET_ID
   bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
   bun run workers:secret GOOGLE_PRIVATE_KEY
   bun run workers:secret CLOUDFLARE_TURNSTILE_SECRET_KEY
   ```

### Local Development

```bash
# Start Workers development server
bun run dev:workers

# Your Worker is available at http://localhost:8787
```

### Production Deployment

```bash
# Deploy to Cloudflare Workers
bun run deploy:workers

# View real-time logs
bun run workers:tail
```

### Deployment Comparison

| Platform | Best For | Latency | Cost | Scaling |
|----------|----------|---------|------|---------|
| **Cloudflare Workers** | Global edge deployment, high traffic | ~10ms worldwide | Free tier + pay-per-request | Automatic |
| **Docker** | Self-hosted, private cloud, VPS | Varies by region | Server cost | Manual |

**When to use Cloudflare Workers**:
- You need global edge deployment
- Want automatic scaling and DDoS protection
- Prefer pay-per-use pricing
- Don't need filesystem access

**When to use Docker**:
- Need to self-host on private infrastructure
- Require custom server configuration
- Need to run alongside other containers
- Prefer fixed-cost pricing

For complete Cloudflare Workers setup instructions, see **[Deployment Guide](https://briansunter.github.io/subs/guide/deployment#cloudflare-workers)**.

## Project Structure

```
subs/
├── src/
│   ├── config.ts              # Environment configuration
│   ├── app.ts                 # Base Elysia app factory
│   ├── index.worker.ts        # Cloudflare Worker entry point
│   ├── routes/
│   │   ├── signup.elysia.ts   # Elysia route definitions
│   │   └── handlers.ts        # Business logic
│   ├── schemas/
│   │   └── signup.ts          # Zod validation schemas
│   ├── services/
│   │   └── sheets.ts          # Google Sheets integration
│   └── utils/
│       └── logger.ts          # Pino logging
├── test/                      # Comprehensive tests
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── mocks/                 # Mock services
│   └── helpers/               # Test helpers
├── docs/                      # VitePress documentation
├── index.ts                   # Server entry point
├── wrangler.toml              # Cloudflare Workers configuration
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Docker Compose configuration
├── .env.example               # Environment variables template
└── package.json
```

## Development

### Running Tests

```bash
# Run all tests
bun test

# Run unit tests only
bun test test/unit

# Run integration tests only
bun test test/integration

# Run tests with coverage
bun test --coverage
```

### Code Quality

The project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Check all files
bunx biome check .

# Auto-fix issues
bunx biome check --write .

# Format files
bunx biome format --write .
```

## Security Considerations

1. **CORS** - Set `ALLOWED_ORIGINS` to specific domains in production
2. **Rate Limiting** - Add a rate limiter plugin for production
3. **Input Validation** - All inputs are validated with Zod
4. **Service Account** - Keep your Google credentials secure
5. **HTTPS** - Always use HTTPS in production

For more security best practices, see the **[Deployment Guide](https://briansunter.github.io/subs/guide/deployment#security-best-practices)**.

## Troubleshooting

### Common Issues

**Port already in use**:
```bash
# Use a different port
PORT=3001 bun run dev

# Or kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Google Sheets permission errors**:
- Verify the sheet is shared with the service account email
- Set permission to "Editor" (not just "Viewer")
- Wait a few minutes for permissions to propagate

For more troubleshooting help, see **[Troubleshooting Guide](https://briansunter.github.io/subs/guide/troubleshooting)**.

## Contributing

Contributions are welcome! Please see **[CONTRIBUTING.md](CONTRIBUTING.md)** for guidelines.

## License

MIT

## Links

- **Documentation**: https://briansunter.github.io/subs
- **GitHub**: https://github.com/briansunter/subs
- **Issues**: https://github.com/briansunter/subs/issues
- **Bun**: https://bun.sh
- **Fastify**: https://fastify.dev
