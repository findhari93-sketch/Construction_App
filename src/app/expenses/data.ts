// src/app/expenses/data.ts
import { supabase } from "@/lib/supabaseClient";

/** Shape coming from your form (same keys you already use in UI) */
export type FormValues = {
  date: string;
  spentOn: string;
  category: string;
  subCategory?: string;
  item: string;
  workPhase: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  amount: number;
  paidInitially: number;
  settledBy: string;
  paymentType: string;
  paidTo: string;
  mobile: string;
  billLink?: string;
  receiptLink?: string;
  notes: string;
};

/** Row shape coming FROM Supabase (snake_case, DB timestamp) */
export type DbExpenseRow = {
  id: string;
  created_at: string;
  date: string;
  spent_on: string;
  category: string;
  sub_category: string | null;
  item: string;
  work_phase: string;
  unit: string;
  quantity: number;
  price_per_unit: number;
  amount: number;
  paid_initially: number;
  settled_by: string;
  payment_type: string;
  paid_to: string;
  mobile: string;
  bill_link: string | null;
  receipt_link: string | null;
  notes: string;
};

/** Insert/Update payload TO Supabase (snake_case, without id/created_at) */
export type DbExpenseInsert = Omit<DbExpenseRow, "id" | "created_at">;

/** UI row you already use in Zustand/components (camelCase, createdAt) */
export type UiExpenseRow = {
  id: string;
  createdAt: string;
  date: string;
  spentOn: string;
  category: string;
  subCategory: string;
  item: string;
  workPhase: string;
  unit: string;
  quantity: number;
  pricePerUnit: number;
  amount: number;
  paidInitially: number;
  settledBy: string;
  paymentType: string;
  paidTo: string;
  mobile: string;
  billLink: string;
  receiptLink: string;
  notes: string;
};

/** Map UI form values -> DB insert payload */
export const toDb = (u: FormValues): DbExpenseInsert => ({
  date: u.date,
  spent_on: u.spentOn,
  category: u.category,
  sub_category: u.subCategory ?? null,
  item: u.item,
  work_phase: u.workPhase,
  unit: u.unit,
  quantity: u.quantity,
  price_per_unit: u.pricePerUnit,
  amount: u.amount,
  paid_initially: u.paidInitially,
  settled_by: u.settledBy,
  payment_type: u.paymentType,
  paid_to: u.paidTo,
  mobile: u.mobile,
  bill_link: u.billLink ?? null,
  receipt_link: u.receiptLink ?? null,
  notes: u.notes,
});

/** Map DB row -> UI row */
export const fromDb = (r: DbExpenseRow): UiExpenseRow => ({
  id: r.id,
  createdAt: r.created_at,
  date: r.date,
  spentOn: r.spent_on,
  category: r.category,
  subCategory: r.sub_category ?? "",
  item: r.item,
  workPhase: r.work_phase,
  unit: r.unit,
  quantity: r.quantity,
  pricePerUnit: r.price_per_unit,
  amount: r.amount,
  paidInitially: r.paid_initially,
  settledBy: r.settled_by,
  paymentType: r.payment_type,
  paidTo: r.paid_to,
  mobile: r.mobile,
  billLink: r.bill_link ?? "",
  receiptLink: r.receipt_link ?? "",
  notes: r.notes,
});

/** CRUD (all strongly typed) */
export async function listExpenses(): Promise<UiExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as DbExpenseRow[]).map(fromDb);
}

export async function addExpense(values: FormValues): Promise<UiExpenseRow> {
  const insert = toDb(values);
  const { data, error } = await supabase
    .from("expenses")
    .insert(insert)
    .select("*")
    .single();
  if (error) throw error;
  return fromDb(data as DbExpenseRow);
}

export async function updateExpense(
  id: string,
  values: FormValues
): Promise<UiExpenseRow> {
  const patch = toDb(values);
  const { data, error } = await supabase
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return fromDb(data as DbExpenseRow);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
