#!/usr/bin/env bash
# Post-edit hook to format TypeScript files with Prettier
# Runs automatically after every Edit/Write on .ts/.tsx files

set -euo pipefail

# Read JSON input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# Only format TypeScript files
if [[ ! "$file_path" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Check if file exists
if [[ ! -f "$file_path" ]]; then
  exit 0
fi

# Run Prettier if available
if command -v npx &> /dev/null; then
  npx prettier --write "$file_path" 2>/dev/null || true
fi

exit 0
