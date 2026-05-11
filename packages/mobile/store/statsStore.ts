/**
 * Listening stats — total time, play counts per track/artist
 * Updated on track play, persisted in AsyncStorage
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { YouTubeTrack } from "../lib/youtube";

const KEY = "sybeat_stats";

export interface TrackStat {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  plays: number;
  totalSeconds: number;
}

export interface ArtistStat {
  name: string;
  plays: number;
  totalSeconds: number;
}

interface StatsState {
  totalSeconds: number;
  trackStats: Record<string, TrackStat>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  recordPlay: (track: YouTubeTrack, seconds: number) => void;
  topTracks: (n?: number) => TrackStat[];
  topArtists: (n?: number) => ArtistStat[];
  reset: () => void;
}

const save = (state: Pick<StatsState, "totalSeconds" | "trackStats">) =>
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});

export const useStatsStore = create<StatsState>((set, get) => ({
  totalSeconds: 0,
  trackStats: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ ...parsed, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  recordPlay: (track, seconds) => {
    if (seconds < 5) return; // ignore very short plays
    const { trackStats, totalSeconds } = get();
    const prev = trackStats[track.videoId];
    const next: TrackStat = prev
      ? { ...prev, plays: prev.plays + 1, totalSeconds: prev.totalSeconds + seconds }
      : {
          videoId: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail || "",
          plays: 1,
          totalSeconds: seconds,
        };
    const nextStats = { ...trackStats, [track.videoId]: next };
    const nextTotal = totalSeconds + seconds;
    set({ trackStats: nextStats, totalSeconds: nextTotal });
    save({ totalSeconds: nextTotal, trackStats: nextStats });
  },

  topTracks: (n = 10) => {
    return Object.values(get().trackStats)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, n);
  },

  topArtists: (n = 10) => {
    const byArtist: Record<string, ArtistStat> = {};
    for (const stat of Object.values(get().trackStats)) {
      const names = stat.artist.split(",").map((a) => a.trim());
      for (const name of names) {
        if (!byArtist[name]) byArtist[name] = { name, plays: 0, totalSeconds: 0 };
        byArtist[name].plays += stat.plays;
        byArtist[name].totalSeconds += stat.totalSeconds;
      }
    }
    return Object.values(byArtist).sort((a, b) => b.plays - a.plays).slice(0, n);
  },

  reset: () => {
    set({ totalSeconds: 0, trackStats: {} });
    AsyncStorage.removeItem(KEY).catch(() => {});
  },
}));
