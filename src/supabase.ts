import { createClient } from '@supabase/supabase-js'

// Publishable client keys are safe to ship in a browser bundle. Environment
// variables override these defaults for other deployments.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://vhnwmwyztftgmaamuinf.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || 'sb_publishable_uDafCUw4z-0qZgZeZzH2nA_1rS1-RhK'
export const supabaseConfigured = Boolean(url && key)
export const supabase = createClient(url || 'https://未配置.supabase.co', key || '未配置', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
