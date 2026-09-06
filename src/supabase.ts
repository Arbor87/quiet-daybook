import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = Boolean(url && key)
export const supabase = createClient(url || 'https://未配置.supabase.co', key || '未配置', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
