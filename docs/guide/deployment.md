# Deployment

Deploy your email signup API to production.

## Overview

The API can be deployed in several ways:

1. **Docker** - Containerized deployment with Docker or Docker Compose
2. **Bun** - Direct deployment on a VPS with Bun
3. **Serverless** - Deploy to serverless platforms (requires modification)

## Prerequisites

Before deploying, ensure you have:

- Production Google Cloud credentials
- Production Google Sheet
- Discord webhook URL (optional)
- Domain name (optional)
- SSL certificate (for production)

## 1. Docker Deployment

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
