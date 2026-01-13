# Bun Fastify Email Signup API

A high-performance email signup API built with Bun, Fastify, Google Sheets, Discord webhooks, and TypeScript.

## Features

- **Email Signup** - Validate and store email signups in Google Sheets
- **Zod Validation** - Type-safe request validation with Zod
- **Google Sheets Integration** - Store signups in configurable sheet tabs
- **Discord Notifications** - Optional webhook notifications for new signups
- **CORS Support** - Allow requests from any origin
- **Iframe Embedding** - Embed the signup form on any website
- **TypeScript Logging** - Structured logging with Pino
- **Docker Support** - Multi-stage Dockerfile for production

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
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

## Embedding the Form

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
2. Share it with your service account email
3. Use the `sheetTab` parameter to specify which tab to use

The API will automatically:
- Create tabs if they don't exist
- Add headers to new tabs
- Prevent duplicate emails (optional)

## Discord Notifications

To enable Discord notifications:

1. Create a Discord webhook in your server settings
2. Add the webhook URL to your `.env`:
   ```
   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
   ```

You'll receive notifications for:
- New signups
- Errors

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

## Project Structure

```
subs/
├── src/
│   ├── config.ts           # Environment configuration
│   ├── routes/
│   │   └── signup.ts       # API routes
│   ├── schemas/
│   │   └── signup.ts       # Zod validation schemas
│   ├── services/
│   │   ├── sheets.ts       # Google Sheets service
│   │   └── discord.ts      # Discord webhook service
│   └── utils/
│       └── logger.ts       # Logging utility
├── index.ts                # Server entry point
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose configuration
├── .env.example            # Environment variables template
└── package.json
```

## Security Considerations

1. **CORS** - Set `ALLOWED_ORIGINS` to specific domains in production
2. **Rate Limiting** - Add a rate limiter plugin for production
3. **Input Validation** - All inputs are validated with Zod
4. **Service Account** - Keep your Google credentials secure
5. **HTTPS** - Always use HTTPS in production

## License

MIT
