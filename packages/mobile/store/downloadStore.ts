/**
 * Download store — tracks offline downloads
 * Persisted to AsyncStorage
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { YouTubeTrack } from "../lib/youtube";

const KEY = "sybeat_downloads";

export interface DownloadedTrack extends YouTubeTrack {
  localPath: string;
  downloadedAt: number;
  fileSize?: number;
}

interface DownloadState {
  downloads: DownloadedTrack[];
  downloading: Set<string>; // videoIds in progress
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addDownload: (track: DownloadedTrack) => void;
  removeDownload: (videoId: string) => void;
  isDownloaded: (videoId: string) => boolean;
  isDownloading: (videoId: string) => boolean;
  setDownloading: (videoId: string, active: boolean) => void;
  getLocalPath: (videoId: string) => string | null;
}

const save = (downloads: DownloadedTrack[]) =>
  AsyncStorage.setItem(KEY, JSON.stringify(downloads)).catch(() => {});

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloads: [],
  downloading: new Set(),
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) set({ downloads: JSON.parse(raw), hydrated: true });
      else set({ hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  addDownload: (track) => {
    const existing = get().downloads.filter((d) => d.videoId !== track.videoId);
    const next = [track, ...existing];
    set({ downloads: next });
    save(next);
  },

  removeDownload: (videoId) => {
    const next = get().downloads.filter((d) => d.videoId !== videoId);
    set({ downloads: next });
    save(next);
  },

  isDownloaded: (videoId) => get().downloads.some((d) => d.videoId === videoId),

  isDownloading: (videoId) => get().downloading.has(videoId),

  setDownloading: (videoId, active) => {
    const next = new Set(get().downloading);
    if (active) next.add(videoId);
    else next.delete(videoId);
    set({ downloading: next });
  },

  getLocalPath: (videoId) => {
    const d = get().downloads.find((d) => d.videoId === videoId);
    return d?.localPath ?? null;
  },
}));
