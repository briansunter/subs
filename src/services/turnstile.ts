/**
 * Cloudflare Turnstile verification service
 */

import { z } from "zod";
import { createChildLogger } from "../utils/logger";

const logger = createChildLogger("turnstile");

/**
 * Turnstile siteverify API response interface
 */
interface TurnstileSiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  challenge_ts?: string;
}

const TurnstileSiteverifyResponseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
  hostname: z.string().optional(),
  challenge_ts: z.string().optional(),
});

/**
 * Turnstile verification result interface
 */
export interface TurnstileVerifyResponse {
  success: boolean;
  hostname?: string;
  error?: string;
}

/**
 * Verify a Turnstile token with Cloudflare's siteverify API
 * @param token - The Turnstile token to verify
 * @param secretKey - The Turnstile secret key
 * @returns Verification result with success status, hostname, and optional error
 */
export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
): Promise<TurnstileVerifyResponse> {
  try {
    logger.debug("Verifying Turnstile token");

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, "Turnstile API returned error");
      return {
        success: false,
        error: `API returned error: ${response.status} ${response.statusText}`,
      };
    }

    const json = await response.json();
    const data: TurnstileSiteverifyResponse = TurnstileSiteverifyResponseSchema.parse(json);

    if (data.success) {
      logger.info({ hostname: data.hostname }, "Turnstile token verified successfully");
      return {
        success: true,
        hostname: data.hostname,
      };
    }

    logger.warn(
      { errorCodes: data["error-codes"], hostname: data.hostname },
      "Turnstile token verification failed",
    );

    return {
      success: false,
      hostname: data.hostname,
      error: data["error-codes"]?.join(", ") || "Verification failed",
    };
  } catch (error) {
    logger.error({ error }, "Failed to verify Turnstile token");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
