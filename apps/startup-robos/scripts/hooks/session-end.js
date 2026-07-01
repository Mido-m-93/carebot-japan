#!/usr/bin/env node
/**
 * Session end hook: Save important session information to daily notes
 * - What was done in today's session
 * - Important decisions
 * - Next steps to take
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const MEMORY_DIR = path.join(ROOT, 'memory')

function getDateStr() {
  return new Date().toISOString().slice(0, 10)
}

function getTimeStr() {
  return new Date().toISOString().slice(11, 16)
}

function main() {
  // Check memory/ directory
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })
  }

  const dateStr = getDateStr()
  const timeStr = getTimeStr()
  const dailyFile = path.join(MEMORY_DIR, `${dateStr}.md`)

  // Extract summary from session transcript
  // Receive session summary from stdin (passed by CC)
  let input = ''
  try {
    input = fs.readFileSync(0, 'utf-8') // stdin
  } catch {
    // stdin is empty
  }

  const entry = `\n### Session ${timeStr} UTC\n${input || '(No session content)'}\n`

  // Append to daily notes
  fs.appendFileSync(dailyFile, entry)
  console.log(`Session record saved to ${dailyFile}`)
}

main()
