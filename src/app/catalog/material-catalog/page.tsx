"use client";
import * as React from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { SimpleTreeView } from "@mui/x-tree-view/SimpleTreeView";
import { TreeItem } from "@mui/x-tree-view/TreeItem";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SearchIcon from "@mui/icons-material/Search";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import DnsIcon from "@mui/icons-material/Dns";
import { useCatalogStore, type CatalogNode } from "../store";
import { supabase } from "@/lib/supabaseClient";

/** You can keep this hard-coded for now or set NEXT_PUBLIC_PROJECT_ID in .env.local */
const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID;

type SupabaseError = {
  message?: string;
  error_description?: string;
  data?: { message?: string };
  [key: string]: unknown;
};

function logErr(where: string) {
  return (e: unknown) => {
    const err = e as SupabaseError;
    const msg =
      err.message ||
      err.error_description ||
      err.data?.message ||
      JSON.stringify(err);

    console.error(`[Catalog] ${where} error:`, err);

    if (process.env.NODE_ENV !== "production") {
      alert(`[Catalog] ${where} error:\n${msg}`);
    }
  };
}

function isBranch(n: CatalogNode): boolean {
  return n.type !== "item" || !!(n.children && n.children.length > 0);
}
function getChildren(n: CatalogNode): CatalogNode[] {
  return n.type !== "item" ? n.children : n.children ?? [];
}

export default function CatalogPage() {
  const {
    categories,
    // only the DB-backed actions are used directly here
    loadFromDb,
    createInDb,
    updateInDb,
    deleteInDb,
  } = useCatalogStore();

  // Initial load
  React.useEffect(() => {
    if (!PROJECT_ID || PROJECT_ID.startsWith("<PUT_")) {
      logErr("init")("PROJECT_ID is not set");
      return;
    }
    loadFromDb(PROJECT_ID).catch(logErr("loadFromDb"));
  }, [loadFromDb]);

  // Optional realtime refresh
  React.useEffect(() => {
    if (!PROJECT_ID || PROJECT_ID.startsWith("<PUT_")) return;

    const ch = supabase
      .channel(`catalog:${PROJECT_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "catalog_nodes",
          filter: `project_id=eq.${PROJECT_ID}`,
        },
        () => {
          loadFromDb(PROJECT_ID).catch(logErr("realtime refresh"));
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR")
          logErr("realtime subscribe")("CHANNEL_ERROR");
      });

    return () => {
      try {
        supabase.removeChannel(ch);
      } catch (e) {
        logErr("realtime cleanup")(e);
      }
    };
  }, [loadFromDb]);

  const [expanded, setExpanded] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<
    | { type: "category"; parentId?: string }
    | { type: "subcategory"; parentId: string }
    | { type: "item"; parentId: string }
    | { type: "subitem"; parentId: string }
    | { type: "edit"; node: CatalogNode }
  >({ type: "category" });

  const [form, setForm] = React.useState({
    name: "",
    unit: "",
    techniqueInput: "",
    techniques: [] as string[],
    code: "",
  });

  const filtered = React.useMemo(() => {
    if (!filter.trim()) return categories;
    const q = filter.toLowerCase();

    const filterTree = (nodes: CatalogNode[]): CatalogNode[] => {
      const mapped = nodes.map<CatalogNode | null>((n) => {
        const selfMatch =
          n.name.toLowerCase().includes(q) ||
          (n.type === "item" &&
            ((n.unit ?? "").toLowerCase().includes(q) ||
              (n.code ?? "").toLowerCase().includes(q) ||
              (n.techniques ?? []).some((t) => t.toLowerCase().includes(q))));

        const kids = isBranch(n) ? filterTree(getChildren(n)) : [];
        if (!selfMatch && kids.length === 0) return null;

        if (n.type === "item")
          return kids.length ? { ...n, children: kids } : n;
        return { ...n, children: kids };
      });

      return mapped.filter((x): x is CatalogNode => x !== null);
    };

    return filterTree(categories);
  }, [categories, filter]);

  const handleExpandAll = React.useCallback(() => {
    const ids: string[] = [];
    const walk = (nodes: CatalogNode[]) => {
      nodes.forEach((n) => {
        if (isBranch(n)) {
          ids.push(n.id);
          const kids = getChildren(n);
          if (kids.length) walk(kids);
        }
      });
    };
    walk(filtered);
    setExpanded(ids);
  }, [filtered]);

  const handleCollapseAll = React.useCallback(() => setExpanded([]), []);

  const openCreate = (
    type: "category" | "subcategory" | "item" | "subitem",
    parentId?: string
  ) => {
    setDialogMode(
      type === "category" ? { type } : { type, parentId: parentId! }
    );
    setForm({
      name: "",
      unit: "",
      techniqueInput: "",
      techniques: [],
      code: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (node: CatalogNode) => {
    setDialogMode({ type: "edit", node });
    setForm({
      name: node.name,
      unit: node.type === "item" ? node.unit ?? "" : "",
      techniques: node.type === "item" ? node.techniques ?? [] : [],
      techniqueInput: "",
      code: node.type === "item" ? node.code ?? "" : "",
    });
    setDialogOpen(true);
  };

  const onSubmitDialog = async () => {
    try {
      if (!PROJECT_ID || PROJECT_ID.startsWith("<PUT_")) {
        throw new Error("PROJECT_ID is not set");
      }

      if (dialogMode.type === "category") {
        await createInDb(PROJECT_ID, null, {
          type: "category",
          name: form.name,
        });
      } else if (dialogMode.type === "subcategory") {
        await createInDb(PROJECT_ID, dialogMode.parentId, {
          type: "subcategory",
          name: form.name,
        });
      } else if (dialogMode.type === "item" || dialogMode.type === "subitem") {
        await createInDb(PROJECT_ID, dialogMode.parentId, {
          type: "item",
          name: form.name,
          unit: form.unit || undefined,
          techniques: form.techniques,
          code: form.code || undefined,
        });
      } else {
        const node = dialogMode.node;
        await updateInDb(node.id, {
          name: form.name,
          ...(node.type === "item"
            ? {
                unit: form.unit || undefined,
                techniques: form.techniques,
                code: form.code || undefined,
              }
            : {}),
        });
      }
      setDialogOpen(false);
    } catch (e) {
      logErr("submit")(e);
    }
  };

  const renderTree = (nodes: CatalogNode[]) =>
    nodes.map((node) => {
      const isItem = node.type === "item";
      const label = (
        <Box
          sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}
        >
          <Typography fontWeight={600} fontSize={14}>
            {node.name}
          </Typography>
          {isItem && node.unit && (
            <Chip size="small" label={node.unit} variant="outlined" />
          )}
          {isItem && node.code && (
            <Chip
              size="small"
              variant="outlined"
              icon={<DnsIcon fontSize="small" />}
              label={node.code}
            />
          )}
          <Box sx={{ marginLeft: "auto", display: "flex", gap: 1 }}>
            {node.type === "category" && (
              <Tooltip title="Add Subcategory">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate("subcategory", node.id);
                  }}
                >
                  <LibraryAddIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
            {node.type === "subcategory" && (
              <Tooltip title="Add Item">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate("item", node.id);
                  }}
                >
                  <AddIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
            {isItem && (
              <Tooltip title="Add Subitem">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreate("subitem", node.id);
                  }}
                >
                  <AddIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(node);
                }}
              >
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${node.name}"?`)) {
                    try {
                      await deleteInDb(node.id);
                    } catch (err) {
                      logErr("delete")(err);
                    }
                  }
                }}
              >
                <DeleteOutlineIcon fontSize="inherit" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      );

      if (isBranch(node)) {
        const kids = getChildren(node);
        return (
          <TreeItem key={node.id} itemId={node.id} label={label}>
            {kids.length ? renderTree(kids) : null}
          </TreeItem>
        );
      }
      return <TreeItem key={node.id} itemId={node.id} label={label} />;
    });

  const handleToggle = (_e: React.SyntheticEvent | null, ids: string[]) =>
    setExpanded(ids);

  return (
    <Box className="container py-3">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
        gap={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Construction Catalog (Category → Subcategory → Item → Subitem)
        </Typography>
        <Stack direction="row" gap={1}>
          <Tooltip title="Expand all">
            <Button
              variant="outlined"
              size="small"
              startIcon={<UnfoldMoreIcon />}
              onClick={handleExpandAll}
            >
              Expand
            </Button>
          </Tooltip>
          <Tooltip title="Collapse all">
            <Button
              variant="outlined"
              size="small"
              startIcon={<UnfoldLessIcon />}
              onClick={handleCollapseAll}
            >
              Collapse
            </Button>
          </Tooltip>
          <Tooltip title="Add Category">
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => openCreate("category")}
            >
              New Category
            </Button>
          </Tooltip>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} gap={2}>
            <Box sx={{ flex: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search name, unit, code, techniques…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Divider sx={{ my: 2 }} />

              <SimpleTreeView
                expandedItems={expanded}
                onExpandedItemsChange={handleToggle}
                slots={{
                  collapseIcon: ExpandMoreIcon,
                  expandIcon: ChevronRightIcon,
                }}
                sx={{
                  "& .MuiTreeItem-content.Mui-selected": {
                    backgroundColor: "transparent",
                  },
                  "& .MuiTreeItem-content.Mui-selected:hover": {
                    backgroundColor: "transparent",
                  },
                }}
              >
                {filtered.length ? (
                  renderTree(filtered)
                ) : (
                  <Typography color="text.secondary">No results</Typography>
                )}
              </SimpleTreeView>
            </Box>

            <Box sx={{ width: { xs: "100%", md: 380 } }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography fontWeight={700} mb={1}>
                    Quick Add
                  </Typography>
                  <Stack gap={1}>
                    <Button
                      variant="outlined"
                      onClick={() => openCreate("category")}
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Category
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        categories[0]?.type === "category"
                          ? openCreate("subcategory", categories[0].id)
                          : alert("Create a category first")
                      }
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Subcategory (under first category)
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const firstSub = categories
                          .filter((c) => c.type === "category")
                          .flatMap((c) => c.children)[0];
                        if (!firstSub || firstSub.type !== "subcategory")
                          return alert("Create a subcategory first");
                        openCreate("item", firstSub.id);
                      }}
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Item (under first subcategory)
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() => {
                        const findFirstItem = (
                          nodes: CatalogNode[]
                        ): CatalogNode | undefined => {
                          for (const n of nodes) {
                            if (n.type === "item") return n;
                            const kids = getChildren(n);
                            const hit = kids.length
                              ? findFirstItem(kids)
                              : undefined;
                            if (hit) return hit;
                          }
                          return undefined;
                        };
                        const firstItem = findFirstItem(categories);
                        if (!firstItem) return alert("Create an item first");
                        openCreate("subitem", firstItem.id);
                      }}
                      startIcon={<AddIcon />}
                      size="small"
                    >
                      Subitem (under first item)
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {dialogMode.type === "edit"
            ? `Edit ${dialogMode.node.type}`
            : dialogMode.type === "subitem"
            ? "New Subitem"
            : `New ${dialogMode.type}`}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
              fullWidth
            />

            {(dialogMode.type === "item" ||
              dialogMode.type === "subitem" ||
              (dialogMode.type === "edit" &&
                dialogMode.node.type === "item")) && (
              <>
                {/* Unit is mandatory for items/subitems. collect it here when catalog-maintainers add items */}
                <TextField
                  label="Unit"
                  placeholder="e.g., bag, kg, piece, ton, cu.ft"
                  value={form.unit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unit: e.target.value }))
                  }
                  fullWidth
                  size="small"
                  error={
                    !!(
                      form.unit === "" &&
                      (dialogMode.type === "item" ||
                        dialogMode.type === "subitem" ||
                        (dialogMode.type === "edit" &&
                          dialogMode.node.type === "item"))
                    )
                  }
                  helperText={
                    form.unit === "" &&
                    (dialogMode.type === "item" ||
                      dialogMode.type === "subitem" ||
                      (dialogMode.type === "edit" &&
                        dialogMode.node.type === "item"))
                      ? "Unit is required for items"
                      : undefined
                  }
                />
                <TextField
                  label="Code (optional)"
                  placeholder="e.g., BRK-CLAY-01"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  fullWidth
                  size="small"
                />
                <Box>
                  <Typography fontSize={13} color="text.secondary" mb={0.5}>
                    Techniques (press Enter to add)
                  </Typography>
                  <Stack
                    direction="row"
                    gap={1}
                    alignItems="center"
                    flexWrap="wrap"
                  >
                    {form.techniques.map((t) => (
                      <Chip
                        key={t}
                        label={t}
                        onDelete={() =>
                          setForm((f) => ({
                            ...f,
                            techniques: f.techniques.filter((x) => x !== t),
                          }))
                        }
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                  <TextField
                    size="small"
                    placeholder="e.g., M20 mix, bar bending, curing, compaction"
                    value={form.techniqueInput}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, techniqueInput: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && form.techniqueInput.trim()) {
                        e.preventDefault();
                        const v = form.techniqueInput.trim();
                        setForm((f) => ({
                          ...f,
                          techniques: Array.from(new Set([...f.techniques, v])),
                          techniqueInput: "",
                        }));
                      }
                    }}
                    fullWidth
                    sx={{ mt: 1 }}
                  />
                </Box>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={onSubmitDialog}
            disabled={
              !form.name.trim() ||
              ((dialogMode.type === "item" ||
                dialogMode.type === "subitem" ||
                (dialogMode.type === "edit" &&
                  dialogMode.node.type === "item")) &&
                !form.unit.trim())
            }
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
