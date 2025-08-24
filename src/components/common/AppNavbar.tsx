"use client";
import * as React from "react";
import Link from "next/link";
import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";
import { NAV_ROUTES } from "@/lib/routes";

export default function AppNavbar() {
  return (
    <AppBar position="static" color="primary">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Construction Manager
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {NAV_ROUTES.map((r) => (
            <Button
              key={r.href}
              component={Link}
              href={r.href}
              color="inherit"
              size="small"
            >
              {r.label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
