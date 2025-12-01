# ZCash Payment Service

A microservice that wraps zingo-cli to verify ZCash shielded payments using a viewing key.

## How It Works

1. Main app shows QR code with your wallet's receiving address
2. User pays with any Zcash wallet (YWallet, Zashi, etc.)
3. This service monitors incoming transactions using your viewing key
4. Main app polls this service to confirm payment

## Deployment on Railway

1. Create a new Railway project from `zcash-service/` directory
2. Add a Volume mounted at `/data/wallets` (for wallet data persistence)
3. Set environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `VIEWING_KEY` | Yes | Unified Full Viewing Key (`uview1...`) from your wallet |
| `BIRTHDAY` | Yes | Block height when wallet was created (e.g., `3150000`) |
| `CHAIN` | No | `mainnet` or `testnet` (default: mainnet) |
| `SERVER` | No | lightwalletd server (default: https://zec.rocks:443) |

## Getting Your Viewing Key

**From YWallet:**
1. Settings → Backup → Show Unified Viewing Key
2. Copy the key starting with `uview1...`

**Birthday:** Use a recent block height before any transactions (check zcash block explorer)

## API Endpoints

### GET /health
Health check. Returns `{ status: "ok", isInitialized: true }`

### GET /balance
Returns wallet balance in zatoshis.

### GET /notes
Returns all incoming notes (shielded transactions with memos).

### POST /sync
Triggers a full sync with the blockchain.

### GET /check-payment?memo=AICALLTV:ZEC-xxx
Checks if a payment with the specified memo has been received.
Returns `{ found: true, payment: {...} }` or `{ found: false }`

## Main App Configuration

Add to your `.env`:
```
ZCASH_SERVICE_URL=https://your-zcash-service.railway.app
```

The receiving address is hardcoded in `src/routes/api/zcash/payment.ts`.

## Local Development

```bash
# Requires zingo-cli installed and in PATH
npm install
VIEWING_KEY="uview1..." BIRTHDAY="3150000" npm start
```

## Security Notes

- The viewing key is **read-only** - it cannot spend funds
- Use Railway's encrypted environment variables
- Keep the service internal/private
