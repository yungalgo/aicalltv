# ZCash Payment Service

A microservice that wraps zingo-cli to provide HTTP APIs for ZCash payment detection.

## Deployment on Railway

1. Create a new Railway project
2. Deploy from this directory
3. Set environment variables:
   - `SEED_PHRASE` (required): Your 24-word Zcash wallet seed phrase
   - `BIRTHDAY` (optional): Block height when wallet was created (speeds up sync)
   - `CHAIN`: `mainnet` or `testnet` (default: mainnet)
   - `SERVER`: lightwalletd server URL (default: https://mainnet.lightwalletd.com:9067)

## API Endpoints

### GET /health
Health check endpoint.

### GET /address
Returns the wallet's receiving addresses (z-address for shielded).

### POST /sync
Triggers a wallet sync with the blockchain.

### GET /notes
Returns all incoming notes (shielded transactions).

### GET /balance
Returns wallet balance.

### GET /check-payment?memo=ORDER-123
Checks if a payment with the specified memo has been received.

### GET /transactions
Returns transaction history.

## Payment Flow

1. Main app calls `/address` to get z-address
2. Main app shows QR code: `zcash:${address}?amount=${amount}&memo=${orderId}`
3. User scans QR with Zashi/YWallet
4. Main app polls `/check-payment?memo=${orderId}`
5. When found, create credit and process call

## Environment Variables for Main App

Add to your `.env`:
```
ZCASH_SERVICE_URL=https://your-zcash-service.railway.app
```

## Local Development

```bash
# Install dependencies
npm install

# Run (requires zingo-cli in PATH and SEED_PHRASE set)
SEED_PHRASE="your 24 words here" npm start
```

## Security Notes

- NEVER commit your seed phrase
- Use Railway's encrypted environment variables
- The service should be internal/private, not publicly exposed

