import type { TaskType } from '@/lib/agent/responseSchemas'

export interface GoldenTask {
  id: string
  taskType: TaskType
  tier: 'high' | 'low'
  system: string
  prompt: string
  maxTokens: number
}

export const GOLDEN_TASKS: GoldenTask[] = [
  {
    id: 'pivot-decision-saas',
    taskType: 'pivot_decision',
    tier: 'high',
    system: 'You are an experienced startup CEO. Respond with a JSON object containing: decision ("go" or "pivot"), confidence (0-100), rationale (string).',
    prompt: 'Our B2C language learning app has 500 DAU but $200 MRR after 6 months. A Fortune 500 asked about licensing our AI engine for internal training. Should we pivot to B2B or keep growing B2C?',
    maxTokens: 500,
  },
  {
    id: 'pivot-decision-marketplace',
    taskType: 'pivot_decision',
    tier: 'high',
    system: 'You are an experienced startup CEO. Respond with a JSON object containing: decision ("go" or "pivot"), confidence (0-100), rationale (string).',
    prompt: 'Our freelancer marketplace has 50 active sellers but only 10 buyers/month. Marketing costs $5/acquisition. A competitor just raised $10M. Should we pivot to a niche vertical or continue horizontal?',
    maxTokens: 500,
  },
  {
    id: 'mvp-spec-chatbot',
    taskType: 'mvp_spec',
    tier: 'low',
    system: 'You are a startup CTO. Respond with a JSON object containing: core_feature (string), validation_metric (string), build_time_estimate (string), tech_stack_suggestion (string).',
    prompt: 'We want to build an AI chatbot that helps refugees find local services (housing, legal aid, language classes) in their native language. Budget: $500, timeline: 2 weeks.',
    maxTokens: 500,
  },
  {
    id: 'pivot-analysis-ecommerce',
    taskType: 'pivot_analysis',
    tier: 'low',
    system: 'You are a startup strategist. Respond with a JSON object containing: pivot_options (array of strings), reasoning (string), risk_level ("low", "medium", or "high").',
    prompt: 'Our handmade crafts e-commerce site has 1,000 monthly visitors but only 2% conversion. Average order value is $25. We spend $500/month on ads. What pivot options should we consider?',
    maxTokens: 500,
  },
  {
    id: 'market-research-ai-tools',
    taskType: 'market_research',
    tier: 'low',
    system: 'You are a CMO. Provide a concise market analysis with actionable recommendations.',
    prompt: 'Analyze the market opportunity for an AI-powered resume builder targeting refugees and immigrants. Consider competitors, pricing strategies, and distribution channels.',
    maxTokens: 600,
  },
  {
    id: 'ceo-synthesis',
    taskType: 'ceo_review',
    tier: 'high',
    system: 'You are an experienced startup CEO. Make concise and specific decisions based on data.',
    prompt: `Evaluate the status of the following startups and propose next actions:

Business: AI Tool Lab (affiliate_seo)
Recent experiments:
- SEO keyword optimization for "best AI tools 2026" [completed]
- Internal linking restructure [in_progress]

Business: Prompt Pack (digital_product)
Recent experiments:
- Bundle pricing test $19 vs $29 [completed]
- Twitter thread marketing campaign [failed]

For each business: 1. Current challenges (1 line) 2. Next experiment to try 3. Priority (High/Medium/Low)`,
    maxTokens: 800,
  },
  {
    id: 'ops-review-general',
    taskType: 'ops_review',
    tier: 'low',
    system: 'You are the COO. Provide actionable operations recommendations.',
    prompt: `Review operations for these 3 businesses:
- AI Tool Lab (GitHub Pages, affiliate_seo)
- Prompt Pack (GitHub Pages + Gumroad, digital_product)
- Puzzle Games (GitHub Pages + AdSense, game_ads)

Report: 1. Deployment challenges 2. Monitoring improvements 3. One critical operations task`,
    maxTokens: 600,
  },
  {
    id: 'budget-review-general',
    taskType: 'budget_review',
    tier: 'low',
    system: 'You are the CFO. Provide actionable financial recommendations.',
    prompt: `Review monetization for these 3 businesses:
- AI Tool Lab: Amazon Associates
- Prompt Pack: Gumroad sales (3 products at $9/$7/$12)
- Puzzle Games: Google AdSense (pending approval)

Report: 1. Expected monthly revenue per channel 2. Cost structure 3. One revenue improvement proposal`,
    maxTokens: 600,
  },
]
