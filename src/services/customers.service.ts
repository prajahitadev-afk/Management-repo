import { supabase } from "../lib/supabase";

export async function getCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_code, first_name, last_name, email, phone, city, state, status, created_at")
    .order("first_name");

  if (error) throw error;

  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    customer_code: row.customer_code as string | null,
    first_name: row.first_name as string | null,
    last_name: row.last_name as string | null,
    email: row.email as string | null,
    phone: row.phone as string | null,
    city: row.city as string | null,
    state: row.state as string | null,
    status: row.status as string | null,
    created_at: row.created_at as string | null,
  }));
}