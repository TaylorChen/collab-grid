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
    origin: [/^http:\/\/(localhost|127\.0\.0\.1):\d+$/],
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
        (socket.data as any).user = user;
      }
    } catch {}
    next();
  });
  nsp.on("connection", (socket) => {
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
            console.log("[layout:update]", { gridId, sheetId, rows, cols, rLen: rowHeights?.length, cLen: colWidths?.length });
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

