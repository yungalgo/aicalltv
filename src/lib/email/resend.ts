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
    // Always use the verified domain email
    // Make sure DNS is configured in Resend dashboard: https://resend.com/domains
    const fromEmail = options.from || "aicall.tv <noreply@aicall.tv>";

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
 * Optimized to avoid spam filters:
 * - No emojis in subject line
 * - Professional tone
 * - Proper HTML structure
 * - Clear sender identity
 * - No spam trigger words
 */
export async function sendVideoReadyEmail(
  userEmail: string,
  userName: string,
  videoUrl: string,
  dashboardUrl: string,
): Promise<void> {
  // Clean first name only for personalization
  const firstName = userName.split(" ")[0] || "there";
  
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your video is ready</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
          <tr>
            <td style="padding: 20px 0; border-bottom: 1px solid #e5e5e5;">
              <strong style="font-size: 18px; color: #1a1a1a;">aicall.tv</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 0;">
              <h1 style="font-size: 24px; font-weight: 600; color: #1a1a1a; margin: 0 0 20px 0;">Your video is ready to download</h1>
              <p style="margin: 0 0 20px 0; color: #4a4a4a;">Hi ${firstName},</p>
              <p style="margin: 0 0 25px 0; color: #4a4a4a;">Your video has been generated successfully. You can download it using the button below or view it in your account dashboard.</p>
              <table cellpadding="0" cellspacing="0" style="margin: 25px 0;">
                <tr>
                  <td style="background-color: #1a1a1a; border-radius: 6px;">
                    <a href="${videoUrl}" 
                       style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 14px;">
                      Download Video
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 25px 0 0 0; color: #4a4a4a;">
                <a href="${dashboardUrl}" style="color: #1a1a1a; text-decoration: underline;">View in Dashboard</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 0; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #8a8a8a; font-size: 12px;">
                You received this email because you requested a video from aicall.tv.
                If you did not make this request, you can safely ignore this email.
              </p>
              <p style="margin: 10px 0 0 0; color: #8a8a8a; font-size: 12px;">
                aicall.tv
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: "Your video is ready to download",
    html,
  });
}

