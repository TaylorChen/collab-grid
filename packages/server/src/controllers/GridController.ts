import { Router } from "express";
import { db } from "../utils/database";
import { authRequired } from "../middleware/auth.middleware";

export const GridController = Router();

GridController.use(authRequired);

function genPublicId(): string {
  const s = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return s.slice(0, 16);
}

async function resolveGridKey(key: string): Promise<number | null> {
  if (!key) return null;
  if (/^\d+$/.test(key)) return Number(key);
  const [rows] = await db.query<any[]>("SELECT id FROM grids WHERE public_id=? LIMIT 1", [key]);
  return (rows as any[])?.[0]?.id ?? null;
}

GridController.post("/", async (req, res) => {
  const body: any = req.body || {};
  const query: any = req.query || {};
  const headerTitle = (req.headers["x-grid-title"] as string | undefined) || "";
  // debug
  let finalTitle = "" + (body.title ?? body.name ?? query.title ?? query.name ?? headerTitle ?? "");
  finalTitle = finalTitle.trim();
  if (!finalTitle) finalTitle = "Untitled";
  const [result] = await db.execute<any>(
    "INSERT INTO grids (owner_id, title, public_id) VALUES (?, ?, ?)",
    [req.user!.id, finalTitle, genPublicId()]
  );
  const id = (result as any).insertId as number;
  // ensure default sheet
  try {
    const [sheetRes] = await db.execute<any>("INSERT INTO grid_sheets (grid_id, name, public_id) VALUES (?, ?, ?)", [id, "Sheet1", genPublicId()]);
    const sheetId = (sheetRes as any).insertId as number | undefined;
    if (sheetId) {
      await db.execute(
        "INSERT INTO grid_sheet_layout (sheet_id, `rows`, `cols`, row_heights, col_widths) VALUES (?, ?, ?, ?, ?)",
        [sheetId, 100, 60, JSON.stringify([]), JSON.stringify([])]
      );
    }
  } catch {}
  const [gr] = await db.query<any[]>("SELECT public_id FROM grids WHERE id=?", [id]);
  return res.json({ success: true, data: { id, public_id: (gr as any[])?.[0]?.public_id, owner_id: req.user!.id, title: finalTitle, cells: [] } });
});

GridController.get("/", async (req, res) => {
  const userId = req.user!.id;
  const [rows] = await db.query<any[]>(
    `SELECT g.id, g.public_id, g.title, g.created_at,
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
     SELECT g.id, g.public_id, g.title, g.created_at,
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
  const { id: key } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  const [rows] = await db.query<any[]>("SELECT id, public_id, owner_id, title FROM grids WHERE id=? LIMIT 1", [id]);
  const grid: any = (rows as any[])[0];
  if (!grid) return res.status(404).json({ success: false, error: "Not found" });
  
  // 检查当前用户对这个Grid的权限
  const userId = req.user!.id;
  const isOwner = grid.owner_id === userId;
  let userPermission = isOwner ? 'owner' : null;
  
  if (!isOwner) {
    // 查询协作者权限
    const [collaboratorRows] = await db.query<any[]>(
      "SELECT permission FROM grid_collaborators WHERE grid_id=? AND user_id=? LIMIT 1", 
      [id, userId]
    );
    if (collaboratorRows.length > 0) {
      userPermission = collaboratorRows[0].permission; // 'read' or 'write'
    }
  }
  
  // 如果用户既不是拥有者也不是协作者，返回403
  if (!userPermission) {
    return res.status(403).json({ success: false, error: "No access to this grid" });
  }
  
  // load cells snapshot
  const [cells] = await db.query<any[]>(
    "SELECT row_index AS `row`, col_index AS `col`, value, style FROM grid_cells WHERE grid_id=?",
    [id]
  );
  const [sheets] = await db.query<any[]>(
    "SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC",
    [id]
  );
  // layout for first sheet
  let layout: any = null;
  if (Array.isArray(sheets) && sheets.length > 0 && (sheets[0] as any)?.id) {
    const firstSheetId = (sheets[0] as any).id;
    const [ls] = await db.query<any[]>("SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=?", [firstSheetId]);
    layout = (ls as any[])[0] || null;
  }
  
  return res.json({ 
    success: true, 
    data: { 
      ...grid, 
      cells, 
      sheets, 
      layout,
      userPermission // 添加用户权限信息
    } 
  });
});

// rename grid (owner only)
GridController.patch("/:id", async (req, res) => {
  const { id: key } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  let { title, name } = (req.body || {}) as any;
  let finalTitle = (typeof title === "string" ? title : (typeof name === "string" ? name : "")).trim();
  if (!finalTitle) return res.status(400).json({ success: false, error: "Title required" });
  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row: any = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });
  await db.execute("UPDATE grids SET title=? WHERE id=?", [finalTitle, id]);
  return res.json({ success: true, data: { id: Number(id), title: finalTitle } });
});

// delete grid (owner only)
GridController.delete("/:id", async (req, res) => {
  const { id: key } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row: any = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });
  await db.execute("DELETE FROM grids WHERE id=?", [id]);
  return res.json({ success: true, data: true });
});

// sheets
GridController.get("/:id/sheets", async (req, res) => {
  const { id: key } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  const [sheets] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: sheets });
});

GridController.post("/:id/sheets", async (req, res) => {
  const { id: key } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  let { name } = (req.body || {}) as any;
  console.log('🆕 创建Sheet请求:', { originalName: name, bodyType: typeof name });
  
  // 生成默认名称
  if (!name || typeof name !== "string" || !name.trim()) {
    // 获取当前grid的Sheet数量，生成合适的默认名称
    const [existingSheets] = await db.query<any[]>("SELECT COUNT(*) as count FROM grid_sheets WHERE grid_id=?", [id]);
    const sheetCount = (existingSheets[0]?.count || 0) + 1;
    name = `Sheet${sheetCount}`;
    console.log('🆕 使用默认名称:', { sheetCount, generatedName: name });
  } else {
    name = name.trim();
    console.log('🆕 使用提供的名称:', { providedName: name });
  }
  
  let finalName = name;
  let newSheetId: number | undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const [r] = await db.execute<any>("INSERT INTO grid_sheets (grid_id, name, public_id) VALUES (?, ?, ?)", [id, finalName, genPublicId()]);
      newSheetId = (r as any)?.insertId as number | undefined;
      console.log('✅ Sheet创建成功:', { newSheetId, finalName, attempt });
      break;
    } catch (e: any) {
      if (e?.code !== 'ER_DUP_ENTRY') throw e;
      // auto-rename: base or base (n)
      const m = /^(.*?)(?:\s\((\d+)\))?$/.exec(finalName) || [];
      const base = (m[1] || finalName).trim();
      const n = m[2] ? (parseInt(m[2], 10) + 1) : 2;
      finalName = `${base} (${n})`;
      console.log('🔄 名称冲突，重命名为:', { 
        originalName: name, 
        finalName, 
        attempt,
        regexMatch: m,
        extractedBase: base,
        extractedN: n,
        m1: m[1],
        m2: m[2]
      });
    }
  }
  if (newSheetId) {
    // 初始化布局为默认状态
    await db.execute(
      "INSERT IGNORE INTO grid_sheet_layout (sheet_id, `rows`, `cols`, row_heights, col_widths) VALUES (?, 100, 60, ?, ?)",
      [newSheetId, JSON.stringify([]), JSON.stringify([])]
    );
  }
  const [rows] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  console.log('📤 返回给前端的Sheet数据:', { 
    newSheetId, 
    returnedSheets: rows.map(r => ({ id: r.id, name: r.name }))
  });
  return res.json({ success: true, data: rows });
});

GridController.delete("/:id/sheets/:sheetId", async (req, res) => {
  const { id: key, sheetId: sheetKey } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  // prevent deleting the only sheet
  try {
    const [cntRows] = await db.query<any[]>("SELECT COUNT(*) AS cnt FROM grid_sheets WHERE grid_id=?", [id]);
    const cnt = (cntRows as any[])?.[0]?.cnt ?? 0;
    if (Number(cnt) <= 1) return res.status(400).json({ success: false, error: "Cannot delete the only sheet" });
  } catch {}
  let sheetId: number | null = null;
  if (/^\d+$/.test(String(sheetKey))) sheetId = Number(sheetKey);
  else {
    const [sr] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE public_id=? AND grid_id=? LIMIT 1", [sheetKey, id]);
    sheetId = (sr as any[])?.[0]?.id ?? null;
  }
  if (!sheetId) return res.status(404).json({ success: false, error: "Not found" });
  await db.execute("DELETE FROM grid_sheets WHERE grid_id=? AND id=?", [id, sheetId]);
  return res.json({ success: true, data: true });
});

// rename sheet (owner only)
GridController.patch("/:id/sheets/:sheetId", async (req, res) => {
  const { id: key, sheetId: sheetKey } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  let sheetId: number | null = null;
  if (/^\d+$/.test(String(sheetKey))) sheetId = Number(sheetKey); else {
    const [sr] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE public_id=? AND grid_id=? LIMIT 1", [sheetKey, id]);
    sheetId = (sr as any[])?.[0]?.id ?? null;
  }
  if (!sheetId) return res.status(404).json({ success: false, error: "Not found" });
  let { name } = (req.body || {}) as any;
  name = typeof name === 'string' ? name.trim() : '';
  if (!name) return res.status(400).json({ success: false, error: "Name required" });

  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });

  await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [name, sheetId, id]);
  const [sheets] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: sheets });
});

// move sheet (owner only) - 简单实现：交换两个Sheet的ID顺序
GridController.patch("/:id/sheets/:sheetId/move", async (req, res) => {
  const { id: key, sheetId: sheetKey } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  
  let sheetId: number | null = null;
  if (/^\d+$/.test(String(sheetKey))) sheetId = Number(sheetKey); else {
    const [sr] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE public_id=? AND grid_id=? LIMIT 1", [sheetKey, id]);
    sheetId = (sr as any[])?.[0]?.id ?? null;
  }
  if (!sheetId) return res.status(404).json({ success: false, error: "Not found" });
  
  const { direction } = req.body || {};
  if (direction !== 'left' && direction !== 'right') {
    return res.status(400).json({ success: false, error: "Invalid direction" });
  }

  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });

  // 获取当前Sheet列表
  const [allSheets] = await db.query<any[]>("SELECT id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  const sheets = allSheets as any[];
  
  // 找到当前Sheet在列表中的位置
  const currentIndex = sheets.findIndex(s => s.id === sheetId);
  if (currentIndex === -1) return res.status(404).json({ success: false, error: "Sheet not found" });
  
  let targetIndex: number;
  if (direction === 'left') {
    if (currentIndex === 0) return res.status(400).json({ success: false, error: "Already leftmost" });
    targetIndex = currentIndex - 1;
  } else {
    if (currentIndex === sheets.length - 1) return res.status(400).json({ success: false, error: "Already rightmost" });
    targetIndex = currentIndex + 1;
  }
  
  // 临时解决方案：通过重新创建Sheet来改变顺序
  // TODO: 实现更优雅的排序字段
  const currentSheet = sheets[currentIndex];
  const targetSheet = sheets[targetIndex];
  
  // 使用三步法交换Sheet名称，避免约束冲突
  console.log('📍 开始交换Sheet名称:', { 
    currentSheet: currentSheet.name, 
    targetSheet: targetSheet.name,
    currentId: currentSheet.id,
    targetId: targetSheet.id
  });
  
  const tempName = `__TEMP_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  try {
    // 步骤1：将当前Sheet改为临时名称
    await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [tempName, currentSheet.id, id]);
    console.log('📍 步骤1完成：当前Sheet改为临时名称');
    
    // 步骤2：将目标Sheet改为当前Sheet的原名称
    await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [currentSheet.name, targetSheet.id, id]);
    console.log('📍 步骤2完成：目标Sheet改为当前Sheet原名称');
    
    // 步骤3：将当前Sheet改为目标Sheet的原名称
    await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [targetSheet.name, currentSheet.id, id]);
    console.log('📍 步骤3完成：当前Sheet改为目标Sheet原名称');
  } catch (swapError) {
    console.error('❌ 交换Sheet名称失败:', swapError);
    // 尝试恢复原状态
    try {
      await db.execute("UPDATE grid_sheets SET name=? WHERE id=? AND grid_id=?", [currentSheet.name, currentSheet.id, id]);
      console.log('📍 已恢复当前Sheet的原名称');
    } catch (restoreError) {
      console.error('❌ 恢复失败:', restoreError);
    }
    throw new Error(`移动失败: ${swapError.message}`);
  }
  
  // 返回更新后的Sheet列表
  const [updatedSheets] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  return res.json({ success: true, data: updatedSheets });
});

// duplicate sheet (owner only)
GridController.post("/:id/sheets/:sheetId/duplicate", async (req, res) => {
  console.log('📄 收到复制Sheet请求:', { gridKey: req.params.id, sheetKey: req.params.sheetId });
  const { id: key, sheetId: sheetKey } = req.params as any;
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  
  let sheetId: number | null = null;
  if (/^\d+$/.test(String(sheetKey))) sheetId = Number(sheetKey); else {
    const [sr] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE public_id=? AND grid_id=? LIMIT 1", [sheetKey, id]);
    sheetId = (sr as any[])?.[0]?.id ?? null;
  }
  if (!sheetId) return res.status(404).json({ success: false, error: "Not found" });

  const [rows] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [id]);
  const row = (rows as any[])[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  if (row.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });

  // 获取原Sheet信息
  const [sourceSheets] = await db.query<any[]>("SELECT name FROM grid_sheets WHERE id=? AND grid_id=? LIMIT 1", [sheetId, id]);
  const sourceSheet = (sourceSheets as any[])[0];
  if (!sourceSheet) return res.status(404).json({ success: false, error: "Source sheet not found" });

  // 生成新的Sheet名称
  const baseName = sourceSheet.name;
  const copyName = `${baseName} 副本`;
  console.log('📄 创建新Sheet:', { baseName, copyName });

  // 创建新Sheet
  const [result] = await db.execute("INSERT INTO grid_sheets (grid_id, name, public_id) VALUES (?, ?, ?)", [
    id, 
    copyName, 
    `sheet_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  ]);
  const newSheetId = (result as any).insertId;
  console.log('📄 新Sheet已创建:', { newSheetId });

  // 复制Sheet的布局信息
  const [layoutData] = await db.query<any[]>("SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=? LIMIT 1", [sheetId]);
  const layout = (layoutData as any[])[0];
  if (layout) {
    await db.execute(
      "INSERT INTO grid_sheet_layout (sheet_id, `rows`, `cols`, row_heights, col_widths) VALUES (?, ?, ?, ?, ?)",
      [newSheetId, layout.rows, layout.cols, layout.row_heights, layout.col_widths]
    );
  } else {
    // 使用默认布局
    await db.execute(
      "INSERT INTO grid_sheet_layout (sheet_id, `rows`, `cols`) VALUES (?, 100, 60)",
      [newSheetId]
    );
  }

  // 复制Sheet的单元格数据
  const [cellsData] = await db.query<any[]>("SELECT row_index AS `row`, col_index AS `col`, value, style FROM grid_cells WHERE grid_id=? AND sheet_id=?", [id, sheetId]);
  const cells = cellsData as any[];
  if (cells.length > 0) {
    const insertPromises = cells.map(cell => 
      db.execute(
        "INSERT INTO grid_cells (grid_id, sheet_id, row_index, col_index, value, style) VALUES (?, ?, ?, ?, ?, ?)",
        [id, newSheetId, cell.row, cell.col, cell.value, cell.style]
      )
    );
    await Promise.all(insertPromises);
  }

  // 返回更新后的Sheet列表
  const [allSheets] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
  console.log('📄 复制完成，返回Sheet列表:', { count: allSheets.length, newSheetId });
  return res.json({ success: true, data: allSheets });
});

// protect/unprotect sheet (owner only)
GridController.patch("/:id/sheets/:sheetId/protect", async (req, res) => {
  console.log('🔒 收到保护Sheet请求:', { gridKey: req.params.id, sheetKey: req.params.sheetId, body: req.body });
  const { id: key, sheetId: sheetKey } = req.params as any;
  const { protected: isProtected } = req.body;
  
  if (typeof isProtected !== 'boolean') {
    return res.status(400).json({ success: false, error: "Invalid protection status" });
  }
  
  const id = await resolveGridKey(String(key));
  if (!id) return res.status(404).json({ success: false, error: "Not found" });
  
  let sheetId: number | null = null;
  if (/^\d+$/.test(String(sheetKey))) sheetId = Number(sheetKey); else {
    const [sr] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE public_id=? AND grid_id=? LIMIT 1", [sheetKey, id]);
    sheetId = (sr as any[])?.[0]?.id ?? null;
  }
  
  if (!sheetId) return res.status(404).json({ success: false, error: "Sheet not found" });
  
  try {
    // 更新Sheet保护状态
    await db.execute("UPDATE grid_sheets SET is_protected=? WHERE id=? AND grid_id=?", [isProtected, sheetId, id]);
    console.log('🔒 Sheet保护状态已更新:', { sheetId, isProtected });
    
    // 返回更新后的Sheet列表（包含保护状态）
    const [allSheets] = await db.query<any[]>("SELECT id, public_id, name, is_protected FROM grid_sheets WHERE grid_id=? ORDER BY id ASC", [id]);
    console.log('🔒 返回带保护状态的Sheet列表:', { count: allSheets.length });
    return res.json({ success: true, data: allSheets });
  } catch (error) {
    console.error('❌ 更新Sheet保护状态失败:', error);
    return res.status(500).json({ success: false, error: "Failed to update protection status" });
  }
});

// 邀请协作者
GridController.post('/:id/collaborators', async (req, res) => {
  const { id: key } = req.params;
  const { email, permission = 'write' } = req.body;
  const userId = req.user?.id;

  console.log('👥 收到邀请协作者请求:', { gridKey: key, email, permission, userId });

  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  if (!['read', 'write'].includes(permission)) {
    return res.status(400).json({ success: false, error: "Invalid permission type" });
  }

  try {
    // 解析Grid ID（支持public_id和数字ID）
    const id = await resolveGridKey(String(key));
    if (!id) {
      return res.status(404).json({ success: false, error: "Grid not found" });
    }

    // 验证Grid存在且用户有权限
    const [gridRows] = await db.query<any[]>("SELECT id, owner_id, title FROM grids WHERE id=? LIMIT 1", [id]);
    if (gridRows.length === 0) {
      return res.status(404).json({ success: false, error: "Grid not found" });
    }

    const grid = gridRows[0];
    
    // 检查用户是否是Grid的拥有者或已有协作权限
    const isOwner = grid.owner_id === userId;
    const [collaboratorRows] = await db.query<any[]>(
      "SELECT permission FROM grid_collaborators WHERE grid_id=? AND user_id=? LIMIT 1", 
      [id, userId]
    );
    const hasWriteAccess = isOwner || (collaboratorRows.length > 0 && collaboratorRows[0].permission === 'write');
    
    if (!hasWriteAccess) {
      return res.status(403).json({ success: false, error: "No permission to invite collaborators" });
    }

    // 查找要邀请的用户
    const [userRows] = await db.query<any[]>("SELECT id, email, display_name FROM users WHERE email=? LIMIT 1", [email]);
    if (userRows.length === 0) {
      return res.status(400).json({ success: false, error: "被邀请的用户不存在，请确保该邮箱地址已注册" });
    }

    const invitedUser = userRows[0];

    // 检查用户是否已经是协作者
    const [existingRows] = await db.query<any[]>(
      "SELECT permission FROM grid_collaborators WHERE grid_id=? AND user_id=? LIMIT 1", 
      [id, invitedUser.id]
    );

    if (existingRows.length > 0) {
      // 如果已存在，更新权限
      await db.execute(
        "UPDATE grid_collaborators SET permission=? WHERE grid_id=? AND user_id=?",
        [permission, id, invitedUser.id]
      );
      console.log('👥 更新协作者权限:', { gridId: id, userId: invitedUser.id, permission });
      return res.json({ 
        success: true, 
        message: `已更新 ${invitedUser.email} 的权限为${permission === 'write' ? '可编辑' : '只读'}` 
      });
    } else {
      // 检查是否是Grid拥有者
      if (grid.owner_id === invitedUser.id) {
        return res.status(400).json({ success: false, error: "不能邀请表格拥有者作为协作者" });
      }

      // 添加新协作者
      await db.execute(
        "INSERT INTO grid_collaborators (grid_id, user_id, permission) VALUES (?, ?, ?)",
        [id, invitedUser.id, permission]
      );
      console.log('👥 添加新协作者:', { gridId: id, userId: invitedUser.id, permission });
      return res.json({ 
        success: true, 
        message: `成功邀请 ${invitedUser.email} 加入协作，权限：${permission === 'write' ? '可编辑' : '只读'}` 
      });
    }

  } catch (error) {
    console.error('❌ 邀请协作者失败:', error);
    return res.status(500).json({ success: false, error: "Failed to invite collaborator" });
  }
});

