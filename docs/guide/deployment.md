# Deployment

## Overview

| Platform | Best For | Scaling | Cost |
|----------|----------|---------|------|
| **Cloudflare Workers** | Global edge, high traffic | Automatic | Free tier + pay-per-request |
| **Docker** | Self-hosted, private infra | Manual | Server cost |
| **Bun/VPS** | Full server control | Manual | Server cost |

## Prerequisites

- Production Google Cloud credentials ([setup guide](/guide/google-sheets))
- Production Google Sheet shared with the service account

---

## Cloudflare Workers (Recommended)

Your API runs in 300+ edge locations worldwide with zero cold starts and automatic HTTPS.

### One-Click Deploy

Click the deploy button on the [GitHub README](https://github.com/briansunter/subs) to:

1. Fork the repository to your GitHub account
2. Connect it to Cloudflare Workers Builds
3. Deploy the worker to Cloudflare's edge network

After deploying, set secrets in the Cloudflare dashboard (Workers & Pages > your worker > Settings > Variables and Secrets):

- `GOOGLE_SHEET_ID` - Your Google Sheet ID
- `GOOGLE_CREDENTIALS_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` - *(optional)* Turnstile secret key

### Manual Deploy

```bash
bun install
bunx wrangler login
```

Set production secrets (you'll be prompted for each value):

```bash
bun run workers:secret GOOGLE_SHEET_ID
bun run workers:secret GOOGLE_CREDENTIALS_EMAIL
bun run workers:secret GOOGLE_PRIVATE_KEY

# Optional
bun run workers:secret CLOUDFLARE_TURNSTILE_SECRET_KEY
bun run workers:secret CLOUDFLARE_TURNSTILE_SITE_KEY
bun run workers:secret ALLOWED_ORIGINS
```

Deploy:

```bash
bun run deploy:workers
```

Your Worker is live at `https://subs-api.YOUR_SUBDOMAIN.workers.dev`.

### Local Workers Development

```bash
cp .env.example .dev.vars
# Edit .dev.vars with your credentials
bun run dev:workers
# http://localhost:8787
```

### Custom Domain

1. Go to Cloudflare Dashboard > Workers & Pages > Your Worker > Triggers > Custom Domains
2. Click "Add Custom Domain" and enter your domain (e.g., `api.yourdomain.com`)
3. DNS and SSL are configured automatically

Update CORS to match:
```bash
bun run workers:secret ALLOWED_ORIGINS
# Enter: https://yourdomain.com,https://www.yourdomain.com
```

### Monitoring

```bash
# Real-time logs
bun run workers:tail

# Filter by status or method
bun run workers:tail --status 500
bun run workers:tail --method POST

# List deployments
bunx wrangler deployments list

# Rollback
bunx wrangler rollback
```

Analytics are available in the Cloudflare Dashboard under Workers & Pages > Your Worker > Metrics.

### Cost

| Tier | Requests | Price |
|------|----------|-------|
| Free | 100,000/day | Free |
| Paid | 10M/month | ~$50/month |

### Troubleshooting

**"Module not found"**: `rm -rf node_modules && bun install && bun run deploy:workers`

**Secret not found**: `bunx wrangler secret list` to verify, then re-set with `bun run workers:secret SECRET_NAME`

**Request timeout**: Workers have a 30s CPU time limit. Check Google Sheets API latency. Enable debug logging: `bun run workers:secret LOG_LEVEL` (enter `debug`).

---

## Docker

### Docker Compose

```bash
cp .env.example .env.production
# Edit .env.production with production values
docker-compose up -d
```

```bash
docker-compose logs -f    # view logs
docker-compose down       # stop
```

### Docker

```bash
docker build -t signup-api .
docker run -d \
  --name signup-api \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  signup-api
```

### Reverse Proxy

Use Nginx or Caddy for SSL and domain routing:

**Nginx**:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**Caddy** (automatic HTTPS):
```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

---

## Direct Bun (VPS)

```bash
curl -fsSL https://bun.sh/install | bash
git clone https://github.com/briansunter/subs.git
cd subs && bun install
cp .env.example .env  # edit with production values
bun run start
```

For process management, use PM2:

```bash
bun install -g pm2
pm2 start index.ts --name signup-api --interpreter bun
pm2 save && pm2 startup
```

---

## Cloud Platforms

### Render

1. Create a Web Service, connect your GitHub repo
2. Build command: `bun install`, Start command: `bun run start`
3. Add environment variables in the dashboard

### Fly.io

```bash
fly launch
fly secrets set GOOGLE_SHEET_ID=your_id GOOGLE_CREDENTIALS_EMAIL=your_email
fly secrets set GOOGLE_PRIVATE_KEY="your_key"
fly deploy
```

---

## Security Checklist

- [ ] Set `ALLOWED_ORIGINS` to specific domains (not `*`)
- [ ] Use HTTPS in production
- [ ] Never commit `.env` files
- [ ] Use different credentials for dev/production
- [ ] Rotate service account keys periodically
- [ ] Consider rate limiting (Cloudflare's built-in, or Nginx/Caddy)

## Monitoring

### Health Check

```bash
curl https://your-domain.com/api/health
```

Set up automated monitoring with UptimeRobot, Pingdom, or a simple cron:

```bash
*/5 * * * * curl -sf https://your-domain.com/api/health || echo "API down" | mail -s "Alert" admin@example.com
```

### Prometheus Metrics

See [Prometheus Metrics](/guide/prometheus) for scrape configuration, Grafana dashboards, and alert rules.

### Log Aggregation

Set `LOG_LEVEL=warn` in production. Logs are structured JSON (Pino) and work with Datadog, Loki, Logtail, or any log aggregation service.

## Next Steps

- **[Troubleshooting](/guide/troubleshooting)** - Common issues and solutions
- **[API Reference](/guide/api)** - All endpoints and schemas
- **[Configuration](/reference/configuration)** - All environment variables
