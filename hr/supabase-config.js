// HR Dashboard — uses shared Supabase config
// This re-exports from the parent directory's shared config

export { supabase, isConfigured as isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "../supabase-config.js";
