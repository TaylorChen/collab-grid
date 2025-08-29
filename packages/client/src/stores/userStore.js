import { create } from "zustand";
const KEY = "collabgrid_auth";
function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return { token: null, user: null };
        return JSON.parse(raw);
    }
    catch {
        return { token: null, user: null };
    }
}
export const useUserStore = create((set) => ({
    ...load(),
    setAuth: (token, user) => {
        localStorage.setItem(KEY, JSON.stringify({ token, user }));
        set({ token, user });
    },
    logout: () => {
        localStorage.removeItem(KEY);
        set({ token: null, user: null });
    }
}));
