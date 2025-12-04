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
  
  // Logo as data URI for maximum email client compatibility
  // SVG encoded for email (works in most modern email clients)
  const logoDataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 43" width="140" height="27">
      <g transform="translate(0, 1)">
        <path d="M39.8278 33.3026L39.8308 33.3061L33.3607 38.9831C32.0341 40.1758 30.3188 40.8515 28.5307 40.8849L28.5157 40.8852H6.3433C5.52252 40.9197 4.70461 40.766 3.9529 40.4361C3.18789 40.1004 2.51205 39.5912 1.97981 38.9489C1.44755 38.3069 1.07385 37.55 0.888129 36.7388C0.705857 35.9416 0.709812 35.1125 0.900558 34.3168L2.60764 25.6248C2.75949 24.8681 3.16084 24.1833 3.74828 23.6792L3.83198 23.6074C3.65027 23.3331 3.51734 23.0292 3.43941 22.709C3.33602 22.2843 3.3324 21.8424 3.42763 21.4174L5.13811 12.7091L5.14074 12.6968C5.47362 11.1342 6.31209 9.72339 7.52782 8.68041L13.4516 3.48275C13.7257 3.16967 14.0266 2.87803 14.3521 2.61141C15.6488 1.54924 17.2624 0.944386 18.9409 0.890845L18.9688 0.889954L41.1681 0.953502C41.988 0.919415 42.8049 1.07313 43.5558 1.40267C44.3209 1.73844 44.9967 2.24759 45.5289 2.88973C46.0611 3.53177 46.4349 4.28874 46.6206 5.10019C46.8031 5.89771 46.7988 6.72616 46.6084 7.52144L42.3681 29.1669L42.362 29.1933C41.9896 30.8017 41.0994 32.2445 39.8278 33.3026Z" fill="#03301D"/>
        <path d="M40.8216 2.95355C41.4048 2.92412 41.9868 3.03161 42.5211 3.26725C43.0554 3.50288 43.5272 3.86014 43.8988 4.31063C44.2703 4.76113 44.5313 5.29225 44.661 5.86162C44.7906 6.43099 44.7853 7.02284 44.6454 7.58977L40.4233 29.2491C40.1268 30.536 39.4127 31.6886 38.3925 32.5273C37.3723 33.3659 36.1032 33.8434 34.7832 33.8853H12.6929C12.1096 33.9143 11.5275 33.8068 10.993 33.5712C10.4585 33.3356 9.98642 32.9785 9.61431 32.5282C9.24221 32.078 8.98033 31.5471 8.84959 30.9778C8.71885 30.4086 8.72283 29.8165 8.86121 29.2491L10.566 20.4866C10.6659 20.0589 10.9045 19.6763 11.2445 19.3983C11.5845 19.1202 12.0069 18.9623 12.446 18.9492C16.4769 19.0926 20.3485 19.3952 23.9572 20.6937L24.7538 25.7043C24.7733 25.8253 24.8371 25.9346 24.9328 26.0112C25.0285 26.0877 25.1492 26.126 25.2716 26.1185C25.4122 26.1161 25.5496 26.0765 25.6699 26.0038C25.7902 25.931 25.8892 25.8277 25.9567 25.7043L28.6811 20.6937L34.13 18.9731C34.2618 18.9309 34.3804 18.8551 34.474 18.7532C34.5676 18.6512 34.633 18.5266 34.6637 18.3916C34.6949 18.2723 34.6802 18.1456 34.6228 18.0365C34.5653 17.9274 34.4691 17.8439 34.353 17.8021L29.5733 16.0894L28.7767 11.079C28.7573 10.9573 28.6938 10.847 28.5983 10.7691C28.5028 10.6913 28.382 10.6513 28.2589 10.6567C28.1175 10.66 27.9795 10.7008 27.8591 10.775C27.7387 10.8492 27.6402 10.9541 27.5738 11.079L24.8494 16.0894C20.8987 17.2226 16.8109 17.8071 12.7009 17.8261C12.5036 17.8429 12.3052 17.8124 12.1219 17.7376C11.9386 17.6627 11.7757 17.5456 11.6466 17.3955C11.5175 17.2454 11.4259 17.0667 11.3793 16.8743C11.3327 16.6819 11.3324 16.481 11.3785 16.2885L13.0833 7.52598C13.3782 6.23972 14.0907 5.0873 15.1096 4.2486C16.1285 3.40989 17.3964 2.93224 18.7154 2.88995L40.8216 2.95355Z" fill="#86EE02"/>
      </g>
      <g transform="translate(53, 9)">
        <path fill="#03301D" d="M14.40 25.49L14.40 25.49Q10.90 25.49 8.92 24.05Q6.95 22.62 6.95 20.10L6.95 20.10Q6.95 18.49 7.79 17.34Q8.63 16.18 10.30 15.44Q11.98 14.71 14.54 14.50L14.54 14.50L21.19 13.80Q22.00 13.73 22.40 13.40Q22.80 13.06 22.80 12.54L22.80 12.54L22.80 12.50Q22.80 11.87 22.28 11.44Q21.75 11.00 20.82 10.77Q19.90 10.54 18.60 10.54L18.60 10.54Q16.64 10.54 15.52 10.98Q14.40 11.42 14.16 12.29L14.16 12.29L7.79 12.29Q8.13 10.40 9.50 9.13Q10.87 7.85 13.19 7.18Q15.52 6.52 18.74 6.52L18.74 6.52Q22.28 6.52 24.59 7.27Q26.90 8.02 28.05 9.56Q29.21 11.10 29.21 13.45L29.21 13.45L29.21 25L23.12 25L23.12 19.75L23.78 20.55Q22.98 22.20 21.68 23.29Q20.39 24.37 18.58 24.93Q16.78 25.49 14.40 25.49ZM16.71 21.29L16.71 21.29Q18.01 21.29 19.11 20.96Q20.21 20.63 21.05 20.05Q21.89 19.47 22.35 18.70Q22.80 17.93 22.80 17.05L22.80 17.05L22.80 14.71L23.82 16.18Q23.29 16.49 22.42 16.74Q21.54 16.98 20.14 17.16L20.14 17.16L15.59 17.72Q14.54 17.86 14.03 18.26Q13.53 18.66 13.53 19.40L13.53 19.40Q13.53 20.27 14.35 20.78Q15.17 21.29 16.71 21.29ZM38.73 25L32.32 25L32.32 7.01L38.73 7.01L38.73 25ZM38.76 4.84L32.29 4.84L32.29 0.01L38.76 0.01L38.76 4.84ZM53.57 25.49L53.57 25.49Q49.68 25.49 46.97 24.30Q44.26 23.11 42.82 20.96Q41.38 18.80 41.38 16.00L41.38 16.00Q41.38 14.29 41.89 12.84Q42.40 11.38 43.43 10.21Q44.47 9.04 45.94 8.22Q47.41 7.39 49.33 6.96Q51.26 6.52 53.57 6.52L53.57 6.52Q57.03 6.52 59.50 7.32Q61.97 8.13 63.38 9.65Q64.80 11.17 65.15 13.38L65.15 13.38L58.50 13.38Q58.19 12.64 57.48 12.12Q56.79 11.59 55.81 11.31Q54.83 11.03 53.53 11.03L53.53 11.03Q52.41 11.03 51.50 11.26Q50.59 11.49 49.93 11.94Q49.26 12.40 48.82 13.01Q48.39 13.62 48.16 14.38Q47.93 15.13 47.93 16.00L47.93 16.00Q47.93 17.41 48.54 18.54Q49.16 19.68 50.40 20.33Q51.64 20.98 53.53 20.98L53.53 20.98Q55.45 20.98 56.68 20.29Q57.91 19.61 58.50 18.66L58.50 18.66L65.15 18.66Q64.84 20.73 63.40 22.25Q61.97 23.77 59.50 24.63Q57.03 25.49 53.57 25.49ZM74.53 25.49L74.53 25.49Q71.03 25.49 69.05 24.05Q67.07 22.62 67.07 20.10L67.07 20.10Q67.07 18.49 67.91 17.34Q68.75 16.18 70.44 15.44Q72.11 14.71 74.67 14.50L74.67 14.50L81.32 13.80Q82.13 13.73 82.53 13.40Q82.93 13.06 82.93 12.54L82.93 12.54L82.93 12.50Q82.93 11.87 82.41 11.44Q81.88 11.00 80.95 10.77Q80.02 10.54 78.73 10.54L78.73 10.54Q76.77 10.54 75.65 10.98Q74.53 11.42 74.28 12.29L74.28 12.29L67.91 12.29Q68.27 10.40 69.63 9.13Q70.99 7.85 73.32 7.18Q75.65 6.52 78.87 6.52L78.87 6.52Q82.41 6.52 84.72 7.27Q87.03 8.02 88.18 9.56Q89.33 11.10 89.33 13.45L89.33 13.45L89.33 25L83.25 25L83.25 19.75L83.91 20.55Q83.10 22.20 81.81 23.29Q80.52 24.37 78.71 24.93Q76.91 25.49 74.53 25.49ZM76.84 21.29L76.84 21.29Q78.13 21.29 79.24 20.96Q80.34 20.63 81.18 20.05Q82.02 19.47 82.47 18.70Q82.93 17.93 82.93 17.05L82.93 17.05L82.93 14.71L83.94 16.18Q83.42 16.49 82.55 16.74Q81.67 16.98 80.27 17.16L80.27 17.16L75.72 17.72Q74.67 17.86 74.16 18.26Q73.66 18.66 73.66 19.40L73.66 19.40Q73.66 20.27 74.48 20.78Q75.30 21.29 76.84 21.29ZM98.82 25L92.41 25L92.41 0.01L98.82 0.01L98.82 25ZM108.55 25L102.14 25L102.14 0.01L108.55 0.01L108.55 25ZM118.98 25L112.26 25L112.26 18.31L118.98 18.31L118.98 25ZM138.23 25L131.83 25Q128.96 25 127.28 23.46Q125.59 21.92 125.59 19.16L125.59 19.16L125.59 2.14L132 2.14L132 18.11Q132 19.40 132.68 20.10Q133.37 20.80 134.69 20.80L134.69 20.80L138.23 20.80L138.23 25ZM126.16 11.14L121.43 11.14L121.43 7.01L126.16 7.01L126.16 11.14ZM138.23 11.14L131.44 11.14L131.44 7.01L138.23 7.01L138.23 11.14ZM156.12 25L148.87 25L139.42 7.01L146.59 7.01L153.77 21.75L151.95 21.75L159.16 7.01L165.57 7.01L156.12 25Z"/>
      </g>
    </svg>
  `);
  
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
                <img src="${logoDataUri}" alt="aicall.tv" width="140" height="27" style="display: block; border: 0; max-width: 140px; height: auto;">
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

