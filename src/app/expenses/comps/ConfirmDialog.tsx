"use client";
import * as React from "react";

type Props = {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean; // NEW
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onClose,
  onConfirm,
  loading = false, // NEW
}: Props) {
  if (!open) return null;
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: "rgba(0,0,0,0.35)", zIndex: 1050 }}
    >
      <div className="card shadow" style={{ minWidth: 380 }}>
        <div className="card-header fw-semibold">{title}</div>
        <div className="card-body">{message}</div>
        <div className="card-footer d-flex justify-content-end gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={onClose}
            disabled={loading} // prevent closing mid-op
          >
            {cancelText}
          </button>
          <button
            className="btn btn-danger btn-sm d-inline-flex align-items-center gap-2"
            onClick={onConfirm}
            disabled={loading} // prevent double-clicks
          >
            {loading && (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
              />
            )}
            {loading ? "Deleting…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
