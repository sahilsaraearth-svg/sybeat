import { usePlayerStore } from "../store/playerStore";
import { Platform } from "react-native";
import { toast } from "../components/Toast";

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://templateserver-production.up.railway.app";

let _nativeSound: any = null;
let _nextNativeSound: any = null;          // pre-buffered next track
let _nextNativeSongId: string | null = null; // which song is pre-buffered
let _webPlayer: HTMLAudioElement | null = null;
let _crossfadeTimer: ReturnType<typeof setInterval> | null = null;
let _loadingTrackId: string | null = null; // prevent double-load
let _audioModeSet = false;                  // only set AudioMode once

// ─── Client-side URL cache ────────────────────────────────────────────────────
interface UrlCacheEntry { url: string; expiresAt: number }
const _clientCache = new Map<string, UrlCacheEntry>();
const CLIENT_TTL = 5.5 * 60 * 60 * 1000;

function getClientCached(songId: string): string | null {
  const e = _clientCache.get(songId);
  if (!e || Date.now() > e.expiresAt) { _clientCache.delete(songId); return null; }
  return e.url;
}

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

// ─── Radio: fetch recommendations and append to queue ─────────────────────────
export async function fetchAndAppendRadio(seedTrack: {
  videoId: string;
  title: string;
  artist?: string;
  language?: string;
  album?: string;
}) {
  const store = usePlayerStore.getState();
  if (store.isFetchingRadio) return; // already in flight
  store.setIsFetchingRadio(true);

  try {
    const { videoId, title, artist, language, album } = seedTrack;
    const recentIds = store.playedInSession.slice(-20);
    const skipCount = store.skipCount;

    // Build liked artists list from recently played (tracks not skipped = liked artist)
    const likedArtists = artist ? [artist] : [];

    const res = await fetch(`${API_BASE}/api/radio/${videoId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title ?? "",
        artist: artist ?? "",
        language: language ?? "",
        album: album ?? "",
        recentIds,
        likedArtists,
        skipCount,
      }),
    });

    if (!res.ok) throw new Error(`Radio fetch failed: ${res.status}`);
    const tracks = await res.json();

    if (Array.isArray(tracks) && tracks.length > 0) {
      // Convert SaavnTrack → YouTubeTrack shape (same fields, videoId = id)
      const mapped = tracks.map((t: any) => ({
        id: t.id,
        videoId: t.id,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail,
        duration: t.duration,
        durationSecs: t.duration,
        album: t.album ?? "",
        language: t.language ?? "",
      }));
      store.appendToQueue(mapped);
      console.log(`[radio] appended ${mapped.length} tracks`);
    }
  } catch (err) {
    console.warn("[radio] fetch failed:", err);
  } finally {
    store.setIsFetchingRadio(false);
  }
}

// ─── Pre-warm: fire on touch/press-in ─────────────────────────────────────────
export function prewarmTrack(songId: string) {
  fetch(`${API_BASE}/api/stream/${songId}/warm`).catch(() => {});
  resolveAudioUrl(songId).catch(() => {});
}

// ─── Prefetch next N tracks URLs silently ────────────────────────────────────
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

// ─── Pre-buffer next native Sound object ─────────────────────────────────────
// Called after current track starts playing — loads next track in background
// so pressing next is instant (no createAsync wait).
async function _prebufferNext(songId: string) {
  if (Platform.OS === "web") return;
  if (_nextNativeSongId === songId) return; // already buffered

  // Clean up any stale pre-buffer
  if (_nextNativeSound) {
    try { await _nextNativeSound.unloadAsync(); } catch {}
    _nextNativeSound = null;
    _nextNativeSongId = null;
  }

  try {
    const { Audio } = await import("expo-av");
    const pipeUrl = `${API_BASE}/api/stream/${songId}`;

    const { sound, status } = await Audio.Sound.createAsync(
      { uri: pipeUrl },
      { shouldPlay: false, volume: 0, progressUpdateIntervalMillis: 99999 }
    );

    if (status.isLoaded) {
      _nextNativeSound = sound;
      _nextNativeSongId = songId;
      console.log("[prebuffer] ready:", songId);
    } else {
      try { await sound.unloadAsync(); } catch {}
    }
  } catch (e) {
    // silent — prebuffer failure is non-fatal
    console.log("[prebuffer] failed:", songId);
  }
}

// ─── Record skip signal ───────────────────────────────────────────────────────
// Call this before loading a new track if user skipped current one early
export function recordSkipIfEarly() {
  const store = usePlayerStore.getState();
  const { currentTrack, position, duration } = store;
  if (!currentTrack) return;
  const pct = duration > 0 ? position / duration : 0;
  if (pct < 0.3) {
    // User skipped within first 30% — negative signal
    store.recordSkip(currentTrack.videoId);
  }
}

// ─── Also prefetch radio when queue is getting low ────────────────────────────
export function checkAndPrefetchRadio() {
  const store = usePlayerStore.getState();
  const { queue, queueIndex, radioMode, currentTrack, isFetchingRadio } = store;
  const remaining = queue.length - queueIndex - 1;
  // When only 2 tracks left in queue, start fetching radio tracks proactively
  if (radioMode && !isFetchingRadio && remaining <= 2 && currentTrack) {
    fetchAndAppendRadio(currentTrack as any);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
export async function initAudio() {
  if (Platform.OS !== "web") {
    const { Audio } = await import("expo-av");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    _audioModeSet = true;
  }
}

// ─── Load & play ──────────────────────────────────────────────────────────────
export async function loadAndPlay(songId: string) {
  if (_loadingTrackId === songId) return;

  // Record skip if user is changing track early
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

  // Kick off prefetch for next tracks URLs + pre-buffer the very next one
  const { queue, queueIndex } = usePlayerStore.getState();
  const nextIds = queue.slice(queueIndex + 1, queueIndex + 4).map((t) => t.videoId);
  prefetchQueue(nextIds);

  // Pre-buffer the next track in background (after 2s to not compete with current)
  if (nextIds[0]) {
    setTimeout(() => _prebufferNext(nextIds[0]), 2000);
  }

  // Proactively fetch radio tracks when queue is getting low (after 3s)
  setTimeout(() => checkAndPrefetchRadio(), 3000);
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
    console.warn("[web audio] HTMLAudioElement not available");
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
      // Record that this track was played (for radio signal)
      const ct = usePlayerStore.getState().currentTrack;
      if (ct) store.recordPlayed(ct.videoId);

      const next = store.nextTrack();
      if (next) {
        loadAndPlay(next.videoId);
      } else if (usePlayerStore.getState().radioMode && ct) {
        // Queue exhausted + radio mode on → fetch more songs then play
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

// ─── Crossfade helpers ────────────────────────────────────────────────────────
async function _fadeOutNative(sound: any, fromVol: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const steps = 20;
    const stepMs = durationMs / steps;
    const stepVol = fromVol / steps;
    let vol = fromVol;
    let count = 0;
    const iv = setInterval(async () => {
      count++;
      vol = Math.max(0, fromVol - stepVol * count);
      try { await sound.setVolumeAsync(vol); } catch {}
      if (count >= steps) { clearInterval(iv); resolve(); }
    }, stepMs);
    _crossfadeTimer = iv;
  });
}

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

// ─── Native audio ─────────────────────────────────────────────────────────────
async function _loadNativeAudio(
  songId: string,
  store: ReturnType<typeof usePlayerStore.getState>
) {
  try {
    const { Audio } = await import("expo-av");

    // Set audio mode only once per app session
    if (!_audioModeSet) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        _audioModeSet = true;
      } catch (modeErr: any) {
        console.warn("[native] setAudioMode failed:", modeErr?.message);
      }
    }

    // Unload previous sound
    if (_crossfadeTimer) { clearInterval(_crossfadeTimer); _crossfadeTimer = null; }
    if (_nativeSound) {
      const cfSecs = store.crossfadeDuration;
      if (cfSecs > 0) {
        try { await _fadeOutNative(_nativeSound, store.volume, cfSecs * 1000); } catch {}
      }
      try { await _nativeSound.unloadAsync(); } catch {}
      _nativeSound = null;
    }

    let sound: any;

    // Use pre-buffered sound if available for this track — instant playback
    if (_nextNativeSongId === songId && _nextNativeSound) {
      console.log("[native] using prebuffered sound for:", songId);
      sound = _nextNativeSound;
      _nextNativeSound = null;
      _nextNativeSongId = null;

      // Set volume and play
      try { await sound.setVolumeAsync(store.volume); } catch {}
      await sound.playAsync();
    } else {
      // Cold load — show loading state, create from scratch
      console.log("[native] cold load:", songId);
      const pipeUrl = `${API_BASE}/api/stream/${songId}`;

      const result = await Audio.Sound.createAsync(
        { uri: pipeUrl },
        { shouldPlay: true, volume: store.volume, progressUpdateIntervalMillis: 500 }
      );

      if (!result.status.isLoaded) {
        const errMsg = (result.status as any).error ?? "unknown";
        toast.error(`Playback failed: ${errMsg}`);
        store.setIsLoading(false);
        store.setIsPlaying(false);
        return;
      }

      sound = result.sound;
    }

    _nativeSound = sound;

    // Status callback for position, finish, etc.
    sound.setOnPlaybackStatusUpdate((status: any) => {
      if (!status.isLoaded) {
        if (status.error) {
          console.error("[native] status error:", status.error);
          toast.error(`Audio error: ${status.error}`);
        }
        return;
      }
      store.setPosition(Math.floor((status.positionMillis ?? 0) / 1000));
      if (status.durationMillis) store.setDuration(Math.floor(status.durationMillis / 1000));
      store.setIsLoading(false);
      if (status.isPlaying !== undefined) store.setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        // Record played track for radio signal
        const ct = usePlayerStore.getState().currentTrack;
        if (ct) usePlayerStore.getState().recordPlayed(ct.videoId);

        const next = store.nextTrack();
        if (next) {
          loadAndPlay(next.videoId);
        } else if (usePlayerStore.getState().radioMode && ct) {
          // Queue exhausted + radio on → fetch more songs then play
          fetchAndAppendRadio(ct as any).then(() => {
            const n = usePlayerStore.getState().nextTrack();
            if (n) loadAndPlay(n.videoId);
            else { store.setIsPlaying(false); store.setPosition(0); }
          });
        } else {
          store.setIsPlaying(false);
          store.setPosition(0);
        }
      }
    });

    store.setIsLoading(false);
    store.setIsPlaying(true);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[native audio error]", msg);
    toast.error(`Audio error: ${msg.slice(0, 80)}`);
    store.setIsLoading(false);
    store.setIsPlaying(false);
  }
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
    if (!_nativeSound) return;
    if (store.isPlaying) {
      await _nativeSound.pauseAsync();
      store.setIsPlaying(false);
    } else {
      await _nativeSound.playAsync();
      store.setIsPlaying(true);
    }
  }
}

export async function seekTo(seconds: number) {
  if (Platform.OS === "web") {
    if (!_webPlayer) return;
    try { _webPlayer.currentTime = seconds; usePlayerStore.getState().setPosition(seconds); } catch {}
  } else {
    if (!_nativeSound) return;
    try { await _nativeSound.setPositionAsync(seconds * 1000); usePlayerStore.getState().setPosition(seconds); } catch {}
  }
}

export async function setVolumeLevel(vol: number) {
  usePlayerStore.getState().setVolume(vol);
  if (Platform.OS === "web") {
    if (_webPlayer) _webPlayer.volume = vol;
  } else {
    if (_nativeSound) await _nativeSound.setVolumeAsync(vol);
  }
}

export async function stopPlayer() {
  if (Platform.OS === "web") {
    if (_webPlayer) {
      try { _webPlayer.pause(); _webPlayer.src = ""; _webPlayer.load(); } catch {}
      _webPlayer = null;
    }
  } else {
    if (_nativeSound) {
      try { await _nativeSound.unloadAsync(); } catch {}
      _nativeSound = null;
    }
    if (_nextNativeSound) {
      try { await _nextNativeSound.unloadAsync(); } catch {}
      _nextNativeSound = null;
      _nextNativeSongId = null;
    }
  }
  usePlayerStore.getState().clearPlayer();
}
