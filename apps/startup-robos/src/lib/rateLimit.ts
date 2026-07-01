/**
 * Upstash Redis を使ったスライディングウィンドウ方式のレートリミッター
 *
 * 環境変数 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定の場合は
 * フォールバックとして全リクエストを許可する（開発・テスト環境向け）。
 */
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * レートリミッター関数を生成する
 *
 * @param limit - ウィンドウ内の最大リクエスト数
 * @param windowSeconds - ウィンドウの長さ（秒）
 * @returns (userId: string) => Promise<boolean>  true = 許可, false = 拒否
 */
export function makeRateLimiter(
  limit: number,
  windowSeconds: number
): (userId: string) => Promise<boolean> {
  // 環境変数が未設定の場合はフォールバック（全許可）
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      // 本番では起動時ではなくリクエスト時に throw（next build を壊さない lazy throw パターン）
      return async (_userId: string) => {
        throw new Error(
          '[rateLimit] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN が未設定です。' +
          'Vercel ダッシュボードで環境変数を設定してください。'
        )
      }
    }
    // 開発・テスト環境: Upstash 未設定時は全リクエストを通す
    console.warn('[rateLimit] Upstash 未設定: レートリミット無効（開発環境のみ許容）')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return async (_userId: string) => true
  }

  const redis = new Redis({ url, token })
  const ratelimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    analytics: false,
  })

  return async (userId: string): Promise<boolean> => {
    try {
      const { success } = await ratelimiter.limit(userId)
      return success
    } catch {
      // Redis 障害時はリクエストを通す（可用性優先）
      return true
    }
  }
}
