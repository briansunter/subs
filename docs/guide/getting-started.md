# Getting Started

Get **subs** up and running in ~5 minutes. You'll have a production-ready email signup API with invisible bot protection, Google Sheets storage, and optional Discord notifications.

## What You're Building

**subs** is a complete email signup solution that:

- 🛡️ Blocks 99% of spam with Cloudflare Turnstile (invisible to users)
- 📧 Validates, deduplicates, and stores emails in Google Sheets
- 📊 Tracks metrics with Prometheus out of the box
- 🔌 Embeds anywhere: iframe, inline, direct POST, or JavaScript SDK
- 📢 Sends real-time notifications to Discord

**Time to complete**: ~5 minutes
**Difficulty**: Beginner-friendly

## Prerequisites

Before you begin, ensure you have:

- **Bun** - Install from [bun.sh](https://bun.sh/)
- **Google Account** - For Google Sheets integration (free tier works great)
- **Code Editor** - VS Code, or any editor of your choice
- **Terminal** - For running commands

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/briansunter/subs.git
cd subs
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# CORS - Use specific domains in production
ALLOWED_ORIGINS=*

# Google Sheets (required)
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CREDENTIALS_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Default sheet tab
DEFAULT_SHEET_TAB=Sheet1

# Discord (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# Logging
LOG_LEVEL=info
```

See the [Google Sheets Setup](/guide/google-sheets) guide for detailed instructions on getting credentials.

## Development

### Start the Development Server

```bash
bun run dev
```

The server will start with hot reload enabled at `http://localhost:3000`

### Verify It's Working

Open your browser and navigate to:

- **`http://localhost:3000`** - The embedded signup form
- **`http://localhost:3000/api/health`** - Health check endpoint

You should see:

```json
{
  "status": "ok",
  "timestamp": "2025-01-12T10:30:00.000Z"
}
```

## Testing

### Run All Tests

```bash
bun test
```

### Run Unit Tests Only

```bash
bun test test/unit
```

### Run Integration Tests Only

```bash
bun test test/integration
```

### Run Tests with Coverage

```bash
bun test --coverage
```

## Quick Test

Test the API with a simple signup request:

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "sheetTab": "Sheet1"
  }'
```

Expected response:

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

Check your Google Sheet - the signup should appear in the "Sheet1" tab.

## Project Structure

```
subs/
├── src/
│   ├── config.ts              # Environment configuration
│   ├── routes/
│   │   ├── signup.ts          # Fastify route definitions
│   │   └── handlers.ts        # Business logic
│   ├── schemas/
│   │   └── signup.ts          # Zod validation schemas
│   ├── services/
│   │   ├── sheets.ts          # Google Sheets integration
│   │   └── discord.ts         # Discord webhook service
│   └── utils/
│       └── logger.ts          # Pino logging
├── test/                      # Test files
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── mocks/                 # Mock services
│   └── helpers/               # Test helpers
├── docs/                      # VitePress documentation
├── index.ts                   # Server entry point
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose configuration
├── .env.example               # Environment variables template
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with hot reload |
| `bun run start` | Start production server |
| `bun test` | Run all tests |
| `bun test test/unit` | Run unit tests only |
| `bun test test/integration` | Run integration tests only |
| `bun test --coverage` | Run tests with coverage report |
| `bun run docker:build` | Build Docker image |
| `bun run docker:up` | Start containers with Docker Compose |
| `bun run docker:down` | Stop Docker Compose containers |
| `bun run docs:dev` | Start VitePress documentation server |
| `bun run docs:build` | Build documentation for production |

## Code Quality

### Linting

The project uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Check all files
bunx biome check .

# Auto-fix issues
bunx biome check --write .

# Format files
bunx biome format --write .
```

### Type Checking

The project uses TypeScript with strict mode enabled.

```bash
# Type check (included in bun test)
bun tsc --noEmit
```

## Next Steps

1. **[Google Sheets Setup](/guide/google-sheets)** - Configure Google Sheets integration
2. **[Discord Setup](/guide/discord)** - Add Discord notifications
3. **[HTML Form Integration](/guide/integration)** - Embed forms on your website
4. **[API Reference](/guide/api)** - Explore all API endpoints
5. **[Deployment](/guide/deployment)** - Deploy to production

## Common Issues

### Port Already in Use

If you see an error about port 3000 being in use:

```bash
# Option 1: Use a different port
PORT=3001 bun run dev

# Option 2: Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Google Sheets Errors

If you see errors related to Google Sheets:

1. Verify your credentials in `.env`
2. Make sure you shared the sheet with the service account email
3. Check that the service account has "Editor" permissions

See [Google Sheets Troubleshooting](/guide/google-sheets#troubleshooting) for more details.

### Environment Variables Not Loading

Make sure your `.env` file is in the project root and properly formatted:

```bash
# Correct
GOOGLE_SHEET_ID=abc123

# Incorrect (no spaces around =)
GOOGLE_SHEET_ID = abc123
```

## Getting Help

- **Documentation**: Check the [Guide](/guide/) section
- **Troubleshooting**: See [Troubleshooting](/guide/troubleshooting)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/briansunter/subs/issues)
