import { describe, it, expect } from 'vitest'
import {
  parseAgentResponse,
  PivotAnalysisSchema,
  MvpSpecSchema,
  PivotDecisionSchema,
  MarketResearchSchema,
} from '@/lib/agent/responseSchemas'

describe('parseAgentResponse', () => {
  describe('pivot_analysis', () => {
    it('parses clean JSON', () => {
      const raw = JSON.stringify({
        pivot_options: ['Pivot to B2B SaaS', 'Add freemium tier'],
        reasoning: 'Current B2C model has high CAC',
        risk_level: 'medium',
      })
      const result = parseAgentResponse(raw, PivotAnalysisSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.pivot_options).toHaveLength(2)
      expect(result.parsed!.risk_level).toBe('medium')
    })

    it('extracts JSON from fenced code block', () => {
      const raw = `Here's my analysis:\n\n\`\`\`json\n{"pivot_options":["Go enterprise"],"reasoning":"Higher LTV","risk_level":"high"}\n\`\`\`\n\nLet me know if you need more.`
      const result = parseAgentResponse(raw, PivotAnalysisSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.risk_level).toBe('high')
    })

    it('extracts JSON embedded in prose', () => {
      const raw = `Based on the data, I recommend: {"pivot_options":["API first"],"reasoning":"developer traction","risk_level":"low"} as the best path.`
      const result = parseAgentResponse(raw, PivotAnalysisSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.risk_level).toBe('low')
    })

    it('returns null + error for non-JSON text', () => {
      const raw = 'I think you should pivot to SaaS because the metrics look bad.'
      const result = parseAgentResponse(raw, PivotAnalysisSchema)
      expect(result.parsed).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.raw).toBe(raw)
    })

    it('rejects invalid risk_level', () => {
      const raw = JSON.stringify({
        pivot_options: ['test'],
        reasoning: 'test',
        risk_level: 'extreme',
      })
      const result = parseAgentResponse(raw, PivotAnalysisSchema)
      expect(result.parsed).toBeNull()
    })
  })

  describe('mvp_spec', () => {
    it('parses MVP spec JSON', () => {
      const raw = JSON.stringify({
        core_feature: 'Landing page with email capture',
        validation_metric: 'Signup conversion rate',
        build_time_estimate: '3 days',
        tech_stack_suggestion: 'Next.js + Supabase',
      })
      const result = parseAgentResponse(raw, MvpSpecSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.core_feature).toBe('Landing page with email capture')
    })
  })

  describe('pivot_decision', () => {
    it('parses go/pivot decision', () => {
      const raw = JSON.stringify({
        decision: 'pivot',
        confidence: 85,
        rationale: 'Metrics show declining engagement',
      })
      const result = parseAgentResponse(raw, PivotDecisionSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.decision).toBe('pivot')
      expect(result.parsed!.confidence).toBe(85)
    })

    it('rejects confidence out of range', () => {
      const raw = JSON.stringify({
        decision: 'go',
        confidence: 150,
        rationale: 'test',
      })
      const result = parseAgentResponse(raw, PivotDecisionSchema)
      expect(result.parsed).toBeNull()
    })
  })

  describe('market_research', () => {
    it('wraps free text into schema', () => {
      const raw = 'The target market for AI tools in Japan is growing rapidly. Key competitors include A, B, and C. The main differentiation opportunity lies in multilingual support, which none of the competitors currently offer adequately.'
      const result = parseAgentResponse(raw, MarketResearchSchema)
      expect(result.parsed).not.toBeNull()
      expect(result.parsed!.content).toBe(raw)
    })

    it('rejects text that is too short', () => {
      const raw = 'Short.'
      const result = parseAgentResponse(raw, MarketResearchSchema)
      expect(result.parsed).toBeNull()
    })
  })
})
