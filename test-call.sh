#!/bin/bash

# Test Call Script (wrapper for TypeScript script)
# Usage: ./test-call.sh <phone-number> <recipient-name> <recipient-context>
# Example: ./test-call.sh "+15005550006" "Test User" "This is a test call"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Run the TypeScript script directly
bun "$SCRIPT_DIR/scripts/test-call.ts" "$@"

