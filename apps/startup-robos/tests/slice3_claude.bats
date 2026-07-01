#!/usr/bin/env bats
# slice3_claude.bats — Tests for Claude Code CLI detection and launch

load test_helpers

setup() {
  setup_temp_home
}

teardown() {
  teardown_temp_home
}

@test "claude check uses command -v" {
  grep -q 'command -v claude' "$START_SH"
}

@test "claude install prompt reads from /dev/tty" {
  grep 'Install now' "$START_SH" | head -1
  grep -q '</dev/tty' "$START_SH"
}

@test "launch section uses exec claude" {
  grep -q 'exec claude' "$START_SH"
}

@test "launch section changes to TARGET_DIR first" {
  # cd into TARGET_DIR before exec claude
  grep -A2 'cd.*TARGET_DIR' "$START_SH" | grep -q 'exec claude'
}

@test "npm install runs with --prefix TARGET_DIR" {
  grep -q 'npm install --prefix.*TARGET_DIR' "$START_SH"
}
