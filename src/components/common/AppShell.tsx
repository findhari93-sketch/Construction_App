"use client";

import * as React from "react";
import { Box } from "@mui/material";

const DRAWER_WIDTH = 260;
const MINI_WIDTH = 76;

type AppShellProps = {
  collapsed: boolean;
  children: React.ReactNode;
};

export default function AppShell({ collapsed, children }: AppShellProps) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        // match sidebar width so content doesn't overlap
        ml: { xs: 0, md: collapsed ? `${MINI_WIDTH}px` : `${DRAWER_WIDTH}px` },
        transition: (t) =>
          t.transitions.create("margin", {
            duration: t.transitions.duration.shortest,
          }),
        p: { xs: 1.5, md: 3 },
      }}
    >
      {children}
    </Box>
  );
}
