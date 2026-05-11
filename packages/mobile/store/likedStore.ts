import { create } from "zustand";
import type { YouTubeTrack } from "../lib/youtube";

interface LikedState {
  likedTracks: YouTubeTrack[];
  like: (track: YouTubeTrack) => void;
  unlike: (videoId: string) => void;
  isLiked: (videoId: string) => boolean;
  toggle: (track: YouTubeTrack) => boolean; // returns new state
}

export const useLikedStore = create<LikedState>((set, get) => ({
  likedTracks: [],

  like: (track) => {
    const { likedTracks } = get();
    if (likedTracks.find((t) => t.videoId === track.videoId)) return;
    set({ likedTracks: [track, ...likedTracks] });
  },

  unlike: (videoId) => {
    set((s) => ({ likedTracks: s.likedTracks.filter((t) => t.videoId !== videoId) }));
  },

  isLiked: (videoId) => !!get().likedTracks.find((t) => t.videoId === videoId),

  toggle: (track) => {
    const { isLiked, like, unlike } = get();
    if (isLiked(track.videoId)) {
      unlike(track.videoId);
      return false;
    } else {
      like(track);
      return true;
    }
  },
}));
