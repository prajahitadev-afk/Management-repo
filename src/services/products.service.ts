import { supabase } from "../lib/supabase";

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock_quantity")
    .order("name", { ascending: true });

  if (error) throw error;

  return data ?? [];
}