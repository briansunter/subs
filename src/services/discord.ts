/**
 * Discord webhook service for sending notifications
 */

import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("discord");

/**
 * Discord webhook payload interface
 */
interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
}

interface DiscordWebhookPayload {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Send notification to Discord webhook
 * @param payload - The webhook payload to send
 * @param webhookUrl - The Discord webhook URL (optional, skips sending if not provided)
 */
export async function sendDiscordNotification(
  payload: DiscordWebhookPayload,
  webhookUrl?: string,
): Promise<void> {
  if (!webhookUrl) {
    logger.debug("Discord webhook URL not configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Discord webhook returned error");
      throw new Error(`Discord webhook failed: ${response.status}`);
    }

    logger.info("Successfully sent Discord notification");
  } catch (error) {
    logger.error({ error }, "Failed to send Discord notification");
    // Don't throw error - Discord notifications should be non-blocking
  }
}

/**
 * Send signup notification to Discord
 * @param data - Signup data to include in notification
 * @param webhookUrl - The Discord webhook URL (optional)
 */
export async function sendSignupNotification(
  data: {
    email: string;
    sheetTab: string;
    name?: string;
    source?: string;
    tags?: string[];
  },
  webhookUrl?: string,
): Promise<void> {
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Email", value: data.email, inline: true },
    { name: "Sheet Tab", value: data.sheetTab, inline: true },
  ];

  if (data.name) {
    fields.push({ name: "Name", value: data.name, inline: true });
  }

  if (data.source) {
    fields.push({ name: "Source", value: data.source, inline: true });
  }

  if (data.tags && data.tags.length > 0) {
    fields.push({ name: "Tags", value: data.tags.join(", "), inline: false });
  }

  const embed: DiscordEmbed = {
    title: "🎉 New Signup!",
    description: "A new user has signed up",
    color: 5763719, // Green color
    fields,
    timestamp: new Date().toISOString(),
  };

  await sendDiscordNotification(
    {
      username: "Signup Bot",
      embeds: [embed],
    },
    webhookUrl,
  );
}

/**
 * Send error notification to Discord
 * @param error - Error data to include in notification
 * @param webhookUrl - The Discord webhook URL (optional)
 */
export async function sendErrorNotification(
  error: {
    message: string;
    context?: Record<string, unknown>;
  },
  webhookUrl?: string,
): Promise<void> {
  const embed: DiscordEmbed = {
    title: "❌ Signup Error",
    description: error.message,
    color: 15548997, // Red color
    timestamp: new Date().toISOString(),
  };

  if (error.context) {
    embed.fields = Object.entries(error.context).map(([key, value]) => ({
      name: key,
      value: String(value),
      inline: true,
    }));
  }

  await sendDiscordNotification(
    {
      username: "Signup Bot",
      embeds: [embed],
    },
    webhookUrl,
  );
}
