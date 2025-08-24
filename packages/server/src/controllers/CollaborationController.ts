import { Router } from "express";
import { db } from "../utils/database";
import { authRequired } from "../middleware/auth.middleware";

export const CollaborationController = Router();

CollaborationController.use(authRequired);

CollaborationController.post("/share", async (req, res) => {
  const { gridId, email } = req.body || {};
  if (!gridId || !email) return res.status(400).json({ success: false, error: "Invalid body" });
  // Only owner can invite
  const [gr] = await db.query<any[]>("SELECT owner_id FROM grids WHERE id=? LIMIT 1", [gridId]);
  const grid = (gr as any[])[0];
  if (!grid) return res.status(404).json({ success: false, error: "Grid not found" });
  if (grid.owner_id !== req.user!.id) return res.status(403).json({ success: false, error: "Forbidden" });

  const [users] = await db.query<any[]>("SELECT id FROM users WHERE email=? LIMIT 1", [email]);
  const user = users[0];
  if (!user) return res.status(404).json({ success: false, error: "User not found" });
  await db.execute("INSERT IGNORE INTO grid_collaborators (grid_id, user_id) VALUES (?, ?)", [gridId, user.id]);
  return res.json({ success: true, data: true });
});

CollaborationController.get("/collaborators/:gridId", async (req, res) => {
  const { gridId } = req.params;
  const [rows] = await db.query<any[]>(
    `SELECT u.id, u.email, u.display_name
     FROM grid_collaborators gc JOIN users u ON gc.user_id=u.id
     WHERE gc.grid_id=?`,
    [gridId]
  );
  return res.json({ success: true, data: rows });
});

