#!/usr/bin/env node
/**
 * PostToolUse hook: Track cost of API calls
 * Record model and token count after Agent tool usage
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const COST_LOG = path.join(ROOT, 'memory', 'cost-log.jsonl')

// Cost per model (USD / 1M tokens)
const COSTS = {
  'opus': { input: 15.0, output: 75.0 },
  'sonnet': { input: 3.0, output: 15.0 },
  'haiku': { input: 1.0, output: 5.0 },
}

function main() {
  let input = ''
  try {
    input = fs.readFileSync(0, 'utf-8')
  } catch {
    process.exit(0)
  }

  let toolResult
  try {
    toolResult = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  // Track only Agent tool results
  if (toolResult.tool_name !== 'Agent') {
    process.exit(0)
  }

  const memDir = path.join(ROOT, 'memory')
  if (!fs.existsSync(memDir)) {
    fs.mkdirSync(memDir, { recursive: true })
  }

  const entry = {
    timestamp: new Date().toISOString(),
    tool: toolResult.tool_name,
    model: toolResult.tool_input?.model || 'sonnet',
    description: toolResult.tool_input?.description || '',
  }

  fs.appendFileSync(COST_LOG, JSON.stringify(entry) + '\n')
}

main()
