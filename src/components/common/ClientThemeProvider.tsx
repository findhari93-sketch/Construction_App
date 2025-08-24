"use client";
import * as React from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "@/lib/theme";

export default function ClientThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
