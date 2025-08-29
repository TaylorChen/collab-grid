import { create } from "zustand";
export const useRealtimeStore = create((set) => ({
    connected: false,
    presence: {},
    presenceByCell: {},
    lockByCell: {},
    setConnected: (v) => set({ connected: v }),
    upsertPresence: (p) => set((s) => ({ presence: { ...s.presence, [p.userId]: p } })),
    setCellPresence: (cellKey, users) => set((s) => ({ presenceByCell: { ...s.presenceByCell, [cellKey]: users } })),
    setCellLock: (cellKey, holder) => set((s) => ({ lockByCell: { ...s.lockByCell, [cellKey]: holder } }))
}));
