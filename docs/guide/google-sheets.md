# Google Sheets Setup

Store email signups in Google Sheets with service account authentication.

## Overview

The API uses the Google Sheets API with a service account to read and write signup data. Each signup can be stored in a specific sheet tab, allowing you to organize signups by source.

## Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown, then **New Project**
3. Name it (e.g., "Email Signup API") and click **Create**

### 2. Enable Google Sheets API

1. In your project, go to **APIs & Services** > **Library**
2. Search for **Google Sheets API**
3. Click **Enable**

### 3. Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **Create Service Account**
3. Name: `email-signup-api`, then click **Create and Continue**
4. Skip roles, click **Done**

### 4. Generate a Key

1. Click the service account you created
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key** > **JSON**
4. The key file downloads automatically - keep it secure

### 5. Create and Share a Google Sheet

1. Create a new spreadsheet at [sheets.google.com](https://sheets.google.com/)
2. Click **Share**, paste the service account email (`client_email` from the JSON key)
3. Set permission to **Editor**, then click **Send**

### 6. Get Your Sheet ID

From the sheet URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### 7. Configure Environment

Add to `.env`:

```bash
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
DEFAULT_SHEET_TAB=Sheet1
```

The private key in the JSON file already contains `\n` characters - paste it directly.

## Sheet Tabs

Use the `sheetTab` parameter to organize signups into different tabs:

```bash
# Newsletter tab
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "sheetTab": "Newsletter"}'

# Beta tab
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "sheetTab": "Beta"}'
```

The API automatically creates tabs and adds headers if they don't exist.

### Row Format

| Email | Timestamp | Source | Name | Tags | Metadata | Sheet Tab |
|-------|-----------|--------|------|------|----------|-----------|

## Testing

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "sheetTab": "Sheet1"}'
```

Check your Google Sheet - a new row should appear.

## Troubleshooting

### "The caller does not have permission"

- Verify the sheet is shared with the service account email
- Set permission to **Editor** (not Viewer)
- Wait 1-2 minutes for permissions to propagate

### "Requested entity was not found"

- Check `GOOGLE_SHEET_ID` matches the URL
- Confirm the sheet exists and is accessible

### "Invalid Credentials"

- Verify `GOOGLE_PRIVATE_KEY` includes the full key with `\n` line breaks
- Ensure the key is wrapped in quotes in `.env`
- Check you're using the correct service account JSON file

### No data appears

1. Check server logs for errors
2. Verify all environment variables are set
3. Test with curl to isolate the issue

## API Quotas

Google Sheets API limits: **100 requests per 100 seconds**, **10,000 per day**.

For high-volume use, consider queuing requests, caching results, or using a database with periodic syncs to Sheets.

## Security

- Never commit the service account key file or `.env` to version control
- Use different service accounts for dev/production
- Rotate keys periodically (IAM > Service Accounts > Keys)
- Only share sheets with the specific service account that needs access

## Next Steps

- **[Cloudflare Turnstile](/guide/turnstile)** - Invisible bot protection
- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[API Reference](/guide/api)** - Complete API documentation
