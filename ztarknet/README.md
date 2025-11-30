# Ztarknet Payment Integration

## Overview

This project includes **4 crypto payment options**:

| Option | Token | Network | Wallet Type |
|--------|-------|---------|-------------|
| **Base** | USDC | Base L2 | MetaMask (browser) |
| **Solana** | USDC | Solana | Phantom (browser) |
| **Zcash** | ZEC | Zcash L1 | Zashi, YWallet (QR scan) |
| **Ztarknet** | ZTF | Ztarknet L2 | Argent, Braavos (browser) |

---

## What is Ztarknet?

**Ztarknet = Starknet L2 that settles on Zcash**

- Uses Madara sequencer (Starknet-compatible)
- Gas/fee token: **ZEC**
- Wallets: Argent, Braavos (configured for Ztarknet)

---

## Network Details (VERIFIED)

| Property | Value |
|----------|-------|
| **RPC URL** | `https://ztarknet-madara.d.karnot.xyz` |
| **Explorer** | `https://explorer-zstarknet.d.karnot.xyz` |
| **Fee Token** | ZTF (Ztarknet Fee Token) |
| **Fee Token Address** | `0x01ad102b4c4b3e40a51b6fb8a446275d600555bd63a95cdceed3e5cef8a6bc1d` |
| **Faucet** | `https://faucet.ztarknet.cash/` |
| **Network Name** | Ztarknet |

---

## Wallet Setup (Argent)

To use Ztarknet, users need to add the network to their wallet:

1. Open Argent wallet
2. Go to **Advanced Settings** → **Manage Networks**
3. Create new network with:
   - **Name**: Ztarknet
   - **RPC URL**: `https://ztarknet-madara.d.karnot.xyz`
   - **Fee Token**: `0x01ad102b4c4b3e40a51b6fb8a446275d600555bd63a95cdceed3e5cef8a6bc1d`
   - **Explorer**: `https://explorer-zstarknet.d.karnot.xyz`
4. **Get ZTF tokens**: Go to https://faucet.ztarknet.cash/

---

## `ztarknet-pay` SDK

Located at: `src/lib/ztarknet-pay/`

A **reusable browser wallet payment component** for Ztarknet.

### Usage

```typescript
import { ZtarknetPay } from '~/lib/ztarknet-pay';

// Initialize
const ztarknet = new ZtarknetPay({
  recipientAddress: '0x...your_address...',
});

// 1. Connect wallet
const { address, walletName } = await ztarknet.connectWallet();

// 2. Send ZTF payment
const result = await ztarknet.sendPayment({
  amount: '0.01', // ZTF
  orderId: 'ORDER-123',
});

if (result.success) {
  console.log('Tx:', result.txHash);
  console.log('Explorer:', ztarknet.getExplorerUrl(result.txHash));
}

// 3. Verify transaction (optional)
const verified = await ztarknet.verifyTransaction(result.txHash);
```

### Payment Flow

```
User clicks "ZEC on Ztarknet"
        │
        ▼
┌───────────────────┐
│  Connect Wallet   │  ← Argent/Braavos (configured for Ztarknet)
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Sign Transfer    │  ← ZEC token transfer
│  (wallet popup)   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  Confirmation     │  ← Verify on explorer
└───────────────────┘
        │
        ▼
   Payment complete!
   → Create credit → Process order
```

---

## Environment Variables

Add to `.env`:

```bash
# Ztarknet receiving address (your Starknet-format address)
VITE_ZTARKNET_PAYMENT_ADDRESS=0x...
```

---

## Payment Validation

For production, validate payments by:

1. **Get tx hash** from wallet after user signs
2. **Query RPC** to verify transaction status:
   ```typescript
   import { RpcProvider } from 'starknet';
   
   const provider = new RpcProvider({ 
     nodeUrl: 'https://ztarknet-madara.d.karnot.xyz' 
   });
   
   const receipt = await provider.getTransactionReceipt(txHash);
   const isValid = receipt.execution_status === 'SUCCEEDED';
   ```
3. **Check explorer** for additional confirmation

No custom payment contract needed - just validate the ZEC token transfer happened.

---

## Differences: Zcash vs Ztarknet

| Aspect | Zcash (L1) | Ztarknet (L2) |
|--------|------------|---------------|
| **Token** | ZEC | ZTF (Ztarknet Fee Token) |
| **Network** | Zcash blockchain | Ztarknet (Starknet L2 on Zcash) |
| **Wallet** | Zashi, YWallet | Argent, Braavos |
| **UX** | QR code scan | Browser wallet popup |
| **Settlement** | Direct on L1 | L2 → settles on Zcash L1 |
| **Get Tokens** | Buy/Exchange | Faucet: faucet.ztarknet.cash |

---

## Resources

- [Ztarknet Website](https://www.ztarknet.cash/)
- [Ztarknet Explorer](https://explorer-zstarknet.d.karnot.xyz/)
- [Ztarknet GitHub](https://github.com/Ztarknet)
- [Argent Wallet](https://www.argent.xyz/)
- [Braavos Wallet](https://braavos.app/)
