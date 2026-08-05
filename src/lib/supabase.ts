import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running the app.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Employee Portal URLs ───────────────────────────────────────────────────
export const EMPLOYEE_PORTAL_URL = "https://ems.prajahita.com"
export const EMPLOYEE_RESET_URL = "https://ems.prajahita.com/reset-password"
export const EMPLOYEE_VERIFY_URL = "https://ems.prajahita.com/verify"

// ─── Customer Portal URLs ───────────────────────────────────────────────────
export const CUSTOMER_PORTAL_URL = "https://www.prajahita.com"
export const CUSTOMER_VERIFY_URL = "https://www.prajahita.com/verify"
export const CUSTOMER_RESET_URL = "https://www.prajahita.com/reset-password"

// ─── Legacy / Fallback ──────────────────────────────────────────────────────
export const PUBLIC_WEBSITE_URL = "https://prajahita.com"