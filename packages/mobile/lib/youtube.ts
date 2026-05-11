/**
 * Compatibility shim — all YouTube code is gone.
 * Everything now routes through JioSaavn via our backend.
 * Existing screens import from here and keep working unchanged.
 */
export {
  type SaavnTrack as YouTubeTrack,
  searchTracks,
  getTrendingMusic,
  getRelatedSongs as getRelatedVideos,
  getSongsByQuery as getVideosByIds,
  GENRES,
} from "./saavn";
