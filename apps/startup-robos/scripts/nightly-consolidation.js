#!/usr/bin/env node
/**
 * Nightly consolidation script: Extract important information from daily notes and append to MEMORY.md
 * cron: Daily at 17:00 UTC (2:00 JST next day)
 *
 * Process:
 * 1. Read today's daily notes (memory/YYYY-MM-DD.md)
 * 2. Extract important information with Haiku
 * 3. Append to corresponding section in MEMORY.md
 * 4. Move daily notes older than 7 days to memory/archive/
 */
const fs = require('fs')
const path = require('path')
const Anthropic = require('@anthropic-ai/sdk')

const ROOT = path.resolve(__dirname, '..')
const MEMORY_DIR = path.join(ROOT, 'memory')
const ARCHIVE_DIR = path.join(MEMORY_DIR, 'archive')
const MEMORY_MD = path.join(MEMORY_DIR, 'MEMORY.md')

function getDateStr(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

async function extractImportantInfo(dailyContent) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `The following is today's session log from Launchpad (an AI entrepreneurship platform).
Extract only the important information that should be retained in long-term memory.

Categories:
- Important decisions (business strategy, technology choices, pivots)
- Lessons learned (insights discovered during troubleshooting)
- New facts (account creation, configuration changes, deployments)
- Next steps to take

Not needed: routine command execution, code change details

Each item should be in the format "- YYYY-MM-DD: content", maximum 5 items.
If there is nothing important, answer "none".

---
${dailyContent}
---`
    }],
    system: 'You are an information extraction assistant. Extract only important information concisely.',
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}

function archiveOldNotes() {
  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const files = fs.readdirSync(MEMORY_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)

  for (const file of files) {
    const dateStr = file.replace('.md', '')
    if (new Date(dateStr) < cutoff) {
      fs.renameSync(
        path.join(MEMORY_DIR, file),
        path.join(ARCHIVE_DIR, file)
      )
      console.log(`Archived: ${file}`)
    }
  }
}

async function main() {
  const today = getDateStr(0)
  const dailyFile = path.join(MEMORY_DIR, `${today}.md`)

  if (!fs.existsSync(dailyFile)) {
    console.log(`No daily notes for ${today}. Skipping.`)
    archiveOldNotes()
    return
  }

  const dailyContent = fs.readFileSync(dailyFile, 'utf-8')
  if (dailyContent.trim().length < 50) {
    console.log('Daily notes too short. Skipping.')
    archiveOldNotes()
    return
  }

  console.log('Extracting important information...')
  const extracted = await extractImportantInfo(dailyContent)

  if (extracted && extracted !== 'none') {
    // Append to MEMORY.md
    let memoryContent = fs.readFileSync(MEMORY_MD, 'utf-8')

    // Append to the end of "Lessons learned" section
    const marker = '## Lessons learned'
    if (memoryContent.includes(marker)) {
      memoryContent = memoryContent.replace(
        marker,
        `${extracted}\n\n${marker}`
      )
    } else {
      memoryContent += `\n\n## Extraction from ${today}\n${extracted}\n`
    }

    fs.writeFileSync(MEMORY_MD, memoryContent)
    console.log(`MEMORY.md updated`)
  }

  // Archive old notes
  archiveOldNotes()
  console.log('Nightly consolidation complete')
}

main().catch(err => {
  console.error('Nightly consolidation error:', err.message)
  process.exit(1)
})
