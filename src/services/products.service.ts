import { supabase } from "../lib/supabase";

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}
