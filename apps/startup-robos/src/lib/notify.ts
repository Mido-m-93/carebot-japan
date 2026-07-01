// Email notification utility (Resend API)

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function markdownToHtml(body: string): string {
  // Escape all HTML first to prevent injection, then apply markdown formatting.
  // Markdown syntax chars (# * -) are not HTML special chars, so they survive escaping.
  return escapeHtml(body)
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

const RESEND_API_KEY = process.env.RESEND_API_KEY
const NOTIFY_EMAILS = (process.env.NOTIFY_EMAIL ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

export async function sendReport(subject: string, body: string) {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured — skipping email notification')
    return
  }
  if (NOTIFY_EMAILS.length === 0) {
    console.warn('NOTIFY_EMAIL not configured — skipping email notification')
    return
  }

  const html = markdownToHtml(body)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Launchpad CEO <onboarding@resend.dev>',
      to: NOTIFY_EMAILS,
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #e0e0e0; border-radius: 12px;">
        <div style="border-bottom: 1px solid #333; padding-bottom: 12px; margin-bottom: 16px;">
          <h1 style="font-size: 18px; color: #a78bfa; margin: 0;">🚀 Launchpad CEO Report</h1>
        </div>
        ${html}
        <div style="border-top: 1px solid #333; margin-top: 20px; padding-top: 12px; font-size: 12px; color: #666;">
          <a href="https://launchpad-kohl-three.vercel.app/dashboard" style="color: #a78bfa;">View details in Mission Control</a>
        </div>
      </div>`,
    }),
  })

  if (!res.ok) {
    console.error('Email send failed:', await res.text())
  }
}
