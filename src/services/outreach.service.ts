import { supabase } from "../lib/supabase";

export interface Program {
  id: string;
  title: string;
  description: string;
  location: string;
  start_date: string;
  end_date: string;
  status?: string;
  created_by: string;
  created_at: string;
}

export async function getPrograms() {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .order("start_date");

  if (error) throw error;

  return data;
}