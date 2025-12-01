/**
 * ZCash Payment Service
 * 
 * A simple HTTP API that wraps zingo-cli for payment detection.
 * Deploy this on Railway as a separate service.
 * 
 * Environment Variables:
 * - PORT: HTTP port (default: 8080)
 * - SEED_PHRASE: 24-word seed phrase for the wallet (REQUIRED)
 * - BIRTHDAY: Block height when wallet was created (default: 0)
 * - CHAIN: mainnet or testnet (default: mainnet)
 * - SERVER: lightwalletd server URL
 */

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHAIN = process.env.CHAIN || 'mainnet';
const SERVER = process.env.SERVER || 'https://zec.rocks:443';
const WALLET_DIR = process.env.WALLET_DIR || '/data/wallets';

// Cache for addresses
let cachedAddresses = null;
let lastSync = 0;
let isInitialized = false; // Track if wallet is ready

// Run zingo-cli command
async function runZingo(command) {
  const cmd = `zingo-cli --chain ${CHAIN} --server ${SERVER} --data-dir ${WALLET_DIR} ${command}`;
  console.log(`[Zingo] Running: ${cmd}`);
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 }); // 2 min timeout
    if (stderr) console.error(`[Zingo] stderr: ${stderr}`);
    return stdout.trim();
  } catch (error) {
    console.error(`[Zingo] Error: ${error.message}`);
    throw error;
  }
}

// Parse JSON output from zingo-cli (handles log messages mixed with JSON)
function parseZingoOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    // zingo-cli sometimes includes log messages before JSON
    const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return output;
      }
    }
    return output;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', chain: CHAIN, lastSync, isInitialized });
});

// Reset wallet - forces reinitialization from SEED_PHRASE
app.post('/reset-wallet', async (req, res) => {
  try {
    console.log('[Zingo] Resetting wallet...');
    isInitialized = false;
    
    const fs = await import('fs/promises');
    
    try {
      await fs.rm(WALLET_DIR, { recursive: true, force: true });
      console.log('[Zingo] Wallet directory removed');
      await fs.mkdir(WALLET_DIR, { recursive: true });
      console.log('[Zingo] Empty wallet directory created');
    } catch (e) {
      console.log('[Zingo] Could not reset wallet dir:', e.message);
    }
    
    cachedAddresses = null;
    await initializeWallet();
    
    res.json({ 
      status: 'reset', 
      message: 'Wallet reinitialized',
      address: cachedAddresses?.[0]?.encoded_address || 'unknown'
    });
  } catch (error) {
    console.error('[Zingo] Reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get wallet address (for QR code)
app.get('/address', async (req, res) => {
  try {
    // Wait for initialization to complete (max 60 seconds)
    let waitCount = 0;
    while (!isInitialized && waitCount < 60) {
      await new Promise(r => setTimeout(r, 1000));
      waitCount++;
    }
    
    if (!isInitialized) {
      return res.status(503).json({ error: 'Wallet still initializing' });
    }
    
    if (cachedAddresses) {
      return res.json(cachedAddresses);
    }
    
    const output = await runZingo('addresses');
    const addresses = parseZingoOutput(output);
    cachedAddresses = addresses;
    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sync wallet with blockchain
app.post('/sync', async (req, res) => {
  try {
    console.log('[Zingo] Starting sync...');
    await runZingo('sync');
    lastSync = Date.now();
    console.log('[Zingo] Sync complete');
    res.json({ status: 'synced', timestamp: lastSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get incoming notes (transactions)
app.get('/notes', async (req, res) => {
  try {
    const output = await runZingo('notes');
    res.json(parseZingoOutput(output));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get balance
app.get('/balance', async (req, res) => {
  try {
    const output = await runZingo('balance');
    res.json(parseZingoOutput(output));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check for payment with specific memo
app.get('/check-payment', async (req, res) => {
  const { memo } = req.query;
  
  if (!memo) {
    return res.status(400).json({ error: 'memo query parameter required' });
  }
  
  try {
    const output = await runZingo('notes');
    const notes = parseZingoOutput(output);
    
    console.log('[check-payment] Looking for memo:', memo);
    
    let found = null;
    
    // Check Orchard notes
    if (notes.orchard_notes?.note_summaries) {
      for (const note of notes.orchard_notes.note_summaries) {
        if (note.memo && note.memo.includes(memo)) {
          found = { 
            ...note, 
            status: note.status?.includes('confirmed') ? 'confirmed' : 'pending',
            pool: 'orchard'
          };
          console.log('[check-payment] Found in Orchard:', found);
          break;
        }
      }
    }
    
    // Check Sapling notes
    if (!found && notes.sapling_notes?.note_summaries) {
      for (const note of notes.sapling_notes.note_summaries) {
        if (note.memo && note.memo.includes(memo)) {
          found = { 
            ...note, 
            status: note.status?.includes('confirmed') ? 'confirmed' : 'pending',
            pool: 'sapling'
          };
          console.log('[check-payment] Found in Sapling:', found);
          break;
        }
      }
    }
    
    if (found) {
      res.json({ found: true, payment: found, memo });
    } else {
      res.json({ found: false, memo });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction list
app.get('/transactions', async (req, res) => {
  try {
    const output = await runZingo('list');
    res.json(parseZingoOutput(output));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize wallet on startup
async function initializeWallet() {
  const seedPhrase = process.env.SEED_PHRASE;
  
  if (!seedPhrase) {
    console.error('ERROR: SEED_PHRASE environment variable is required');
    process.exit(1);
  }
  
  try {
    const fs = await import('fs/promises');
    
    // Check if wallet files exist
    let walletExists = false;
    try {
      const files = await fs.readdir(WALLET_DIR);
      walletExists = files.length > 0;
      console.log(`[Zingo] Wallet directory has ${files.length} files`);
    } catch {
      console.log('[Zingo] Wallet directory does not exist');
      await fs.mkdir(WALLET_DIR, { recursive: true });
    }
    
    if (!walletExists) {
      console.log('[Zingo] Initializing wallet from seed...');
      const birthday = process.env.BIRTHDAY || '0';
      console.log(`[Zingo] Using birthday: ${birthday}`);
      await runZingo(`init-from-seed "${seedPhrase}" ${birthday}`);
      console.log('[Zingo] Wallet initialized from seed');
    } else {
      console.log('[Zingo] Using existing wallet');
    }
    
    // Initial sync
    console.log('[Zingo] Starting initial sync...');
    await runZingo('sync');
    lastSync = Date.now();
    console.log('[Zingo] Initial sync complete');
    
    // Cache addresses
    const addresses = await runZingo('addresses');
    cachedAddresses = parseZingoOutput(addresses);
    console.log('[Zingo] Addresses cached');
    
    // Log the address for verification
    if (Array.isArray(cachedAddresses) && cachedAddresses[0]?.encoded_address) {
      console.log('[Zingo] Receiving address:', cachedAddresses[0].encoded_address.slice(0, 50) + '...');
    }
    
    isInitialized = true;
    console.log('[Zingo] ✅ Wallet initialization complete!');
    
  } catch (error) {
    console.error('[Zingo] Initialization failed:', error.message);
  }
}

// Background sync every 30 seconds
setInterval(async () => {
  if (!isInitialized) return;
  try {
    console.log('[Zingo] Background sync...');
    await runZingo('sync');
    lastSync = Date.now();
  } catch (error) {
    console.error('[Zingo] Background sync failed:', error.message);
  }
}, 30000);

// Start server
app.listen(PORT, async () => {
  console.log(`ZCash Payment Service listening on port ${PORT}`);
  console.log(`Chain: ${CHAIN}`);
  console.log(`Server: ${SERVER}`);
  
  await initializeWallet();
});

