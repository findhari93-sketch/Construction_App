"use client";
import { create } from "zustand";
import {
  listCatalog,
  createNode,
  updateNodeDb,
  deleteNodeDb,
} from "@/lib/catalogRepo";
import { buildTree } from "./material-catalog/dbAdapter";

/** Catalog node can be branch or item; items can have sub-items */
export type CatalogNode =
  | { id: string; type: "category"; name: string; children: CatalogNode[] }
  | { id: string; type: "subcategory"; name: string; children: CatalogNode[] }
  | {
      id: string;
      type: "item";
      name: string;
      unit?: string;
      techniques?: string[];
      code?: string;
      children?: CatalogNode[]; // sub-items
    };

type CatalogState = {
  categories: CatalogNode[];

  // local/optimistic ops (UI)
  hydrate: (all: CatalogNode[]) => void;
  addCategory: (c: { id: string; name: string }) => void;
  addSubcategory: (parentId: string, sc: { id: string; name: string }) => void;
  addItemUnder: (
    parentId: string,
    it: {
      id: string;
      name: string;
      unit?: string;
      techniques?: string[];
      code?: string;
    }
  ) => void;
  addItem: (
    parentSubcategoryId: string,
    it: {
      id: string;
      name: string;
      unit?: string;
      techniques?: string[];
      code?: string;
    }
  ) => void;
  updateNode: (id: string, patch: Partial<CatalogNode>) => void;
  removeNode: (id: string) => void;

  // DB actions
  loadFromDb: (projectId: string) => Promise<void>;
  createInDb: (
    projectId: string,
    parentId: string | null,
    payload: {
      type: CatalogNode["type"];
      name: string;
      unit?: string;
      code?: string;
      techniques?: string[];
      position?: number;
    }
  ) => Promise<void>;
  updateInDb: (
    id: string,
    patch: {
      name?: string;
      unit?: string;
      code?: string;
      techniques?: string[];
      parent_id?: string | null;
      position?: number;
    }
  ) => Promise<void>;
  deleteInDb: (id: string) => Promise<void>;
};

function isBranch(n: CatalogNode): boolean {
  return n.type !== "item" || !!(n.children && n.children.length > 0);
}
function getChildren(n: CatalogNode): CatalogNode[] {
  return n.type !== "item" ? n.children : n.children ?? [];
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  categories: [],
  hydrate: (all) => set(() => ({ categories: all })),

  addCategory: (c) =>
    set((s) => ({
      categories: [
        ...s.categories,
        { id: c.id, type: "category", name: c.name, children: [] },
      ],
    })),

  addSubcategory: (parentId, sc) =>
    set((s) => {
      const mutate = (nodes: CatalogNode[]): CatalogNode[] =>
        nodes.map((n) => {
          if (
            (n.type === "category" || n.type === "subcategory") &&
            n.id === parentId
          ) {
            return {
              ...n,
              children: [
                ...n.children,
                { id: sc.id, type: "subcategory", name: sc.name, children: [] },
              ],
            };
          }
          if (n.type !== "item") return { ...n, children: mutate(n.children) };
          if (n.id === parentId) {
            const kids = n.children ?? [];
            return {
              ...n,
              children: [
                ...kids,
                { id: sc.id, type: "subcategory", name: sc.name, children: [] },
              ],
            };
          }
          return n;
        });
      return { categories: mutate(s.categories) };
    }),

  addItemUnder: (parentId, it) =>
    set((s) => {
      const mutate = (nodes: CatalogNode[]): CatalogNode[] =>
        nodes.map((n) => {
          if (
            (n.type === "subcategory" || n.type === "item") &&
            n.id === parentId
          ) {
            const newItem: CatalogNode = {
              id: it.id,
              type: "item",
              name: it.name,
              unit: it.unit,
              techniques: it.techniques,
              code: it.code,
            };
            if (n.type === "subcategory")
              return { ...n, children: [...n.children, newItem] };
            const kids = n.children ?? [];
            return { ...n, children: [...kids, newItem] };
          }
          if (isBranch(n)) return { ...n, children: mutate(getChildren(n)) };
          return n;
        });
      return { categories: mutate(s.categories) };
    }),

  addItem: (parentSubcategoryId, it) =>
    set((s) => {
      const mutate = (nodes: CatalogNode[]): CatalogNode[] =>
        nodes.map((n) => {
          if (n.type === "subcategory" && n.id === parentSubcategoryId) {
            const newItem: CatalogNode = {
              id: it.id,
              type: "item",
              name: it.name,
              unit: it.unit,
              techniques: it.techniques,
              code: it.code,
            };
            return { ...n, children: [...n.children, newItem] };
          }
          if (isBranch(n)) return { ...n, children: mutate(getChildren(n)) };
          return n;
        });
      return { categories: mutate(s.categories) };
    }),

  updateNode: (id, patch) =>
    set((s) => {
      const mutate = (nodes: CatalogNode[]): CatalogNode[] =>
        nodes.map((n) => {
          if (n.id === id) {
            if (n.type === "item") {
              // Only properties valid for items
              const p = patch as Partial<
                Extract<CatalogNode, { type: "item" }>
              >;
              return { ...n, ...p };
            }
            // Category or subcategory: currently only "name" can change
            const p = patch as Partial<Pick<CatalogNode, "name">>;
            return { ...n, ...p };
          }
          if (isBranch(n)) return { ...n, children: mutate(getChildren(n)) };
          return n;
        });
      return { categories: mutate(s.categories) };
    }),

  removeNode: (id) =>
    set((s) => {
      const mutate = (nodes: CatalogNode[]): CatalogNode[] =>
        nodes
          .filter((n) => n.id !== id)
          .map((n) =>
            isBranch(n) ? { ...n, children: mutate(getChildren(n)) } : n
          );
      return { categories: mutate(s.categories) };
    }),

  // ---- DB actions ----
  loadFromDb: async (projectId) => {
    const rows = await listCatalog(projectId);
    set(() => ({ categories: buildTree(rows) }));
  },

  createInDb: async (projectId, parentId, payload) => {
    const created = await createNode({
      project_id: projectId,
      parent_id: parentId,
      type: payload.type,
      name: payload.name,
      unit: payload.unit ?? null,
      code: payload.code ?? null,
      techniques: payload.techniques ?? [],
      position: payload.position ?? 0,
    });

    // optimistic merge
    if (!created.parent_id && created.type === "category") {
      get().addCategory({ id: created.id, name: created.name });
      return;
    }
    if (created.type === "subcategory") {
      get().addSubcategory(created.parent_id!, {
        id: created.id,
        name: created.name,
      });
      return;
    }
    // item (could be under subcategory or item)
    get().addItemUnder(created.parent_id!, {
      id: created.id,
      name: created.name,
      unit: created.unit ?? undefined,
      code: created.code ?? undefined,
      techniques: created.techniques ?? undefined,
    });
  },

  updateInDb: async (id, patch) => {
    const r = await updateNodeDb(id, patch);
    get().updateNode(id, {
      name: r.name,
      ...(r.type === "item"
        ? {
            unit: r.unit ?? undefined,
            code: r.code ?? undefined,
            techniques: r.techniques ?? undefined,
          }
        : {}),
    });
  },

  deleteInDb: async (id) => {
    await deleteNodeDb(id);
    get().removeNode(id);
  },
}));
