import { supabase } from "../lib/supabase";

export async function getProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name", { ascending: true });

  console.log("PRODUCTS RAW", data);
  console.log("PRODUCTS ERROR", error);
  console.log("PRODUCT COUNT", data?.length);

  if (error) {
    console.error("QUERY FAILED", error);
    throw error;
  }

  console.log("PRODUCTS SERVICE", data);
  console.log("PRODUCTS SERVICE COUNT", data?.length);
  return data;
}