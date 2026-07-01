import { callLLM } from '@/lib/agent/llm'
import type { GoldenTask } from './goldenTasks'

export interface JudgeResult {
  score: number
  reasoning: string
}

const JUDGE_MODEL = 'deepseek/deepseek-v4-pro'

const RUBRIC = `Rate the AI response on a 0-10 scale using these criteria:
- Relevance (0-3): Does it directly address the question with specific, actionable advice?
- Structure (0-3): Is the response well-organized and easy to follow?
- Quality (0-4): Is the reasoning sound, specific (not generic), and appropriate for the context?

Respond with ONLY a JSON object: {"score": <number 0-10>, "reasoning": "<one sentence>"}
Do not include any other text.`

export async function judgeResponse(
  task: GoldenTask,
  response: string,
): Promise<JudgeResult> {
  const prompt = `## Task Given to AI
System: ${task.system}
Prompt: ${task.prompt}

## AI Response
${response}

## Your Evaluation
${RUBRIC}`

  const result = await callLLM({
    model: JUDGE_MODEL,
    system: 'You are a strict AI response evaluator. Output only valid JSON.',
    prompt,
    maxTokens: 200,
  })

  try {
    const match = result.text.match(/\{[\s\S]*\}/)
    if (!match) return { score: 0, reasoning: 'Judge returned no JSON' }
    const parsed = JSON.parse(match[0]) as { score: unknown; reasoning: unknown }
    const score = typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 0
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : 'No reasoning'
    return { score, reasoning }
  } catch {
    return { score: 0, reasoning: 'Failed to parse judge response' }
  }
}
