import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { ensureSchema, getDb } from "../utils/database";

async function ensureDatabaseExists(dsn: string) {
  const u = new URL(dsn);
  const database = (u.pathname || "/").slice(1);
  if (!database) throw new Error("DATABASE_URL missing database name");
  const host = u.hostname;
  const port = Number(u.port || 3306);
  const user = decodeURIComponent(u.username || "root");
  const password = decodeURIComponent(u.password || "");

  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await conn.end();
}

async function seed() {
  const dsn = process.env.DATABASE_URL;
  if (!dsn) throw new Error("DATABASE_URL is required");
  await ensureDatabaseExists(dsn);
  await ensureSchema();
  const db = await getDb();

  const users = [
    { email: "alice@example.com", displayName: "Alice", password: "pass1234" },
    { email: "bob@example.com", displayName: "Bob", password: "pass1234" }
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    try {
      await db.execute(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE display_name=VALUES(display_name)",
        [u.email, hash, u.displayName]
      );
      // eslint-disable-next-line no-console
      console.log(`[seed] upserted user ${u.email}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(`[seed] failed to upsert ${u.email}`, e);
    }
  }
}

seed().then(() => {
  // eslint-disable-next-line no-console
  console.log("[seed] done");
  process.exit(0);
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[seed] error", e);
  process.exit(1);
});

