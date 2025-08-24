import { Router } from "express";
import { db } from "../utils/database";
import bcrypt from "bcryptjs";
import { signToken, type AuthUser } from "../middleware/auth.middleware";
import { authRequired } from "../middleware/auth.middleware";

export const AuthController = Router();

AuthController.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body || {};
  if (!email || !password || !displayName) return res.status(400).json({ success: false, error: "Invalid body" });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await db.execute<unknown & { insertId: number }>(
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
      [email, hash, displayName]
    );
    const id = (result as any).insertId as number;
    const user: AuthUser = { id, email, displayName };
    const token = signToken(user);
    return res.json({ success: true, data: { token, user } });
  } catch (e: any) {
    if (e?.code === "ER_DUP_ENTRY") return res.status(409).json({ success: false, error: "Email exists" });
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

AuthController.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, error: "Invalid body" });
  const [rows] = await db.query<any[]>("SELECT id, email, display_name, password_hash FROM users WHERE email=? LIMIT 1", [email]);
  const row = rows[0];
  if (!row) return res.status(401).json({ success: false, error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });
  const user: AuthUser = { id: row.id, email: row.email, displayName: row.display_name };
  const token = signToken(user);
  return res.json({ success: true, data: { token, user } });
});

AuthController.get("/me", authRequired, async (req, res) => {
  return res.json({ success: true, data: req.user });
});

// Update profile display name
AuthController.patch("/profile", authRequired, async (req, res) => {
  const { displayName } = req.body || {};
  if (!displayName || typeof displayName !== "string") return res.status(400).json({ success: false, error: "Invalid displayName" });
  await db.execute("UPDATE users SET display_name=? WHERE id=?", [displayName.trim(), req.user!.id]);
  const user: AuthUser = { id: req.user!.id, email: req.user!.email, displayName: displayName.trim() };
  const token = signToken(user);
  return res.json({ success: true, data: { token, user } });
});

// Change password
AuthController.post("/change-password", authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: "Invalid body" });
  const [rows] = await db.query<any[]>("SELECT password_hash FROM users WHERE id=? LIMIT 1", [req.user!.id]);
  const row = rows[0];
  if (!row) return res.status(404).json({ success: false, error: "Not found" });
  const ok = await bcrypt.compare(currentPassword, row.password_hash);
  if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });
  const hash = await bcrypt.hash(newPassword, 10);
  await db.execute("UPDATE users SET password_hash=? WHERE id=?", [hash, req.user!.id]);
  return res.json({ success: true, data: true });
});

