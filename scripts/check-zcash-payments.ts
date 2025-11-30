/**
 * Check zcash-service for received payments
 * 
 * Usage: bun run scripts/check-zcash-payments.ts
 */

const ZCASH_SERVICE_URL = process.env.ZCASH_SERVICE_URL || "http://localhost:8080";

async function checkPayments() {
  console.log("Checking zcash-service at:", ZCASH_SERVICE_URL);
  console.log("---");

  // 1. Check health/sync status
  try {
    console.log("1. Checking sync status...");
    const healthRes = await fetch(`${ZCASH_SERVICE_URL}/health`);
    const health = await healthRes.json();
    console.log("   Status:", health.status);
    console.log("   Last sync:", new Date(health.lastSync).toISOString());
    console.log("   Chain:", health.chain);
  } catch (err) {
    console.log("   Error:", err);
  }

  console.log("---");

  // 2. Trigger a fresh sync
  try {
    console.log("2. Triggering fresh sync...");
    const syncRes = await fetch(`${ZCASH_SERVICE_URL}/sync`, { method: "POST" });
    if (syncRes.ok) {
      const sync = await syncRes.json();
      console.log("   Sync complete:", sync);
    } else {
      console.log("   Sync failed:", syncRes.status);
    }
  } catch (err) {
    console.log("   Sync error:", err);
  }

  console.log("---");

  // 3. Check balance
  try {
    console.log("3. Checking balance...");
    const balanceRes = await fetch(`${ZCASH_SERVICE_URL}/balance`);
    const balanceText = await balanceRes.text();
    console.log("   Raw balance response:");
    console.log(balanceText);
  } catch (err) {
    console.log("   Error:", err);
  }

  console.log("---");

  // 4. Check notes (incoming transactions)
  try {
    console.log("4. Checking notes (transactions)...");
    const notesRes = await fetch(`${ZCASH_SERVICE_URL}/notes`);
    const notesText = await notesRes.text();
    console.log("   Raw notes response:");
    console.log(notesText);
  } catch (err) {
    console.log("   Error:", err);
  }

  console.log("---");

  // 5. Check transaction list
  try {
    console.log("5. Checking transaction list...");
    const txRes = await fetch(`${ZCASH_SERVICE_URL}/transactions`);
    const txText = await txRes.text();
    console.log("   Raw transactions response:");
    console.log(txText);
  } catch (err) {
    console.log("   Error:", err);
  }

  console.log("---");

  // 6. Try to find payment with AICALLTV memo
  try {
    console.log("6. Searching for AICALLTV payments...");
    const checkRes = await fetch(`${ZCASH_SERVICE_URL}/check-payment?memo=AICALLTV`);
    const checkText = await checkRes.text();
    console.log("   Check result:");
    console.log(checkText);
  } catch (err) {
    console.log("   Error:", err);
  }
}

checkPayments();

