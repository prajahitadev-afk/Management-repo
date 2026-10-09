import { supabase } from "../lib/supabase";

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function subscribeToAuth(onChange: (event: string, session: any) => void | Promise<void>) {
  return supabase.auth.onAuthStateChange(onChange);
}
