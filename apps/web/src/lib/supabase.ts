import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000001";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
