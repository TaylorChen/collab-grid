import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { WS_NAMESPACE, DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS } from "@collab-grid/shared";
import { ensureSchema } from "./utils/database";
import { AuthController } from "./controllers/AuthController";
import { GridController } from "./controllers/GridController";
import { authRequired } from "./middleware/auth.middleware";
import { CollaborationController } from "./controllers/CollaborationController";

const PORT = Number(process.env.PORT || 4000);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function bootstrap() {
  const app = express();
  app.use(cors({
    // 反射请求来源，便于本地局域网 IP 访问（开发环境）
    origin: (_origin, cb) => cb(null, true),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-grid-title"],
    credentials: false
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  // routes
  app.use("/api/auth", AuthController);
  app.use("/api/grids", GridController);
  app.use("/api/collab", CollaborationController);

  const httpServer = createServer(app);
  const io = new IOServer(httpServer, { cors: { origin: "*" } });

  // Try Redis adapter; fallback to in-memory if unavailable
  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();
    await pubClient.connect();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log(`[server] Redis adapter enabled at ${REDIS_URL}`);
  } catch (e) {
    console.warn("[server] Redis not available, falling back to in-memory adapter", e);
  }

  const nsp = io.of(WS_NAMESPACE);
  nsp.use(async (socket, next) => {
    // optional JWT auth via handshake.auth.token
    try {
      const token = (socket.handshake.auth as any)?.token as string | undefined;
      if (token) {
        const jwt = (await import("jsonwebtoken")).default as any;
        const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
        const user = jwt.verify(token, JWT_SECRET);
        // Single-login: verify token matches latest
        try {
          const { getRedis } = await import("./utils/redis");
          const r = await getRedis();
          const last = await r?.get(`user:${user.id}:lastToken`);
          if (last && last !== token) {
            return next(new Error("unauthorized: session expired"));
          }
        } catch {}
        (socket.data as any).user = user;
      }
    } catch {}
    next();
  });
  nsp.on("connection", (socket) => {
    // helper: stable color by user id
    function colorFor(userId?: number) {
      const colors = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"]; // tailwind palette
      if (!userId) return colors[0];
      return colors[userId % colors.length];
    }

    socket.on("grid:join", async ({ gridId, sheetId }) => {
      const room = String(gridId);
      socket.join(room);
      try {
        const { db } = await import("./utils/database");
        // resolve numeric grid id for DB queries
        let numericGridId: number = 0;
        if (/^\d+$/.test(String(gridId))) numericGridId = Number(gridId);
        else {
          const [gidRows] = await db.query<any[]>("SELECT id FROM grids WHERE public_id=? LIMIT 1", [String(gridId)]);
          numericGridId = (gidRows as any[])?.[0]?.id ?? 0;
        }
        // fallback: if invalid sheetId, use first sheet of the grid (or 0)
        let effectiveSheetId = sheetId;
        if (typeof effectiveSheetId !== 'number' || !Number.isFinite(effectiveSheetId) || effectiveSheetId <= 0) {
          const [ss] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE grid_id=? ORDER BY id ASC LIMIT 1", [numericGridId || gridId]);
          if ((ss as any[])?.[0]?.id) effectiveSheetId = (ss as any[])[0].id;
          else effectiveSheetId = 0;
        }

        const params: any[] = [numericGridId || gridId];
        let sql = "SELECT row_index AS `row`, col_index AS `col`, value, style FROM grid_cells WHERE grid_id=?";
        if (effectiveSheetId > 0) {
          sql += " AND sheet_id=?";
          params.push(effectiveSheetId);
        }
        const [cells] = await db.query<any[]>(sql, params);
        const cellsParsed = (cells as any[]).map((c) => ({
          ...c,
          style: c.style ? (() => { try { return JSON.parse(c.style as any); } catch { return undefined; } })() : undefined
        }));
        // layout
        console.log('🚀 服务器使用的默认值:', { DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS });
        let rows = DEFAULT_GRID_ROWS, cols = DEFAULT_GRID_COLS, rowHeights: number[] | undefined, colWidths: number[] | undefined;
        if (effectiveSheetId > 0) {
          const [ls] = await db.query<any[]>("SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=?", [effectiveSheetId]);
          const lay = (ls as any[])[0];
          if (lay) {
            rows = lay.rows ?? rows;
            cols = lay.cols ?? cols;
            // 解析并验证数组长度
            const parsedRowHeights = lay.row_heights ? (()=>{ try { return JSON.parse(lay.row_heights); } catch { return undefined; } })() : undefined;
            const parsedColWidths = lay.col_widths ? (()=>{ try { return JSON.parse(lay.col_widths); } catch { return undefined; } })() : undefined;
            
            // 如果解析的数组长度不匹配，使用undefined让客户端使用默认值
            rowHeights = (Array.isArray(parsedRowHeights) && parsedRowHeights.length === rows) ? parsedRowHeights : undefined;
            colWidths = (Array.isArray(parsedColWidths) && parsedColWidths.length === cols) ? parsedColWidths : undefined;
          }
        }
        console.log('📊 发送grid:snapshot:', { rows, cols, rowHeights: rowHeights?.length, colWidths: colWidths?.length });
        socket.emit("grid:snapshot", { id: room, rows, cols, rowHeights, colWidths, cells: cellsParsed });
      } catch {
        socket.emit("grid:snapshot", { id: room, rows: DEFAULT_GRID_ROWS, cols: DEFAULT_GRID_COLS, cells: [] });
      }
    });

    socket.on("grid:operation", async (op) => {
      const { gridId } = op || {};
      if (gridId) {
        // resolve numeric grid id for DB operations
        let numericGridId: number = 0;
        try {
          const { db } = await import('./utils/database');
          if (/^\d+$/.test(String(gridId))) numericGridId = Number(gridId);
          else {
            const [gidRows] = await db.query<any[]>("SELECT id FROM grids WHERE public_id=? LIMIT 1", [String(gridId)]);
            numericGridId = (gidRows as any[])?.[0]?.id ?? 0;
          }
        } catch {}
        // normalize sheetId (fallback to first sheet if invalid/missing)
        let normalizedSheetId = typeof op?.sheetId === 'number' ? op.sheetId : 0;
        if (!(normalizedSheetId > 0)) {
          try {
            const { db } = await import('./utils/database');
            const [ss] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE grid_id=? ORDER BY id ASC LIMIT 1", [numericGridId || gridId]);
            if ((ss as any[])?.[0]?.id) normalizedSheetId = (ss as any[])[0].id;
          } catch {}
        }
        (op as any).sheetId = normalizedSheetId;
        // broadcast first (with normalized sheetId)
        socket.to(String(gridId)).emit("grid:operation", op);
        // dimension/resize persistence per sheet
        if (op?.type === "grid:dimension" || op?.type === "grid:resize") {
          try {
            let sheetId = normalizedSheetId;
            const { rows, cols, rowHeights, colWidths } = op.payload || {};
            const dbm = (await import("./utils/database")).db;
            // step1: ensure row exists with defaults, avoids NOT NULL error on first write
            await dbm.execute(
              "INSERT IGNORE INTO grid_sheet_layout (sheet_id, `rows`, `cols`) VALUES (?, ?, ?)",
              [effectiveSheetId, DEFAULT_GRID_ROWS, DEFAULT_GRID_COLS]
            );
            // step2: update only provided fields; do not overwrite others
            await dbm.execute(
              "UPDATE grid_sheet_layout SET `rows`=COALESCE(?, `rows`), `cols`=COALESCE(?, `cols`), row_heights=COALESCE(?, row_heights), col_widths=COALESCE(?, col_widths) WHERE sheet_id=?",
              [
                rows ?? null,
                cols ?? null,
                rowHeights ? JSON.stringify(rowHeights) : null,
                colWidths ? JSON.stringify(colWidths) : null,
                sheetId || null
              ]
            );
            // removed verbose layout update log
          } catch (e) {
            console.error("[layout:update] failed", e);
          }
        }

        // insert/delete rows/cols with cell reindexing and layout persistence
        if (
          op?.type === "grid:row:insert" || op?.type === "grid:row:delete" ||
          op?.type === "grid:col:insert" || op?.type === "grid:col:delete"
        ) {
          try {
            const dbm = (await import("./utils/database")).db;
            const sheetId = normalizedSheetId;
            const payload = op.payload || {};
            const at: number = Math.max(0, Number(payload.at ?? 0));
            const count: number = Math.max(1, Number(payload.count ?? 1));
            const where: "before" | "after" = payload.where === "after" ? "after" : "before";

            // load current layout
            let rows = 100, cols = 60; let rowHeightsArr: number[] = [], colWidthsArr: number[] = [];
            await dbm.execute(
              "INSERT IGNORE INTO grid_sheet_layout (sheet_id, `rows`, `cols`) VALUES (?, 100, 60)",
              [sheetId || null]
            );
            const [ls] = await dbm.query<any[]>(
              "SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=?",
              [sheetId]
            );
            if ((ls as any[])?.[0]) {
              const lay = (ls as any[])[0];
              rows = lay.rows ?? rows;
              cols = lay.cols ?? cols;
              if (lay.row_heights) { try { rowHeightsArr = JSON.parse(lay.row_heights) || []; } catch { rowHeightsArr = []; } }
              if (lay.col_widths) { try { colWidthsArr = JSON.parse(lay.col_widths) || []; } catch { colWidthsArr = []; } }
            }
            // ensure arrays length
            while (rowHeightsArr.length < rows) rowHeightsArr.push(24);
            while (colWidthsArr.length < cols) colWidthsArr.push(80);

            const isRow = op.type.startsWith("grid:row");
            const pivot = Math.min(isRow ? rows : cols, where === "after" ? at + 1 : at);

            if (op.type === "grid:row:insert") {
              // shift cells >= pivot using large temporary offset to avoid PK conflicts
              const SHIFT = 1000000;
              await dbm.execute(
                "UPDATE grid_cells SET row_index = row_index + ? WHERE grid_id=? AND sheet_id=? AND row_index >= ?",
                [SHIFT, numericGridId || gridId, sheetId, pivot]
              );
              await dbm.execute(
                "UPDATE grid_cells SET row_index = row_index - ? WHERE grid_id=? AND sheet_id=? AND row_index >= ?",
                [SHIFT - count, numericGridId || gridId, sheetId, pivot]
              );
              // update layout
              const insertArr = Array(count).fill(24);
              rowHeightsArr.splice(pivot, 0, ...insertArr);
              rows += count;
            }
            if (op.type === "grid:row:delete") {
              const end = Math.min(rows - 1, at + count - 1);
              const start = Math.max(0, at);
              const delCount = Math.max(0, end - start + 1);
              if (delCount > 0) {
                await dbm.execute(
                  "DELETE FROM grid_cells WHERE grid_id=? AND sheet_id=? AND row_index BETWEEN ? AND ?",
                  [numericGridId || gridId, sheetId, start, end]
                );
                await dbm.execute(
                  "UPDATE grid_cells SET row_index = row_index - ? WHERE grid_id=? AND sheet_id=? AND row_index > ?",
                  [delCount, numericGridId || gridId, sheetId, end]
                );
                rowHeightsArr.splice(start, delCount);
                rows = Math.max(1, rows - delCount);
              }
            }
            if (op.type === "grid:col:insert") {
              const SHIFT = 1000000;
              await dbm.execute(
                "UPDATE grid_cells SET col_index = col_index + ? WHERE grid_id=? AND sheet_id=? AND col_index >= ?",
                [SHIFT, numericGridId || gridId, sheetId, pivot]
              );
              await dbm.execute(
                "UPDATE grid_cells SET col_index = col_index - ? WHERE grid_id=? AND sheet_id=? AND col_index >= ?",
                [SHIFT - count, numericGridId || gridId, sheetId, pivot]
              );
              const insertArr = Array(count).fill(80);
              colWidthsArr.splice(pivot, 0, ...insertArr);
              cols += count;
            }
            if (op.type === "grid:col:delete") {
              const end = Math.min(cols - 1, at + count - 1);
              const start = Math.max(0, at);
              const delCount = Math.max(0, end - start + 1);
              if (delCount > 0) {
                await dbm.execute(
                  "DELETE FROM grid_cells WHERE grid_id=? AND sheet_id=? AND col_index BETWEEN ? AND ?",
                  [numericGridId || gridId, sheetId, start, end]
                );
                await dbm.execute(
                  "UPDATE grid_cells SET col_index = col_index - ? WHERE grid_id=? AND sheet_id=? AND col_index > ?",
                  [delCount, numericGridId || gridId, sheetId, end]
                );
                colWidthsArr.splice(start, delCount);
                cols = Math.max(1, cols - delCount);
              }
            }

            // persist layout
            await dbm.execute(
              "UPDATE grid_sheet_layout SET `rows`=?, `cols`=?, row_heights=?, col_widths=? WHERE sheet_id=?",
              [rows, cols, JSON.stringify(rowHeightsArr), JSON.stringify(colWidthsArr), sheetId]
            );

            // broadcast fresh snapshot to keep clients consistent
            try {
              const params: any[] = [numericGridId || gridId];
              let sql = "SELECT row_index AS `row`, col_index AS `col`, value, style FROM grid_cells WHERE grid_id=?";
              if (sheetId > 0) { sql += " AND sheet_id=?"; params.push(sheetId); }
              const [cells] = await dbm.query<any[]>(sql, params);
              const cellsParsed = (cells as any[]).map((c) => ({ ...c, style: c.style ? (()=>{ try { return JSON.parse(c.style); } catch { return undefined; } })() : undefined }));
              nsp.to(String(gridId)).emit("grid:snapshot", { id: String(gridId), rows, cols, rowHeights: rowHeightsArr, colWidths: colWidthsArr, cells: cellsParsed });
            } catch {}
          } catch (e) {
            console.error("[rows/cols:update] failed", e);
          }
        }
        // persist if cell:update
        if (op?.type === "cell:update" || op?.type === "cell:style") {
          try {
            const { row, col, value, style } = op.payload || {};
            const user = (socket.data as any).user as { id?: number } | undefined;
            const userId = (op as any).actorId ?? user?.id ?? null;
            const sheetId = typeof op.sheetId === "number" ? op.sheetId : 0;
            const styleJson = style != null ? JSON.stringify(style) : null;
            if (op?.type === "cell:update") {
              // 更新值，样式不变（若传入样式则更新）
              await (await import("./utils/database")).db.execute(
                `INSERT INTO grid_cells (grid_id, sheet_id, row_index, col_index, value, style, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                   value=VALUES(value), 
                   style=COALESCE(VALUES(style), style),
                   updated_by=VALUES(updated_by),
                   updated_at=NOW()`,
                [numericGridId || gridId, sheetId, row, col, value ?? null, styleJson, userId]
              );
            } else {
              // cell:style 仅更新样式，值保持不变
              await (await import("./utils/database")).db.execute(
                `INSERT INTO grid_cells (grid_id, sheet_id, row_index, col_index, value, style, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE 
                   value=COALESCE(VALUES(value), value),
                   style=VALUES(style),
                   updated_by=VALUES(updated_by),
                   updated_at=NOW()`,
                [numericGridId || gridId, sheetId, row, col, null, styleJson, userId]
              );
            }
            // update grids.last_modified, last_editor_id
            await (await import("./utils/database")).db.execute(
              `UPDATE grids SET last_modified=NOW(), last_editor_id=? WHERE id=?`,
              [userId, numericGridId || gridId]
            );
          } catch {}
        }
      }
    });

    // --- Presence & Locking ---
    socket.on("cell:focus", async ({ gridId, sheetId, row, col }) => {
      try {
        const cellKey = `${sheetId}:${row}:${col}`;
        const user = (socket.data as any).user as { id?: number; displayName?: string } | undefined;
        const userId = user?.id ? String(user.id) : socket.id;
        const name = user?.displayName || `User-${userId}`;
        const { db: _db } = await import("./utils/database"); // ensure adapter loaded
        // use pubClient via io server adapter (redis is already connected); fallback to in-memory map if needed
        try {
          const { createClient } = await import("redis");
          const r = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
          await r.connect();
          await r.hSet(`grid:${gridId}:user:${userId}`, { name, color: colorFor(Number(userId)) });
          await r.sAdd(`presence:${gridId}:${cellKey}`, userId);
          await r.expire(`presence:${gridId}:${cellKey}`, 7);
          const members = await r.sMembers(`presence:${gridId}:${cellKey}`);
          const users: any[] = [];
          for (const m of members) {
            const h = await r.hGetAll(`grid:${gridId}:user:${m}`);
            users.push({ userId: m, displayName: h.name || `User-${m}`, color: h.color || colorFor(Number(m)) });
          }
          await r.disconnect();
          nsp.to(gridId).emit("cell:presence", { cellKey, users });
        } catch {}
      } catch {}
    });

    socket.on("cell:blur", async ({ gridId, sheetId, row, col }) => {
      try {
        const cellKey = `${sheetId}:${row}:${col}`;
        const user = (socket.data as any).user as { id?: number } | undefined;
        const userId = user?.id ? String(user.id) : socket.id;
        try {
          const { createClient } = await import("redis");
          const r = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
          await r.connect();
          await r.sRem(`presence:${gridId}:${cellKey}`, userId);
          const members = await r.sMembers(`presence:${gridId}:${cellKey}`);
          const users: any[] = [];
          for (const m of members) {
            const h = await r.hGetAll(`grid:${gridId}:user:${m}`);
            users.push({ userId: m, displayName: h.name || `User-${m}`, color: h.color || colorFor(Number(m)) });
          }
          await r.disconnect();
          nsp.to(gridId).emit("cell:presence", { cellKey, users });
        } catch {}
      } catch {}
    });

    socket.on("cell:lock:acquire", async ({ gridId, sheetId, row, col, token }) => {
      const cellKey = `${sheetId}:${row}:${col}`;
      const user = (socket.data as any).user as { id?: number; displayName?: string } | undefined;
      const userId = user?.id ? String(user.id) : socket.id;
      const name = user?.displayName || `User-${userId}`;
      try {
        const { createClient } = await import("redis");
        const r = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
        await r.connect();
        // 确保目录里有昵称与颜色（避免 race 或缺失）
        await r.hSet(`grid:${gridId}:user:${userId}`, { name, color: colorFor(Number(userId)) });
        const ok = await r.set(`lock:${gridId}:${cellKey}`, JSON.stringify({ userId, token, name }), { NX: true, PX: 5000 });
        if (ok) {
          // enrich displayName from directory
          const dir = await r.hGetAll(`grid:${gridId}:user:${userId}`);
          const displayName = dir?.name || name;
          nsp.to(gridId).emit("cell:lock:granted", { cellKey, holder: { userId, displayName, name: displayName, color: colorFor(Number(userId)) }, token, ttlMs: 5000 });
        } else {
          const cur = await r.get(`lock:${gridId}:${cellKey}`);
          let holder = cur ? JSON.parse(cur) : null;
          if (holder?.userId) {
            const dir = await r.hGetAll(`grid:${gridId}:user:${holder.userId}`);
            if (dir?.name) holder.name = dir.name;
          }
          nsp.to(socket.id).emit("cell:lock:denied", { cellKey, holder, ttlMs: 5000 });
        }
        await r.disconnect();
      } catch (e) {
        nsp.to(socket.id).emit("cell:lock:denied", { cellKey });
      }
    });

    socket.on("cell:lock:renew", async ({ gridId, sheetId, row, col, token }) => {
      const cellKey = `${sheetId}:${row}:${col}`;
      try {
        const { createClient } = await import("redis");
        const r = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
        await r.connect();
        const cur = await r.get(`lock:${gridId}:${cellKey}`);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed?.token === token) await r.pexpire(`lock:${gridId}:${cellKey}`, 5000);
        }
        await r.disconnect();
      } catch {}
    });

    socket.on("cell:lock:release", async ({ gridId, sheetId, row, col, token }) => {
      const cellKey = `${sheetId}:${row}:${col}`;
      try {
        const { createClient } = await import("redis");
        const r = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
        await r.connect();
        const cur = await r.get(`lock:${gridId}:${cellKey}`);
        if (cur) {
          const parsed = JSON.parse(cur);
          if (parsed?.token === token) await r.del(`lock:${gridId}:${cellKey}`);
        }
        await r.disconnect();
        nsp.to(gridId).emit("cell:lock:released", { cellKey });
      } catch {}
    });
  });

  await ensureSchema();
  httpServer.listen(PORT, () => {
    console.log(`[server] listening on :${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("[server] failed to start", err);
  process.exit(1);
});

