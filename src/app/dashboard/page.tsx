"use client";
import AppContainer from "@/components/common/AppContainer";
import { Typography } from "@mui/material";

export default function DashboardPage() {
  return (
    <AppContainer>
      <Typography variant="h5" gutterBottom>
        Dashboard Summary
      </Typography>
      {/* TODO: summary cards, charts, filters */}
    </AppContainer>
  );
}
