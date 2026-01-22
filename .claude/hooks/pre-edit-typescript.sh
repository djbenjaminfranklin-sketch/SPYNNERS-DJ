#!/usr/bin/env bash
# Pre-edit hook for TypeScript files
# Validates that edits follow project conventions

set -euo pipefail

# Read JSON input
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# Only check TypeScript files
if [[ ! "$file_path" =~ \.(ts|tsx)$ ]]; then
  exit 0
fi

# Block edits to critical config files without explicit approval
protected_files=(
  "app.json"
  "eas.json"
  "tsconfig.json"
  "metro.config.js"
)

for protected in "${protected_files[@]}"; do
  if [[ "$file_path" == *"$protected" ]]; then
    echo "ATTENTION: Modification de fichier de configuration critique: $protected" >&2
    echo "Assurez-vous que cette modification est intentionnelle." >&2
    exit 0  # Warning only, not blocking
  fi
done

exit 0
