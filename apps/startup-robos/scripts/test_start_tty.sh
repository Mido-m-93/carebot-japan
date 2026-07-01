#!/usr/bin/env bash
# Test: all interactive read calls in start.sh redirect from /dev/tty
# This ensures curl|bash works (stdin is a pipe, so reads must use /dev/tty).

set -euo pipefail

SCRIPT_FILE="$(cd "$(dirname "$0")/.." && pwd)/start.sh"
EXIT_CODE=0

# Find interactive "read" calls that lack </dev/tty.
# Exclude while-loop reads (redirected via done < file) and lines already using </dev/tty.
bare_reads=$(grep -n 'read -r' "$SCRIPT_FILE" \
  | grep -v 'while.*read' \
  | grep -v '</dev/tty' || true)

if [[ -n "$bare_reads" ]]; then
  echo "FAIL: found read calls without </dev/tty redirection:"
  echo "$bare_reads"
  EXIT_CODE=1
else
  echo "PASS: all read calls redirect from /dev/tty"
fi

exit $EXIT_CODE
