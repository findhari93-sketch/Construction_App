"use client";
import * as React from "react";
import { IconButton, TextField } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

type Props = {
  value: string; // yyyy-mm-dd
  onChange: (newDate: string) => void;
  label?: string;
};

export default function DateNavigator({
  value,
  onChange,
  label = "Date",
}: Props) {
  // parse value into Date
  const date = value ? new Date(value) : new Date();

  const shiftDate = (days: number) => {
    const newDate = new Date(date);
    newDate.setDate(date.getDate() + days);
    const iso = newDate.toISOString().slice(0, 10); // yyyy-mm-dd
    onChange(iso);
  };

  return (
    <div className="d-flex align-items-center gap-2">
      <TextField
        type="date"
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        size="small"
      />
      <IconButton size="small" onClick={() => shiftDate(-1)}>
        <ArrowBackIosNewIcon fontSize="inherit" />
      </IconButton>
      <IconButton size="small" onClick={() => shiftDate(1)}>
        <ArrowForwardIosIcon fontSize="inherit" />
      </IconButton>
    </div>
  );
}
