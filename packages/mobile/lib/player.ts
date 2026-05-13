import { usePlayerStore } from "../store/playerStore";
import { Platform } from "react-native";
import { toast } from "../components/Toast";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://templateserver-production.up.railway.app";

// ─── Client-side URL cache ────────────────────────────────────────────────────
interface UrlCacheEntry { url: string; expiresAt: number }
const _clientCache = new Map<string, UrlCacheEntry>();
const CLIENT_TTL = 5.5 * 60 * 60 * 1000;

function getClientCached(songId: string): string | null {
  const e = _clientCache.get(songId);
  if (!e || Date.now() > e.expiresAt) { _clientCache.delete(songId); return null; }
  return e.url;
}

// ─── RNTP setup (Android/iOS only) ───────────────────────────────────────────
let _trackPlayerReady = false;
let _loadingTrackId: string | null = null;

async function getTrackPlayer() {
  const mod = await import("react-native-track-player");
  return mod.default ?? mod;
}

async function ensureTrackPlayer() {
  if (_trackPlayerReady) return;
  try {
    const TrackPlayer = await getTrackPlayer();
    await TrackPlayer.setupPlayer({
      minBuffer: 15,
      maxBuffer: 50,
      backBuffer: 10,
      playBuffer: 2,
    });
    const { Capability } = await import("react-native-track-player");
    await TrackPlayer.updateOptions({
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      progressUpdateEventThrottle: 1000,
    });
    _trackPlayerReady = true;
    console.log("[RNTP] player ready");
  } catch (e) {
    console.warn("[RNTP] setup failed:", e);
  }
}

// ─── Web player ───────────────────────────────────────────────────────────────
let _webPlayer: HTMLAudioElement | null = null;
let _crossfadeTimer: ReturnType<typeof setInterval> | null = null;

// ─── Resolve Saavn CDN URL ────────────────────────────────────────────────────
export async function resolveAudioUrl(songId: string): Promise<{ url: string; contentType: string }> {
  const cached = getClientCached(songId);
  if (cached) return { url: cached, contentType: "audio/mp4" };

  const endpoint = `${API_BASE}/api/stream/${songId}/url`;
  let res: Response;
  try {
    res = await fetch(endpoint);
  } catch (fetchErr: any) {
    throw new Error(`Network fetch failed (${endpoint}): ${fetchErr?.message ?? fetchErr}`);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`URL resolve failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.url) throw new Error(`No URL in response: ${JSON.stringify(data).slice(0, 200)}`);

  _clientCache.set(songId, { url: data.url, expiresAt: Date.now() + CLIENT_TTL });
  return { url: data.url, contentType: data.contentType ?? "audio/mp4" };
}

// ─── Radio ────────────────────────────────────────────────────────────────────
export async function fetchAndAppendRadio(seedTrack: {
  videoId: string; title: string; artist?: string; language?: string; album?: string;
}) {
  const store = usePlayerStore.getState();
  if (store.isFetchingRadio) return;
  store.setIsFetchingRadio(true);
  try {
    const { videoId, title, artist, language, album } = seedTrack;
    const recentIds = store.playedInSession.slice(-20);
    const skipCount = store.skipCount;
    const likedArtists = artist ? [artist] : [];
    const res = await fetch(`${API_BASE}/api/radio/${videoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title ?? "", artist: artist ?? "", language: language ?? "", album: album ?? "", recentIds, likedArtists, skipCount }),
    });
    if (!res.ok) throw new Error(`Radio fetch failed: ${res.status}`);
    const tracks = await res.json();
    if (Array.isArray(tracks) && tracks.length > 0) {
      const mapped = tracks.map((t: any) => ({
        id: t.id, videoId: t.id, title: t.title, artist: t.artist,
        thumbnail: t.thumbnail, duration: t.duration, durationSecs: t.duration,
        album: t.album ?? "", language: t.language ?? "",
      }));
      store.appendToQueue(mapped);
    }
  } catch (err) {
    console.warn("[radio] fetch failed:", err);
  } finally {
    store.setIsFetchingRadio(false);
  }
}

export function prewarmTrack(songId: string) {
  fetch(`${API_BASE}/api/stream/${songId}/warm`).catch(() => {});
  resolveAudioUrl(songId).catch(() => {});
}

export function prefetchQueue(songIds: string[]) {
  if (!songIds.length) return;
  const ids = songIds.filter((id) => !getClientCached(id)).slice(0, 3);
  if (!ids.length) return;
  fetch(`${API_BASE}/api/stream/warm-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  }).catch(() => {});
  ids.slice(0, 2).forEach((id) =>
    setTimeout(() => resolveAudioUrl(id).catch(() => {}), 200)
  );
}

export function recordSkipIfEarly() {
  const store = usePlayerStore.getState();
  const { currentTrack, position, duration } = store;
  if (!currentTrack) return;
  const pct = duration > 0 ? position / duration : 0;
  if (pct < 0.3) store.recordSkip(currentTrack.videoId);
}

export function checkAndPrefetchRadio() {
  const store = usePlayerStore.getState();
  const { queue, queueIndex, radioMode, currentTrack, isFetchingRadio } = store;
  const remaining = queue.length - queueIndex - 1;
  if (radioMode && !isFetchingRadio && remaining <= 2 && currentTrack) {
    fetchAndAppendRadio(currentTrack as any);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initAudio() {
  if (Platform.OS !== "web") {
    await ensureTrackPlayer();
    // Register playback service listener
    _setupRNTPListeners();
  }
}

// ─── RNTP event listeners ─────────────────────────────────────────────────────
let _listenersSet = false;
function _setupRNTPListeners() {
  if (_listenersSet) return;
  _listenersSet = true;

  import("react-native-track-player").then(({ Event, State }) => {
    import("react-native-track-player").then((mod) => {
      const TrackPlayer = mod.default ?? mod;

      TrackPlayer.addEventListener(Event.RemotePlay, () => {
        TrackPlayer.play();
        usePlayerStore.getState().setIsPlaying(true);
      });

      TrackPlayer.addEventListener(Event.RemotePause, () => {
        TrackPlayer.pause();
        usePlayerStore.getState().setIsPlaying(false);
      });

      TrackPlayer.addEventListener(Event.RemoteNext, () => {
        const store = usePlayerStore.getState();
        recordSkipIfEarly();
        const next = store.nextTrack();
        if (next) loadAndPlay(next.videoId);
      });

      TrackPlayer.addEventListener(Event.RemotePrevious, () => {
        const store = usePlayerStore.getState();
        const prev = store.prevTrack();
        if (prev) loadAndPlay(prev.videoId);
      });

      TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }: { position: number }) => {
        TrackPlayer.seekTo(position);
        usePlayerStore.getState().setPosition(Math.floor(position));
      });

      TrackPlayer.addEventListener(Event.RemoteStop, () => {
        stopPlayer();
      });

      TrackPlayer.addEventListener(Event.PlaybackState, ({ state }: { state: any }) => {
        const store = usePlayerStore.getState();
        if (state === State.Playing) {
          store.setIsPlaying(true);
          store.setIsLoading(false);
        } else if (state === State.Paused || state === State.Stopped) {
          store.setIsPlaying(false);
        } else if (state === State.Loading || state === State.Buffering) {
          store.setIsLoading(true);
        } else if (state === State.Ready) {
          store.setIsLoading(false);
        }
      });

      TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, ({ position, duration }: { position: number; duration: number }) => {
        const store = usePlayerStore.getState();
        store.setPosition(Math.floor(position));
        if (duration && isFinite(duration)) store.setDuration(Math.floor(duration));
      });

      TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
        const store = usePlayerStore.getState();
        const ct = store.currentTrack;
        if (ct) store.recordPlayed(ct.videoId);

        const next = store.nextTrack();
        if (next) {
          loadAndPlay(next.videoId);
        } else if (store.radioMode && ct) {
          await fetchAndAppendRadio(ct as any);
          const n = usePlayerStore.getState().nextTrack();
          if (n) loadAndPlay(n.videoId);
          else { store.setIsPlaying(false); store.setPosition(0); }
        } else {
          store.setIsPlaying(false);
          store.setPosition(0);
        }
      });

      TrackPlayer.addEventListener(Event.PlaybackError, ({ message }: { message: string }) => {
        console.error("[RNTP] playback error:", message);
        usePlayerStore.getState().setIsLoading(false);
        usePlayerStore.getState().setIsPlaying(false);
        toast.error(`Audio error: ${message?.slice(0, 80)}`);
      });
    });
  });
}

// ─── Load & Play ──────────────────────────────────────────────────────────────
export async function loadAndPlay(songId: string) {
  if (_loadingTrackId === songId) return;
  recordSkipIfEarly();
  _loadingTrackId = songId;

  const store = usePlayerStore.getState();
  store.setIsLoading(true);

  if (Platform.OS === "web") {
    try {
      const { url } = await resolveAudioUrl(songId);
      await _loadWebAudio(url, "audio/mp4", store);
    } catch (err: any) {
      console.warn("[web] CDN resolve failed, falling back to pipe", err?.message);
      await _loadWebAudio(`${API_BASE}/api/stream/${songId}`, "audio/mp4", store);
    }
  } else {
    await _loadNativeAudio(songId, store);
  }

  _loadingTrackId = null;

  const { queue, queueIndex } = usePlayerStore.getState();
  const nextIds = queue.slice(queueIndex + 1, queueIndex + 4).map((t) => t.videoId);
  prefetchQueue(nextIds);
  setTimeout(() => checkAndPrefetchRadio(), 3000);
}

// ─── Native audio via RNTP ────────────────────────────────────────────────────
async function _loadNativeAudio(
  songId: string,
  store: ReturnType<typeof usePlayerStore.getState>
) {
  try {
    await ensureTrackPlayer();
    const TrackPlayer = await getTrackPlayer();

    const currentTrack = store.currentTrack;
    const pipeUrl = `${API_BASE}/api/stream/${songId}`;

    // Build track object for RNTP (shows in notification)
    const track = {
      id: songId,
      url: pipeUrl,
      title: currentTrack?.title ?? "Unknown Title",
      artist: currentTrack?.artist ?? "Unknown Artist",
      album: currentTrack?.album ?? "",
      artwork: currentTrack?.thumbnail ?? undefined,
      duration: currentTrack?.durationSecs ?? currentTrack?.duration ?? 0,
    };

    // Reset queue and add current track
    await TrackPlayer.reset();
    await TrackPlayer.add(track);
    await TrackPlayer.play();

    store.setIsPlaying(true);
    store.setIsLoading(false);
    if (currentTrack?.durationSecs) store.setDuration(currentTrack.durationSecs);

    // Record played + prefetch radio
    store.recordPlayed(songId);

    console.log("[RNTP] playing:", currentTrack?.title);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[RNTP native error]", msg);
    toast.error(`Audio error: ${msg.slice(0, 80)}`);
    store.setIsLoading(false);
    store.setIsPlaying(false);
  }
}

// ─── Web audio ────────────────────────────────────────────────────────────────
async function _loadWebAudio(
  url: string,
  _contentType: string,
  store: ReturnType<typeof usePlayerStore.getState>
) {
  const AudioCtor =
    typeof window !== "undefined" && typeof (window as any).Audio === "function"
      ? (window as any).Audio
      : typeof globalThis !== "undefined" && typeof (globalThis as any).Audio === "function"
      ? (globalThis as any).Audio
      : null;

  if (!AudioCtor) {
    store.setIsLoading(false);
    return;
  }

  try {
    if (_webPlayer) {
      const cfSecs = store.crossfadeDuration;
      if (cfSecs > 0) {
        try { await _fadeOutWeb(_webPlayer, store.volume, cfSecs * 1000); } catch {}
      }
      try { _webPlayer.pause(); _webPlayer.src = ""; _webPlayer.load(); } catch {}
      _webPlayer = null;
    }

    const audio: HTMLAudioElement = new AudioCtor();
    _webPlayer = audio;
    audio.volume = store.volume;
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";

    audio.addEventListener("canplay", () => { store.setIsLoading(false); });
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration))
        store.setDuration(Math.floor(audio.duration));
    });
    audio.addEventListener("playing", () => {
      store.setIsLoading(false);
      store.setIsPlaying(true);
    });
    audio.addEventListener("pause", () => { store.setIsPlaying(false); });
    audio.addEventListener("timeupdate", () => {
      store.setPosition(Math.floor(audio.currentTime));
      if (audio.duration && isFinite(audio.duration))
        store.setDuration(Math.floor(audio.duration));
    });
    audio.addEventListener("ended", () => {
      store.setIsPlaying(false);
      const ct = usePlayerStore.getState().currentTrack;
      if (ct) store.recordPlayed(ct.videoId);
      const next = store.nextTrack();
      if (next) {
        loadAndPlay(next.videoId);
      } else if (usePlayerStore.getState().radioMode && ct) {
        fetchAndAppendRadio(ct as any).then(() => {
          const n = usePlayerStore.getState().nextTrack();
          if (n) loadAndPlay(n.videoId);
        });
      }
    });
    audio.addEventListener("error", (e) => {
      const err = (audio as any).error;
      console.error("[web audio error]", err?.message ?? e);
      store.setIsLoading(false);
      store.setIsPlaying(false);
    });

    audio.src = url;
    audio.load();
    try {
      await audio.play();
      store.setIsPlaying(true);
      store.setIsLoading(false);
    } catch (playErr: any) {
      store.setIsLoading(false);
      if (playErr?.name !== "NotAllowedError") {
        console.error("[web audio play]", playErr?.message ?? String(playErr));
      }
      store.setIsPlaying(false);
    }
  } catch (err: any) {
    console.error("[web audio load error]", err?.message ?? String(err));
    store.setIsLoading(false);
    store.setIsPlaying(false);
  }
}

// ─── Crossfade helper (web only) ──────────────────────────────────────────────
function _fadeOutWeb(audio: HTMLAudioElement, fromVol: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const steps = 20;
    const stepMs = durationMs / steps;
    const stepVol = fromVol / steps;
    let vol = fromVol;
    let count = 0;
    const iv = setInterval(() => {
      count++;
      vol = Math.max(0, fromVol - stepVol * count);
      try { audio.volume = vol; } catch {}
      if (count >= steps) { clearInterval(iv); resolve(); }
    }, stepMs);
    _crossfadeTimer = iv as any;
  });
}

// ─── Controls ─────────────────────────────────────────────────────────────────
export async function togglePlayPause() {
  const store = usePlayerStore.getState();
  if (Platform.OS === "web") {
    if (!_webPlayer) return;
    if (_webPlayer.paused) {
      try { await _webPlayer.play(); store.setIsPlaying(true); } catch {}
    } else {
      _webPlayer.pause();
      store.setIsPlaying(false);
    }
  } else {
    const TrackPlayer = await getTrackPlayer();
    if (store.isPlaying) {
      await TrackPlayer.pause();
      store.setIsPlaying(false);
    } else {
      await TrackPlayer.play();
      store.setIsPlaying(true);
    }
  }
}

export async function seekTo(seconds: number) {
  if (Platform.OS === "web") {
    if (!_webPlayer) return;
    try { _webPlayer.currentTime = seconds; usePlayerStore.getState().setPosition(seconds); } catch {}
  } else {
    const TrackPlayer = await getTrackPlayer();
    await TrackPlayer.seekTo(seconds);
    usePlayerStore.getState().setPosition(Math.floor(seconds));
  }
}

export async function setVolumeLevel(vol: number) {
  usePlayerStore.getState().setVolume(vol);
  if (Platform.OS === "web") {
    if (_webPlayer) _webPlayer.volume = vol;
  } else {
    const TrackPlayer = await getTrackPlayer();
    await TrackPlayer.setVolume(vol);
  }
}

export async function stopPlayer() {
  if (Platform.OS === "web") {
    if (_webPlayer) {
      try { _webPlayer.pause(); _webPlayer.src = ""; _webPlayer.load(); } catch {}
      _webPlayer = null;
    }
  } else {
    try {
      const TrackPlayer = await getTrackPlayer();
      await TrackPlayer.reset();
      _trackPlayerReady = false;
    } catch {}
  }
  usePlayerStore.getState().clearPlayer();
}
