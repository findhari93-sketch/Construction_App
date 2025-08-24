"use client";
import { Container } from "@mui/material";
import * as React from "react";

export default function AppContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {children}
    </Container>
  );
}
