# Shared helpers for start.sh bats tests
# Source this file from each test slice.

# Path to the script under test
START_SH="${BATS_TEST_DIRNAME}/../start.sh"

# Create a temporary HOME so tests don't pollute the real one
setup_temp_home() {
  export ORIG_HOME="$HOME"
  export HOME="$(mktemp -d)"
  export TMPDIR="$HOME/tmp"
  mkdir -p "$TMPDIR"
  cd "$HOME"
}

teardown_temp_home() {
  cd /
  rm -rf "$HOME"
  export HOME="$ORIG_HOME"
}

# Extract a specific section of start.sh between two comment markers
# Usage: extract_section "3b. Install robobuilder"
extract_section() {
  local marker="$1"
  sed -n "/# .*${marker}/,/^# ---/p" "$START_SH"
}

# Stub out a command by creating a script in PATH
stub_command() {
  local cmd="$1"
  local exit_code="${2:-0}"
  local output="${3:-}"
  local stub_dir="$HOME/stubs"
  mkdir -p "$stub_dir"
  cat > "$stub_dir/$cmd" <<STUB
#!/bin/bash
${output:+echo "$output"}
exit $exit_code
STUB
  chmod +x "$stub_dir/$cmd"
  export PATH="$stub_dir:$PATH"
}

# Remove a stub
unstub_command() {
  local cmd="$1"
  rm -f "$HOME/stubs/$cmd"
}
