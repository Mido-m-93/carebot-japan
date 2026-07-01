#!/usr/bin/env node
/**
 * pre-compact hook: Save important state before context compression
 * Back up information that would be lost during compaction to memory/
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
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true })
  }

  const dateStr = getDateStr()
  const timeStr = getTimeStr()
  const dailyFile = path.join(MEMORY_DIR, `${dateStr}.md`)

  // Receive context summary from stdin
  let input = ''
  try {
    input = fs.readFileSync(0, 'utf-8')
  } catch {
    // No stdin
  }

  const entry = `\n### Pre-compact ${timeStr} UTC\n${input || '(No context state)'}\n`
  fs.appendFileSync(dailyFile, entry)
  console.log(`Saved pre-compact state: ${dailyFile}`)
}

main()
