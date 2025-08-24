// app/catalog/dbAdapter.ts
import type { DbNode } from "@/lib/catalogRepo";
import type { CatalogNode } from "../store";

/** turn flat rows into your UI tree (supports sub-items under items) */
export function buildTree(rows: DbNode[]): CatalogNode[] {
  const byId = new Map<string, CatalogNode>();
  const roots: CatalogNode[] = [];

  rows.forEach((r) => {
    const node: CatalogNode =
      r.type === "item"
        ? {
            id: r.id,
            type: "item",
            name: r.name,
            unit: r.unit ?? undefined,
            code: r.code ?? undefined,
            techniques: r.techniques ?? undefined,
            // children optional, added later if any
          }
        : {
            id: r.id,
            type: r.type, // "category" | "subcategory"
            name: r.name,
            children: [],
          };
    byId.set(r.id, node);
  });

  rows.forEach((r) => {
    const me = byId.get(r.id)!;
    if (r.parent_id) {
      const parent = byId.get(r.parent_id)!;
      if (parent.type === "item") {
        parent.children = parent.children ?? [];
        parent.children.push(me);
      } else {
        parent.children.push(me);
      }
    } else {
      roots.push(me);
    }
  });

  return roots;
}
