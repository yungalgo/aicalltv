# External Integrations

This document covers all external service integrations for the Quadball Canada platform.

## Square Payments

**Status**: ⏳ Planned

### Configuration

Environment variables required:

```bash
SQUARE_APPLICATION_ID=    # From Square dashboard
SQUARE_ACCESS_TOKEN=      # API access token
SQUARE_LOCATION_ID=       # Default location
SQUARE_WEBHOOK_SIGNATURE_KEY= # For webhook validation
```

### Planned Implementation

**Core Logic**: `src/lib/payments/square.ts` (not yet created)

- Client initialization
- Checkout session creation
- Webhook signature validation

**Webhook Handler**: `src/routes/api/webhooks/square.ts` (not yet created)

- Process payment confirmations
- Update database records
- Trigger email confirmations

### Key Features

1. **Hosted Checkout**: PCI-compliant payment page
2. **Canadian Support**: Full support for CAD payments
3. **Webhook Security**: Cryptographic signature validation
4. **Refunds**: API integration for processing refunds

## E-transfer Payments

**Status**: ⏳ Planned

### Configuration

```bash
ETRANSFER_EMAIL=treasurer@quadballcanada.ca  # Receiving email
ETRANSFER_NOTIFICATION_EMAIL=admin@quadballcanada.ca # Admin notifications
```

### Implementation Approach

1. **User Flow**:
   - User selects e-transfer at checkout
   - System generates unique reference number
   - Email sent with payment instructions
   - Admin manually confirms receipt
   - System updates payment status

2. **Security**:
   - Unique reference per transaction
   - Manual verification required
   - Audit trail of confirmations

## SendGrid Email

**Status**: ⏳ Planned

### Configuration

```bash
SENDGRID_API_KEY=         # API key from SendGrid
SENDGRID_WEBHOOK_KEY=     # Webhook verification
SENDGRID_FROM_EMAIL=noreply@quadballcanada.ca
SENDGRID_FROM_NAME=Quadball Canada
```

### Planned Implementation

**Service Location**: `src/lib/email/sendgrid.ts` (not yet created)

**Email Types**:

1. **Transactional**:
   - Welcome emails
   - Payment confirmations
   - Event registrations
   - Password resets

2. **Marketing**:
   - Event announcements
   - Newsletter
   - Member updates

**Templates**: Will be managed in SendGrid dashboard for easy updates without code changes.

## Cloudinary Media Storage

**Status**: ⏳ Planned

### Configuration

```bash
CLOUDINARY_CLOUD_NAME=    # Account identifier
CLOUDINARY_API_KEY=       # API credentials
CLOUDINARY_API_SECRET=    # Secret key
```

### Planned Usage

1. **Team Logos**: Automatic resizing and optimization
2. **Event Photos**: Gallery management
3. **User Avatars**: Privacy-aware storage
4. **Documents**: Secure PDF storage for waivers

## Social Media APIs

**Status**: ⏳ Planned

### Planned Integrations

1. **Instagram Basic Display API**:
   - Embed recent posts
   - Show event highlights
   - No user data collection

2. **Facebook Page API**:
   - Event cross-posting
   - Page feed display

## Development Guidelines

### Adding New Integrations

1. **Environment Variables**:
   - Add to `.env.example` with clear descriptions
   - Document in this file
   - Add validation in `src/lib/env.server.ts`

2. **Service Wrapper**:
   - Create typed wrapper in `src/lib/[service-name]/`
   - Include error handling and logging
   - Write unit tests for critical paths

3. **Webhook Handlers**:
   - Always validate signatures
   - Use database transactions
   - Log all events for debugging

4. **Documentation**:
   - Update this file with configuration steps
   - Add integration guide if complex
   - Include troubleshooting section

### Security Best Practices

1. **API Keys**: Never commit to repository
2. **Webhooks**: Always validate signatures
3. **Rate Limiting**: Implement for all external calls
4. **Error Handling**: Never expose internal errors to users
5. **Logging**: Track all external API interactions

## Monitoring

All integrations should report to application monitoring:

```typescript
// Example integration wrapper
async function callExternalAPI() {
  const start = Date.now();
  try {
    const result = await externalAPI.call();
    metrics.record("external_api.success", Date.now() - start);
    return result;
  } catch (error) {
    metrics.record("external_api.error", Date.now() - start);
    logger.error("External API failed", { error });
    throw new ExternalServiceError("Service temporarily unavailable");
  }
}
```

## Troubleshooting

### Square Payments

- **Webhook not received**: Check signature key configuration
- **Payment failed**: Review Square dashboard for details
- **Sandbox testing**: Use test card numbers from Square docs

### Email Delivery

- **Emails not sending**: Verify API key and sender domain
- **Spam folder**: Check SPF/DKIM records
- **Rate limits**: Implement queuing for bulk sends

### Media Upload

- **Upload fails**: Check file size limits
- **Transformation errors**: Verify format support
- **Slow loading**: Enable CDN caching
