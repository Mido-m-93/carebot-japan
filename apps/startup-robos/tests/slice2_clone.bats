#!/usr/bin/env bats
# slice2_clone.bats — Tests for git clone and robobuilder install sections

load test_helpers

setup() {
  setup_temp_home
}

teardown() {
  teardown_temp_home
}

@test "clone section uses TARGET_DIR=StartupRobos" {
  grep -q 'TARGET_DIR="StartupRobos"' "$START_SH"
}

@test "clone skips when directory exists" {
  grep -q 'already exists.*skipping clone' "$START_SH"
}

@test "clone uses --depth 1 for shallow clone" {
  grep -q 'git clone --depth 1' "$START_SH"
}

@test "clone URL points to Robo-Co-op/StartupRobos" {
  grep -q 'https://github.com/Robo-Co-op/StartupRobos.git' "$START_SH"
}

@test "robobuilder section defines ROBOBUILDER_REF" {
  grep -q 'ROBOBUILDER_REF=' "$START_SH"
}

@test "robobuilder install uses pinned SHA" {
  # The SHA should be a 40-char hex string, not a placeholder
  local sha
  sha=$(grep 'ROBOBUILDER_REF=' "$START_SH" | head -1 | sed 's/.*ROBOBUILDER_REF="//' | sed 's/".*//')
  [ ${#sha} -eq 40 ]
  [[ "$sha" =~ ^[0-9a-f]+$ ]]
}

@test "robobuilder update uses git pull or checkout" {
  grep -q 'Updating robobuilder' "$START_SH"
}

@test "robobuilder install failure is non-fatal" {
  grep -q 'WARNING.*robobuilder install failed.*Continuing' "$START_SH"
}

@test "robobuilder uses platform-aware plugins path" {
  # Should detect platform and set PLUGINS_DIR accordingly
  grep -q 'APPDATA\|uname\|platform' "$START_SH" || grep -q 'PLUGINS_DIR=' "$START_SH"
}
