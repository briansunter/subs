# Discord Setup

This guide walks you through setting up Discord webhook notifications for new email signups.

## Overview

Discord webhooks allow you to receive real-time notifications in your Discord server when:
- A new user signs up
- A bulk signup is completed
- An error occurs during signup processing

## Prerequisites

- A Discord account
- Permission to create webhooks in a Discord server

## Step 1: Create a Discord Webhook

### 1.1 Open Server Settings

1. Open Discord and navigate to your server
2. Click the **server name** in the top left
3. Select **"Server Settings"** from the dropdown

### 1.2 Navigate to Integrations

1. In the left sidebar, click on **"Integrations"**
2. Scroll down to the **"Webhooks"** section
3. Click **"New Webhook"**

### 1.3 Configure the Webhook

1. **Name**: Give your webhook a name (e.g., "Email Signups")
2. **Channel**: Select the channel where notifications will be posted
3. Click **"Copy Webhook URL"** to save the URL
4. Click **"Save"**

**Important**: Keep this webhook URL secure! Anyone with the URL can post messages to your channel.

## Step 2: Configure Environment Variables

Add the webhook URL to your `.env` file:

```bash
# Discord Webhook (Optional)
# Leave empty to disable Discord notifications
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz
```

### Optional: Disable Discord Notifications

To disable Discord notifications, leave the variable empty or remove it:

```bash
# Disable Discord notifications
DISCORD_WEBHOOK_URL=
```

## Step 3: Test Your Webhook

### Test with the API

```bash
# Send a test signup
curl -X POST http://localhost:3000/api/signup/extended \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "sheetTab": "Sheet1"
  }'
```

Check your Discord channel - you should see a notification like this:

```
🎉 New Signup!
📧 test@example.com
👤 Test User
📅 2025-01-12 10:30:00
📋 Sheet: Sheet1
```

### Test with cURL

You can also test the webhook directly:

```bash
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test webhook notification",
    "embeds": [{
      "title": "Test Message",
      "description": "If you see this, your webhook is working!",
      "color": 5814783
    }]
  }'
```

## Notification Formats

### Basic Signup Notification

```
🎉 New Signup!
📧 user@example.com
📅 2025-01-12 10:30:00
📋 Sheet: Sheet1
```

### Extended Signup Notification

```
🎉 New Signup!
📧 user@example.com
👤 John Doe
📝 Source: website
🏷️ Tags: newsletter, beta
📅 2025-01-12 10:30:00
📋 Sheet: Newsletter
```

### Bulk Signup Notification

```
📦 Bulk Signup Complete
✅ 47 successful
❌ 3 failed
📋 Sheet: Import
```

### Error Notification

```
⚠️ Signup Error
📧 Invalid email format
💡 Validation Error
```

## Customizing Notifications

The Discord notification format is determined by the `sendDiscordNotification` function in `src/services/discord.ts`. You can customize:

### Change the Notification Format

Edit `src/services/discord.ts` to modify the embed structure:

```typescript
export async function sendDiscordNotification(
  data: DiscordNotificationData,
): Promise<void> {
  // Customize the embed fields
  const embed = {
    title: data.type === "error" ? "⚠️ Signup Error" : "🎉 New Signup!",
    color: data.type === "error" ? 0xff0000 : 0x00ff00,
    fields: [
      {
        name: "Email",
        value: data.email,
        inline: true,
      },
      // Add your custom fields here
    ],
    // ... rest of the embed
  };
}
```

### Add Custom Fields

You can extend the notification with additional information:

```typescript
// Add UTM tracking information
if (data.metadata?.utm_source) {
  fields.push({
    name: "UTM Source",
    value: data.metadata.utm_source,
    inline: true,
  });
}

// Add IP address (if available)
if (data.ip) {
  fields.push({
    name: "IP Address",
    value: data.ip,
    inline: true,
  });
}
```

## Security Best Practices

### 1. Never Commit Webhook URLs

Always add `.env` to `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
```

### 2. Use Environment-Specific Webhooks

Use different webhooks for different environments:

```bash
# Development - use a test channel
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/dev-webhook-id/dev-token

# Production - use the main channel
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/prod-webhook-id/prod-token
```

### 3. Rotate Webhooks Regularly

If your webhook URL is compromised:
1. Delete the old webhook in Discord
2. Create a new webhook
3. Update your `.env` file
4. Restart the server

### 4. Limit Webhook Permissions

- Create a dedicated channel for notifications
- Limit who can create/manage webhooks
- Use role permissions to control who can view the channel

## Troubleshooting

### No Notifications Appearing

**Check 1**: Verify the webhook URL is correct

```bash
# Test the webhook URL directly
curl -X POST $DISCORD_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"content": "Test message"}'
```

**Check 2**: Verify the environment variable is loaded

```bash
# Check if the variable is set
echo $DISCORD_WEBHOOK_URL

# Check server logs for errors
bun run dev
```

**Check 3**: Check Discord webhook permissions

1. Go to Server Settings > Integrations
2. Find your webhook
3. Verify it has permission to post in the channel

### Rate Limit Errors

Discord allows up to **30 webhook requests per 60 seconds**. If you're sending too many notifications:

**Solution 1**: Use a queue system for high-volume signups

**Solution 2**: Aggregate notifications

```typescript
// Instead of sending each signup immediately,
// collect signups and send them in batches
```

### Webhook Returns 404 Not Found

**Cause**: The webhook was deleted or the URL is incorrect.

**Solution**:
1. Verify the webhook still exists in Discord
2. Create a new webhook if needed
3. Update the `DISCORD_WEBHOOK_URL` in your `.env` file

### Notifications Include Sensitive Information

**Problem**: Webhook notifications might include user data.

**Solutions**:
1. Create a private channel for notifications
2. Customize the notification format to exclude sensitive data
3. Use role permissions to restrict who can view the channel

## Advanced Configuration

### Multiple Webhooks

To send notifications to multiple channels, modify the Discord service:

```typescript
// src/services/discord.ts
const WEBHOOKS = [
  process.env.DISCORD_WEBHOOK_URL,
  process.env.DISCORD_WEBHOOK_URL_ADMIN, // Admin channel
].filter(Boolean) as string[];

export async function sendDiscordNotification(
  data: DiscordNotificationData,
): Promise<void> {
  await Promise.all(
    WEBHOOKS.map((webhook) => fetch(webhook, { /* ... */ }))
  );
}
```

### Conditional Notifications

Send notifications only for specific types of signups:

```typescript
export async function sendDiscordNotification(
  data: DiscordNotificationData,
): Promise<void> {
  // Only notify for specific sources
  if (data.source === "newsletter") {
    await sendNotification(data);
  }
}
```

### Rich Embeds

Create more detailed notifications with Discord embeds:

```typescript
const embed = {
  title: "🎉 New Signup!",
  description: "A new user has signed up!",
  color: 0x5865f2, // Discord blurple color
  fields: [
    {
      name: "User Information",
      value: `**Email**: ${data.email}\n**Name**: ${data.name || "N/A"}`,
      inline: true,
    },
    {
      name: "Signup Details",
      value: `**Source**: ${data.source || "N/A"}\n**Tags**: ${data.tags?.join(", ") || "None"}`,
      inline: true,
    },
  ],
  footer: {
    text: `Sheet: ${data.sheetTab}`,
  },
  timestamp: new Date().toISOString(),
};
```

## Testing Discord Webhooks

### Using Discord Webhook Tester

1. Go to https://discord.com/developers/docs/resources/webhook#execute-webhook
2. Enter your webhook URL
3. Send a test POST request

### Using an Online Tool

Use a tool like [Webhook.site](https://webhook.site/) to test your webhook URL:

1. Get a webhook URL from Webhook.site
2. Set it as your `DISCORD_WEBHOOK_URL`
3. Trigger a signup
4. Check Webhook.site for the request payload

## Next Steps

- **[Google Sheets Setup](/guide/google-sheets)** - Configure Google Sheets integration
- **[HTML Form Integration](/guide/integration)** - Embed forms on your website
- **[Deployment](/guide/deployment)** - Deploy your API to production
