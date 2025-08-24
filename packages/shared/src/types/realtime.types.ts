export type SocketEvent =
  | "connect"
  | "disconnect"
  | "grid:join"
  | "grid:leave"
  | "grid:operation"
  | "grid:presence"
  | "grid:snapshot";

export interface PresenceState {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { row: number; col: number } | null;
  selection?: { start: { row: number; col: number }; end: { row: number; col: number } } | null;
}

export interface GridOperation {
  id: string;
  gridId: string;
  userId: string;
  ts: number;
  type: "cell:update" | "row:insert" | "row:delete" | "col:insert" | "col:delete";
  payload: unknown;
}

