import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder'

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Missing Supabase environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Running with fallback placeholder configuration.')
}

const authOptions = typeof window !== "undefined"
  ? { persistSession: false, storage: window.sessionStorage }
  : { persistSession: false };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: authOptions,
})

// ─── Employee Portal URLs ───────────────────────────────────────────────────
export function getEmployeeResetUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }
  return "/reset-password";
}
export const EMPLOYEE_RESET_URL = getEmployeeResetUrl();
export const EMPLOYEE_VERIFY_URL = "https://ems.prajahita.com/verify"

// ─── Customer Portal URLs ───────────────────────────────────────────────────
export const CUSTOMER_PORTAL_URL = "https://www.prajahita.com"
export const CUSTOMER_VERIFY_URL = "https://www.prajahita.com/verify"
export const CUSTOMER_RESET_URL = "https://www.prajahita.com/reset-password"

// ─── Legacy / Fallback ──────────────────────────────────────────────────────
export const PUBLIC_WEBSITE_URL = "https://prajahita.com"