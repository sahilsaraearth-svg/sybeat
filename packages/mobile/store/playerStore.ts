import { create } from "zustand";
import type { YouTubeTrack } from "../lib/youtube";

export type RepeatMode = "none" | "all" | "one";

interface PlayerState {
  currentTrack: YouTubeTrack | null;
  queue: YouTubeTrack[];
  queueIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  duration: number;
  position: number;
  volume: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isPlayerOpen: boolean;
  crossfadeDuration: number; // seconds, 0 = off

  // Radio mode — auto-fetches more songs when queue ends
  radioMode: boolean;
  isFetchingRadio: boolean; // prevent duplicate fetches
  playedInSession: string[]; // track IDs played this session (for skip-repeat avoidance)
  skipCount: Record<string, number>; // trackId → how many times skipped early

  // Actions
  setTrack: (track: YouTubeTrack, queue?: YouTubeTrack[], index?: number) => void;
  setQueue: (tracks: YouTubeTrack[], startIndex?: number) => void;
  setIsPlaying: (v: boolean) => void;
  setIsLoading: (v: boolean) => void;
  setDuration: (v: number) => void;
  setPosition: (v: number) => void;
  setVolume: (v: number) => void;
  setCrossfadeDuration: (seconds: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  toggleRadioMode: () => void;
  setRadioMode: (v: boolean) => void;
  setIsFetchingRadio: (v: boolean) => void;
  appendToQueue: (tracks: YouTubeTrack[]) => void;
  recordPlayed: (trackId: string) => void;
  recordSkip: (trackId: string) => void;
  nextTrack: () => YouTubeTrack | null;
  prevTrack: () => YouTubeTrack | null;
  openPlayer: () => void;
  closePlayer: () => void;
  clearPlayer: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  isLoading: false,
  duration: 0,
  position: 0,
  volume: 1,
  repeatMode: "none",
  isShuffle: false,
  isPlayerOpen: false,
  crossfadeDuration: 0,
  radioMode: true, // on by default — auto-continue after queue ends
  isFetchingRadio: false,
  playedInSession: [],
  skipCount: {},

  setTrack: (track, queue, index = 0) => {
    set({
      currentTrack: track,
      queue: queue ?? [track],
      queueIndex: index,
      isPlaying: true,
      position: 0,
      duration: 0,
      isLoading: true,
    });
  },

  setQueue: (tracks, startIndex = 0) => {
    const track = tracks[startIndex];
    if (!track) return;
    set({
      queue: tracks,
      queueIndex: startIndex,
      currentTrack: track,
      isPlaying: true,
      position: 0,
      duration: 0,
      isLoading: true,
    });
  },

  setIsPlaying: (v) => set({ isPlaying: v }),
  setIsLoading: (v) => set({ isLoading: v }),
  setDuration: (v) => set({ duration: v }),
  setPosition: (v) => set({ position: v }),
  setVolume: (v) => set({ volume: v }),
  setCrossfadeDuration: (seconds) => set({ crossfadeDuration: seconds }),

  toggleRadioMode: () => set((s) => ({ radioMode: !s.radioMode })),
  setRadioMode: (v) => set({ radioMode: v }),
  setIsFetchingRadio: (v) => set({ isFetchingRadio: v }),

  appendToQueue: (tracks) => {
    set((s) => {
      // Deduplicate: don't add tracks already in queue
      const existingIds = new Set(s.queue.map((t) => t.videoId));
      const newTracks = tracks.filter((t) => !existingIds.has(t.videoId));
      return { queue: [...s.queue, ...newTracks] };
    });
  },

  recordPlayed: (trackId) => {
    set((s) => ({
      playedInSession: [...s.playedInSession.slice(-49), trackId], // keep last 50
    }));
  },

  recordSkip: (trackId) => {
    set((s) => ({
      skipCount: {
        ...s.skipCount,
        [trackId]: (s.skipCount[trackId] ?? 0) + 1,
      },
    }));
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ["none", "all", "one"];
    const cur = get().repeatMode;
    const next = modes[(modes.indexOf(cur) + 1) % modes.length];
    set({ repeatMode: next });
  },

  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),

  nextTrack: () => {
    const { queue, queueIndex, repeatMode, isShuffle } = get();
    if (queue.length === 0) return null;

    let nextIdx: number;
    if (repeatMode === "one") {
      nextIdx = queueIndex;
    } else if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === "all") nextIdx = 0;
        else return null;
      }
    }

    const track = queue[nextIdx];
    if (!track) return null;
    set({
      queueIndex: nextIdx,
      currentTrack: track,
      position: 0,
      isLoading: true,
      isPlaying: true,
    });
    return track;
  },

  prevTrack: () => {
    const { queue, queueIndex, position } = get();
    if (queue.length === 0) return null;

    // If > 3 seconds in, restart current track
    if (position > 3) {
      set({ position: 0 });
      return get().currentTrack;
    }

    const prevIdx = Math.max(0, queueIndex - 1);
    const track = queue[prevIdx];
    if (!track) return null;
    set({
      queueIndex: prevIdx,
      currentTrack: track,
      position: 0,
      isLoading: true,
      isPlaying: true,
    });
    return track;
  },

  openPlayer: () => set({ isPlayerOpen: true }),
  closePlayer: () => set({ isPlayerOpen: false }),
  clearPlayer: () =>
    set({
      currentTrack: null,
      queue: [],
      queueIndex: 0,
      isPlaying: false,
      isLoading: false,
      position: 0,
      duration: 0,
      isPlayerOpen: false,
    }),
}));
