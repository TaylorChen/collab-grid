import { create } from "zustand";
import type { PresenceState } from "@collab-grid/shared";

interface RealtimeState {
  connected: boolean;
  presence: Record<string, PresenceState>;
  setConnected: (v: boolean) => void;
  upsertPresence: (p: PresenceState) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connected: false,
  presence: {},
  setConnected: (v) => set({ connected: v }),
  upsertPresence: (p) => set((s) => ({ presence: { ...s.presence, [p.userId]: p } }))
}));

