/**
 * Resend email integration for sending notifications
 */

import { Resend } from "resend";
import { env } from "~/env/server";

let resendClient: Resend | null = null;

/**
 * Get Resend client instance
 */
function getResendClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send email using Resend SDK
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const resend = getResendClient();
  
  if (!resend) {
    console.warn("[Resend] API key not configured. Email not sent.");
    return;
  }

  try {
    // Use provided from, or default to Resend test email for development
    // For production, verify your domain in Resend and use your domain email
    const fromEmail = options.from || (process.env.NODE_ENV === "production" 
      ? "AI Call TV <noreply@aicall.tv>"
      : "onboarding@resend.dev");

    const result = await resend.emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${JSON.stringify(result.error)}`);
    }

    console.log(`[Resend] ✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error("[Resend] Error sending email:", error);
    throw error;
  }
}

/**
 * Send video ready notification email
 */
export async function sendVideoReadyEmail(
  userEmail: string,
  userName: string,
  videoUrl: string,
  dashboardUrl: string,
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2563eb;">Your Video is Ready! 🎬</h1>
        <p>Hi ${userName},</p>
        <p>Great news! Your video has been generated and is ready to view.</p>
        <div style="margin: 30px 0;">
          <a href="${videoUrl}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Download Video
          </a>
        </div>
        <p>Or view it on your dashboard:</p>
        <p><a href="${dashboardUrl}" style="color: #2563eb;">View Dashboard →</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from AI Call TV.
        </p>
      </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: "Your Video is Ready! 🎬",
    html,
  });
}

