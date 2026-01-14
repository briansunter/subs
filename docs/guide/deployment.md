# Deployment

Deploy your email signup API to production.

## Overview

The API can be deployed in several ways:

1. **Cloudflare Workers** - Edge deployment with automatic scaling (NEW!)
2. **Docker** - Containerized deployment with Docker or Docker Compose
3. **Bun** - Direct deployment on a VPS with Bun
4. **Serverless** - Deploy to serverless platforms (requires modification)

### Deployment Comparison

| Platform | Best For | Latency | Cost | Scaling | Setup |
|----------|----------|---------|------|---------|-------|
| **Cloudflare Workers** | Global edge deployment, high traffic | ~10ms worldwide | Free tier + pay-per-request | Automatic | Easiest |
| **Docker** | Self-hosted, private cloud, VPS | Varies by region | Server cost | Manual | Medium |
| **Bun/VPS** | Full server control, custom requirements | Varies by region | Server cost | Manual | Medium |
| **Serverless** | Event-driven workloads | Varies | Pay-per-use | Automatic | Complex |

## Prerequisites

Before deploying, ensure you have:

- Production Google Cloud credentials
- Production Google Sheet
- Discord webhook URL (optional)
- Domain name (optional)
- SSL certificate (for production, not needed for Cloudflare Workers)

---

## 1. Cloudflare Workers Deployment (Recommended)

Cloudflare Workers provides edge deployment with automatic scaling and global distribution. Your API runs in 300+ locations worldwide with zero cold starts.

### Why Cloudflare Workers?

**Advantages:**
- **Edge Deployment**: Code runs in 300+ locations worldwide
- **Zero Cold Starts**: Workers platform has no cold starts
- **Automatic HTTPS**: Built-in SSL certificate management
- **DDoS Protection**: Cloudflare's network mitigates attacks automatically
- **Free Tier**: 100,000 requests/day free
- **Pay-per-Use**: Only pay for what you use beyond free tier
- **Instant Rollbacks**: Deploy and rollback in seconds

**Limitations:**
- 10MB bundled size limit
- 30 second CPU time limit per request
- No filesystem access (our app uses in-memory static content)
- Limited TCP socket support (not needed for this app)

### 1.1 Prerequisites

**Required:**
- Cloudflare account (free at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up))
- GitHub or GitLab repository

**Optional:**
- Custom domain (can be configured later)

### 1.2 Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/briansunter/subs.git
   cd subs
   bun install
   ```

2. **Login to Cloudflare:**
   ```bash
   bunx wrangler login
   ```

   This opens your browser to authenticate with Cloudflare.

### 1.3 Local Development

1. **Create environment file:**
   ```bash
   cp .env.example .dev.vars
   ```

2. **Edit `.dev.vars` with your values:**
   ```bash
   # Server Configuration
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=development

   # CORS - Use your actual domain in production
   ALLOWED_ORIGINS=*

   # Google Sheets Configuration
   GOOGLE_SHEET_ID=your_google_sheet_id
   GOOGLE_CREDENTIALS_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

   # Default sheet tab name
   DEFAULT_SHEET_TAB=Sheet1

   # Optional: Cloudflare Turnstile
   CLOUDFLARE_TURNSTILE_SITE_KEY=your_site_key
   CLOUDFLARE_TURNSTILE_SECRET_KEY=your_secret_key

   # Logging
   LOG_LEVEL=info
   ```

3. **Start local development server:**
   ```bash
   bun run dev:workers
   ```

   Your Worker is available at `http://localhost:8787`

   **Features:**
   - Hot reload on file changes
   - Access to secrets from `.dev.vars`
   - Full debugging support
   - Mimics production Workers environment

### 1.4 Production Deployment

#### Step 1: Set Secrets

Set production secrets using `wrangler secret put`. These are encrypted and stored securely:

```bash
# Required secrets
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY

# Optional secrets
bun run workers:secret CLOUDFLARE_TURNSTILE_SECRET_KEY
bun run workers:secret CLOUDFLARE_TURNSTILE_SITE_KEY
bun run workers:secret ALLOWED_ORIGINS
bun run workers:secret DEFAULT_SHEET_TAB
bun run workers:secret ENABLE_EXTENDED_SIGNUP
bun run workers:secret ENABLE_BULK_SIGNUP
bun run workers:secret ENABLE_METRICS
bun run workers:secret LOG_LEVEL
```

**Secret Values:**
- `GOOGLE_SHEET_ID`: Your Google Sheet ID (from sheet URL)
- `GOOGLE_CREDENTIALS_EMAIL`: Service account email
- `GOOGLE_PRIVATE_KEY`: Full private key with `\n` for line breaks
- `CLOUDFLARE_TURNSTILE_SECRET_KEY`: Turnstile secret key
- `CLOUDFLARE_TURNSTILE_SITE_KEY`: Turnstile site key (for frontend)
- `ALLOWED_ORIGINS`: Comma-separated origins or `*` (defaults to `*`)
- `DEFAULT_SHEET_TAB`: Sheet tab name (defaults to `Sheet1`)
- `ENABLE_EXTENDED_SIGNUP`: `true` or `false` (defaults to `true`)
- `ENABLE_BULK_SIGNUP`: `true` or `false` (defaults to `true`)
- `ENABLE_METRICS`: `true` or `false` (defaults to `true`)
- `LOG_LEVEL`: `debug`, `info`, `warn`, or `error` (defaults to `info`)

#### Step 2: Deploy

```bash
# Deploy to Cloudflare Workers
bun run deploy:workers
```

**Output:**
```
⛅️ wrangler 3.114.17
-------------------------
Total Upload: 2.45 MB / gzip: 0.58 MB
Uploaded subs-api (2.45 sec)
Deployed subs-api triggers
  https://subs-api.YOUR_SUBDOMAIN.workers.dev
Current Version ID: <version-id>
```

Your Worker is now live!

#### Step 3: Verify Deployment

```bash
# Check deployment status
bunx wrangler deployments list

# Test your Worker
curl https://subs-api.YOUR_SUBDOMAIN.workers.dev/api/health

# View real-time logs
bun run workers:tail
```

### 1.5 Custom Domain (Optional)

#### Add a Custom Domain

1. **Go to Cloudflare Dashboard:**
   - Navigate to Workers & Pages > Your Worker > Triggers > Custom Domains

2. **Add Your Domain:**
   - Click "Add Custom Domain"
   - Enter `api.yourdomain.com`
   - Click "Activate Domain"

3. **DNS is Automatic:**
   - Cloudflare automatically creates DNS records
   - SSL certificate is provisioned automatically
   - No manual configuration needed

#### Update CORS Origins

Update your `ALLOWED_ORIGINS` secret:
```bash
bun run workers:secret ALLOWED_ORIGINS
# Enter: https://yourdomain.com,https://www.yourdomain.com
```

### 1.6 Monitoring and Logs

#### Real-Time Logs

```bash
# Tail logs in real-time
bun run workers:tail

# Filter by status
bun run workers:tail --status 500

# Filter by method
bun run workers:tail --method POST
```

#### Analytics Dashboard

1. Go to Cloudflare Dashboard
2. Workers & Pages > Your Worker > Metrics
3. View:
   - Request count and error rate
   - Response time percentiles
   - CPU usage
   - Memory usage

### 1.7 Cost Estimation

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- Sufficient for most small to medium applications

**Paid Tier** (beyond free):
- $5/month per million requests
- $0.50 per million GB-seconds of CPU time
- $0.60 per million GB-seconds of memory usage

**Example Calculations:**
- 1 million requests/month: $5/month
- 10 million requests/month: ~$50/month
- 100 million requests/month: ~$500/month

### 1.8 Rollback

#### Instant Rollback

```bash
# List recent deployments
bunx wrangler deployments list

# Rollback to previous version
bunx wrangler rollback
```

Or use the Cloudflare Dashboard:
1. Workers & Pages > Your Worker > Deployments
2. Click on a previous deployment
3. Click "Rollback to this version"

### 1.9 Troubleshooting

#### Common Issues

**"Module not found" errors:**
```bash
# Clear cache and rebuild
rm -rf node_modules
bun install
bun run deploy:workers
```

**Secret not found:**
```bash
# Verify secret is set
bunx wrangler secret list

# Re-set the secret
bun run workers:secret SECRET_NAME
```

**Request timeout:**
- Workers have 30 second CPU time limit
- Our API typically completes in <1 second
- If timeouts occur, check Google Sheets API latency

#### Debug Mode

Enable debug logging:
```bash
# Set secret
bun run workers:secret LOG_LEVEL

# Enter: debug
```

View detailed logs in `wrangler tail`.

### 1.10 Advanced Configuration

**Note:** Wrangler automatically handles TypeScript compilation with the `nodejs_compat` compatibility flag. No custom build command is needed.

#### KV Namespaces (Caching)

For caching frequently accessed data:

```toml
# wrangler.toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

#### D1 Databases

For SQL database storage:

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "subs-db"
```

#### Cron Triggers

For scheduled tasks:

```toml
# wrangler.toml
[triggers.crons]
"0 0 * * *" = "cleanup-job"
```

### 1.11 Migrating from Docker

If you're currently using Docker:

1. **Deploy to Workers** (this section)
2. **Update DNS** to point to Workers URL
3. **Monitor** both deployments during transition
4. **Decommission** Docker once Workers is stable

---

## 2. Docker Deployment

### Using Docker Compose (Recommended)

#### 1.1 Create Production Environment File

```bash
# Create production environment file
cp .env.example .env.production
```

Edit `.env.production` with your production values:

```bash
# Server Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=production

# CORS - Use your actual domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Google Sheets Configuration
GOOGLE_SHEET_ID=your_production_sheet_id
GOOGLE_CREDENTIALS_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour production private key\n-----END PRIVATE KEY-----\n"

# Discord Webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your-webhook-url

# Logging
LOG_LEVEL=warn
```

#### 1.2 Deploy with Docker Compose

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

#### 1.3 Configure Reverse Proxy (Optional)

Use Nginx or Caddy as a reverse proxy for SSL and domain routing:

**Nginx Example**:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using Docker

#### 1.1 Build the Image

```bash
docker build -t signup-api:latest .
```

#### 1.2 Run the Container

```bash
docker run -d \
  --name signup-api \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  signup-api:latest
```

#### 1.3 Update Running Container

```bash
# Stop and remove old container
docker stop signup-api
docker rm signup-api

# Pull/build new image
docker build -t signup-api:latest .

# Run new container
docker run -d \
  --name signup-api \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  signup-api:latest
```

## 2. Direct Bun Deployment

### Deploying to a VPS

#### 2.1 Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

#### 2.2 Clone and Setup

```bash
# Clone repository
git clone https://github.com/briansunter/subs.git
cd subs

# Install dependencies
bun install

# Create production environment file
cp .env.example .env
# Edit .env with production values

# Test the server
bun run start
```

#### 2.3 Using PM2 (Recommended)

Install PM2:

```bash
bun install -g pm2
```

Start the application:

```bash
pm2 start index.ts --name signup-api
pm2 save
pm2 startup
```

PM2 commands:

```bash
pm2 status          # Check status
pm2 logs signup-api # View logs
pm2 restart signup-api  # Restart
pm2 stop signup-api     # Stop
pm2 delete signup-api    # Remove
```

#### 2.4 Configure PM2 Ecosystem

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'signup-api',
    script: 'index.ts',
    interpreter: 'bun',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    env_production: {
      NODE_ENV: 'production',
    },
  }],
};
```

Use with PM2:

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

## 3. Cloud Platform Deployment

### Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Configure build settings:
   - **Build Command**: `bun install`
   - **Start Command**: `bun run start`
4. Add environment variables in the Render dashboard
5. Deploy

### Railway

1. Create a new project on Railway
2. Deploy from GitHub repository
3. Add environment variables
4. Railway will automatically detect and build

### Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch
fly launch

# Set environment variables
fly secrets set GOOGLE_SHEET_ID=your_sheet_id
fly secrets set GOOGLE_CREDENTIALS_EMAIL=your_email
fly secrets set GOOGLE_PRIVATE_KEY="your_key"

# Deploy
fly deploy
```

## 4. SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### Using Caddy (Automatic HTTPS)

Caddy automatically handles SSL certificates:

```javascript
// Caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl restart caddy
```

## 5. Monitoring and Logging

### View Logs

**Docker**:

```bash
docker-compose logs -f
```

**PM2**:

```bash
pm2 logs signup-api
```

**Systemd**:

```bash
journalctl -u signup-api -f
```

### Log Aggregation

Consider using log aggregation services:

- **Logtail** - Simple log monitoring
- **Datadog** - Full observability platform
- **Loggly** - Cloud log management
- **Loki** - Open-source log aggregation

### Health Monitoring

Set up health check monitoring:

```bash
# Simple cron job
*/5 * * * * curl -f http://localhost:3000/api/health || echo "API down" | mail -s "Alert" admin@example.com
```

Or use monitoring services:

- **UptimeRobot** - Free uptime monitoring
- **Pingdom** - Website monitoring
- **StatusCake** - Uptime and performance monitoring

## 6. Security Best Practices

### 6.1 Environment Variables

- Never commit `.env` files to version control
- Use different credentials for production
- Rotate credentials periodically
- Use secrets management tools (e.g., HashiCorp Vault)

### 6.2 CORS Configuration

Set specific origins in production:

```bash
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 6.3 Rate Limiting

Implement rate limiting to prevent abuse:

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});
```

### 6.4 Firewall

Configure firewall rules:

```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 6.5 Dependencies

Keep dependencies updated:

```bash
bun update
```

## 7. Performance Optimization

### 7.1 Google Sheets Caching

The API caches the Google Sheets client. For high-volume applications, consider:

1. Adding request queuing
2. Implementing response caching
3. Using a database as primary storage with periodic syncs to Sheets

### 7.2 Connection Pooling

Fastify handles connection pooling automatically. Configure if needed:

```typescript
const fastify = Fastify({
  connectionTimeout: 10000,
});
```

### 7.3 Logging

Set appropriate log level in production:

```bash
LOG_LEVEL=warn  # Only log warnings and errors
```

## 8. Backup and Recovery

### Google Sheets Backup

Google Sheets automatically creates backups. Configure version history:

1. Open your Google Sheet
2. File > Version history > See version history
3. Enable named versions for important milestones

### Environment Backup

Securely backup your `.env` file:

```bash
# Encrypt environment file
gpg -c .env.production

# Store encrypted file securely
# Decrypt when needed
gpg .env.production.gpg
```

## 9. CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Build Docker image
        run: docker build -t signup-api .

      - name: Deploy
        run: |
          # Add your deployment commands here
          echo "Deploying..."
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs signup-api

# Common issues:
# - Missing environment variables
# - Invalid Google credentials
# - Port already in use
```

### Google Sheets Connection Issues

```bash
# Verify credentials
echo $GOOGLE_SHEET_ID
echo $GOOGLE_CREDENTIALS_EMAIL

# Test API directly
curl http://localhost:3000/api/health
```

### High Memory Usage

```bash
# Check resource usage
docker stats signup-api

# Limit memory
docker run -m 512m signup-api:latest
```

## Next Steps

- **[Troubleshooting](/guide/troubleshooting)** - Common issues and solutions
- **[API Reference](/guide/api)** - Complete API documentation
- **[Configuration](/reference/configuration)** - Environment variables reference
