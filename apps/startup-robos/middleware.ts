import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/getAuthUser'

/**
 * 保護された API エンドポイントへの認証ゲート。
 * /api/heartbeat/* は CRON_SECRET で個別に保護されるため除外。
 */
export async function middleware(req: NextRequest) {
  const user = await getAuthUser(req)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 認証済みユーザーIDを route handler に転送（x-user-id ヘッダー経由）
  // delete してから set することで外部から偽造された x-user-id ヘッダーを除去する
  const requestHeaders = new Headers(req.headers)
  requestHeaders.delete('x-user-id')
  requestHeaders.set('x-user-id', user.id)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    '/api/agent/:path*',
    '/api/cxo/:path*',
    '/api/pivot',
    '/api/dashboard/:path*',
  ],
}
