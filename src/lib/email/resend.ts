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
  
  // Use text-based logo for maximum email client compatibility
  // SVG data URIs are not well supported in many email clients
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>your video is ready</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #ffffff;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff;">
          <tr>
            <td align="center" style="padding: 40px 20px 30px;">
              <!-- Logo -->
              <a href="${env.VITE_BASE_URL}" style="text-decoration: none; display: inline-block;">
                <h1 style="font-size: 24px; font-weight: 700; color: #03301D; margin: 0; letter-spacing: -0.5px;">aicall.tv</h1>
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background-color: #ffffff;">
                <tr>
                  <td style="padding: 0 0 30px;">
                    <h1 style="font-size: 28px; font-weight: 600; color: #03301D; margin: 0 0 20px 0; line-height: 1.3; text-transform: lowercase;">your video is ready</h1>
                    <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">hi ${firstName},</p>
                    <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">your video has been generated successfully. you can download it using the button below or view it in your account dashboard.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 30px;">
                    <table cellpadding="0" cellspacing="0" style="margin: 0;">
                      <tr>
                        <td style="background-color: #03301D; border-radius: 8px;">
                          <a href="${videoUrl}" 
                             style="display: inline-block; padding: 16px 32px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px; text-transform: lowercase;">
                            download video
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 0 40px;">
                    <p style="margin: 0; color: #4a4a4a; font-size: 16px;">
                      <a href="${dashboardUrl}" style="color: #03301D; text-decoration: underline; font-weight: 500; text-transform: lowercase;">view in dashboard</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 30px 20px; border-top: 1px solid #e5e5e5;">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto;">
                <tr>
                  <td style="padding: 0 0 15px;">
                    <p style="margin: 0; color: #8a8a8a; font-size: 13px; line-height: 1.5;">
                      you received this email because you requested a video from aicall.tv.
                      if you did not make this request, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0;">
                    <p style="margin: 0; color: #8a8a8a; font-size: 13px; text-transform: lowercase;">
                      <a href="${env.VITE_BASE_URL}" style="color: #03301D; text-decoration: none; font-weight: 500;">aicall.tv</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  await sendEmail({
    to: userEmail,
    subject: "your video is ready",
    html,
  });
}

