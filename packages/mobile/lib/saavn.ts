/**
 * JioSaavn client — replaces youtube.ts entirely.
 * All search/trending/genre queries go through our backend proxy,
 * which calls Saavn's API and decrypts audio URLs.
 */

import { API_BASE } from "./player";

export interface SaavnTrack {
  /** Saavn song ID — used everywhere videoId was used before */
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  /** Duration in seconds */
  duration: number;
  album: string;
  language: string;
  // Aliases so existing code that reads .videoId still works
  videoId: string;
  durationSecs: number;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function normalize(raw: any): SaavnTrack {
  const secs = raw.duration ?? raw.durationSecs ?? 0;
  return {
    id: raw.id ?? "",
    title: raw.title ?? "Unknown",
    artist: raw.artist ?? "Unknown",
    thumbnail: raw.thumbnail ?? "",
    duration: secs,
    durationSecs: secs,
    album: raw.album ?? "",
    language: raw.language ?? "",
    // alias so TrackCard / playerStore don't need changes
    videoId: raw.id ?? "",
  };
}

export async function searchTracks(query: string, maxResults = 20): Promise<SaavnTrack[]> {
  const res = await fetch(
    `${API_BASE}/api/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data: any[] = await res.json();
  return data.slice(0, maxResults).map(normalize);
}

export async function getTrendingMusic(_regionCode = "IN", maxResults = 20): Promise<SaavnTrack[]> {
  const res = await fetch(`${API_BASE}/api/trending`);
  if (!res.ok) return searchTracks("bollywood hits arijit neha 2024", maxResults);
  const data: any[] = await res.json();
  if (!data.length) return searchTracks("bollywood hits arijit neha 2024", maxResults);
  return data.slice(0, maxResults).map(normalize);
}

export async function getRelatedSongs(songId: string, maxResults = 10): Promise<SaavnTrack[]> {
  // Saavn doesn't have a direct "related" endpoint without auth.
  // We fetch the song info and search by artist + language.
  try {
    const res = await fetch(`${API_BASE}/api/stream/${songId}/info`);
    if (res.ok) {
      const song = await res.json();
      const artist = song.artist?.split(",")[0]?.trim() ?? "";
      if (artist) return searchTracks(artist, maxResults);
    }
  } catch {}
  return [];
}

export async function getSongsByQuery(query: string, maxResults = 20): Promise<SaavnTrack[]> {
  return searchTracks(query, maxResults);
}

export const GENRES = [
  { label: "Trending", query: "trending bollywood 2024" },
  { label: "Bollywood", query: "bollywood hits 2024" },
  { label: "Hip-Hop", query: "hindi hip hop rap" },
  { label: "Pop", query: "pop music hits 2024" },
  { label: "Electronic", query: "electronic edm music" },
  { label: "Rock", query: "rock music hits" },
  { label: "Romantic", query: "romantic hindi songs" },
  { label: "Devotional", query: "devotional hindi songs" },
  { label: "Jazz", query: "jazz lofi music" },
  { label: "Chill", query: "chill lofi beats" },
];

// Re-export type alias so screens that imported YouTubeTrack still compile
export type YouTubeTrack = SaavnTrack;
