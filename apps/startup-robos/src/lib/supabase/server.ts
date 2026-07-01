/**
 * サーバーサイド専用 Supabase クライアント（サービスロールキー）。
 * `server-only` により、クライアントバンドルへの混入を防ぐ。
 */
import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      '[supabase/server] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です'
    )
  }
  return createClient(url, key)
}
