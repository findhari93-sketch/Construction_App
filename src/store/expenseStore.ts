import { create } from "zustand";
import { persist } from "zustand/middleware";

// add this field to ExpenseRow
export type ExpenseRow = {
  id: string;
  createdAt: string;
  date: string;
  spentOn: string;
  category: string;
  subCategory?: string;
  item: string;
  subItem?: string;
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

  // NEW:
  excelSynced?: boolean; // default false
};

type ExpenseState = {
  rows: ExpenseRow[];
  lastDeleted: ExpenseRow | null;

  add: (row: ExpenseRow) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<ExpenseRow>) => void;
  undoLastDelete: () => void;

  // helpers (optional)
  clearAll: () => void;
};

export const useExpenseStore = create<ExpenseState>()(
  persist(
    (set, get) => ({
      rows: [],
      lastDeleted: null,

      add: (row) =>
        set((s) => ({
          rows: [{ excelSynced: false, ...row }, ...s.rows],
        })),

      remove: (id) =>
        set((s) => {
          const toDelete = s.rows.find((r) => r.id === id) || null;
          return {
            rows: s.rows.filter((r) => r.id !== id),
            lastDeleted: toDelete, // keep a copy for undo
          };
        }),

      update: (id, patch) =>
        set((s) => ({
          rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      undoLastDelete: () =>
        set((s) => {
          if (!s.lastDeleted) return s;
          return {
            rows: [s.lastDeleted, ...s.rows],
            lastDeleted: null,
          };
        }),

      clearAll: () => set({ rows: [] }),
    }),
    { name: "expenses" }
  )
);
