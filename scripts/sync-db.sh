#!/bin/bash
# Sync database schema using drizzle-kit push

cd "$(dirname "$0")/.."

echo "🔄 Syncing database schema..."
echo "This will add the missing 'call_sid' column to the 'calls' table."
echo ""

# Use expect to handle the interactive prompt
if command -v expect &> /dev/null; then
    expect << EOF
spawn bunx drizzle-kit push
expect {
    "Yes, I want to execute all statements" {
        send "Yes, I want to execute all statements\r"
        exp_continue
    }
    eof
}
EOF
else
    # Fallback: manual confirmation
    echo "Please type 'Yes, I want to execute all statements' when prompted"
    bunx drizzle-kit push
fi

