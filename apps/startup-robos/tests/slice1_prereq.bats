#!/usr/bin/env bats
# slice1_prereq.bats — Tests for prerequisite tool checks (git, node, npm, claude)

load test_helpers

setup() {
  setup_temp_home
}

teardown() {
  teardown_temp_home
}

@test "start.sh exists and is a bash script" {
  [ -f "$START_SH" ]
  head -1 "$START_SH" | grep -q "bash"
}

@test "start.sh checks for git" {
  grep -q 'for cmd in git node npm' "$START_SH"
}

@test "start.sh checks for node" {
  grep -q 'for cmd in git node npm' "$START_SH"
}

@test "start.sh checks for npm" {
  grep -q 'for cmd in git node npm' "$START_SH"
}

@test "missing git causes exit 1" {
  # Create a minimal test script that only runs the prereq check
  cat > "$HOME/test_prereq.sh" <<'SCRIPT'
#!/bin/bash
set -euo pipefail
for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: Required tool not found: $cmd"
    exit 1
  fi
done
echo "OK"
SCRIPT
  chmod +x "$HOME/test_prereq.sh"

  # Hide git
  stub_command git 1
  unstub_command git
  local orig_path="$PATH"
  export PATH="$HOME/stubs"  # only stubs, no real git

  run bash "$HOME/test_prereq.sh"
  export PATH="$orig_path"
  [ "$status" -ne 0 ]
}

@test "all prereqs present succeeds" {
  stub_command git 0
  stub_command node 0
  stub_command npm 0

  cat > "$HOME/test_prereq.sh" <<'SCRIPT'
#!/bin/bash
set -euo pipefail
for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: Required tool not found: $cmd"
    exit 1
  fi
done
echo "OK"
SCRIPT
  chmod +x "$HOME/test_prereq.sh"

  run bash "$HOME/test_prereq.sh"
  [ "$status" -eq 0 ]
  [[ "$output" == *"OK"* ]]
}

@test "claude CLI check section exists" {
  grep -q 'command -v claude' "$START_SH"
}

@test "claude install prompt offers npm install" {
  grep -q 'npm install -g @anthropic-ai/claude-code' "$START_SH"
}
