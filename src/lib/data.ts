// src/lib/data.ts
import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Minimal ExpenseRow type used across this module
export type ExpenseRow = {
  id: string;
  description?: string;
  amount?: number;
  date?: string;
  createdAt?: string;
  [key: string]: unknown;
};

// Fetch all expenses (latest by date, then createdAt)
export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false })
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("fetchExpenses error:", error);
    return [];
  }
  return (data || []) as ExpenseRow[];
}

export async function addExpense(row: ExpenseRow) {
  const { error } = await supabase.from("expenses").insert([row]);
  if (error) console.error("addExpense error:", error);
}

export async function updateExpense(id: string, patch: Partial<ExpenseRow>) {
  const { error } = await supabase.from("expenses").update(patch).eq("id", id);
  if (error) console.error("updateExpense error:", error);
}

export async function deleteExpense(id: string) {
  // returns { data, error } - consumer should inspect error
  try {
    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .select(); // selecting returns deleted rows for debugging
    return { data, error };
  } catch (err) {
    return { data: null, error: err as unknown };
  }
}
