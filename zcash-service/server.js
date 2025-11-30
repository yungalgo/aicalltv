/**
 * ZCash Payment Service
 * 
 * A simple HTTP API that wraps zingo-cli for payment detection.
 * Deploy this on Railway as a separate service.
 * 
 * Environment Variables:
 * - PORT: HTTP port (default: 8080)
 * - SEED_PHRASE: 24-word seed phrase for the wallet (REQUIRED)
 * - CHAIN: mainnet or testnet (default: mainnet)
 * - SERVER: lightwalletd server URL
 */

import express from 'express';
import cors from 'cors';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CHAIN = process.env.CHAIN || 'mainnet';
const SERVER = process.env.SERVER || 'https://mainnet.lightwalletd.com:9067';
const WALLET_DIR = process.env.WALLET_DIR || '/data/wallets';

// Cache for addresses
let cachedAddresses = null;
let lastSync = 0;

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

// Parse JSON output from zingo-cli
function parseZingoOutput(output) {
  try {
    // zingo-cli outputs JSON, try to parse it
    return JSON.parse(output);
  } catch {
    // If not JSON, return as-is
    return output;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', chain: CHAIN, lastSync });
});

// Get wallet address (for QR code)
app.get('/address', async (req, res) => {
  try {
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
    const notes = parseZingoOutput(output);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get balance
app.get('/balance', async (req, res) => {
  try {
    const output = await runZingo('balance');
    const balance = parseZingoOutput(output);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check for payment with specific memo
// This is the main endpoint we'll use for payment detection
app.get('/check-payment', async (req, res) => {
  const { memo } = req.query;
  
  if (!memo) {
    return res.status(400).json({ error: 'memo query parameter required' });
  }
  
  try {
    // Get all notes
    const output = await runZingo('notes');
    let notes = parseZingoOutput(output);
    
    // zingo-cli outputs log messages with JSON - extract JSON if needed
    if (typeof notes === 'string') {
      const jsonMatch = notes.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          notes = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('[check-payment] Failed to parse JSON from output');
        }
      }
    }
    
    console.log('[check-payment] Looking for memo:', memo);
    
    // Search for a note with matching memo
    // zingo-cli returns: { orchard_notes: { note_summaries: [...] }, sapling_notes: { note_summaries: [...] } }
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
    
    // Check Sapling notes if not found in Orchard
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
    
    // Legacy format fallback (pending_notes, unspent_notes)
    if (!found && notes.pending_notes) {
      for (const note of notes.pending_notes) {
        if (note.memo && note.memo.includes(memo)) {
          found = { ...note, status: 'pending' };
          break;
        }
      }
    }
    
    if (!found && notes.unspent_notes) {
      for (const note of notes.unspent_notes) {
        if (note.memo && note.memo.includes(memo)) {
          found = { ...note, status: 'confirmed' };
          break;
        }
      }
    }
    
    if (found) {
      res.json({ 
        found: true, 
        payment: found,
        memo 
      });
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
    const transactions = parseZingoOutput(output);
    res.json(transactions);
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
    // Check if wallet already exists by trying to get addresses
    console.log('[Zingo] Checking for existing wallet...');
    try {
      await runZingo('addresses');
      console.log('[Zingo] Wallet already exists');
    } catch {
      // Wallet doesn't exist, initialize from seed
      console.log('[Zingo] Initializing wallet from seed...');
      const birthday = process.env.BIRTHDAY || '0';
      await runZingo(`init-from-seed "${seedPhrase}" ${birthday}`);
      console.log('[Zingo] Wallet initialized');
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
    
  } catch (error) {
    console.error('[Zingo] Initialization failed:', error.message);
    // Don't exit, let the server start anyway for debugging
  }
}

// Background sync every 30 seconds
setInterval(async () => {
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

