/**
 * Playlists — create/edit/delete, persisted in AsyncStorage
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { YouTubeTrack } from "../lib/youtube";

const KEY = "sybeat_playlists";

export interface Playlist {
  id: string;
  name: string;
  tracks: YouTubeTrack[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistState {
  playlists: Playlist[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  create: (name: string) => Playlist;
  rename: (id: string, name: string) => void;
  delete: (id: string) => void;
  addTrack: (playlistId: string, track: YouTubeTrack) => void;
  removeTrack: (playlistId: string, trackId: string) => void;
  reorderTracks: (playlistId: string, tracks: YouTubeTrack[]) => void;
}

const save = (playlists: Playlist[]) =>
  AsyncStorage.setItem(KEY, JSON.stringify(playlists)).catch(() => {});

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ playlists: JSON.parse(raw), hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  create: (name) => {
    const pl: Playlist = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: name.trim() || "New Playlist",
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [pl, ...get().playlists];
    set({ playlists: next });
    save(next);
    return pl;
  },

  rename: (id, name) => {
    const next = get().playlists.map((p) =>
      p.id === id ? { ...p, name: name.trim(), updatedAt: Date.now() } : p
    );
    set({ playlists: next });
    save(next);
  },

  delete: (id) => {
    const next = get().playlists.filter((p) => p.id !== id);
    set({ playlists: next });
    save(next);
  },

  addTrack: (playlistId, track) => {
    const next = get().playlists.map((p) => {
      if (p.id !== playlistId) return p;
      if (p.tracks.find((t) => t.videoId === track.videoId)) return p;
      return { ...p, tracks: [...p.tracks, track], updatedAt: Date.now() };
    });
    set({ playlists: next });
    save(next);
  },

  removeTrack: (playlistId, trackId) => {
    const next = get().playlists.map((p) =>
      p.id === playlistId
        ? { ...p, tracks: p.tracks.filter((t) => t.videoId !== trackId), updatedAt: Date.now() }
        : p
    );
    set({ playlists: next });
    save(next);
  },

  reorderTracks: (playlistId, tracks) => {
    const next = get().playlists.map((p) =>
      p.id === playlistId ? { ...p, tracks, updatedAt: Date.now() } : p
    );
    set({ playlists: next });
    save(next);
  },
}));
