import { createBrowserClient } from "@supabase/ssr";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// supabase-js's default navigator.locks-based auth lock can deadlock in the browser,
// leaving auth calls (e.g. signInWithPassword) hanging forever with no error.
// https://github.com/supabase/supabase-js/issues/2013
async function noOpLock<R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> {
  return fn();
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: noOpLock },
});
export const DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000001";
export const API_URL = "/api-proxy";
