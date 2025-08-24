import { create } from "zustand";

interface UserInfo {
  id: number;
  email: string;
  displayName: string;
}

interface UserState {
  token: string | null;
  user: UserInfo | null;
  setAuth: (token: string, user: UserInfo) => void;
  logout: () => void;
}

const KEY = "collabgrid_auth";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, user: null };
  }
}

export const useUserStore = create<UserState>((set) => ({
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

