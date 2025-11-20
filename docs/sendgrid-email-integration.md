# SendGrid Email Integration

## Overview

This document explains the SendGrid transactional email integration for the Quadball Canada platform, including setup instructions, templates, and usage examples.

## Implementation Status

- **Status**: ✅ Complete (January 2025)
- **Package**: @sendgrid/mail v8.1.0
- **Type**: Transactional emails only
- **Environments**: Mock (development), Real (production)

## Environment Variables

### Required for Production

- `SENDGRID_API_KEY` - Your SendGrid API key
- `SENDGRID_FROM_EMAIL` - Verified sender email address
- `SENDGRID_FROM_NAME` - Sender display name (default: "Quadball Canada")

### Example Configuration

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@quadballcanada.com
SENDGRID_FROM_NAME=Quadball Canada
```

## Code Architecture

### Service Pattern

The email integration uses a service pattern with environment-based switching:

```typescript
// src/lib/email/types.ts - Common types and interfaces
interface EmailService {
  send(params: SendEmailParams): Promise<EmailResult>;
}

// src/lib/email/sendgrid-service.ts - Real SendGrid implementation
// src/lib/email/mock-email-service.ts - Mock for development
// src/lib/email/sendgrid.ts - Service factory with convenience methods
```

### Key Files

- **Service Layer**:
  - `src/lib/email/sendgrid.ts` - Main service with convenience methods
  - `src/lib/email/sendgrid-service.ts` - SendGrid SDK implementation
  - `src/lib/email/mock-email-service.ts` - Development mock
  - `src/lib/email/types.ts` - TypeScript types and Zod schemas
  - `src/lib/email/templates/*.ts` - Email templates

- **Integration Points**:
  - `src/features/membership/membership.mutations.ts` - Sends purchase receipts
  - Future: Auth system for password resets
  - Future: Teams for invitations

## Email Templates

### Available Templates

1. **Membership Purchase Receipt** (`membership-receipt.ts`)
   - Sent after successful membership purchase
   - Includes: membership type, price, expiry date
   - Receipt formatting

2. **Welcome Email** (`welcome.ts`)
   - Sent to new users after registration
   - Includes: getting started guide, important links

3. **Password Reset** (`password-reset.ts`)
   - Template ready for future auth integration
   - Includes: reset link, security notice

4. **Team Invitation** (`team-invitation.ts`)
   - Template ready for teams feature
   - Includes: team details, accept/decline links

5. **Event Confirmation** (`event-confirmation.ts`)
   - Template ready for events feature
   - Includes: event details, calendar attachment support

### Template Structure

Each template exports HTML and text versions:

```typescript
export const membershipReceiptTemplate = {
  subject: (data: MembershipReceiptData) => string,
  html: (data: MembershipReceiptData) => string,
  text: (data: MembershipReceiptData) => string,
};
```

## Usage Examples

### Basic Email Send

```typescript
import { emailService } from "~/lib/email/sendgrid";

const result = await emailService.send({
  to: ["user@example.com"],
  subject: "Test Email",
  html: "<p>Hello World</p>",
  text: "Hello World",
});
```

### Convenience Methods

```typescript
// Send membership purchase receipt
await sendMembershipPurchaseReceipt({
  to: user.email,
  userName: user.name || user.email,
  membershipType: "Annual Player Membership",
  amount: "$45.00",
  expiryDate: "December 31, 2025",
  receiptNumber: "QC-2025-001234",
});

// Send welcome email
await sendWelcomeEmail({
  to: user.email,
  userName: user.name || "Member",
});
```

## Development Mode

When `SENDGRID_API_KEY` is not set, the mock service is used:

- Emails are logged to console with full details
- No actual emails are sent
- Success is always returned
- Useful for local development and testing

Example console output:

```
[Mock Email Service] Would send email:
From: Quadball Canada <noreply@quadballcanada.com>
To: user@example.com
Subject: Welcome to Quadball Canada!
[HTML and text content displayed]
```

## Testing

### Unit Tests

```bash
pnpm test src/lib/email/__tests__/
```

### Integration Testing

1. Set `SENDGRID_API_KEY` in `.env.local`
2. Use a test email address
3. Verify email delivery in SendGrid dashboard

## SendGrid Setup

### 1. Create SendGrid Account

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Complete sender verification
3. Generate API key with "Mail Send" permission

### 2. Verify Sender

1. Go to Settings > Sender Authentication
2. Verify your sending domain or email
3. Complete DNS verification (recommended)

### 3. Configure Environment

```bash
# Add to .env.local or Netlify environment
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=verified-email@yourdomain.com
SENDGRID_FROM_NAME=Quadball Canada
```

## Best Practices

1. **Always use templates** - Don't hardcode email content
2. **Include text version** - Better deliverability and accessibility
3. **Test in development** - Use mock service to preview emails
4. **Monitor delivery** - Check SendGrid dashboard for bounces/spam
5. **Handle failures gracefully** - Email sending is not guaranteed

## Troubleshooting

### Email Not Received

1. Check SendGrid dashboard for delivery status
2. Verify sender authentication is complete
3. Check spam folder
4. Review SendGrid activity feed for errors

### API Key Issues

- Ensure API key has "Mail Send" permission
- Check key hasn't been revoked
- Verify environment variable is loaded

### Template Rendering Issues

- Test templates with mock service first
- Validate all required data is provided
- Check for HTML escaping issues

## Future Enhancements

1. **Dynamic Templates**: Use SendGrid's template engine
2. **Attachments**: Add calendar invites for events
3. **Bulk Sending**: Newsletter functionality
4. **Analytics**: Track open rates and clicks
5. **Unsubscribe**: Preference center integration
