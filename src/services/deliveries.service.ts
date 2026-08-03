import { supabase } from "../lib/supabase";

export async function getDeliveries() {
  const { data, error } = await supabase
    .from("deliveries")
    .select(`
      *,
      orders (
        order_number
      )
    `);

  if (error) throw error;

  return data || [];
}