"use client";

import { msalInstance, graphScopes } from "./msal";
import type { ExpenseRow } from "@/store/expenseStore";

// add near your imports / top of file
let cachedItemId: string | null = null;
let workbookSessionId: string | null = null;

async function getOrResolveItemId(token: string): Promise<string> {
  if (cachedItemId) return cachedItemId;
  cachedItemId = await resolveItemId(token);
  return cachedItemId;
}

async function ensureWorkbookSession(token: string, itemId: string) {
  if (workbookSessionId) return;
  const res = await gfetch(
    `/me/drive/items/${itemId}/workbook/createSession`,
    token,
    {
      method: "POST",
      body: JSON.stringify({ persistChanges: true }), // persist is usually what you want
    }
  );
  if (!res.ok) {
    throw new Error(`createSession failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  workbookSessionId = json?.id || null;
}

/** ───────────── Configure these to match YOUR Excel ───────────── */
const FILE_NAME = "Construction_App.xlsx"; // exact file name
const TABLE_NAME = "Expenses"; // Excel table name
const KEY_COLUMN_NAME = "app_id"; // unique key column header (first column)
/** ──────────────────────────────────────────────────────────────── */

// Small Graph types
type DriveItem = { id: string; name?: string };
type SearchResponse = { value: DriveItem[] };
type HeaderRange = { values?: string[][] };
type DataBodyRange = { values?: (string | number | boolean | null)[][] };
type TablesList = { value?: { name: string }[] };

let msalInitialized = false;
async function ensureMsalInitialized() {
  if (!msalInitialized) {
    await msalInstance.initialize();
    msalInitialized = true;
  }
}

async function getGraphToken(): Promise<string> {
  await ensureMsalInitialized();

  let account = msalInstance.getAllAccounts()[0];
  if (!account) {
    await msalInstance.loginPopup({ scopes: graphScopes });
    account = msalInstance.getAllAccounts()[0]!;
  }
  const token = await msalInstance.acquireTokenSilent({
    scopes: graphScopes,
    account,
  });
  return token.accessToken; // raw JWT string (xxxxx.yyyyy.zzzzz)
}

function gfetch(
  path: string,
  token: string,
  init?: RequestInit
): Promise<Response> {
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  return fetch(url, {
    ...(init || {}),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(workbookSessionId
        ? { "workbook-session-id": workbookSessionId }
        : {}),
      ...(init?.headers || {}),
    },
  });
}

/** Find the OneDrive itemId for FILE_NAME anywhere in your OneDrive. */
async function resolveItemId(token: string): Promise<string> {
  const res = await gfetch(
    `/me/drive/root/search(q='${encodeURIComponent(
      FILE_NAME
    )}')?$select=id,name`,
    token
  );
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as SearchResponse;
  const hit = json.value.find(
    (x) => (x.name || "").toLowerCase() === FILE_NAME.toLowerCase()
  );
  if (!hit) {
    throw new Error(
      `Workbook "${FILE_NAME}" not found in your OneDrive. Confirm name and account.`
    );
  }
  return hit.id;
}

/** Make sure TABLE_NAME exists; if not, show what Graph sees. */
async function ensureTableExists(token: string, itemId: string) {
  const res = await gfetch(`/me/drive/items/${itemId}/workbook/tables`, token);
  if (!res.ok) {
    throw new Error(`List tables failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as TablesList;
  const names = (json.value ?? []).map((t) => t.name);
  if (!names.includes(TABLE_NAME)) {
    throw new Error(
      `Table "${TABLE_NAME}" not found. Available tables: ${
        names.join(", ") || "(none)"
      }`
    );
  }
}

/** Return the 0-based column index of KEY_COLUMN_NAME in the table header. */
async function getKeyColumnIndex(
  token: string,
  itemId: string
): Promise<number> {
  await ensureTableExists(token, itemId);

  const res = await gfetch(
    `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
      TABLE_NAME
    )}')/headerRowRange`,
    token
  );
  if (!res.ok) {
    throw new Error(`Header fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as HeaderRange;
  const headers = json.values?.[0] ?? [];
  const idx = headers.findIndex(
    (h) => String(h).trim().toLowerCase() === KEY_COLUMN_NAME.toLowerCase()
  );
  if (idx < 0) {
    throw new Error(
      `Header "${KEY_COLUMN_NAME}" not found. Headers: ${headers.join(", ")}`
    );
  }
  return idx;
}

/** Find the 0-based row index (in the table body) where KEY_COLUMN_NAME === id. */
async function findRowIndexById(
  token: string,
  itemId: string,
  id: string
): Promise<number> {
  const keyIdx = await getKeyColumnIndex(token, itemId);

  const res = await gfetch(
    `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
      TABLE_NAME
    )}')/dataBodyRange`,
    token
  );
  if (!res.ok) {
    throw new Error(`Body fetch failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as DataBodyRange;
  const rows = json.values ?? [];
  return rows.findIndex((row) => String(row[keyIdx] ?? "") === id);
}

/** Append a row to Excel. */
export async function addExpenseToExcel(row: ExpenseRow) {
  const token = await getGraphToken();
  const itemId = await resolveItemId(token);
  await ensureTableExists(token, itemId);
  await ensureWorkbookSession(token, itemId); // NEW

  const url = `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
    TABLE_NAME
  )}')/rows/add`;

  const values = [
    [
      row.id, // app_id in Excel
      row.date,
      row.spentOn,
      row.category,
      row.subCategory ?? "",
      row.item,
      row.subItem,
      row.workPhase,
      row.unit,
      row.quantity,
      row.pricePerUnit,
      row.amount,
      row.paidInitially,
      row.settledBy,
      row.paymentType,
      row.paidTo,
      row.mobile,
      row.billLink ?? "",
      row.receiptLink ?? "",
      row.notes,
    ],
  ];

  const res = await gfetch(url, token, {
    method: "POST",
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`Add row failed: ${res.status} ${await res.text()}`);
  }
}

/** ───── Fallback-capable delete (rows API → range delete/shift up) ───── */

/** Get worksheet (id & name) that hosts TABLE_NAME */
async function getWorksheetForTable(
  token: string,
  itemId: string
): Promise<{ id: string; name: string }> {
  const res = await gfetch(
    `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
      TABLE_NAME
    )}')/worksheet`,
    token
  );
  if (!res.ok) {
    throw new Error(`Get worksheet failed: ${res.status} ${await res.text()}`);
  }
  const ws = await res.json(); // { id, name, ... }
  return { id: ws.id, name: ws.name };
}

/** Get the full table A1 (e.g., "Sheet1!A1:T200") */

/** Convert a 1-based column number to letters (1->A, 27->AA, ...) */
function colToLetters(col: number): string {
  let s = "";
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

async function computeRelativeRowA1FromTable(
  token: string,
  itemId: string,
  rowIndex: number
): Promise<string> {
  const res = await gfetch(
    `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
      TABLE_NAME
    )}')/range`,
    token
  );
  if (!res.ok) {
    throw new Error(
      `Get table range failed: ${res.status} ${await res.text()}`
    );
  }
  const table = await res.json(); // { address: "Sheet1!A1:T200", ... }
  const { startCol, startRow, endCol } = parseA1(String(table.address));

  const headerRows = 1;
  const targetRow = startRow + headerRows + rowIndex;

  const startColLetters = colToLetters(startCol);
  const endColLetters = colToLetters(endCol);

  return `${startColLetters}${targetRow}:${endColLetters}${targetRow}`;
}

/** Parse "Sheet Name!A1:T200" into parts */
function parseA1(a1: string): {
  sheet: string;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
} {
  const m =
    a1.match(/^'(.+?)'!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i) ||
    a1.match(/^(.+?)!([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!m) throw new Error(`Unexpected A1 address: ${a1}`);

  const sheet = m[1];
  const startColLetters = m[2].toUpperCase();
  const startRow = parseInt(m[3], 10);
  const endColLetters = m[4].toUpperCase();
  const endRow = parseInt(m[5], 10);

  const lettersToCol = (letters: string) =>
    letters
      .split("")
      .reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);

  return {
    sheet,
    startCol: lettersToCol(startColLetters),
    startRow,
    endCol: lettersToCol(endColLetters),
    endRow,
  };
}

/**
 * Compute the single-row A1 for a table body row index (0-based).
 * We avoid rows/{index}/range by:
 *  - reading table range (includes header row),
 *  - targetRow = startRow + 1 (header) + rowIndex.
 */

/** Fallback: delete a range and shift cells up */
async function deleteRangeShiftUp(
  token: string,
  itemId: string,
  worksheetId: string,
  relativeA1: string
) {
  // IMPORTANT:
  // - Do NOT URL-encode the relative address here.
  // - Do NOT include the sheet name.
  // - The API expects: .../range(address='A4:S4')
  const url = `/me/drive/items/${itemId}/workbook/worksheets('${encodeURIComponent(
    worksheetId
  )}')/range(address='${relativeA1}')/delete`;

  const res = await gfetch(url, token, {
    method: "POST",
    body: JSON.stringify({ shift: "Up" }),
  });
  if (!res.ok) {
    throw new Error(`Range delete failed: ${res.status} ${await res.text()}`);
  }
}

/** Low-level: delete by table row index with robust fallback */
async function deleteByRowIndexWithFallback(rowIndex: number) {
  const token = await getGraphToken();
  const itemId = await resolveItemId(token);
  await ensureTableExists(token, itemId);
  await ensureWorkbookSession(token, itemId);

  // Attempt 1: direct row delete (may be unsupported)
  {
    const url = `/me/drive/items/${itemId}/workbook/tables('${encodeURIComponent(
      TABLE_NAME
    )}')/rows/${rowIndex}`;
    const res = await gfetch(url, token, { method: "DELETE" });
    if (res.ok) return;

    const body = await res.text();
    const isApiNotFound =
      res.status === 400 &&
      /apiNotFound/i.test(body) &&
      /requirement-sets/i.test(body);

    if (!isApiNotFound) {
      throw new Error(`Delete row failed: ${res.status} ${body}`);
    }
    // fall through…
  }

  // Attempt 2: compute relative row address, then worksheet-range delete
  const { id: worksheetId } = await getWorksheetForTable(token, itemId);
  const relativeA1 = await computeRelativeRowA1FromTable(
    token,
    itemId,
    rowIndex
  );
  await deleteRangeShiftUp(token, itemId, worksheetId, relativeA1);
}

/** High-level: delete the row where KEY_COLUMN_NAME === appId (with fallback) */
export async function deleteExpenseFromExcelByAppId(appId: string) {
  const token = await getGraphToken();
  const itemId = await resolveItemId(token);
  await ensureTableExists(token, itemId);
  await ensureWorkbookSession(token, itemId);

  const rowIndex = await findRowIndexById(token, itemId, appId);
  if (rowIndex < 0) {
    // Not found — nothing to delete
    return;
  }
  await deleteByRowIndexWithFallback(rowIndex);
}
