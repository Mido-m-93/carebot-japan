import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
}

/**
 * Next.js middleware/route ハンドラから Supabase Auth セッションユーザーを取得する。
 * セッションがない場合は null を返す。
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: () => {}, // middleware では read-only
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id }
}
