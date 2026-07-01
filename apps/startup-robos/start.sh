#!/usr/bin/env bash
# StartupRobos — AI CXO Startup Platform
# Usage: bash <(curl -sL https://raw.githubusercontent.com/Robo-Co-op/StartupRobos/main/start.sh)

set -euo pipefail

echo ""
echo "  StartupRobos — AI CXO Startup Platform"
echo "  ========================================"
echo ""

# ---------------------------------------------------------------------------
# 1. Check required tools: git, node, npm
# ---------------------------------------------------------------------------
for cmd in git node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "  ERROR: Required tool not found: $cmd"
    echo "  Please install $cmd and try again."
    exit 1
  fi
done

# ---------------------------------------------------------------------------
# 2. Check for Claude Code CLI
# ---------------------------------------------------------------------------
if ! command -v claude &>/dev/null; then
  echo "  Claude Code CLI is required."
  echo "  Install: npm install -g @anthropic-ai/claude-code@1"
  echo ""
  read -r -p "  Install now? (y/n): " install_cc </dev/tty || true
  if [[ "$install_cc" == "y" || "$install_cc" == "Y" ]]; then
    npm install -g @anthropic-ai/claude-code@1
  else
    echo "  Please install Claude Code and try again."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 3. Clone StartupRobos (skip if already exists)
# ---------------------------------------------------------------------------
TARGET_DIR="StartupRobos"

if [ -d "$TARGET_DIR" ]; then
  echo "  $TARGET_DIR/ already exists — skipping clone."
else
  echo "  Cloning StartupRobos..."
  git clone --depth 1 https://github.com/Robo-Co-op/StartupRobos.git "$TARGET_DIR"
fi

# ---------------------------------------------------------------------------
# 3b. Install robobuilder into plugins directory (platform-aware)
# ---------------------------------------------------------------------------
ROBOBUILDER_REF="9f9eabd53680f6b5749fcf7b504d8381f7eb6c1d"

# Detect platform and set plugins path accordingly
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    # Native Windows (Git Bash / MSYS2 / Cygwin)
    if [ -n "${APPDATA:-}" ]; then
      PLUGINS_DIR="$APPDATA/claude/plugins"
    else
      PLUGINS_DIR="$HOME/.claude/plugins"
    fi
    ;;
  *)
    # Linux, macOS, WSL (all use ~/.claude/plugins/)
    PLUGINS_DIR="$HOME/.claude/plugins"
    ;;
esac

ROBOBUILDER_DIR="$PLUGINS_DIR/robobuilder"

mkdir -p "$PLUGINS_DIR"

if [ -d "$ROBOBUILDER_DIR" ]; then
  echo "  Updating robobuilder..."
  git -C "$ROBOBUILDER_DIR" fetch origin 2>/dev/null \
    && git -C "$ROBOBUILDER_DIR" checkout "$ROBOBUILDER_REF" 2>/dev/null \
    || echo "  WARNING: robobuilder update skipped. Continuing."
else
  echo "  Installing robobuilder..."
  git clone https://github.com/Robo-Co-op/robobuilder.git "$ROBOBUILDER_DIR" 2>/dev/null \
    && git -C "$ROBOBUILDER_DIR" checkout "$ROBOBUILDER_REF" 2>/dev/null \
    || echo "  WARNING: robobuilder install failed. Continuing."
fi

# ---------------------------------------------------------------------------
# 4. Parse env.staff (line-by-line; never source to avoid shell injection)
# ---------------------------------------------------------------------------
declare -A STAFF_VALS

if [ -f "env.staff" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    # Require KEY=VALUE format; silently skip malformed lines
    if [[ "$line" == *=* ]]; then
      key="${line%%=*}"
      val="${line#*=}"
      STAFF_VALS["$key"]="$val"
    fi
  done < "env.staff"
fi

# ---------------------------------------------------------------------------
# Helper: prompt for a REQUIRED value (loops until non-empty)
# Shows masked staff default when available.
# ---------------------------------------------------------------------------
prompt_required() {
  local key="$1"
  local label="$2"
  local result=""
  local staff_val="${STAFF_VALS[$key]:-}"

  if [ -n "$staff_val" ]; then
    local masked="${staff_val:0:8}..."
    read -r -p "  $label (default: $masked): " result </dev/tty || true
    if [ -z "$result" ]; then
      result="$staff_val"
    fi
  else
    while [ -z "$result" ]; do
      read -r -p "  $label: " result </dev/tty || true
    done
  fi

  printf '%s' "$result"
}

# ---------------------------------------------------------------------------
# Helper: prompt for an OPTIONAL value (empty = skip)
# ---------------------------------------------------------------------------
prompt_optional() {
  local key="$1"
  local label="$2"
  local result=""
  local staff_val="${STAFF_VALS[$key]:-}"

  if [ -n "$staff_val" ]; then
    local masked="${staff_val:0:8}..."
    read -r -p "  $label (press Enter to skip, default: $masked): " result </dev/tty || true
    if [ -z "$result" ]; then
      result="$staff_val"
    fi
  else
    read -r -p "  $label (press Enter to skip): " result </dev/tty || true
  fi

  printf '%s' "$result"
}

# ---------------------------------------------------------------------------
# Prompt for required credentials
# ---------------------------------------------------------------------------
echo ""
echo "  Enter your credentials:"
echo ""

SUPABASE_URL=$(prompt_required "NEXT_PUBLIC_SUPABASE_URL" "Supabase URL")
SUPABASE_ANON_KEY=$(prompt_required "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase Anon Key")
SERVICE_ROLE_KEY=$(prompt_required "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key")
ANTHROPIC_API_KEY=$(prompt_required "ANTHROPIC_API_KEY" "Anthropic API Key")

# ---------------------------------------------------------------------------
# Optional integrations
# ---------------------------------------------------------------------------
echo ""
echo "  Optional integrations:"
echo ""

RESEND_API_KEY=$(prompt_optional "RESEND_API_KEY" "Resend API Key")
NOTIFY_EMAIL=$(prompt_optional "NOTIFY_EMAIL" "Notify Email")
UPSTASH_REDIS_REST_URL=$(prompt_optional "UPSTASH_REDIS_REST_URL" "Upstash Redis REST URL")
UPSTASH_REDIS_REST_TOKEN=$(prompt_optional "UPSTASH_REDIS_REST_TOKEN" "Upstash Redis REST Token")

# ---------------------------------------------------------------------------
# 5. Generate CRON_SECRET
# ---------------------------------------------------------------------------
if command -v openssl &>/dev/null; then
  CRON_SECRET=$(openssl rand -hex 32)
else
  CRON_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
fi

# ---------------------------------------------------------------------------
# 6. Write .env.local (backup existing)
# ---------------------------------------------------------------------------
# Strip newlines to prevent heredoc injection attacks
SUPABASE_URL="${SUPABASE_URL//$'\n'/}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY//$'\n'/}"
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY//$'\n'/}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY//$'\n'/}"
RESEND_API_KEY="${RESEND_API_KEY//$'\n'/}"
NOTIFY_EMAIL="${NOTIFY_EMAIL//$'\n'/}"
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL//$'\n'/}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN//$'\n'/}"

ENV_FILE="$TARGET_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.bak"
  echo "  Backed up existing .env.local to .env.local.bak"
fi

cat > "$ENV_FILE" <<ENV
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
CRON_SECRET=$CRON_SECRET
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=$RESEND_API_KEY
NOTIFY_EMAIL=$NOTIFY_EMAIL
UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN
ENV

echo ""
echo "  .env.local written."

# ---------------------------------------------------------------------------
# 7. npm install
# ---------------------------------------------------------------------------
echo "  Installing dependencies..."
npm install --prefix "$TARGET_DIR"

# ---------------------------------------------------------------------------
# 8. Launch Claude Code
# ---------------------------------------------------------------------------
echo ""
echo "  ========================================"
echo "  Ready! Launching Claude Code..."
echo ""

cd "$TARGET_DIR"
exec claude
