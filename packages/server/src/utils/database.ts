import mysql from "mysql2/promise";

type QueryResult<T = any> = Promise<[T, any]>;

interface DbLike {
  query<T = any>(sql: string, params?: any[]): QueryResult<T[]>;
  execute<T = any>(sql: string, params?: any[]): Promise<[any]>;
}

const DATABASE_URL = process.env.DATABASE_URL || "mysql://collab:collab@localhost:3306/collabgrid";

let dbImpl: DbLike | null = null;
let usingMemory = false;
const REQUIRE_MYSQL = String(process.env.DB_REQUIRE_MYSQL || "false").toLowerCase() === "true";

// Very small in-memory fallback for local dev without MySQL
const memory = (() => {
  let userId = 1;
  let gridId = 1;
  const users: Array<{ id: number; email: string; display_name: string; password_hash: string; created_at: Date }> = [];
  const grids: Array<{ id: number; owner_id: number; title: string; created_at: Date }> = [];

  const match = {
    insertUser: /INSERT\s+INTO\s+users\s*\(email,\s*password_hash,\s*display_name\)/i,
    selectUserByEmail: /SELECT\s+id,\s*email,\s*display_name,\s*password_hash\s+FROM\s+users\s+WHERE\s+email=\?\s+LIMIT\s+1/i,
    insertGrid: /INSERT\s+INTO\s+grids\s*\(owner_id,\s*title\)/i,
    listGridsByOwner: /SELECT\s+id,\s*title,\s*created_at\s+FROM\s+grids\s+WHERE\s+owner_id=\?\s+ORDER\s+BY\s+created_at\s+DESC/i,
    getGridById: /SELECT\s+id,\s*owner_id,\s*title\s+FROM\s+grids\s+WHERE\s+id=\?\s+LIMIT\s+1/i
  };

  const api: DbLike = {
    async query(sql: string, params: any[] = []) {
      if (match.selectUserByEmail.test(sql)) {
        const email = params[0];
        const row = users.find((u) => u.email === email);
        const result = row ? [row] : [];
        return [result as any, null];
      }
      if (match.listGridsByOwner.test(sql)) {
        const ownerId = Number(params[0]);
        const result = grids
          .filter((g) => g.owner_id === ownerId)
          .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
          .map((g) => ({ id: g.id, title: g.title, created_at: g.created_at }));
        return [result as any, null];
      }
      if (match.getGridById.test(sql)) {
        const id = Number(params[0]);
        const g = grids.find((x) => x.id === id);
        const result = g ? [{ id: g.id, owner_id: g.owner_id, title: g.title }] : [];
        return [result as any, null];
      }
      // unsupported
      return [[] as any, null];
    },
    async execute(sql: string, params: any[] = []) {
      if (match.insertUser.test(sql)) {
        const [email, password_hash, display_name] = params as [string, string, string];
        if (users.some((u) => u.email === email)) {
          const err: any = new Error("duplicate");
          err.code = "ER_DUP_ENTRY";
          throw err;
        }
        const id = userId++;
        users.push({ id, email, password_hash, display_name, created_at: new Date() });
        return [{ insertId: id } as any];
      }
      if (match.insertGrid.test(sql)) {
        const [owner_id, title] = params as [number, string];
        const id = gridId++;
        grids.push({ id, owner_id: Number(owner_id), title, created_at: new Date() });
        return [{ insertId: id } as any];
      }
      return [{} as any];
    }
  };

  return api;
})();

export async function getDb(): Promise<DbLike> {
  if (dbImpl) return dbImpl;
  try {
    const pool = await mysql.createPool(DATABASE_URL);
    // simple ping
    await pool.query("SELECT 1");
    dbImpl = pool as unknown as DbLike;
    usingMemory = false;
    console.log(`[db] Connected to MySQL at ${DATABASE_URL}`);
  } catch (e) {
    if (REQUIRE_MYSQL) {
      console.error("[db] MySQL required but not available. Set DATABASE_URL or start MySQL.");
      throw e;
    }
    console.warn("[db] MySQL not available, using in-memory store", e);
    dbImpl = memory;
    usingMemory = true;
  }
  return dbImpl!;
}

export let db: DbLike;

export async function ensureSchema(): Promise<void> {
  db = await getDb();
  if (usingMemory) return; // nothing to migrate for memory
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS grids (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      public_id VARCHAR(32) UNIQUE NULL,
      owner_id BIGINT NOT NULL,
      title VARCHAR(255) NOT NULL,
      last_modified TIMESTAMP NULL DEFAULT NULL,
      last_editor_id BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (last_editor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS grid_cells (
      grid_id BIGINT NOT NULL,
      row_index INT NOT NULL,
      col_index INT NOT NULL,
      value TEXT NULL,
      style TEXT NULL,
      updated_by BIGINT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (grid_id, row_index, col_index),
      FOREIGN KEY (grid_id) REFERENCES grids(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS grid_collaborators (
      grid_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      permission ENUM('read', 'write') NOT NULL DEFAULT 'write',
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (grid_id, user_id),
      FOREIGN KEY (grid_id) REFERENCES grids(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // sheets support
  await db.query(`
    CREATE TABLE IF NOT EXISTS grid_sheets (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      grid_id BIGINT NOT NULL,
      public_id VARCHAR(32) UNIQUE NULL,
      name VARCHAR(255) NOT NULL,
      is_protected BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_sheet_name (grid_id, name),
      FOREIGN KEY (grid_id) REFERENCES grids(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // add sheet_id to grid_cells if missing
  try {
    await db.query("ALTER TABLE grid_cells ADD COLUMN sheet_id BIGINT NOT NULL DEFAULT 0");
    await db.query("ALTER TABLE grid_cells DROP PRIMARY KEY, ADD PRIMARY KEY (grid_id, sheet_id, row_index, col_index)");
  } catch (e) {
    // ignore if already applied
  }
  // add public_id columns if missing
  try {
    await db.query("ALTER TABLE grids ADD COLUMN public_id VARCHAR(32) UNIQUE NULL");
  } catch (e) {}
  try {
    await db.query("ALTER TABLE grid_sheets ADD COLUMN public_id VARCHAR(32) UNIQUE NULL");
  } catch (e) {}
  // backfill public ids if missing
  try {
    await db.execute("UPDATE grids SET public_id = SUBSTRING(REPLACE(UUID(),'-',''),1,16) WHERE public_id IS NULL");
  } catch (e) {}
  try {
    await db.execute("UPDATE grid_sheets SET public_id = SUBSTRING(REPLACE(UUID(),'-',''),1,16) WHERE public_id IS NULL");
  } catch (e) {}
  try {
    await db.query("ALTER TABLE grid_cells ADD COLUMN style TEXT NULL");
  } catch (e) {
    // ignore if exists
  }
  try {
    await db.query("ALTER TABLE grids ADD COLUMN last_modified TIMESTAMP NULL DEFAULT NULL, ADD COLUMN last_editor_id BIGINT NULL");
  } catch (e) {
    // ignore if exists
  }
  
  // add permission column to grid_collaborators if missing
  try {
    await db.query("ALTER TABLE grid_collaborators ADD COLUMN permission ENUM('read', 'write') NOT NULL DEFAULT 'write'");
  } catch (e) {
    // ignore if exists
  }

  // sheet layout (rows/cols and sizes)
  await db.query(`
    CREATE TABLE IF NOT EXISTS grid_sheet_layout (
      sheet_id BIGINT PRIMARY KEY,
      \`rows\` INT NOT NULL DEFAULT 100,
      \`cols\` INT NOT NULL DEFAULT 60,
      row_heights TEXT NULL,
      col_widths TEXT NULL,
      FOREIGN KEY (sheet_id) REFERENCES grid_sheets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

