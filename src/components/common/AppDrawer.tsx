import * as React from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import CloseIcon from "@mui/icons-material/Close";
import { SxProps, Theme } from "@mui/material";

type AppDrawerProps = {
  title?: React.ReactNode;
  open: boolean;
  onClose: () => void;
  /**
   * Optional actions area in header (right side). Place buttons here
   * or leave empty and keep Save inside the form.
   */
  headerActions?: React.ReactNode;
  /**
   * width passed to Drawer Paper sx (can be object for breakpoints)
   */
  width?: number | string | { [k: string]: unknown };
  PaperSx?: SxProps<Theme>;
  children?: React.ReactNode;
};

export default function AppDrawer({
  title,
  open,
  onClose,
  headerActions,
  width = { xs: "100%", sm: 520, md: 640 },
  PaperSx,
  children,
}: AppDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width,
          display: "flex",
          flexDirection: "column",
          ...((PaperSx as any) || {}),
        },
      }}
    >
      {/* Header with filled background and contrast text */}
      <Box
        component="header"
        sx={(t) => ({
          px: 2,

          backgroundColor: t.palette.primary.main,
          color: t.palette.primary.contrastText,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        })}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" component="div" fontWeight={700}>
            {title}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* custom header actions (e.g. Save) */}
          {headerActions}
          <IconButton
            aria-label="close drawer"
            onClick={onClose}
            sx={{ color: "inherit" }}
            size="large"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      <Divider />

      {/* Body: scrollable area for form/content */}
      <Box component="main" sx={{ flex: 1, overflowY: "auto" }}>
        {children}
      </Box>
    </Drawer>
  );
}
