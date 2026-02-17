// ══════════════════════════════════════════
// AZZURRO HOTELS — Supabase Configuration
// ══════════════════════════════════════════
// 1. Go to Supabase Dashboard → Settings → API
// 2. Copy your Project URL and paste below
// 3. Copy your anon/public key and paste below
// ══════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⬇️ PASTE YOUR SUPABASE CREDENTIALS HERE ⬇️
export const SUPABASE_URL = "https://lnigcfboeqsafcqgysgz.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaWdjZmJvZXFzYWZjcWd5c2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjg3NzgsImV4cCI6MjA4Njg0NDc3OH0.ZapbiFcQKOQQjEsdIVI61QgUyCEbcZojBkjoXWL6DcI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isConfigured() {
  return SUPABASE_URL && SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("YOUR_PROJECT_ID") &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON_PUBLIC_KEY");
}

// Back-compat for modules that expect this name
export function isSupabaseConfigured() {
  return isConfigured();
}
