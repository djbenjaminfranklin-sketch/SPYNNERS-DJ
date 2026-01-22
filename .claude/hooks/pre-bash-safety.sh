#!/usr/bin/env bash
# Pre-bash hook for safety checks
# Blocks dangerous commands

set -euo pipefail

# Read JSON input
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')

# Block dangerous patterns
dangerous_patterns=(
  'rm -rf /'
  'rm -rf ~'
  'rm -rf \*'
  'git reset --hard'
  'git push --force'
  'git push -f'
  'DROP TABLE'
  'DROP DATABASE'
  'format c:'
)

for pattern in "${dangerous_patterns[@]}"; do
  if echo "$cmd" | grep -qi "$pattern"; then
    echo "BLOQUE: Commande potentiellement dangereuse detectee: $pattern" >&2
    echo "Cette commande a ete bloquee pour des raisons de securite." >&2
    exit 2
  fi
done

# Warn about npm when pnpm/yarn might be preferred
if echo "$cmd" | grep -qE '\bnpm\s+(install|i)\b'; then
  if [[ -f "pnpm-lock.yaml" ]]; then
    echo "Ce projet utilise pnpm. Utilisez 'pnpm install' au lieu de 'npm install'." >&2
    exit 2
  elif [[ -f "yarn.lock" ]]; then
    echo "Ce projet utilise yarn. Utilisez 'yarn' au lieu de 'npm install'." >&2
    exit 2
  fi
fi

exit 0
