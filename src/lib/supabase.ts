import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Supabase client instance for the frontend.
 * Used for auth and real-time subscriptions.
 * Data mutations go through the FastAPI backend.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Check if the Supabase client is properly configured.
 */
export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}
