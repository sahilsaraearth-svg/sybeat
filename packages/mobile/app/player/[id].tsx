import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  CaretDown, Play, Pause, SkipForward, SkipBack,
  Shuffle, Repeat, Heart,
  Queue, ShareNetwork, Moon, Download, CheckCircle, User, Broadcast,
} from "phosphor-react-native";
import { usePlayerStore } from "../../store/playerStore";
import { useLikedStore } from "../../store/likedStore";
import { useRecentStore } from "../../store/recentStore";
import { useStatsStore } from "../../store/statsStore";
import { togglePlayPause, loadAndPlay, seekTo, fetchAndAppendRadio } from "../../lib/player";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useRef, useMemo } from "react";
import QueueSheet from "../../components/QueueSheet";
import ShareCard from "../../components/ShareCard";
import SleepTimerSheet from "../../components/SleepTimerSheet";
import { useSleepTimerStore } from "../../store/sleepTimerStore";
import { useDownloadStore } from "../../store/downloadStore";
import { downloadTrack } from "../../lib/download";
import { useColors } from "../../lib/colors";

const { width: SW } = Dimensions.get("window");



const WAVE = [0.3,0.5,0.4,0.8,0.6,0.9,0.7,0.5,1,0.8,0.6,0.4,0.7,0.9,0.5,0.3,0.6,0.8,0.4,0.7,
              0.5,0.9,0.6,0.8,0.4,0.6,1,0.7,0.5,0.3,0.8,0.6,0.4,0.9,0.7,0.5,0.3,0.6,0.8,0.5];

export default function PlayerScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any);

  const {
    currentTrack, isPlaying, isLoading, position, duration,
    repeatMode, isShuffle, toggleRepeat, toggleShuffle,
    nextTrack, prevTrack, queue,
    radioMode, toggleRadioMode, isFetchingRadio,
  } = usePlayerStore();

  const { toggle, isLiked } = useLikedStore();
  const liked = currentTrack ? isLiked(currentTrack.videoId) : false;
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;
  const [queueOpen, setQueueOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const { isActive: sleepActive } = useSleepTimerStore();
  const { isDownloaded, isDownloading } = useDownloadStore();
  const { add: addRecent } = useRecentStore();
  const { recordPlay } = useStatsStore();
  const trackStartRef = useRef<number>(Date.now());
  const lastTrackId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) return;
    trackStartRef.current = Date.now();
    lastTrackId.current = currentTrack.videoId;
    addRecent(currentTrack);
  }, [currentTrack?.videoId]);

  useEffect(() => {
    if (!isPlaying && currentTrack && trackStartRef.current) {
      const secs = Math.floor((Date.now() - trackStartRef.current) / 1000);
      if (secs > 5) recordPlay(currentTrack, secs);
      trackStartRef.current = Date.now();
    }
  }, [isPlaying]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const haptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const handlePlayPause = async () => { await haptic(); await togglePlayPause(); };
  const handleNext = () => {
    haptic();
    const n = nextTrack(); // updates store immediately → UI updates instantly
    if (n) loadAndPlay(n.videoId); // fire-and-forget, no await
  };
  const handlePrev = () => {
    haptic();
    const p = prevTrack();
    if (p) loadAndPlay(p.videoId);
  };
  const handleLike = async () => {
    if (!currentTrack) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggle(currentTrack);
  };

  if (!currentTrack) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>No track playing</Text>
        <TouchableOpacity onPress={goBack}>
          <Text style={{ color: C.indigo, fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const thumbUrl = currentTrack.thumbnail || "https://placehold.co/400x400/18181B/6366F1?text=♪";
  const curIdx = queue.findIndex((t) => t.videoId === currentTrack.videoId);
  const artists = currentTrack.artist.split(",").map((a) => a.trim());

  return (
    <View style={s.container}>
      <Image
        source={{ uri: thumbUrl }}
        style={StyleSheet.absoluteFillObject}
        blurRadius={Platform.OS === "android" ? 30 : 0}
      />
      {Platform.OS === "ios" && (
        <BlurView intensity={98} tint="dark" style={StyleSheet.absoluteFillObject} />
      )}
      <LinearGradient
        colors={["rgba(9,9,11,0.6)", "rgba(9,9,11,0.88)", "#09090B"]}
        style={StyleSheet.absoluteFillObject}
        locations={[0, 0.45, 0.85]}
      />

      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.iconBtn} onPress={goBack}>
            <CaretDown size={20} color={C.text} weight="bold" />
          </TouchableOpacity>
          <View style={s.topCenter}>
            <Text style={s.topLabel}>NOW PLAYING</Text>
            {currentTrack.album ? (
              <Text style={s.topAlbum} numberOfLines={1}>{currentTrack.album}</Text>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.iconBtn} onPress={() => setSleepOpen(true)}>
              <Moon size={18} color={sleepActive ? "#818cf8" : C.text} weight={sleepActive ? "fill" : "regular"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => currentTrack && downloadTrack(currentTrack)}
            >
              {isDownloading(currentTrack.videoId) ? (
                <Download size={18} color="#6366F1" />
              ) : isDownloaded(currentTrack.videoId) ? (
                <CheckCircle size={18} color="#22C55E" weight="fill" />
              ) : (
                <Download size={18} color={C.text} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => setShareOpen(true)}>
              <ShareNetwork size={18} color={C.text} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={() => setQueueOpen(true)}>
              <Queue size={18} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable content — player + artist section below */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          scrollEventThrottle={16}
        >
          {/* Album art */}
          <View style={s.artWrap}>
            <Image source={{ uri: thumbUrl }} style={s.art} resizeMode="cover" />
            {isLoading && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={C.indigo} />
              </View>
            )}
          </View>

          {/* Track info + like */}
          <View style={s.trackSection}>
            <View style={s.trackText}>
              <Text style={s.trackTitle} numberOfLines={1}>{currentTrack.title}</Text>
              <Text style={s.trackArtist} numberOfLines={1}>{currentTrack.artist}</Text>
            </View>
            <TouchableOpacity onPress={handleLike} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Heart size={24} color={liked ? "#F43F5E" : C.textMuted} weight={liked ? "fill" : "regular"} />
            </TouchableOpacity>
          </View>

          {/* Waveform progress */}
          <View style={s.waveSection}>
            <TouchableOpacity
              style={s.waveOuter}
              activeOpacity={1}
              onPress={(e) => {
                if (duration <= 0) return;
                const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / (SW - 48)));
                seekTo(Math.floor(pct * duration));
              }}
            >
              <View style={s.waveBars}>
                {WAVE.map((h, i) => {
                  const isPassed = (i / WAVE.length) <= progress;
                  return (
                    <View
                      key={i}
                      style={[
                        s.waveBar,
                        { height: h * 36 },
                        isPassed ? s.waveBarActive : s.waveBarInactive,
                      ]}
                    />
                  );
                })}
              </View>
              <View style={[s.waveThumb, { left: `${progress * 100}%` as any }]} />
            </TouchableOpacity>
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmt(position)}</Text>
              <Text style={s.timeText}>{fmt(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <TouchableOpacity onPress={() => { toggleShuffle(); haptic(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Shuffle size={22} color={isShuffle ? C.indigo : C.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={handlePrev}>
              <SkipBack size={28} color={C.text} weight="fill" />
            </TouchableOpacity>
            <TouchableOpacity style={s.playBtn} onPress={handlePlayPause} activeOpacity={0.85}>
              <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
              {isLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : isPlaying
                ? <Pause size={30} color="#fff" weight="fill" />
                : <Play size={30} color="#fff" weight="fill" />}
            </TouchableOpacity>
            <TouchableOpacity style={s.skipBtn} onPress={handleNext}>
              <SkipForward size={28} color={C.text} weight="fill" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { toggleRepeat(); haptic(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Repeat size={22} color={repeatMode !== "none" ? C.indigo : C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Queue dots */}
          <View style={s.queueRow}>
            {[...Array(Math.min(queue.length, 5))].map((_, i) => {
              const dotIdx = Math.max(0, curIdx - 2) + i;
              return <View key={i} style={[s.dot, dotIdx === curIdx && s.dotActive]} />;
            })}
          </View>

          {/* Radio mode row */}
          <TouchableOpacity
            style={s.radioRow}
            onPress={() => { toggleRadioMode(); haptic(); }}
            activeOpacity={0.7}
          >
            <View style={[s.radioIcon, radioMode && s.radioIconActive]}>
              {isFetchingRadio
                ? <ActivityIndicator size="small" color={C.indigo} />
                : <Broadcast size={14} color={radioMode ? C.indigo : C.textMuted} weight={radioMode ? "fill" : "regular"} />
              }
            </View>
            <Text style={[s.radioLabel, radioMode && s.radioLabelActive]}>
              {isFetchingRadio ? "Finding similar songs…" : radioMode ? "Radio On — auto-plays similar songs" : "Radio Off"}
            </Text>
          </TouchableOpacity>

          {/* ── ARTIST SECTION (below controls, Spotify style) ── */}
          <View style={a.divider}>
            <View style={a.dividerLine} />
            <View style={a.dividerPill}>
              <User size={12} color={C.indigo} />
              <Text style={a.dividerText}>ARTIST</Text>
            </View>
            <View style={a.dividerLine} />
          </View>

          {/* Artist hero */}
          <View style={a.hero}>
            <Image source={{ uri: thumbUrl }} style={a.heroImg} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "#09090B"]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={a.heroText}>
              <Text style={a.heroTag}>✦ ARTIST</Text>
              <Text style={a.heroName}>{artists[0]}</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={a.statsRow}>
            <View style={a.statItem}>
              <Text style={a.statVal}>∞</Text>
              <Text style={a.statLabel}>Listeners</Text>
            </View>
            <View style={a.statDivider} />
            <View style={a.statItem}>
              <Text style={a.statVal}>{currentTrack.language?.toUpperCase() || "—"}</Text>
              <Text style={a.statLabel}>Language</Text>
            </View>
            <View style={a.statDivider} />
            <View style={a.statItem}>
              <Text style={a.statVal}>{currentTrack.album ? "✓" : "—"}</Text>
              <Text style={a.statLabel}>Album</Text>
            </View>
          </View>

          {/* Album card */}
          {currentTrack.album && (
            <View style={a.albumCard}>
              <Image source={{ uri: thumbUrl }} style={a.albumThumb} />
              <View style={{ flex: 1 }}>
                <Text style={a.albumLabel}>FROM THE ALBUM</Text>
                <Text style={a.albumName} numberOfLines={2}>{currentTrack.album}</Text>
              </View>
            </View>
          )}

          {/* Featured artists */}
          {artists.length > 1 && (
            <>
              <Text style={a.sectionTitle}>Featured Artists</Text>
              {artists.slice(1).map((ar, i) => (
                <View key={i} style={a.artistRow}>
                  <View style={a.artistAvatar}>
                    <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                    <Text style={a.artistAvatarTxt}>{ar[0]?.toUpperCase() ?? "?"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={a.artistName}>{ar}</Text>
                    <Text style={a.artistRole}>Featured Artist</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Track info */}
          <Text style={a.sectionTitle}>About This Track</Text>
          <View style={a.infoCard}>
            <InfoRow label="Title" value={currentTrack.title} />
            {currentTrack.album && <InfoRow label="Album" value={currentTrack.album} />}
            <InfoRow label="Artists" value={currentTrack.artist} />
            {currentTrack.language && <InfoRow label="Language" value={currentTrack.language} />}
          </View>

          {/* Mini controls at bottom of artist section */}
          <View style={a.miniControls}>
            <TouchableOpacity onPress={handlePrev}>
              <SkipBack size={26} color={C.text} weight="fill" />
            </TouchableOpacity>
            <TouchableOpacity style={a.miniPlay} onPress={handlePlayPause}>
              <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
              {isPlaying ? <Pause size={20} color="#fff" weight="fill" /> : <Play size={20} color="#fff" weight="fill" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext}>
              <SkipForward size={26} color={C.text} weight="fill" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      <QueueSheet visible={queueOpen} onClose={() => setQueueOpen(false)} />
      <ShareCard visible={shareOpen} onClose={() => setShareOpen(false)} track={currentTrack} />
      <SleepTimerSheet visible={sleepOpen} onClose={() => setSleepOpen(false)} />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text style={a.infoLabel}>{label}</Text>
      <Text style={a.infoVal}>{value}</Text>
    </>
  );
}

function makeStyles(C: ReturnType<typeof import("../../lib/colors").useColors>) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: "#09090B" },
  safe: { flex: 1 },
  empty: { flex: 1, backgroundColor: "#09090B", alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { color: "#A1A1AA", fontSize: 16 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 10,
  },
  topCenter: { alignItems: "center", flex: 1 },
  topLabel: { fontSize: 10, color: "#A1A1AA", textTransform: "uppercase", letterSpacing: 2.5, fontWeight: "700" },
  topAlbum: { fontSize: 12, color: "#FAFAFA", fontWeight: "600", marginTop: 2, maxWidth: 180 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(24,24,27,0.6)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.5)",
  },

  artWrap: {
    alignSelf: "center", width: SW - 60, aspectRatio: 1,
    borderRadius: 20, overflow: "hidden",
    marginVertical: 12, maxHeight: SW * 0.65,
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.7, shadowRadius: 28, elevation: 20,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
  },
  art: { width: "100%", height: "100%" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(9,9,11,0.5)",
    alignItems: "center", justifyContent: "center",
  },

  trackSection: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 24, marginBottom: 16, gap: 12,
  },
  trackText: { flex: 1 },
  trackTitle: { fontSize: 20, fontWeight: "800", color: "#FAFAFA", letterSpacing: -0.3, marginBottom: 4 },
  trackArtist: { fontSize: 14, color: "#A1A1AA", fontWeight: "500" },

  waveSection: { paddingHorizontal: 24, marginBottom: 20 },
  waveOuter: { height: 52, justifyContent: "center", marginBottom: 8 },
  waveBars: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", height: 40,
  },
  waveBar: { width: 3, borderRadius: 2 },
  waveBarActive: { backgroundColor: "#6366F1" },
  waveBarInactive: { backgroundColor: "rgba(255,255,255,0.12)" },
  waveThumb: {
    position: "absolute", width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#fff", top: 20, marginLeft: -6,
    shadowColor: "#6366F1", shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, color: "#71717A" },

  controls: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 24, marginBottom: 20,
  },
  skipBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 68, height: 68, borderRadius: 34, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 18, elevation: 12,
  },
  queueRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingBottom: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)" },
  dotActive: { width: 20, borderRadius: 3, backgroundColor: "#6366F1" },
  radioRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 10, paddingHorizontal: 16,
    marginTop: 4,
  },
  radioIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  radioIconActive: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  radioLabel: {
    fontSize: 12, color: "#6B7280", fontWeight: "500",
  },
  radioLabelActive: {
    color: "#6366F1",
  },
});

// Artist section styles
const a = StyleSheet.create({
  divider: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, marginTop: 16, marginBottom: 20, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(63,63,70,0.5)" },
  dividerPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(99,102,241,0.12)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.25)",
  },
  dividerText: {
    fontSize: 10, color: "#6366F1", fontWeight: "700", letterSpacing: 1.5,
  },

  hero: {
    height: 200, marginHorizontal: 16, borderRadius: 18,
    overflow: "hidden", position: "relative", marginBottom: 16,
  },
  heroImg: { width: "100%", height: "100%" },
  heroText: { position: "absolute", bottom: 16, left: 16, right: 16 },
  heroTag: { fontSize: 10, color: "#6366F1", fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  heroName: { fontSize: 26, fontWeight: "900", color: "#FAFAFA", letterSpacing: -0.5 },

  statsRow: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 16,
    backgroundColor: "rgba(24,24,27,0.7)",
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statVal: { fontSize: 16, fontWeight: "800", color: "#FAFAFA" },
  statLabel: { fontSize: 10, color: "#71717A", textAlign: "center", fontWeight: "600" },
  statDivider: { width: 1, backgroundColor: "rgba(63,63,70,0.5)" },

  albumCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, padding: 14,
    backgroundColor: "rgba(24,24,27,0.7)",
    borderRadius: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
  },
  albumThumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: "#27272A" },
  albumLabel: { fontSize: 10, color: "#6366F1", fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  albumName: { fontSize: 15, fontWeight: "700", color: "#FAFAFA" },

  sectionTitle: {
    fontSize: 12, fontWeight: "700", color: "#71717A",
    letterSpacing: 1.5, textTransform: "uppercase",
    paddingHorizontal: 20, marginBottom: 10, marginTop: 4,
  },
  artistRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  artistAvatar: {
    width: 44, height: 44, borderRadius: 22, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  artistAvatarTxt: { color: "#fff", fontWeight: "800", fontSize: 18, zIndex: 2 },
  artistName: { fontSize: 15, fontWeight: "700", color: "#FAFAFA" },
  artistRole: { fontSize: 12, color: "#71717A" },

  infoCard: {
    marginHorizontal: 16, padding: 16,
    backgroundColor: "rgba(24,24,27,0.7)",
    borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
    gap: 4, marginBottom: 24,
  },
  infoLabel: {
    fontSize: 10, color: "#52525B", fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase", marginTop: 8,
  },
  infoVal: { fontSize: 14, color: "#D4D4D8", fontWeight: "500" },

  miniControls: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 28, paddingBottom: 8,
  },
  miniPlay: {
    width: 52, height: 52, borderRadius: 26, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
}); }
