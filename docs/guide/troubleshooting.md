# Troubleshooting

## Quick Check

```bash
curl http://localhost:3000/api/health
# Expected: {"status": "ok", "timestamp": "..."}
```

If the health check fails, the server isn't running. Check logs:

```bash
bun run dev                   # local - logs in terminal
docker-compose logs -f        # Docker
bun run workers:tail          # Cloudflare Workers
```

---

## Server Won't Start

### Port in Use

```bash
PORT=3001 bun run dev         # use different port
lsof -ti:3000 | xargs kill   # or kill existing process
```

### Module Not Found

```bash
rm -rf node_modules bun.lockb
bun install
```

### Missing Environment Variables

The server fails with a Zod validation error if required variables are missing. Check:

```bash
ls -la .env                   # file exists?
```

Required variables: `GOOGLE_SHEET_ID`, `GOOGLE_CREDENTIALS_EMAIL`, `GOOGLE_PRIVATE_KEY`

---

## Google Sheets

### Permission Denied

*"The caller does not have permission"*

1. Open the Google Sheet and click Share
2. Confirm the service account email is listed with **Editor** permission
3. Wait 1-2 minutes for permissions to propagate

### Invalid Credentials

*"invalid_grant" or "unauthorized_client"*

- Ensure `GOOGLE_PRIVATE_KEY` uses `\n` for line breaks and is wrapped in quotes
- Verify `GOOGLE_CREDENTIALS_EMAIL` matches `client_email` from the JSON key file
- If the key was rotated, regenerate in Google Cloud Console > IAM > Service Accounts

### Sheet Not Found

*"Requested entity was not found"*

- Verify `GOOGLE_SHEET_ID` matches the ID in the sheet URL (between `/d/` and `/edit`)
- Confirm the sheet exists and you have access

### API Quota Exceeded

Google Sheets API: 100 requests per 100 seconds, 10,000 per day.

For high volume: implement queuing, caching, or use a database with periodic Sheets sync.

---

## CORS

*"Access to fetch has been blocked by CORS policy"*

Add your domain to `ALLOWED_ORIGINS` and restart:

```bash
ALLOWED_ORIGINS=https://yoursite.com,https://www.yoursite.com
```

---

## Validation Errors

*"email: Invalid email address"*

Valid formats: `user@example.com`, `user+tag@example.co.uk`
Invalid: `user@`, `@example.com`, `user example.com`

Check the `details` field in the error response for which fields failed.

---

## Docker

### Container Keeps Restarting

```bash
docker logs signup-api        # check error message
```

Usually: missing env vars or invalid Google credentials. Test with `bun run dev` first to isolate.

### High Memory

```bash
docker stats signup-api       # check usage
docker run -m 512m signup-api # limit memory
```

---

## Performance

**Slow responses**: Usually Google Sheets API latency. Consider caching, or switch to Cloudflare Workers for edge deployment.

**High CPU**: Check log level (`LOG_LEVEL=warn` in production), and add rate limiting to prevent abuse.

---

## Tests Failing

```bash
lsof -ti:3000 | xargs kill   # kill any running server
bun test test/unit            # run unit tests only (use mocks)
```

---

## Getting Help

1. Check the [documentation](/guide/getting-started)
2. Search [GitHub Issues](https://github.com/briansunter/subs/issues)
3. Open a new issue with:
   - Error message
   - Steps to reproduce
   - `bun --version` and OS
   - Relevant logs (redact private keys)
