/**
 * Create database schema directly using SQL
 * This bypasses drizzle-kit entirely
 */

import postgres from "postgres";
import { env } from "~/env/server";

async function createSchema() {
  console.log("🔄 Creating database schema directly...");
  const driver = postgres(env.DATABASE_URL);

  try {
    console.log("📦 Creating enums...");
    await driver.unsafe(`
      DO $$ BEGIN
        CREATE TYPE call_status AS ENUM ('call_created', 'prompt_ready', 'call_attempted', 'call_complete', 'call_failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE payment_method AS ENUM ('free', 'near_ai', 'sol', 'mina', 'zcash', 'web3_wallet', 'stripe');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE video_status AS ENUM ('pending', 'generating', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE credit_state AS ENUM ('unused', 'consumed', 'expired');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("✅ Enums created");

    console.log("📦 Creating tables...");
    // Create user table first (no dependencies)
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        image TEXT,
        free_call_credits INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create session table
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ip_address TEXT,
        user_agent TEXT,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      );
    `);

    // Create account table
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(provider_id, account_id)
      );
    `);

    // Create verification table
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Create call_analytics table
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS call_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_number_hash TEXT NOT NULL,
        date DATE NOT NULL,
        call_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(phone_number_hash, date)
      );
    `);

    // Create calls table with all new fields
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        status call_status NOT NULL DEFAULT 'call_created',
        recipient_name TEXT NOT NULL,
        anything_else TEXT,
        target_gender TEXT NOT NULL,
        target_gender_custom TEXT,
        target_age_range TEXT,
        target_physical_description TEXT,
        interesting_piece TEXT,
        video_style TEXT,
        openai_prompt TEXT,
        image_prompt TEXT,
        script TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        first_attempt_at TIMESTAMP,
        last_attempt_at TIMESTAMP,
        days_since_first_attempt INTEGER DEFAULT 0,
        next_retry_at TIMESTAMP,
        is_free BOOLEAN NOT NULL DEFAULT false,
        payment_method payment_method NOT NULL,
        payment_tx_hash TEXT,
        payment_amount DECIMAL(18, 8),
        encrypted_handle TEXT,
        call_sid TEXT,
        recording_url TEXT,
        recording_sid TEXT,
        duration INTEGER,
        video_url TEXT,
        video_status video_status DEFAULT 'pending',
        wavespeed_job_id TEXT,
        video_error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create call_credits table
    await driver.unsafe(`
      CREATE TABLE IF NOT EXISTS call_credits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        state credit_state NOT NULL DEFAULT 'unused',
        payment_method payment_method NOT NULL,
        payment_ref TEXT,
        network TEXT,
        amount_cents INTEGER NOT NULL,
        call_id UUID REFERENCES calls(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        consumed_at TIMESTAMP
      );
      
      -- Unique index to prevent duplicate credits from same payment
      CREATE UNIQUE INDEX IF NOT EXISTS unique_payment_ref 
      ON call_credits(payment_ref) 
      WHERE payment_ref IS NOT NULL;
    `);

    // Create updated_at trigger function
    await driver.unsafe(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add triggers for updated_at
    await driver.unsafe(`
      DROP TRIGGER IF EXISTS update_user_updated_at ON "user";
      CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_session_updated_at ON session;
      CREATE TRIGGER update_session_updated_at BEFORE UPDATE ON session
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_account_updated_at ON account;
      CREATE TRIGGER update_account_updated_at BEFORE UPDATE ON account
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_verification_updated_at ON verification;
      CREATE TRIGGER update_verification_updated_at BEFORE UPDATE ON verification
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      
      DROP TRIGGER IF EXISTS update_calls_updated_at ON calls;
      CREATE TRIGGER update_calls_updated_at BEFORE UPDATE ON calls
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log("✅ All tables created!");
    console.log("✅ Schema complete with all new fields");
    
  } catch (error) {
    console.error("❌ Error creating schema:", error);
    throw error;
  } finally {
    await driver.end();
  }
}

if (import.meta.main) {
  createSchema()
    .then(() => {
      console.log("\n✨ Database schema created successfully!");
      console.log("   Run 'bun run scripts/check-db.ts' to verify");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Failed:", error);
      process.exit(1);
    });
}

