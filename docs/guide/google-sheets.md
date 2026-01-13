# Google Sheets Setup

This guide walks you through setting up Google Sheets to store email signups from the API.

## Overview

The API uses Google Sheets API with service account authentication to store email signups. Each signup can be stored in a specific sheet tab, allowing you to organize signups from different sources.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Enter a project name (e.g., "Email Signup API")
5. Click **"Create"**

## Step 2: Enable Google Sheets API

1. In your new project, navigate to **"APIs & Services"** > **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it and press **"Enable"**

## Step 3: Create a Service Account

1. Go to **"IAM & Admin"** > **"Service Accounts"**
2. Click **"Create Service Account"**
3. Fill in the service account details:
   - **Service account name**: `email-signup-api`
   - **Service account description**: `Service account for email signup API`
4. Click **"Create and Continue"**
5. Skip adding users/roles for now (click **"Done"**)

## Step 4: Generate a Service Account Key

1. Click on the service account you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **"JSON"** as the key type
5. Click **"Create"**
6. The JSON key file will download automatically

**Important**: Keep this file secure! It contains your private key and should never be committed to version control.

## Step 5: Extract Credentials from JSON Key

Open the downloaded JSON file. It will look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "email-signup-api@your-project-id.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

You'll need two values from this file:

1. **`client_email`** - This is your `GOOGLE_CREDENTIALS_EMAIL`
2. **`private_key`** - This is your `GOOGLE_PRIVATE_KEY`

## Step 6: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Click **"Blank"** to create a new spreadsheet
3. Name it (e.g., "Email Signups")

## Step 7: Share the Sheet with Your Service Account

1. Open your Google Sheet
2. Click **"Share"** in the top right
3. Paste the service account email (`client_email` from step 5)
4. Set the permission to **"Editor"**
5. Click **"Send"**

## Step 8: Get Your Sheet ID

Your sheet ID is the long string of characters in the URL between `/d/` and `/edit`:

```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjGMUUqpt35/edit
                                         ^^^^^^^^^^^^^^^^^^^^^^^
                                         This is your Sheet ID
```

## Step 9: Configure Environment Variables

Add the following to your `.env` file:

```bash
# Google Sheets Configuration
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CREDENTIALS_EMAIL=email-signup-api@your-project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

# Default sheet tab name (will be created if doesn't exist)
DEFAULT_SHEET_TAB=Sheet1
```

### Formatting the Private Key

The private key must be formatted with `\n` for line breaks in your `.env` file:

```bash
# CORRECT - with \n for line breaks
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# INCORRECT - actual line breaks won't work
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...
-----END PRIVATE KEY-----"
```

**Tip**: Copy the entire `private_key` value from the JSON file and paste it directly into your `.env` file. The `\n` characters are already included in the JSON.

## Step 10: Configure Sheet Tabs

The API automatically creates sheet tabs if they don't exist. Each tab will have the following headers:

| Email | Timestamp | Source | Name | Tags | Metadata | Sheet Tab |
|-------|-----------|--------|------|------|----------|-----------|

### Using Different Sheet Tabs

You can organize signups into different tabs by using the `sheetTab` parameter:

```bash
# Store in "Newsletter" tab
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Newsletter"
  }'

# Store in "Beta" tab
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "sheetTab": "Beta"
  }'
```

## Testing Your Setup

### Verify Service Account Access

1. Open your Google Sheet
2. Check that the service account email appears in the **"Share"** dialog with **"Editor"** access

### Test the API

```bash
# Test basic signup
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

Check your Google Sheet - a new row should appear in the "Sheet1" tab.

## Troubleshooting

### Error: "The caller does not have permission"

**Cause**: The service account doesn't have access to the sheet.

**Solution**:
1. Make sure you shared the sheet with the service account email
2. Set the permission to **"Editor"** (not just **"Viewer"**)
3. Wait a few minutes for permissions to propagate

### Error: "Requested entity was not found"

**Cause**: Incorrect sheet ID or sheet doesn't exist.

**Solution**:
1. Verify the `GOOGLE_SHEET_ID` in your `.env` file
2. Make sure the sheet exists and you have access to it
3. Check that the sheet ID is copied correctly (no extra characters)

### Error: "Invalid Credentials"

**Cause**: Incorrect or malformed private key.

**Solution**:
1. Verify the `GOOGLE_PRIVATE_KEY` includes the full key with `\n` for line breaks
2. Make sure the key is enclosed in quotes in the `.env` file
3. Check that you're using the correct service account key file

### Error: "Sheet tab not found" (with auto-creation disabled)

**Cause**: The specified sheet tab doesn't exist and auto-creation failed.

**Solution**:
1. Check that the service account has **"Editor"** permissions (required to create tabs)
2. Verify the `sheetTab` parameter name is correct
3. Try manually creating the tab in Google Sheets first

### No data appears in Google Sheet

**Possible causes**:
1. Check the server logs for errors
2. Verify all environment variables are set correctly
3. Test with a simple curl command to isolate the issue
4. Check that the request body matches the expected schema

## Security Best Practices

1. **Never commit your service account key** to version control
2. **Add `.env` to `.gitignore`**
3. **Use different environments** for development and production
4. **Rotate keys periodically** - create a new service account key and delete the old one
5. **Limit service account permissions** - only give it access to the specific sheets it needs
6. **Monitor API usage** - check Google Cloud Console for unusual activity

## Advanced Configuration

### Using Multiple Spreadsheets

The API currently supports a single spreadsheet per deployment. To use multiple spreadsheets:

1. Deploy multiple instances of the API with different configurations
2. Use a reverse proxy (like Nginx) to route requests to the appropriate instance

### Custom Row Data

The API stores the following fields in each row:

| Field | Description | Example |
|-------|-------------|---------|
| Email | User's email address | `user@example.com` |
| Timestamp | ISO 8601 timestamp | `2025-01-12T10:30:00.000Z` |
| Source | Signup source | `website`, `api`, `import` |
| Name | User's name (optional) | `John Doe` |
| Tags | Comma-separated tags | `newsletter,beta` |
| Metadata | JSON string of extra data | `{"utm_source": "google"}` |
| Sheet Tab | Tab where data was stored | `Sheet1` |

### Rate Limiting

Google Sheets API has quota limits:
- **100 requests per 100 seconds** per project
- **10,000 requests per day** per project

For high-volume signups, consider:
- Implementing a queue system
- Caching results
- Using a database as the primary storage with periodic syncs to Sheets

## Next Steps

- **[Discord Setup](/guide/discord)** - Add Discord notifications for new signups
- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[API Reference](/guide/api)** - Complete API documentation
