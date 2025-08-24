# CollabGrid

An open-source, real-time collaborative spreadsheet web app built as a monorepo.

## Highlights
- Real-time multi-user editing via WebSockets (Socket.IO)
- Canvas-based grid engine for high-performance rendering
- Per-cell formatting (bold, alignment, text/background color, font size)
- Multiple sheet tabs per grid with per-sheet row/column sizes and layout persistence
- Presence indicators and cell locking with non-blocking conflict bubbles showing actual nicknames
- Auth (register/login/JWT), personal grid creation, share with collaborators (owner-only invite), owner-only delete
- Responsive UI with Tailwind CSS + Headless UI

## Monorepo Structure
```
collab-grid/
├── packages/
│   ├── client/              # React 18 + TS + Vite + Zustand + React Query + Tailwind
│   ├── server/              # Node.js + Express + TS + Socket.IO + Redis + MySQL
│   └── shared/              # Shared types/constants between client & server
├── infrastructure/          # (reserved) docker/k8s/monitoring configs
├── scripts/                 # helper scripts
├── docker-compose.yml       # Local dev infra (MySQL/Redis/MinIO) and app
├── package.json             # npm workspaces
└── README.md
```

## Tech Stack
- Frontend: React 18, TypeScript, Zustand, React Query, Vite, Tailwind CSS, Headless UI
- Backend: Node.js, Express, TypeScript, Socket.IO, Redis (presence/locks/cache), MySQL (primary data)
- Infra: Docker + Docker Compose (optional), Nginx (later), MinIO (reserved)

## Features (Current)
- Auth: register, login, JWT session; change display name/password
- Grid: create/list/get/delete/rename
- Sheets: create/list/rename/delete, default layout on create
- Realtime: cell update/style, grid resize/dimension, presence (colored dots), cell lock acquire/renew/release
- Formatting: bold, align left/center/right, text color, background color, font size
- Layout: drag to resize row height and column width per sheet; persistence to MySQL
- Multi-line cell input: Shift+Enter for newline, Enter to submit
- Ownership and sharing: owner can invite collaborators; collaborators cannot delete or invite others
- List metadata: creation time, last modified, last editor (nickname)
- CORS: dynamic origin reflection for local IPs; client/WS URLs auto-derive from current host

## Prerequisites
- Node.js >= 18
- npm >= 9
- MySQL 8.x
- Redis 7.x
- (Optional) Docker Desktop or Colima for Docker Compose

## Quick Start (Local without Docker)
1) Install dependencies
```bash
npm install
```

2) Start required services yourself
- MySQL at `127.0.0.1:3306` with database `collabgrid`
- Redis at `127.0.0.1:6379`

3) Seed database (creates schema and demo users)
```bash
cd packages/server
npm run seed
# Users: alice@example.com / pass1234, bob@example.com / pass1234
```

4) Start backend
```bash
cd ../../
npm run dev:server
# API: http://localhost:4000/healthz
```

5) Start frontend
```bash
npm run dev:client
# Web: http://localhost:5173
```

6) Login & test
- Login at `http://localhost:5173/login`
- Create a grid, rename it, edit cells with formatting, add sheets
- Open two browsers (or two accounts) to test real-time presence and locking

## Quick Start (Docker Compose)
This spins up MySQL, Redis, MinIO (reserved), server, and client.
```bash
npm run dev:infra
# then in another terminal
npm run dev:server
npm run dev:client
```
Notes:
- The compose file exposes MySQL 3306, Redis 6379, server 4000, client 5173.
- Server uses `DATABASE_URL=mysql://collab:collab@mysql:3306/collabgrid` and `REDIS_URL=redis://redis:6379` inside the network.

## Environment Variables
- Server
  - `PORT` (default 4000)
  - `DATABASE_URL` (e.g. `mysql://root:@127.0.0.1:3306/collabgrid`)
  - `DB_REQUIRE_MYSQL` (`true` in dev to force MySQL)
  - `REDIS_URL` (e.g. `redis://localhost:6379`)
  - `JWT_SECRET` (optional; default `dev_secret_change_me`)
- Client
  - `VITE_API_BASE_URL` (optional; default `http://<current-host>:4000`)
  - `VITE_WS_URL` (optional; default `http://<current-host>:4000`)

## API Overview (Selected)
- Auth
  - `POST /api/auth/register` { email, password, displayName }
  - `POST /api/auth/login` { email, password } -> { token, user }
  - `PATCH /api/auth/me` Authorization: Bearer -> { displayName?, password? }
- Grids
  - `POST /api/grids/` Authorization: Bearer { title }
  - `GET /api/grids/` Authorization: Bearer -> list with metadata
  - `GET /api/grids/:id` Authorization: Bearer -> grid + cells + sheets + layout
  - `PATCH /api/grids/:id` Authorization: Bearer { title }
  - `DELETE /api/grids/:id` Authorization: Bearer (owner only)
- Sheets
  - `GET /api/grids/:id/sheets` Authorization: Bearer
  - `POST /api/grids/:id/sheets` Authorization: Bearer { name }
  - `PATCH /api/grids/:id/sheets/:sheetId` Authorization: Bearer { name }
  - `DELETE /api/grids/:id/sheets/:sheetId` Authorization: Bearer

## Realtime Events (Selected)
- Client -> Server: `grid:join` { gridId, sheetId }
- Server -> Client: `grid:snapshot` { rows, cols, rowHeights, colWidths, cells }
- Broadcast: `grid:operation` for
  - `cell:update` { row, col, value }
  - `cell:style` { row, col, style }
  - `grid:dimension` { rows?, cols? }
  - `grid:resize` { rowHeights?, colWidths? }
- Presence
  - `cell:focus` / `cell:blur`
- Lock
  - `cell:lock:acquire` / `cell:lock:renew` / `cell:lock:release`
  - `cell:lock:granted` / `cell:lock:denied` / `cell:lock:released`

## Development Notes
- The client auto-derives API/WS URLs from `window.location.hostname` when env is absent, enabling LAN access without CORS pain.
- Row/column sizes are stored per-sheet in MySQL table `grid_sheet_layout`.
- Cell values and styles are stored in `grid_cells` (per `grid_id`, `sheet_id`, `row_index`, `col_index`).
- Last modified and last editor are tracked in `grids.last_modified` and `grids.last_editor_id`.

## Troubleshooting
- Port already in use (4000): kill the process or use `npx kill-port 4000`.
- CORS errors on LAN: ensure server CORS reflects origin (already configured), and client uses LAN IP.
- MySQL keyword issues: columns `rows`/`cols` are backticked; ensure your MySQL is 8.x and schema up to date.
- Layout not persisting: confirm `grid:operation` payload contains `sheetId`, and `grid_sheet_layout` has a row for the `sheet_id`.
- Nicknames not showing: ensure clients pass JWT in WS auth; Redis directory keys are `grid:{gridId}:user:{userId}`.

## License
MIT © CollabGrid Contributors

