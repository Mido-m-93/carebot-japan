#!/usr/bin/env node
/**
 * Session start hook: Load previous memory and context
 * - MEMORY.md (long-term memory)
 * - Today's and yesterday's daily notes
 * - Recent agent_runs summary
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const MEMORY_DIR = path.join(ROOT, 'memory')
const MEMORY_MD = path.join(MEMORY_DIR, 'MEMORY.md')

function getDateStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function readIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

function main() {
  const parts = []

  // Long-term memory
  const memory = readIfExists(MEMORY_MD)
  if (memory) {
    parts.push('## Long-term Memory (MEMORY.md)\n' + memory)
  }

  // Today's daily notes
  const today = readIfExists(path.join(MEMORY_DIR, `${getDateStr(0)}.md`))
  if (today) {
    parts.push(`## Today's Notes (${getDateStr(0)})\n` + today)
  }

  // Yesterday's daily notes
  const yesterday = readIfExists(path.join(MEMORY_DIR, `${getDateStr(-1)}.md`))
  if (yesterday) {
    parts.push(`## Yesterday's Notes (${getDateStr(-1)})\n` + yesterday)
  }

  if (parts.length > 0) {
    // Output as session context
    console.log('--- Launchpad Memory Loaded ---')
    console.log(parts.join('\n\n'))
    console.log('--- End Memory ---')
  }
}

main()
