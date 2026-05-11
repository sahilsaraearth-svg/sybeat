/**
 * Recently played tracks — last 50, persisted in AsyncStorage
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { YouTubeTrack } from "../lib/youtube";

const KEY = "sybeat_recently_played";
const MAX = 50;

interface RecentState {
  tracks: YouTubeTrack[];
  hydrated: boolean;
  add: (track: YouTubeTrack) => void;
  clear: () => void;
  hydrate: () => Promise<void>;
}

export const useRecentStore = create<RecentState>((set, get) => ({
  tracks: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ tracks: JSON.parse(raw), hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  add: (track) => {
    const prev = get().tracks.filter((t) => t.videoId !== track.videoId);
    const next = [track, ...prev].slice(0, MAX);
    set({ tracks: next });
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  },

  clear: () => {
    set({ tracks: [] });
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
}));
