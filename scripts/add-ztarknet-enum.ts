import postgres from "postgres";

async function addZtarknetEnum() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL);

  try {
    // Check if ztarknet already exists
    const check = await sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
      AND enumlabel = 'ztarknet'
    `;

    if (check.length > 0) {
      console.log("✅ 'ztarknet' already exists in payment_method enum");
    } else {
      await sql.unsafe("ALTER TYPE payment_method ADD VALUE 'ztarknet'");
      console.log("✅ Added 'ztarknet' to payment_method enum");
    }

    // List all values
    const result = await sql`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
      ORDER BY enumsortorder
    `;
    console.log("\nAll payment_method values:");
    result.forEach((r) => console.log("  -", r.enumlabel));
  } catch (e) {
    const error = e as Error;
    if (error.message?.includes("already exists")) {
      console.log("✅ 'ztarknet' already exists in payment_method enum");
    } else {
      console.error("Error:", error.message);
      throw e;
    }
  } finally {
    await sql.end();
  }
}

addZtarknetEnum();

