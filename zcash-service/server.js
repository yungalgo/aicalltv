/**
 * ZCash Payment Service
 * 
 * Wraps zingo-cli for shielded payment verification.
 * Uses a Unified Viewing Key to monitor incoming transactions.
 * 
 * Environment Variables:
 * - VIEWING_KEY: Unified Full Viewing Key (uview1...) - REQUIRED
 * - BIRTHDAY: Block height when wallet was created (default: 3150000)
 * - PORT: HTTP port (default: 8080)
 * - CHAIN: mainnet or testnet (default: mainnet)
 * - SERVER: lightwalletd server URL (default: https://zec.rocks:443)
 */

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 8080;
const CHAIN = process.env.CHAIN || 'mainnet';
const SERVER = process.env.SERVER || 'https://zec.rocks:443';
const WALLET_DIR = process.env.WALLET_DIR || '/data/wallets';
const VIEWING_KEY = process.env.VIEWING_KEY;
const BIRTHDAY = process.env.BIRTHDAY || '3150000';

// State
let isInitialized = false;
let lastSync = 0;

// Validate required env
if (!VIEWING_KEY) {
  console.error('ERROR: VIEWING_KEY environment variable is required');
  process.exit(1);
}

/**
 * Run a zingo-cli command
 * Uses --viewkey on first run to initialize wallet, then uses existing wallet
 */
async function runZingo(command, waitSync = false) {
  const fs = await import('fs/promises');
  
  // Check if wallet exists
  let walletExists = false;
  try {
    const files = await fs.readdir(WALLET_DIR);
    walletExists = files.length > 0;
  } catch {
    await fs.mkdir(WALLET_DIR, { recursive: true });
  }

  // Build command
  let cmd = `zingo-cli --chain ${CHAIN} --server ${SERVER} --data-dir ${WALLET_DIR}`;
  
  // If wallet doesn't exist, initialize with viewing key
  if (!walletExists) {
    cmd += ` --viewkey "${VIEWING_KEY}" --birthday ${BIRTHDAY}`;
  }
  
  // Add waitsync flag if requested (ensures sync completes before command runs)
  if (waitSync) {
    cmd += ' --waitsync';
  }
  
  cmd += ` ${command}`;
  
  console.log(`[Zingo] ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 }); // 5 min timeout
    if (stderr && !stderr.includes('Launching')) {
      console.error(`[Zingo] stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    console.error(`[Zingo] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Parse JSON from zingo-cli output (handles log messages mixed with JSON)
 */
function parseOutput(output) {
  try {
    return JSON.parse(output);
  } catch {
    const match = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return output;
      }
    }
    return output;
  }
}

/**
 * Initialize wallet on startup
 */
async function initialize() {
  console.log('[Zingo] Initializing with viewing key...');
  console.log(`[Zingo] Birthday: ${BIRTHDAY}`);
  
  try {
    // Run balance with --waitsync to ensure wallet is synced
    const output = await runZingo('balance', true);
    console.log('[Zingo] Initial sync complete');
    
    const balance = parseOutput(output);
    if (typeof balance === 'object') {
      console.log('[Zingo] Balance:', JSON.stringify(balance).slice(0, 200));
    }
    
    isInitialized = true;
    lastSync = Date.now();
    console.log('[Zingo] ✅ Ready');
  } catch (error) {
    console.error('[Zingo] Initialization failed:', error.message);
    // Don't exit - let it retry on next request
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: isInitialized ? 'ok' : 'initializing',
    chain: CHAIN,
    lastSync,
    isInitialized
  });
});

// Get balance
app.get('/balance', async (req, res) => {
  try {
    const output = await runZingo('balance', false);
    res.json(parseOutput(output));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get notes (incoming transactions)
app.get('/notes', async (req, res) => {
  try {
    const output = await runZingo('notes', false);
    res.json(parseOutput(output));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger sync
app.post('/sync', async (req, res) => {
  try {
    await runZingo('balance', true); // balance with waitsync triggers full sync
    lastSync = Date.now();
    res.json({ status: 'synced', timestamp: lastSync });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check for payment with specific memo
 * This is the main endpoint for payment verification
 */
app.get('/check-payment', async (req, res) => {
  const { memo } = req.query;
  
  if (!memo) {
    return res.status(400).json({ error: 'memo parameter required' });
  }
  
  try {
    const output = await runZingo('notes', false);
    const notes = parseOutput(output);
    
    console.log('[check-payment] Looking for memo:', memo);
    
    // Search Orchard notes
    const orchardNotes = notes?.orchard_notes?.note_summaries || [];
    for (const note of orchardNotes) {
      if (note.memo && note.memo.includes(memo)) {
        console.log('[check-payment] Found:', note.memo, 'value:', note.value);
        return res.json({
          found: true,
          payment: {
            value: note.value,
            status: note.status,
            memo: note.memo,
            txid: note.txid,
            pool: 'orchard'
          }
        });
      }
    }
    
    // Search Sapling notes
    const saplingNotes = notes?.sapling_notes?.note_summaries || [];
    for (const note of saplingNotes) {
      if (note.memo && note.memo.includes(memo)) {
        console.log('[check-payment] Found:', note.memo, 'value:', note.value);
        return res.json({
          found: true,
          payment: {
            value: note.value,
            status: note.status,
            memo: note.memo,
            txid: note.txid,
            pool: 'sapling'
          }
        });
      }
    }
    
    res.json({ found: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Background sync every 30 seconds
setInterval(async () => {
  if (!isInitialized) return;
  try {
    await runZingo('balance', false); // Light sync
    lastSync = Date.now();
  } catch (error) {
    console.error('[Zingo] Background sync failed:', error.message);
  }
}, 30000);

// Start server
app.listen(PORT, async () => {
  console.log(`ZCash Payment Service on port ${PORT}`);
  console.log(`Chain: ${CHAIN}, Server: ${SERVER}`);
  await initialize();
});
