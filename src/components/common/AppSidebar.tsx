"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
  Theme,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

type NavItem = {
  key: string;
  label: string;
  href?: string; // if undefined, it’s a header-only node
  icon?: React.ReactNode;
  children?: NavItem[];
};

export type AppSidebarProps = {
  /** Your brand */
  logo?: React.ReactNode; // e.g. <img src="/logo.svg" height={28} />
  title?: string;

  /** User footer */
  user?: { name: string; role: string };

  /** Menu definition */
  items: NavItem[];

  /** Controlled collapsed (optional) */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (c: boolean) => void;
};

const DRAWER_WIDTH = 260;
const MINI_WIDTH = 76;

function useLocalStorageBoolean(key: string, initial: boolean) {
  const [state, setState] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return initial;
    const raw = localStorage.getItem(key);
    return raw === null ? initial : raw === "1";
  });
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, state ? "1" : "0");
    }
  }, [key, state]);
  return [state, setState] as const;
}

function isActive(pathname: string, href?: string) {
  if (!href) return false;
  // active if exact or a prefix (except root)
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "").concat(parts[1]?.[0] ?? "").toUpperCase();
}

export default function AppSidebar({
  logo,
  title = "Construction Manager",
  user = { name: "User", role: "Member" },
  items,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const isDesktop = useMediaQuery<Theme>((t) => t.breakpoints.up("md"));
  const pathname = usePathname();

  // collapsed state (controlled or local)
  const [storedCollapsed, setStoredCollapsed] = useLocalStorageBoolean(
    "app_sidebar_collapsed",
    defaultCollapsed
  );
  const collapsed = controlledCollapsed ?? storedCollapsed;
  const setCollapsed = React.useCallback(
    (v: boolean) => {
      if (onCollapsedChange) onCollapsedChange(v);
      else setStoredCollapsed(v);
    },
    [onCollapsedChange, setStoredCollapsed]
  );

  // mobile temporary drawer
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // track which tree nodes are open
  const [openKeys, setOpenKeys] = React.useState<Record<string, boolean>>({});

  // open parents that contain the current route (only once)
  React.useEffect(() => {
    // Walk items and open all branches that contain the active path
    const next: Record<string, boolean> = {};
    const visit = (nodes: NavItem[], parents: string[]) => {
      nodes.forEach((n) => {
        const active = isActive(pathname, n.href);
        if (active) parents.forEach((k) => (next[k] = true));
        if (n.children?.length) visit(n.children, [...parents, n.key]);
      });
    };
    visit(items, []);
    setOpenKeys((prev) => ({ ...prev, ...next }));
  }, [pathname, items]);

  const toggleKey = (key: string) =>
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderItem = (item: NavItem, depth = 0): React.ReactNode => {
    const hasChildren = !!item.children?.length;
    const active = isActive(pathname, item.href);

    const content = (
      <ListItemButton
        onClick={() => {
          if (hasChildren) toggleKey(item.key);
          if (!isDesktop) setMobileOpen(false);
        }}
        selected={active}
        sx={{
          pl: 1 + depth * 1,
          py: 0.75,
          borderRadius: 1.5,
          mx: 1,
          "&.Mui-selected": (t) => ({
            background: t.palette.action.selected,
            "&:hover": { background: t.palette.action.selected },
          }),
        }}
        component={item.href ? Link : "button"}
        href={item.href || undefined}
      >
        {item.icon && (
          <ListItemIcon
            sx={{
              minWidth: 40,
              justifyContent: "center",
            }}
          >
            {item.icon}
          </ListItemIcon>
        )}
        {!collapsed && (
          <ListItemText
            primary={item.label}
            primaryTypographyProps={{ noWrap: true }}
          />
        )}
        {hasChildren &&
          !collapsed &&
          (openKeys[item.key] ? <ExpandLess /> : <ExpandMore />)}
      </ListItemButton>
    );

    return (
      <React.Fragment key={item.key}>
        {collapsed && item.href ? (
          <Tooltip title={item.label} placement="right">
            <Box>{content}</Box>
          </Tooltip>
        ) : (
          content
        )}

        {hasChildren && (
          <Collapse
            in={!collapsed && !!openKeys[item.key]}
            timeout="auto"
            unmountOnExit
          >
            <List disablePadding dense>
              {item.children!.map((c) => renderItem(c, depth + 1))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  const drawerInner = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: collapsed ? MINI_WIDTH : DRAWER_WIDTH,
        position: "relative", // allow the toggle button to be absolutely positioned
      }}
    >
      {/* Header / Brand */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1.5,
          height: 64,
        }}
      >
        {/* removed header toggle so logo/title won't be pushed to the right/top */}
        {!collapsed && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              overflow: "hidden",
            }}
          >
            {logo}
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {title}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />

      {/* Menu */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List dense disablePadding>
          {items.map((it) => renderItem(it))}
        </List>
      </Box>

      <Divider />

      {/* User footer */}
      <Box sx={{ p: 1.25, display: "flex", alignItems: "center", gap: 1 }}>
        <Avatar sx={{ width: 32, height: 32 }}>{initials(user.name)}</Avatar>
        {!collapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap fontWeight={600}>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user.role}
            </Typography>
          </Box>
        )}
      </Box>

      {/* floating collapse toggle button — only on desktop permanent sidebar */}
      {isDesktop && (
        <IconButton
          aria-label={collapsed ? "expand sidebar" : "collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          size="medium"
          sx={{
            position: "absolute",
            right: -20, // hang out of the sidebar
            bottom: 16,
            width: 40,
            height: 40,
            bgcolor: "background.paper",
            boxShadow: 3,
            borderRadius: "50%",
            opacity: 0.4, // small opacity normally
            transition: (t) =>
              t.transitions.create(["opacity", "transform"], {
                duration: t.transitions.duration.short,
              }),
            "&:hover": {
              opacity: 1, // full opacity on hover
              transform: "scale(1.03)",
              bgcolor: "background.paper",
            },
            // ensure the button is visible above other elements
            zIndex: (t) => t.zIndex.drawer + 3,
            // subtle border so it reads against page background
            border: (t) => `1px solid ${t.palette.divider}`,
          }}
        >
          <ChevronLeftIcon
            sx={{
              transform: collapsed ? "rotate(180deg)" : "none",
              transition: (t) =>
                t.transitions.create("transform", {
                  duration: t.transitions.duration.short,
                }),
              color: "text.primary",
            }}
          />
        </IconButton>
      )}
    </Box>
  );

  // Permanent on desktop, temporary on mobile
  return (
    <>
      {!isDesktop && (
        <IconButton
          aria-label="open sidebar"
          onClick={() => setMobileOpen(true)}
          sx={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: (t) => t.zIndex.drawer + 2,
          }}
        >
          <MenuIcon />
        </IconButton>
      )}

      {/* Desktop permanent */}
      {isDesktop ? (
        <Drawer
          variant="permanent"
          open
          PaperProps={{
            sx: {
              borderRight: 0,
              width: collapsed ? MINI_WIDTH : DRAWER_WIDTH,
              transition: (t) =>
                t.transitions.create("width", {
                  duration: t.transitions.duration.shortest,
                }),
              // allow the floating toggle to be visible outside the drawer paper
              overflow: "visible",
            },
          }}
        >
          {drawerInner}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: DRAWER_WIDTH } }}
        >
          {drawerInner}
        </Drawer>
      )}
    </>
  );
}

/* --------- example menu you can pass from layout (see below) --------- */
export const defaultMenu: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: <DashboardOutlinedIcon />,
  },
  {
    key: "catalog",
    label: "Catalog",
    icon: <Inventory2OutlinedIcon />,
    children: [
      {
        key: "catalog-browser",
        label: "Material Catalog",
        href: "/catalog/material-catalog",
      },
    ],
  },
  {
    key: "expenses",
    label: "Expenses",
    icon: <PaidOutlinedIcon />,
    children: [
      { key: "expenses-list", label: "All Expenses", href: "/expenses" },
      { key: "expenses-test", label: "Test Supabase", href: "/test-supabase" },
    ],
  },
  {
    key: "labour",
    label: "Labour",
    icon: <EngineeringOutlinedIcon />,
    children: [
      { key: "contracts", label: "Contracts", href: "/labour-contracts" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: <SettingsOutlinedIcon />,
  },
];
