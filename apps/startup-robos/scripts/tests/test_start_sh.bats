#!/usr/bin/env bats
# TDD tests for start.sh

SCRIPT_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)"
START_SH="$SCRIPT_DIR/start.sh"

# Save original PATH for setup
ORIG_PATH="$PATH"

# Standard inputs for tests (4 required + 4 optional)
STANDARD_INPUTS="https://test.supabase.co
test-anon-key-123
test-service-role-key-456
sk-ant-test-api-key-789




"

setup() {
  # Create fake PATH directories before tests
  mkdir -p /tmp/fake-path-no-git
  mkdir -p /tmp/fake-path-no-node
  mkdir -p /tmp/fake-path-no-npm

  # Get real tool locations
  REAL_GIT="$(which git)"
  REAL_NODE="$(which node)"
  REAL_NPM="$(which npm)"
  REAL_BASH="$(which bash)"

  # Setup fake-path-no-git (has node, npm, bash but not git)
  ln -sf "$REAL_NODE" /tmp/fake-path-no-git/node 2>/dev/null || true
  ln -sf "$REAL_NPM" /tmp/fake-path-no-git/npm 2>/dev/null || true
  ln -sf "$REAL_BASH" /tmp/fake-path-no-git/bash 2>/dev/null || true

  # Setup fake-path-no-node (has git, npm, bash but not node)
  ln -sf "$REAL_GIT" /tmp/fake-path-no-node/git 2>/dev/null || true
  ln -sf "$REAL_NPM" /tmp/fake-path-no-node/npm 2>/dev/null || true
  ln -sf "$REAL_BASH" /tmp/fake-path-no-node/bash 2>/dev/null || true

  # Setup fake-path-no-npm (has git, node, bash but not npm)
  ln -sf "$REAL_GIT" /tmp/fake-path-no-npm/git 2>/dev/null || true
  ln -sf "$REAL_NODE" /tmp/fake-path-no-npm/node 2>/dev/null || true
  ln -sf "$REAL_BASH" /tmp/fake-path-no-npm/bash 2>/dev/null || true
}

# Helper to create a full fake PATH with all needed tools
# Note: Call this BEFORE creating any fake scripts
setup_full_fake_path() {
  local path_dir="$1"
  /bin/rm -rf "$path_dir"
  /bin/mkdir -p "$path_dir"
  /bin/ln -sf "$(which node)" "$path_dir/node" 2>/dev/null || true
  /bin/ln -sf "$(which bash)" "$path_dir/bash" 2>/dev/null || true
  /bin/ln -sf "$(which openssl)" "$path_dir/openssl" 2>/dev/null || true
  /bin/ln -sf "$(which cat)" "$path_dir/cat" 2>/dev/null || true
  /bin/ln -sf "$(which mkdir)" "$path_dir/mkdir" 2>/dev/null || true
  /bin/ln -sf "$(which cp)" "$path_dir/cp" 2>/dev/null || true
  /bin/ln -sf "$(which echo)" "$path_dir/echo" 2>/dev/null || true
  /bin/ln -sf "$(which tr)" "$path_dir/tr" 2>/dev/null || true
  /bin/ln -sf "$(which printf)" "$path_dir/printf" 2>/dev/null || true
  /bin/ln -sf "$(which test)" "$path_dir/test" 2>/dev/null || true
  /bin/ln -sf "$(which [)" "$path_dir/[" 2>/dev/null || true
}

# =============================================================================
# Slice 1: Prereq check (git, node, npm)
# =============================================================================

@test "exits 1 when git is missing" {
  export PATH="/tmp/fake-path-no-git"

  run bash "$START_SH"

  [ "$status" -eq 1 ]
  [[ "$output" == *"git"* ]]
}

@test "exits 1 when node is missing" {
  export PATH="/tmp/fake-path-no-node"

  run bash "$START_SH"

  [ "$status" -eq 1 ]
  [[ "$output" == *"node"* ]]
}

@test "exits 1 when npm is missing" {
  export PATH="/tmp/fake-path-no-npm"

  run bash "$START_SH"

  [ "$status" -eq 1 ]
  [[ "$output" == *"npm"* ]]
}

# =============================================================================
# Slice 2: Claude CLI check + install offer
# =============================================================================

@test "offers to install claude when missing" {
  /bin/rm -rf /tmp/fake-path-no-claude
  /bin/mkdir -p /tmp/fake-path-no-claude
  /bin/ln -sf "$(which git)" /tmp/fake-path-no-claude/git
  /bin/ln -sf "$(which node)" /tmp/fake-path-no-claude/node
  /bin/ln -sf "$(which npm)" /tmp/fake-path-no-claude/npm
  /bin/ln -sf "$(which bash)" /tmp/fake-path-no-claude/bash

  export PATH="/tmp/fake-path-no-claude"

  run bash "$START_SH" <<< "n"

  [[ "$output" == *"Claude Code"* ]]
  [[ "$output" == *"Install"* ]] || [[ "$output" == *"install"* ]]
}

@test "exits 1 when claude missing and user declines install" {
  /bin/rm -rf /tmp/fake-path-no-claude2
  /bin/mkdir -p /tmp/fake-path-no-claude2
  /bin/ln -sf "$(which git)" /tmp/fake-path-no-claude2/git
  /bin/ln -sf "$(which node)" /tmp/fake-path-no-claude2/node
  /bin/ln -sf "$(which npm)" /tmp/fake-path-no-claude2/npm
  /bin/ln -sf "$(which bash)" /tmp/fake-path-no-claude2/bash

  export PATH="/tmp/fake-path-no-claude2"

  run bash "$START_SH" <<< "n"

  [ "$status" -eq 1 ]
}

# =============================================================================
# Slice 3: Clone StartupRobos (skip if exists)
# =============================================================================

@test "skips clone if StartupRobos directory exists" {
  TEST_DIR="/tmp/test-clone-skip-$$"
  FAKE_HOME="/tmp/fake-home-skip-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-clone-skip"

  /bin/cat > /tmp/fake-path-clone-skip/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-clone-skip/git

  /bin/cat > /tmp/fake-path-clone-skip/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-clone-skip/npm

  /bin/cat > /tmp/fake-path-clone-skip/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-clone-skip/claude

  export PATH="/tmp/fake-path-clone-skip"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [[ "$output" == *"already exists"* ]] || [[ "$output" == *"skipping"* ]]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Slice 4: Prompt 4 required vars + write .env.local (with CRON_SECRET)
# =============================================================================

@test ".env.local contains all 5 required keys" {
  TEST_DIR="/tmp/test-env-local-$$"
  FAKE_HOME="/tmp/fake-home-env-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-env-local"

  /bin/cat > /tmp/fake-path-env-local/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-env-local/git

  /bin/cat > /tmp/fake-path-env-local/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-env-local/npm

  /bin/cat > /tmp/fake-path-env-local/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-env-local/claude

  export PATH="/tmp/fake-path-env-local"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  export PATH="$ORIG_PATH"

  [ -f "$TEST_DIR/StartupRobos/.env.local" ]
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_URL=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "SUPABASE_SERVICE_ROLE_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "ANTHROPIC_API_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "CRON_SECRET=" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Slice 5: npm install
# =============================================================================

@test "runs npm install in StartupRobos directory" {
  TEST_DIR="/tmp/test-npm-install-$$"
  FAKE_HOME="/tmp/fake-home-npm-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-npm-install"

  /bin/cat > /tmp/fake-path-npm-install/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-npm-install/git

  /bin/cat > /tmp/fake-path-npm-install/npm <<'FAKENPM'
#!/bin/bash
echo "NPM_CALLED: $@" >> /tmp/npm_calls.log
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-npm-install/npm

  /bin/cat > /tmp/fake-path-npm-install/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-npm-install/claude

  /bin/rm -f /tmp/npm_calls.log

  export PATH="/tmp/fake-path-npm-install"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ -f /tmp/npm_calls.log ]
  /bin/grep -q "install" /tmp/npm_calls.log

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME" /tmp/npm_calls.log
}

# =============================================================================
# Slice 6: Launch claude
# =============================================================================

@test "outputs 'Launching Claude Code' and calls claude" {
  TEST_DIR="/tmp/test-launch-$$"
  FAKE_HOME="/tmp/fake-home-launch-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-launch"

  /bin/cat > /tmp/fake-path-launch/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-launch/git

  /bin/cat > /tmp/fake-path-launch/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-launch/npm

  /bin/cat > /tmp/fake-path-launch/claude <<'FAKECLAUDE'
#!/bin/bash
echo "CLAUDE_LAUNCHED" >> /tmp/claude_calls.log
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-launch/claude

  /bin/rm -f /tmp/claude_calls.log

  export PATH="/tmp/fake-path-launch"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [[ "$output" == *"Launching Claude Code"* ]]
  [ -f /tmp/claude_calls.log ]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME" /tmp/claude_calls.log
}

# =============================================================================
# Issue #12: Robustness - .env.local backup
# =============================================================================

@test ".env.local.bak created when .env.local already exists" {
  TEST_DIR="/tmp/test-env-backup-$$"
  FAKE_HOME="/tmp/fake-home-backup-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  echo "EXISTING_KEY=old_value" > "$TEST_DIR/StartupRobos/.env.local"

  setup_full_fake_path "/tmp/fake-path-backup"

  /bin/cat > /tmp/fake-path-backup/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-backup/git

  /bin/cat > /tmp/fake-path-backup/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-backup/npm

  /bin/cat > /tmp/fake-path-backup/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-backup/claude

  export PATH="/tmp/fake-path-backup"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ -f "$TEST_DIR/StartupRobos/.env.local.bak" ]
  /bin/grep -q "EXISTING_KEY=old_value" "$TEST_DIR/StartupRobos/.env.local.bak"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Issue #12: Robustness - NEXT_PUBLIC_APP_URL without prompt
# =============================================================================

@test ".env.local contains NEXT_PUBLIC_APP_URL=http://localhost:3000 without prompt" {
  TEST_DIR="/tmp/test-app-url-$$"
  FAKE_HOME="/tmp/fake-home-appurl-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-appurl"

  /bin/cat > /tmp/fake-path-appurl/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-appurl/git

  /bin/cat > /tmp/fake-path-appurl/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-appurl/npm

  /bin/cat > /tmp/fake-path-appurl/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-appurl/claude

  export PATH="/tmp/fake-path-appurl"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  export PATH="$ORIG_PATH"

  [ -f "$TEST_DIR/StartupRobos/.env.local" ]
  /bin/grep -q "NEXT_PUBLIC_APP_URL=http://localhost:3000" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Issue #12: Robustness - Optional env vars (10 keys total)
# =============================================================================

@test ".env.local contains all 10 keys including optional ones" {
  TEST_DIR="/tmp/test-optional-vars-$$"
  FAKE_HOME="/tmp/fake-home-optional-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-optional"

  /bin/cat > /tmp/fake-path-optional/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-optional/git

  /bin/cat > /tmp/fake-path-optional/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-optional/npm

  /bin/cat > /tmp/fake-path-optional/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-optional/claude

  export PATH="/tmp/fake-path-optional"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  export PATH="$ORIG_PATH"

  [ -f "$TEST_DIR/StartupRobos/.env.local" ]

  /bin/grep -q "NEXT_PUBLIC_SUPABASE_URL=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "SUPABASE_SERVICE_ROLE_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "ANTHROPIC_API_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "CRON_SECRET=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "NEXT_PUBLIC_APP_URL=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "RESEND_API_KEY=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "NOTIFY_EMAIL=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "UPSTASH_REDIS_REST_URL=" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "UPSTASH_REDIS_REST_TOKEN=" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Issue #14: Staff pre-config - env.staff defaults
# =============================================================================

@test "env.staff provides defaults for prompts" {
  TEST_DIR="/tmp/test-staff-config-$$"
  FAKE_HOME="/tmp/fake-home-staff-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  /bin/cat > "$TEST_DIR/env.staff" <<'ENVSTAFF'
NEXT_PUBLIC_SUPABASE_URL=https://staffpre.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staff-anon-key-12345678
SUPABASE_SERVICE_ROLE_KEY=staff-service-key-87654321
ANTHROPIC_API_KEY=sk-ant-staff-key-abcdefgh
ENVSTAFF

  setup_full_fake_path "/tmp/fake-path-staff"

  /bin/cat > /tmp/fake-path-staff/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-staff/git

  /bin/cat > /tmp/fake-path-staff/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-staff/npm

  /bin/cat > /tmp/fake-path-staff/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-staff/claude

  export PATH="/tmp/fake-path-staff"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  # Press Enter 8 times to accept all staff defaults + skip optionals
  run bash "$START_SH" <<EOF








EOF

  export PATH="$ORIG_PATH"

  [ -f "$TEST_DIR/StartupRobos/.env.local" ]
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_URL=https://staffpre.supabase.co" "$TEST_DIR/StartupRobos/.env.local"
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=staff-anon-key-12345678" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

@test "env.staff shows masked hint (first 8 chars)" {
  TEST_DIR="/tmp/test-staff-hint-$$"
  FAKE_HOME="/tmp/fake-home-hint-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  /bin/cat > "$TEST_DIR/env.staff" <<'ENVSTAFF'
NEXT_PUBLIC_SUPABASE_URL=https://staffhint.supabase.co
ENVSTAFF

  setup_full_fake_path "/tmp/fake-path-hint"

  /bin/cat > /tmp/fake-path-hint/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-hint/git

  /bin/cat > /tmp/fake-path-hint/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-hint/npm

  /bin/cat > /tmp/fake-path-hint/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-hint/claude

  export PATH="/tmp/fake-path-hint"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [[ "$output" == *"https://"* ]] && [[ "$output" == *"..."* ]]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

@test "user override replaces env.staff default" {
  TEST_DIR="/tmp/test-staff-override-$$"
  FAKE_HOME="/tmp/fake-home-override-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  /bin/cat > "$TEST_DIR/env.staff" <<'ENVSTAFF'
NEXT_PUBLIC_SUPABASE_URL=https://staffvalue.supabase.co
ENVSTAFF

  setup_full_fake_path "/tmp/fake-path-override"

  /bin/cat > /tmp/fake-path-override/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-override/git

  /bin/cat > /tmp/fake-path-override/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-override/npm

  /bin/cat > /tmp/fake-path-override/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-override/claude

  export PATH="/tmp/fake-path-override"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<EOF
https://useroverride.supabase.co
user-anon-key
user-service-key
sk-ant-user-key




EOF

  export PATH="$ORIG_PATH"

  [ -f "$TEST_DIR/StartupRobos/.env.local" ]
  /bin/grep -q "NEXT_PUBLIC_SUPABASE_URL=https://useroverride.supabase.co" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

@test "malformed env.staff line is skipped" {
  TEST_DIR="/tmp/test-malformed-staff-$$"
  FAKE_HOME="/tmp/fake-home-malformed-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  /bin/cat > "$TEST_DIR/env.staff" <<'ENVSTAFF'
MALFORMED_LINE_WITHOUT_EQUALS
NEXT_PUBLIC_SUPABASE_URL=https://valid.supabase.co
ENVSTAFF

  setup_full_fake_path "/tmp/fake-path-malformed"

  /bin/cat > /tmp/fake-path-malformed/git <<'FAKEGIT'
#!/bin/bash
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-malformed/git

  /bin/cat > /tmp/fake-path-malformed/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-malformed/npm

  /bin/cat > /tmp/fake-path-malformed/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-malformed/claude

  export PATH="/tmp/fake-path-malformed"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  # Accept default for URL (Enter), provide others
  run bash "$START_SH" <<EOF

user-anon-key
user-service-key
sk-ant-user-key




EOF

  [ "$status" -eq 0 ]

  export PATH="$ORIG_PATH"

  /bin/grep -q "NEXT_PUBLIC_SUPABASE_URL=https://valid.supabase.co" "$TEST_DIR/StartupRobos/.env.local"

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

# =============================================================================
# Issue #13: Robobuilder install
# =============================================================================

@test "robobuilder cloned to ~/.claude/plugins/robobuilder/" {
  TEST_DIR="/tmp/test-robobuilder-$$"
  FAKE_HOME="/tmp/fake-home-rb-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME"

  setup_full_fake_path "/tmp/fake-path-robobuilder"

  /bin/cat > /tmp/fake-path-robobuilder/git <<'FAKEGIT'
#!/bin/bash
if [[ "$1" == "clone" ]]; then
  echo "GIT_CLONE: $@" >> /tmp/git_calls.log
  mkdir -p "${@: -1}"
  mkdir -p "${@: -1}/.git"
fi
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-robobuilder/git

  /bin/cat > /tmp/fake-path-robobuilder/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-robobuilder/npm

  /bin/cat > /tmp/fake-path-robobuilder/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-robobuilder/claude

  /bin/rm -f /tmp/git_calls.log

  export PATH="/tmp/fake-path-robobuilder"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ -f /tmp/git_calls.log ]
  /bin/grep -q "robobuilder" /tmp/git_calls.log
  [ -d "$FAKE_HOME/.claude/plugins/robobuilder" ]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME" /tmp/git_calls.log
}

@test "robobuilder git pull if already exists" {
  TEST_DIR="/tmp/test-robobuilder-pull-$$"
  FAKE_HOME="/tmp/fake-home-pull-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-rb-pull"

  /bin/cat > /tmp/fake-path-rb-pull/git <<'FAKEGIT'
#!/bin/bash
if [[ "$1" == "-C" ]] && [[ "$3" == "pull" ]]; then
  echo "GIT_PULL: $@" >> /tmp/git_pull_calls.log
fi
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-rb-pull/git

  /bin/cat > /tmp/fake-path-rb-pull/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-rb-pull/npm

  /bin/cat > /tmp/fake-path-rb-pull/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-rb-pull/claude

  /bin/rm -f /tmp/git_pull_calls.log

  export PATH="/tmp/fake-path-rb-pull"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ -f /tmp/git_pull_calls.log ]
  /bin/grep -q "pull" /tmp/git_pull_calls.log
  /bin/grep -q "ff-only" /tmp/git_pull_calls.log

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME" /tmp/git_pull_calls.log
}

@test "robobuilder git pull failure is caught as warning" {
  TEST_DIR="/tmp/test-robobuilder-fail-$$"
  FAKE_HOME="/tmp/fake-home-fail-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME/.claude/plugins/robobuilder/.git"

  setup_full_fake_path "/tmp/fake-path-rb-fail"

  /bin/cat > /tmp/fake-path-rb-fail/git <<'FAKEGIT'
#!/bin/bash
if [[ "$1" == "-C" ]] && [[ "$3" == "pull" ]]; then
  exit 1
fi
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-rb-fail/git

  /bin/cat > /tmp/fake-path-rb-fail/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-rb-fail/npm

  /bin/cat > /tmp/fake-path-rb-fail/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-rb-fail/claude

  export PATH="/tmp/fake-path-rb-fail"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ "$status" -eq 0 ]
  [[ "$output" == *"Warning"* ]] || [[ "$output" == *"warning"* ]]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}

@test "~/.claude/plugins/ created if not exists" {
  TEST_DIR="/tmp/test-plugins-dir-$$"
  FAKE_HOME="/tmp/fake-home-plugins-$$"
  /bin/mkdir -p "$TEST_DIR/StartupRobos"
  /bin/mkdir -p "$FAKE_HOME"

  setup_full_fake_path "/tmp/fake-path-plugins"

  /bin/cat > /tmp/fake-path-plugins/git <<'FAKEGIT'
#!/bin/bash
if [[ "$1" == "clone" ]]; then
  mkdir -p "${@: -1}"
  mkdir -p "${@: -1}/.git"
fi
exit 0
FAKEGIT
  /bin/chmod +x /tmp/fake-path-plugins/git

  /bin/cat > /tmp/fake-path-plugins/npm <<'FAKENPM'
#!/bin/bash
exit 0
FAKENPM
  /bin/chmod +x /tmp/fake-path-plugins/npm

  /bin/cat > /tmp/fake-path-plugins/claude <<'FAKECLAUDE'
#!/bin/bash
exit 0
FAKECLAUDE
  /bin/chmod +x /tmp/fake-path-plugins/claude

  export PATH="/tmp/fake-path-plugins"
  export HOME="$FAKE_HOME"

  cd "$TEST_DIR"

  run bash "$START_SH" <<< "$STANDARD_INPUTS"

  [ -d "$FAKE_HOME/.claude/plugins" ]

  /bin/rm -rf "$TEST_DIR" "$FAKE_HOME"
}
