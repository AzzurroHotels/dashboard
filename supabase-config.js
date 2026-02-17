import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://lnigcfboeqsafcqgysgz.supabase.co";
// Public anon key (safe for frontend). Do NOT use service_role key here.
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaWdjZmJvZXFzYWZjcWd5c2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjg3NzgsImV4cCI6MjA4Njg0NDc3OH0.ZapbiFcQKOQQjEsdIVI61QgUyCEbcZojBkjoXWL6DcI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}
