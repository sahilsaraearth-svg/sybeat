/**
 * Search history — last 20 queries, persisted in AsyncStorage
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sybeat_search_history";
const MAX = 20;

interface SearchHistoryState {
  queries: string[];
  hydrated: boolean;
  add: (q: string) => void;
  remove: (q: string) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  queries: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ queries: JSON.parse(raw), hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  add: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const prev = get().queries.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
    const next = [trimmed, ...prev].slice(0, MAX);
    set({ queries: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },

  remove: (q) => {
    const next = get().queries.filter((x) => x !== q);
    set({ queries: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },

  clear: () => {
    set({ queries: [] });
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
}));
