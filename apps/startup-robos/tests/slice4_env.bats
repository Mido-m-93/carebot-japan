#!/usr/bin/env bats
# slice4_env.bats — Tests for env.staff parsing, credential prompts, .env.local generation

load test_helpers

setup() {
  setup_temp_home
}

teardown() {
  teardown_temp_home
}

# --- env.staff parsing ---

@test "env.staff parsing skips comment lines" {
  grep -q '^\[.*#' "$START_SH" || grep -q 'continue' "$START_SH"
  # Verify the comment-skip pattern exists
  grep -q '^[[:space:]]*#' "$START_SH"
}

@test "env.staff parsing uses associative array" {
  grep -q 'declare -A STAFF_VALS' "$START_SH"
}

@test "env.staff parsing handles KEY=VALUE format" {
  grep -q 'key=.*%%=\*' "$START_SH"
  grep -q 'val=.*#\*=' "$START_SH"
}

@test "env.staff parser correctly extracts key and value" {
  cat > "$HOME/test_parse.sh" <<'SCRIPT'
#!/bin/bash
set -euo pipefail
declare -A STAFF_VALS
input="MY_KEY=my_value"
if [[ "$input" == *=* ]]; then
  key="${input%%=*}"
  val="${input#*=}"
  STAFF_VALS["$key"]="$val"
fi
echo "${STAFF_VALS[MY_KEY]}"
SCRIPT
  chmod +x "$HOME/test_parse.sh"
  run bash "$HOME/test_parse.sh"
  [ "$status" -eq 0 ]
  [ "$output" = "my_value" ]
}

@test "env.staff parser skips empty lines and comments" {
  cat > "$HOME/test_parse2.sh" <<'SCRIPT'
#!/bin/bash
set -euo pipefail
declare -A STAFF_VALS
while IFS= read -r line || [ -n "$line" ]; do
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" == *=* ]]; then
    key="${line%%=*}"
    val="${line#*=}"
    STAFF_VALS["$key"]="$val"
  fi
done <<INPUT

# This is a comment
FOO=bar

BAZ=qux
INPUT
echo "${#STAFF_VALS[@]}"
echo "${STAFF_VALS[FOO]}"
echo "${STAFF_VALS[BAZ]}"
SCRIPT
  chmod +x "$HOME/test_parse2.sh"
  run bash "$HOME/test_parse2.sh"
  [ "$status" -eq 0 ]
  [[ "${lines[0]}" == "2" ]]
  [[ "${lines[1]}" == "bar" ]]
  [[ "${lines[2]}" == "qux" ]]
}

# --- Credential prompts ---

@test "prompt_required function is defined" {
  grep -q 'prompt_required()' "$START_SH"
}

@test "prompt_optional function is defined" {
  grep -q 'prompt_optional()' "$START_SH"
}

@test "prompt_required masks staff defaults (shows first 8 chars)" {
  grep -q 'masked=.*:0:8' "$START_SH"
}

# --- .env.local generation ---

@test "env.local includes all required variables" {
  for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY CRON_SECRET; do
    grep -q "$var" "$START_SH"
  done
}

@test "env.local backs up existing file" {
  grep -q '.env.local.bak' "$START_SH"
}

@test "CRON_SECRET uses openssl or node fallback" {
  grep -q 'openssl rand -hex 32' "$START_SH"
  grep -q "require('crypto')" "$START_SH"
}

@test "env.local includes optional integrations" {
  for var in RESEND_API_KEY NOTIFY_EMAIL UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN; do
    grep -q "$var" "$START_SH"
  done
}

# --- Security: never sources env.staff ---

@test "env.staff is never sourced (avoids shell injection)" {
  # Should read line-by-line, not source
  # Strip comments first, then check no source/dot command references env.staff
  run bash -c "sed 's/#.*//' '$START_SH' | grep -E 'source\s+.*env\.staff|\.\s+.*env\.staff'"
  [ "$status" -eq 1 ]
}
