import { Router } from "express";
import { db } from "../utils/database";
import { authRequired } from "../middleware/auth.middleware";

export const GridController = Router();

GridController.use(authRequired);

GridController.post("/", async (req, res) => {
  const body: any = req.body || {};
  const query: any = req.query || {};
  const headerTitle = (req.headers["x-grid-title"] as string | undefined) || "";
  // debug
  try { console.log("[grids:create] raw", { body, query, headerTitle }); } catch {}
  let finalTitle = "" + (body.title ?? body.name ?? query.title ?? query.name ?? headerTitle ?? "");
  finalTitle = finalTitle.trim();
  if (!finalTitle) finalTitle = "Untitled";
  const [result] = await db.execute<any>(
    "INSERT INTO grids (owner_id, title) VALUES (?, ?)",
    [req.user!.id, finalTitle]
  );
  const id = (result as any).insertId as number;
  // ensure default sheet
  try {
    const [sheetRes] = await db.execute<any>("INSERT INTO grid_sheets (grid_id, name) VALUES (?, ?)", [id, "Sheet1"]);
    const sheetId = (sheetRes as any).insertId as number | undefined;
    if (sheetId) {
      await db.execute(
        "INSERT INTO grid_sheet_layout (sheet_id, `rows`, `cols`, row_heights, col_widths) VALUES (?, ?, ?, ?, ?)",
        [sheetId, 100, 26, JSON.stringify([]), JSON.stringify([])]
      );
    }
  } catch {}
  try { console.log("[grids:create] inserted", { id, finalTitle }); } catch {}
  return res.json({ success: true, data: { id, owner_id: req.user!.id, title: finalTitle, cells: [] } });
});

GridController.get("/", async (req, res) => {
  const userId = req.user!.id;
  const [rows] = await db.query<any[]>(
    `SELECT g.id, g.title, g.created_at,
            COALESCE(g.last_modified, lc.last_at) AS last_modified,
            COALESCE(u.display_name, u2.display_name) AS last_editor,
            (g.owner_id = ?) AS is_owner
     FROM grids g
     LEFT JOIN users u ON g.last_editor_id=u.id
     LEFT JOIN (
        SELECT c.grid_id, MAX(c.updated_at) AS last_at,
               SUBSTRING_INDEX(
                 GROUP_CONCAT(CASE WHEN c.updated_by IS NOT NULL THEN CONCAT(c.updated_at, '|', c.updated_by) END ORDER BY c.updated_at DESC), ',', 1
               ) AS last_pair
        FROM grid_cells c
        GROUP BY c.grid_id
     ) lc ON lc.grid_id=g.id
     LEFT JOIN users u2 ON u2.id = NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(lc.last_pair, '|', -1), ',', 1), '')
     WHERE g.owner_id=?
     UNION
     SELECT g.id, g.title, g.created_at,
            COALESCE(g.last_modified, lc.last_at) AS last_modified,
            COALESCE(u.display_name, u2.display_name) AS last_editor,
            (g.owner_id = ?) AS is_owner
     FROM grid_collaborators gc
     JOIN grids g ON gc.grid_id=g.id
     LEFT JOIN users u ON g.last_editor_id=u.id
     LEFT JOIN (
        SELECT c.grid_id, MAX(c.updated_at) AS last_at,
               SUBSTRING_INDEX(
                 GROUP_CONCAT(CASE WHEN c.updated_by IS NOT NULL THEN CONCAT(c.updated_at, '|', c.updated_by) END ORDER BY c.updated_at DESC), ',', 1
               ) AS last_pair
        FROM grid_cells c
        GROUP BY c.grid_id
     ) lc ON lc.grid_id=g.id
     LEFT JOIN users u2 ON u2.id = NULLIF(SUBSTRING_INDEX(SUBSTRING_INDEX(lc.last_pair, '|', -1), ',', 1), '')
     WHERE gc.user_id=?
     ORDER BY last_modified DESC, created_at DESC`,
    [userId, userId, userId, userId]
  );
  return res.json({ success: true, data: rows });
});

GridController.get("/:id", async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query<any[]>("SELECT id, owner_id, title FROM grids WHERE id=? LIMIT 1", [id]);
  const grid = rows[0];
  if (!grid) return res.status(404).json({ success: false, error: "Not found" });
  // load cells snapshot
  const [cells] = await db.query<any[]>(
    "SELECT row_index AS `row`, col_index AS `col`, value FROM grid_cells WHERE grid_id=?",
    [id]
  );
  const [sheets] = await db.query<any[]>(
    "SELECT id, name FROM grid_sheets WHERE grid_id=? ORDER BY id ASC",
    [id]
  );
  // layout for first sheet
  let layout: any = null;
  if (sheets?.[0]?.id) {
    const [ls] = await db.query<any[]>("SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=?", [sheets[0].id]);
    layout = ls[0] || null;
  }
  return res.json({ success: true, data: { ...grid, cells, sheets, layout } });
});

// rename grid (owner only)
GridController.patch("/:id", async (req, res) => {
  const { id } = req.params;
  let { title, name } = (req.body || {}) as any;
  let finalTitle = (typeof title === "string" ? title : (typeof name === "string" ? name : "")).trim();
  if (!finalTitle) return res.status(400).json({ success: false, error: "Title required" });
  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });
  await db.execute("UPDATE grids SET title=? WHERE id=?", [finalTitle, id]);
  return res.json({ success: true, data: { id: Number(id), title: finalTitle } });
});

// delete grid (owner only)
GridController.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });
  await db.execute("DELETE FROM grids WHERE id=?", [id]);
  return res.json({ success: true, data: true });
});

// sheets
GridController.get("/:id/sheets", async (req, res) => {
  const { id } = req.params;
  const [sheets] = await db.query<any[]>("SELECT id, name FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: sheets });
});

GridController.post("/:id/sheets", async (req, res) => {
  const { id } = req.params;
  let { name } = (req.body || {}) as any;
  name = (typeof name === "string" ? name : "").trim() || "Sheet" + Math.floor(Math.random() * 1000);
  const [r] = await db.execute<any>("INSERT INTO grid_sheets (grid_id, name) VALUES (?, ?)", [id, name]);
  const newSheetId = (r as any)?.insertId as number | undefined;
  if (newSheetId) {
    // 初始化布局为默认状态
    await db.execute(
      "INSERT IGNORE INTO grid_sheet_layout (sheet_id, `rows`, `cols`, row_heights, col_widths) VALUES (?, 100, 26, ?, ?)",
      [newSheetId, JSON.stringify([]), JSON.stringify([])]
    );
  }
  const [rows] = await db.query<any[]>("SELECT id, name FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: rows });
});

GridController.delete("/:id/sheets/:sheetId", async (req, res) => {
  const { id, sheetId } = req.params as any;
  await db.execute("DELETE FROM grid_sheets WHERE grid_id=? AND id=?", [id, sheetId]);
  return res.json({ success: true, data: true });
});

// rename sheet (owner only)
GridController.patch("/:id/sheets/:sheetId", async (req, res) => {
  const { id, sheetId } = req.params as any;
  let { name } = (req.body || {}) as any;
  name = typeof name === 'string' ? name.trim() : '';
  if (!name) return res.status(400).json({ success: false, error: "Name required" });

  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });

  await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [name, sheetId, id]);
  const [sheets] = await db.query<any[]>("SELECT id, name FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: sheets });
});

