import { supabase } from "@/lib/supabaseClient";

// sub item search

export type SubitemPathRow = {
  sub_item_id: string;
  sub_item_name: string;
  item_name: string | null;
  sub_category_name: string | null;
  category_name: string | null;
  unit: string | null;
  code: string | null;
  project_id: string;
};

export async function searchSubitems(
  projectId: string,
  q: string,
  limit = 12
): Promise<SubitemPathRow[]> {
  // Empty query? Return nothing (avoid loading the world)
  if (!q.trim()) return [];

  const { data, error } = await supabase
    .from("catalog_subitem_paths")
    .select(
      "sub_item_id,sub_item_name,item_name,sub_category_name,category_name,unit,code,project_id"
    )
    .eq("project_id", projectId)
    .ilike("sub_item_name", `%${q}%`)
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// old

export type DbNode = {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: "category" | "subcategory" | "item";
  name: string;
  unit: string | null;
  code: string | null;
  techniques: string[] | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export async function listCatalog(projectId: string): Promise<DbNode[]> {
  const { data, error } = await supabase
    .from("catalog_nodes")
    .select("*")
    .eq("project_id", projectId)
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return data as DbNode[];
}

export async function createNode(payload: {
  project_id: string;
  parent_id: string | null;
  type: "category" | "subcategory" | "item";
  name: string;
  unit?: string | null;
  code?: string | null;
  techniques?: string[] | null;
  position?: number;
}) {
  const { data, error } = await supabase
    .from("catalog_nodes")
    .insert({
      ...payload,
      unit: payload.unit ?? null,
      code: payload.code ?? null,
      techniques: payload.techniques ?? [],
      position: payload.position ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbNode;
}

export async function updateNodeDb(
  id: string,
  patch: Partial<
    Pick<
      DbNode,
      "name" | "unit" | "code" | "techniques" | "parent_id" | "position"
    >
  >
) {
  const { data, error } = await supabase
    .from("catalog_nodes")
    .update({
      ...patch,
      unit: patch.unit ?? undefined,
      code: patch.code ?? undefined,
      techniques: patch.techniques ?? undefined,
      parent_id: patch.parent_id ?? undefined,
      position: patch.position ?? undefined,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbNode;
}

export async function deleteNodeDb(id: string) {
  const { error } = await supabase.from("catalog_nodes").delete().eq("id", id);
  if (error) throw error;
}
