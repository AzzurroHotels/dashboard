// =============================================
// AZZURRO HOTELS — Supabase Configuration
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Your Production Supabase Credentials
export const SUPABASE_URL = "https://lnigcfboeqsafcqgysgz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaWdjZmJvZXFzYWZjcWd5c2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjg3NzgsImV4cCI6MjA4Njg0NDc3OH0.ZapbiFcQKOQQjEsdIVI61QgUyCEbcZojBkjoXWL6DcI";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const SUPABASE_URL = "https://lnigcfboeqsafcqgysgz.supabase.co";
export const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}
