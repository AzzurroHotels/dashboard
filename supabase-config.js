
// 1. Install the package first: npm install @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';

// 2. Use environment variables for sensitive data (recommended)
export const SUPABASE_URL = process.env.SUPABASE_URL || "https://lnigcfboeqsafcqgysgz.supabase.co";
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaWdjZmJvZXFzYWZjcWd5c2d6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjg3NzgsImV4cCI6MjA4Njg0NDc3OH0.ZapbiFcQKOQQjEsdIVI61QgUyCEbcZojBkjoXWL6DcI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isSupabaseConfigured() {
  return isConfigured();
}
