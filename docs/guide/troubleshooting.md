# Troubleshooting

Common issues and solutions for the email signup API.

## Quick Diagnostics

### Health Check

First, check if the API is running:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-12T10:30:00.000Z"
}
```

### Check Logs

```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs signup-api

# Direct Bun
bun run dev  # Logs appear in terminal
```

## Common Issues

### Server Won't Start

#### Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:

```bash
# Option 1: Use a different port
PORT=3001 bun run dev

# Option 2: Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Option 3: Find and kill manually
lsof -i :3000
kill -9 <PID>
```

#### Module Not Found

**Error**: `Cannot find module '...'`

**Solution**:

```bash
# Reinstall dependencies
rm -rf node_modules bun.lockb
bun install
```

#### Environment Variables Missing

**Error**: `GOOGLE_SHEET_ID is required`

**Solution**:

1. Check `.env` file exists in project root
2. Verify all required variables are set
3. Restart the server after changing `.env`

```bash
# Verify file exists
ls -la .env

# Check variables are set
cat .env
```

### Google Sheets Issues

#### Permission Denied

**Error**: `The caller does not have permission`

**Causes**:
1. Service account doesn't have access to the sheet
2. Service account has "Viewer" instead of "Editor" permission
3. Wrong sheet ID

**Solutions**:

1. **Verify sheet sharing**:
   - Open Google Sheet
   - Click "Share"
   - Confirm service account email is listed with "Editor" permission
   - Wait a few minutes for permissions to propagate

2. **Check sheet ID**:
   ```bash
   # Verify ID matches the URL
   # URL: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35/edit
   # ID: 1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35 (the part between /d/ and /edit)
   ```

3. **Re-share the sheet**:
   - Remove service account from sharing
   - Add it back with "Editor" permission
   - Wait 1-2 minutes

#### Invalid Credentials

**Error**: `invalid_grant` or `unauthorized_client`

**Causes**:
1. Malformed private key
2. Wrong service account email
3. Key was rotated or deleted

**Solutions**:

1. **Check private key format**:
   ```bash
   # Correct - with \n for line breaks
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFA...\n-----END PRIVATE KEY-----\n"
   ```

2. **Verify service account email**:
   ```bash
   # Should match the client_email in your JSON key file
   GOOGLE_CREDENTIALS_EMAIL=service-account@project-id.iam.gserviceaccount.com
   ```

3. **Regenerate service account key**:
   - Go to Google Cloud Console
   - IAM & Admin > Service Accounts
   - Delete old keys
   - Create new key
   - Update `.env` with new credentials

#### Sheet Not Found

**Error**: `Requested entity was not found`

**Solutions**:

1. Verify sheet ID is correct
2. Check that the sheet still exists
3. Confirm you have access to the sheet
4. Try opening the sheet in a browser

#### API Quota Exceeded

**Error**: `Quota exceeded` or `Rate limit exceeded`

**Solutions**:

1. **Wait and retry** - Quotas reset every 100 seconds
2. **Implement caching** - Reduce API calls
3. **Use a queue** - Batch requests
4. **Request quota increase** - Google Cloud Console > APIs & Services > Quotas

### Discord Issues

#### Webhook Not Working

**Symptoms**: No Discord notifications appearing

**Diagnosis**:

```bash
# Test webhook directly
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

**Solutions**:

1. **Verify webhook URL**:
   ```bash
   # Check URL is set
   echo $DISCORD_WEBHOOK_URL
   ```

2. **Check webhook exists**:
   - Go to Discord Server Settings > Integrations
   - Verify webhook still exists
   - Create new webhook if needed

3. **Check channel permissions**:
   - Verify webhook can post in the channel
   - Check bot permissions

#### Rate Limit Errors

**Error**: `You are being rate limited` or `429 Too Many Requests`

**Solution**:

1. Discord allows 30 webhook requests per 60 seconds
2. Implement a queue for high-volume signups
3. Aggregate notifications instead of sending one per signup

### CORS Issues

#### Blocked by CORS Policy

**Error**: `Access to fetch at '...' has been blocked by CORS policy`

**Solutions**:

1. **Check `ALLOWED_ORIGINS`**:
   ```bash
   # .env
   ALLOWED_ORIGINS=https://yourwebsite.com
   ```

2. **Include all domains**:
   ```bash
   # Multiple domains
   ALLOWED_ORIGINS=https://yourwebsite.com,https://www.yourwebsite.com

   # Development only
   ALLOWED_ORIGINS=*
   ```

3. **Restart server** after changing `.env`

4. **Check browser console** for the exact origin being blocked

### Validation Errors

#### Invalid Email Format

**Error**: `email: Invalid email address`

**Solutions**:

1. **Check email format**:
   ```javascript
   // Valid
   user@example.com
   user.name@example.com
   user+tag@example.co.uk

   // Invalid
   user@ (missing domain)
   @example.com (missing user)
   user example.com (missing @)
   ```

2. **Client-side validation**:
   ```html
   <input type="email" required>
   ```

#### Validation Error Details

**Error**: `Validation error` with details object

**Example**:
```json
{
  "success": false,
  "error": "Validation error",
  "details": {
    "email": "Invalid email address",
    "sheetTab": "Must be a string"
  }
}
```

**Solution**: Fix the fields listed in `details`

### Docker Issues

#### Container Keeps Restarting

**Diagnosis**:

```bash
# Check logs
docker logs signup-api

# Check container status
docker ps -a
```

**Common causes**:

1. **Missing environment variables**
   - Add all required variables to docker-compose.yml or `.env`
   - Restart container

2. **Invalid Google credentials**
   - Verify credentials in `.env`
   - Test with direct Bun run first

3. **Port conflicts**
   - Change port mapping in docker-compose.yml

#### Out of Memory

**Error**: Container killed with OOM (Out of Memory)

**Solutions**:

1. **Increase memory limit**:
   ```yaml
   # docker-compose.yml
   services:
     app:
       deploy:
         resources:
           limits:
             memory: 512M
   ```

2. **Check for memory leaks**:
   ```bash
   docker stats signup-api
   ```

### Performance Issues

#### Slow Response Times

**Diagnosis**:

```bash
# Test response time
time curl http://localhost:3000/api/health
```

**Solutions**:

1. **Check Google Sheets API latency** - This is usually the bottleneck
2. **Implement caching** - Cache frequent reads
3. **Use connection pooling** - Fastify handles this by default
4. **Add CDN** - For static assets

#### High CPU Usage

**Diagnosis**:

```bash
# Check CPU usage
docker stats signup-api
# or
top
```

**Solutions**:

1. **Check for infinite loops**
2. **Review logging level** - Reduce logging in production
3. **Add rate limiting** - Prevent abuse

### Testing Issues

#### Tests Failing

**Common causes**:

1. **Port already in use**:
   ```bash
   # Kill existing test servers
   lsof -ti:3000 | xargs kill -9
   ```

2. **Environment not cleared**:
   ```bash
   # Clear config cache between tests
   # Tests should handle this automatically
   ```

3. **Mock service issues**:
   ```bash
   # Run unit tests only (use mocks)
   bun test test/unit
   ```

## Diagnostic Commands

### Check Server Status

```bash
# Process running
ps aux | grep "bun run index.ts"

# Port listening
lsof -i :3000

# HTTP response
curl -I http://localhost:3000
```

### Check Configuration

```bash
# Environment variables
env | grep GOOGLE_

# Test config loading
bun -e "import('./src/config.ts').then(m => console.log(m))"
```

### Check Google Sheets Access

```bash
# Test API directly
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "sheetTab": "Sheet1"}'
```

### Check Logs

```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail 100

# Specific service
docker-compose logs -f app
```

## Getting Help

If you're still having trouble:

1. **Check the documentation**:
   - [Getting Started](/guide/getting-started)
   - [Google Sheets Setup](/guide/google-sheets)
   - [API Reference](/guide/api)

2. **Search existing issues**:
   - [GitHub Issues](https://github.com/briansunter/subs/issues)

3. **Create a new issue** with:
   - Error messages
   - Steps to reproduce
   - Environment details (OS, Bun version)
   - Relevant logs

4. **Include diagnostic information**:
   ```bash
   # Gather diagnostics
   bun --version
   uname -a
   cat .env | grep -v PRIVATE_KEY  # Hide private key
   curl -s http://localhost:3000/api/health
   ```
