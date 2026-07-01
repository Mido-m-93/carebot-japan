#!/usr/bin/env node
/**
 * PreToolUse hook: Detect secrets before git commit
 * Verify that .env content, API keys, and tokens are not in staging
 */
const { execSync } = require('child_process')

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/,           // Anthropic / OpenAI API key
  /eyJ[a-zA-Z0-9_-]{50,}/,         // JWT token
  /ghp_[a-zA-Z0-9]{36}/,           // GitHub PAT
  /ghu_[a-zA-Z0-9]{36}/,           // GitHub user token
  /xoxb-[0-9]{10,}-[a-zA-Z0-9]+/,  // Slack bot token
  /AKIA[0-9A-Z]{16}/,              // AWS access key
  /supabase.*service_role.*/i,      // Supabase service role key mention
  /ca-pub-\d{16}/,                  // AdSense publisher ID (not secret but check)
]

const SENSITIVE_FILES = [
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  /credentials\.json$/,
  /\.pem$/,
  /\.key$/,
]

function main() {
  // Receive tool input from stdin
  let input = ''
  try {
    input = require('fs').readFileSync(0, 'utf-8')
  } catch {
    process.exit(0)
  }

  let toolInput
  try {
    toolInput = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  // Check only git commit commands from Bash
  if (!toolInput.tool_input?.command?.includes('git commit')) {
    process.exit(0)
  }

  // Check staged files
  try {
    const staged = execSync('git diff --cached --name-only', { cwd: process.env.PWD || '.' })
      .toString().trim().split('\n').filter(Boolean)

    // Check for sensitive files
    for (const file of staged) {
      for (const pattern of SENSITIVE_FILES) {
        if (pattern.test(file)) {
          console.error(`⚠️ Sensitive file is staged: ${file}`)
          console.error('Unstage with: git reset HEAD ' + file)
          process.exit(2)
        }
      }
    }

    // Check staged diff content
    const diff = execSync('git diff --cached', { cwd: process.env.PWD || '.' }).toString()
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(diff)) {
        console.error(`⚠️ Possible secret found in diff: ${pattern}`)
        console.error('Please verify before committing')
        process.exit(2)
      }
    }
  } catch {
    // Ignore git command failures
  }

  process.exit(0)
}

main()
