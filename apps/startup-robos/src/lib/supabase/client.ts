import { createClient } from '@supabase/supabase-js'

/**
 * クライアントサイド用 Supabase クライアント（anon key）。
 * サービスロールキーは src/lib/supabase/server.ts に分離済み。
 */
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
