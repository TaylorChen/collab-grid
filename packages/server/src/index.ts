import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { createClient } from "redis";
import { createAdapter } from "@socket.io/redis-adapter";
import { WS_NAMESPACE } from "@collab-grid/shared";
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
      socket.join(gridId);
      try {
        const { db } = await import("./utils/database");
        // fallback: if invalid sheetId, use first sheet of the grid (or 0)
        let effectiveSheetId = sheetId;
        if (typeof effectiveSheetId !== 'number' || !Number.isFinite(effectiveSheetId) || effectiveSheetId <= 0) {
          const [ss] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE grid_id=? ORDER BY id ASC LIMIT 1", [gridId]);
          if ((ss as any[])?.[0]?.id) effectiveSheetId = (ss as any[])[0].id;
          else effectiveSheetId = 0;
        }

        const params: any[] = [gridId];
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
        let rows = 100, cols = 26, rowHeights: number[] | undefined, colWidths: number[] | undefined;
        if (effectiveSheetId > 0) {
          const [ls] = await db.query<any[]>("SELECT `rows`, `cols`, row_heights, col_widths FROM grid_sheet_layout WHERE sheet_id=?", [effectiveSheetId]);
          const lay = (ls as any[])[0];
          if (lay) {
            rows = lay.rows ?? rows;
            cols = lay.cols ?? cols;
            rowHeights = lay.row_heights ? (()=>{ try { return JSON.parse(lay.row_heights); } catch { return undefined; } })() : undefined;
            colWidths = lay.col_widths ? (()=>{ try { return JSON.parse(lay.col_widths); } catch { return undefined; } })() : undefined;
          }
        }
        socket.emit("grid:snapshot", { id: gridId, rows, cols, rowHeights, colWidths, cells: cellsParsed });
      } catch {
        socket.emit("grid:snapshot", { id: gridId, rows: 100, cols: 26, cells: [] });
      }
    });

    socket.on("grid:operation", async (op) => {
      const { gridId } = op || {};
      if (gridId) {
        // normalize sheetId (fallback to first sheet if invalid/missing)
        let normalizedSheetId = typeof op?.sheetId === 'number' ? op.sheetId : 0;
        if (!(normalizedSheetId > 0)) {
          try {
            const { db } = await import('./utils/database');
            const [ss] = await db.query<any[]>("SELECT id FROM grid_sheets WHERE grid_id=? ORDER BY id ASC LIMIT 1", [gridId]);
            if ((ss as any[])?.[0]?.id) normalizedSheetId = (ss as any[])[0].id;
          } catch {}
        }
        (op as any).sheetId = normalizedSheetId;
        // broadcast first (with normalized sheetId)
        socket.to(gridId).emit("grid:operation", op);
        // dimension/resize persistence per sheet
        if (op?.type === "grid:dimension" || op?.type === "grid:resize") {
          try {
            let sheetId = normalizedSheetId;
            const { rows, cols, rowHeights, colWidths } = op.payload || {};
            const dbm = (await import("./utils/database")).db;
            // step1: ensure row exists with defaults, avoids NOT NULL error on first write
            await dbm.execute(
              "INSERT IGNORE INTO grid_sheet_layout (sheet_id, `rows`, `cols`) VALUES (?, 100, 26)",
              [sheetId || null]
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
                [gridId, sheetId, row, col, value ?? null, styleJson, userId]
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
                [gridId, sheetId, row, col, null, styleJson, userId]
              );
            }
            // update grids.last_modified, last_editor_id
            await (await import("./utils/database")).db.execute(
              `UPDATE grids SET last_modified=NOW(), last_editor_id=? WHERE id=?`,
              [userId, gridId]
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

