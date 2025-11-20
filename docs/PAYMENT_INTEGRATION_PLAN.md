# Payment Integration Plan

Based on thirdweb documentation and requirements.

## Architecture Overview

**Payment Flow:**
1. User fills call request form
2. User selects payment method (Free, Credit Card, Crypto)
3. Payment processed → Webhook triggered
4. Call record created in database
5. Call processing begins

## Phase 1: MVP (Dummy Payment)

**Current Implementation:**
- Dummy "Pay" button that simulates payment
- Creates call record directly in database
- No actual payment processing

**Payment Model:** Pay-per-call ($5 per call, not a subscription)
- User pays → Call is submitted for processing
- Each call is a one-time payment
- No recurring charges

**Use Case:** Testing form flow and call creation

## Phase 2: Stripe Integration (Credit Cards)

**Based on thirdweb docs:**
- Use Stripe Payment Intents API
- Frontend: Stripe Elements for card input
- Backend: Create payment intent → Get client secret
- Webhook: Listen for `charge.succeeded` event
- On success: Create call record via server function

**Implementation:**
1. Install `stripe` and `@stripe/stripe-js`
2. Create `/api/stripe/intent` route (create payment intent)
3. Create `/api/stripe/webhook` route (handle payment success)
4. Frontend: Stripe Elements component
5. On payment success → Call server function to create call

**Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Note:** Requires Stripe account setup. This is pay-per-call ($5 per call), not a subscription model.

## Phase 3: thirdweb Pay (Crypto Payments)

**Based on thirdweb docs:**
- Use thirdweb Pay SDK for crypto payments
- Support multiple chains (Ethereum, Polygon, Solana, etc.)
- Auto-creates wallets for non-crypto users
- Handles onramping (fiat → crypto)

**Implementation:**
1. Install `@thirdweb-dev/react` and `@thirdweb-dev/sdk`
2. Set up thirdweb Provider
3. Use `PayEmbed` or `BuyWidget` component
4. Listen for payment success events
5. On success → Call server function to create call

**Environment Variables:**
```env
THIRDWEB_CLIENT_ID=...
THIRDWEB_SECRET_KEY=...
```

## Phase 3.5: thirdweb x402 (Internet Native Payments)

**Based on thirdweb docs:**
- Use thirdweb x402 for internet-native payments
- Unified payment solution supporting crypto
- Integrates with thirdweb Pay infrastructure
- Supports both credit card and crypto payments in one solution

**TODO:** Research x402 API and integration requirements
**Status:** ⏳ Planned for later phase (after Stripe and thirdweb Pay)

**Note:** x402 may replace or complement Stripe + thirdweb Pay setup

## Phase 4: thirdweb Engine (On-Chain Settlement)

**For Ztarknet contract settlement:**
- Use thirdweb Engine for on-chain transactions
- After payment → Engine calls Ztarknet contract
- Contract receives ZEC payment
- Webhook confirms settlement

**Implementation:**
1. Set up thirdweb Engine instance
2. Deploy Ztarknet contract (Cairo)
3. Create Engine endpoint: `/api/engine/settle`
4. On payment success → Call Engine → Settle to contract

**Environment Variables:**
```env
THIRDWEB_ENGINE_URL=...
THIRDWEB_ENGINE_ACCESS_TOKEN=...
THIRDWEB_BACKEND_WALLET_ADDRESS=...
```

## Payment Methods Supported

### MVP (Phase 1)
- ✅ **Free** - Check `freeCallCredits`, decrement if available
- ✅ **Dummy Payment** - Simulates payment, creates call immediately

### Phase 2
- ✅ **Credit Card** - Stripe integration
- ✅ **Free Credits** - Check user credits

### Phase 3
- ✅ **Crypto** - thirdweb Pay (multiple chains)
- ✅ **Credit Card** - Stripe (existing)
- ✅ **Free Credits** - User credits

### Phase 4 (Future)
- ⏳ **NEAR AI** - Natural language payments
- ⏳ **SOL Bridge** - SOL → ZEC via thirdweb Bridge
- ⏳ **MINA Bridge** - MINA → ZEC via thirdweb Bridge
- ⏳ **Zcash Direct** - Direct ZEC payments

## Database Schema

**calls table:**
- `paymentMethod` - Enum: `free`, `credit_card`, `crypto`, `near_ai`, `sol`, `mina`, `zcash`, `web3_wallet`
- `paymentTxHash` - Transaction hash (for crypto payments)
- `paymentAmount` - Amount paid (in ZEC equivalent)
- `isFree` - Boolean flag

## Webhook Flow

```
User Payment → Stripe/thirdweb → Webhook → Server Function → Create Call Record
```

**Webhook Handler:**
1. Verify webhook signature
2. Extract payment metadata (wallet address, amount, method)
3. Create call record in database
4. Return success response

## Security Considerations

1. **Webhook Verification:** Always verify Stripe/thirdweb webhook signatures
2. **Payment Amount Validation:** Verify payment amount matches expected amount
3. **Rate Limiting:** Check `call_analytics` before creating call
4. **PII Encryption:** Encrypt phone numbers before storing (Fhenix CoFHE)

## Next Steps

1. ✅ Build call request form UI
2. ✅ Create dummy payment button
3. ✅ Create server function for call creation
4. ⏳ Integrate Stripe (Phase 2) - Requires Stripe account setup
5. ⏳ Integrate thirdweb Pay (Phase 3) - Crypto payments
6. ⏳ Integrate thirdweb x402 (Phase 3.5) - Internet native payments
7. ⏳ Set up webhooks (Phase 2-3)
8. ⏳ Integrate thirdweb Engine (Phase 4)

