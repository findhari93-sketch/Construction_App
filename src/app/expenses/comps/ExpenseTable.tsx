"use client";
import * as React from "react";
import { useExpenseStore } from "@/store/expenseStore";
import { type ExpenseRow } from "@/store/expenseStore";
import ConfirmDialog from "@/app/expenses/comps/ConfirmDialog";
import {
  addExpenseToExcel,
  deleteExpenseFromExcelByAppId,
} from "@/lib/graphExcel";
import { deleteExpense as deleteExpenseFromDb } from "@/lib/data";
// use deleteExpenseFromExcelByAppId from "@/lib/graphExcel" instead of a missing helper import

type Props = {
  onEdit: (row: ExpenseRow) => void;
  onDelete?: (row: ExpenseRow) => void; // notify parent for Undo toast
};

export default function ExpenseTable({ onEdit, onDelete }: Props) {
  const rows = useExpenseStore((s) => s.rows);
  const remove = useExpenseStore((s) => s.remove);
  const update = useExpenseStore((s) => s.update);

  const [isPushingId, setIsPushingId] = React.useState<string | null>(null);
  const [rowToDelete, setRowToDelete] = React.useState<ExpenseRow | null>(null);
  const [rowToEdit, setRowToEdit] = React.useState<ExpenseRow | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // mouse cursor spinner while deleting
  React.useEffect(() => {
    if (deletingId) {
      const prev = document.body.style.cursor;
      document.body.style.cursor = "progress";
      return () => {
        document.body.style.cursor = prev;
      };
    }
  }, [deletingId]);

  async function handlePushToExcel(row: ExpenseRow) {
    setIsPushingId(row.id);
    try {
      await addExpenseToExcel(row);
      update(row.id, { excelSynced: true });
    } catch (err) {
      console.error(err);
      alert("Failed to push to Excel");
    } finally {
      setIsPushingId(null);
    }
  }

  // Delete (Excel first if synced, then local)
  const confirmDelete = async () => {
    if (!rowToDelete) return;
    const copy = rowToDelete;
    setDeletingId(copy.id);

    try {
      // 1) Delete from DB
      const dbRes = await deleteExpenseFromDb(copy.id);
      console.log("DB delete response:", dbRes);
      if (dbRes?.error) {
        console.error("DB delete failed:", dbRes.error);
        alert("Failed to delete from database. See console for details.");
        return;
      }

      // 2) Delete from Excel (only if you have an excel row id)
      try {
        // prefer explicit excel_row_id if present, else pass DB id
        const excelId = (copy as any).excel_row_id ?? copy.id;
        const excelRes = await deleteExpenseFromExcelByAppId(excelId);
        console.log("Excel delete response:", excelRes);
        // excelRes may be unknown/never-typed; use type-safe checks
        const excelResAny = excelRes as any;
        const excelStatus =
          typeof excelResAny?.status === "number"
            ? excelResAny.status
            : undefined;
        const excelError = excelResAny?.error;
        if (excelError || (excelStatus !== undefined && excelStatus >= 400)) {
          console.error("Excel delete failed:", excelRes);
          // choose: notify & keep local deleted, or revert local delete so user can retry
          alert("Failed to delete from Excel. Check console for details.");
          // optionally continue to remove local row or stop here
        }
      } catch (ex) {
        console.error("Unexpected error deleting from Excel:", ex);
      }

      // 3) remove locally and notify
      remove(copy.id);
      onDelete?.(copy);
      setRowToDelete(null);
    } catch (err) {
      console.error("Unexpected error in confirmDelete:", err);
      alert("Unexpected error. See console.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmEdit = () => {
    if (!rowToEdit) return;
    onEdit(rowToEdit);
    setRowToEdit(null);
  };

  if (!rows.length) {
    return <p className="text-muted">No expenses yet.</p>;
  }

  return (
    <>
      <div className="table-responsive">
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>Date</th>
              <th>Spent On</th>
              <th>Category</th>
              <th>Item</th>
              <th className="text-end">Qty</th>
              <th className="text-end">Price</th>
              <th className="text-end">Amount</th>
              <th className="text-end">Paid</th>
              <th className="text-end">Balance</th>
              <th className="text-center" style={{ width: 150 }}>
                Excel
              </th>
              <th style={{ width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const balance = (r.amount || 0) - (r.paidInitially || 0);
              return (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.spentOn}</td>
                  <td>{r.category}</td>
                  <td>{r.item}</td>
                  <td className="text-end">{r.quantity}</td>
                  <td className="text-end">{r.pricePerUnit}</td>
                  <td className="text-end">{r.amount}</td>
                  <td className="text-end">{r.paidInitially}</td>
                  <td className="text-end">{balance}</td>

                  <td className="text-center">
                    {r.excelSynced ? (
                      <span className="badge text-bg-success">Synced ✓</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={() => handlePushToExcel(r)}
                        disabled={isPushingId === r.id}
                      >
                        {isPushingId === r.id ? "Pushing..." : "Push to Excel"}
                      </button>
                    )}
                  </td>

                  <td>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => setRowToEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-2"
                        onClick={() => setRowToDelete(r)}
                        disabled={!!deletingId} // disable all deletes while one is running
                      >
                        {deletingId === r.id && (
                          <span
                            className="spinner-border spinner-border-sm"
                            role="status"
                            aria-hidden="true"
                          />
                        )}
                        {deletingId === r.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirm Edit */}
      <ConfirmDialog
        open={!!rowToEdit}
        title="Edit this expense?"
        message={
          rowToEdit ? (
            <>
              <strong>{rowToEdit.spentOn}</strong> — {rowToEdit.category} /{" "}
              {rowToEdit.item}
            </>
          ) : undefined
        }
        confirmText="Yes, Edit"
        cancelText="No"
        onClose={() => setRowToEdit(null)}
        onConfirm={confirmEdit}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!rowToDelete}
        title="Delete this expense?"
        message={
          rowToDelete ? (
            <>
              This can be undone for a few seconds. <br />
              <strong>{rowToDelete.spentOn}</strong> — {rowToDelete.category} /{" "}
              {rowToDelete.item}
            </>
          ) : undefined
        }
        confirmText="Delete"
        cancelText="Cancel"
        onClose={() => setRowToDelete(null)}
        onConfirm={confirmDelete}
        loading={!!deletingId} // NEW
      />
    </>
  );
}
