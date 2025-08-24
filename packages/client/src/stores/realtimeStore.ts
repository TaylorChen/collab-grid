import { create } from "zustand";
import type { PresenceState } from "@collab-grid/shared";

interface CellPresenceUser { userId: string; displayName: string; color: string }

interface RealtimeState {
  connected: boolean;
  presence: Record<string, PresenceState>;
  // cellKey -> users
  presenceByCell: Record<string, CellPresenceUser[]>;
  // cellKey -> holder or null
  lockByCell: Record<string, { userId: string; displayName: string; color: string } | null>;
  setConnected: (v: boolean) => void;
  upsertPresence: (p: PresenceState) => void;
  setCellPresence: (cellKey: string, users: CellPresenceUser[]) => void;
  setCellLock: (cellKey: string, holder: { userId: string; displayName: string; color: string } | null) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  presence: {},
  presenceByCell: {},
  lockByCell: {},
  setConnected: (v) => set({ connected: v }),
  upsertPresence: (p) => set((s) => ({ presence: { ...s.presence, [p.userId]: p } })),
  setCellPresence: (cellKey, users) => set((s) => ({ presenceByCell: { ...s.presenceByCell, [cellKey]: users } })),
  setCellLock: (cellKey, holder) => set((s) => ({ lockByCell: { ...s.lockByCell, [cellKey]: holder } }))
}));

