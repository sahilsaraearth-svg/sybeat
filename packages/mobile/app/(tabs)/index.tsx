import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, Play, ArrowRight } from "phosphor-react-native";
import { getTrendingMusic, searchTracks, GENRES, type YouTubeTrack } from "../../lib/youtube";
import { loadAndPlay, prewarmTrack, prefetchQueue } from "../../lib/player";
import { usePlayerStore } from "../../store/playerStore";
import { useAuthStore } from "../../store/authStore";
import { useLikedStore } from "../../store/likedStore";
import { useColors } from "../../lib/colors";

const { width: W } = Dimensions.get("window");

const HOUR = new Date().getHours();
const GREETING = HOUR < 12 ? "Good Morning," : HOUR < 17 ? "Good Afternoon," : "Good Evening,";

export default function HomeScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { currentTrack } = usePlayerStore();
  const { user } = useAuthStore();
  const avatarInitial = (user?.name ?? "?")[0].toUpperCase();
  const [activeGenre, setActiveGenre] = useState("Trending");
  const [refreshing, setRefreshing] = useState(false);
  const { likedTracks } = useLikedStore();

  const trending = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrendingMusic("IN", 20),
  });

  const genreQuery = useQuery({
    queryKey: ["genre", activeGenre],
    queryFn: () => {
      const genre = GENRES.find((g) => g.label === activeGenre);
      return searchTracks(genre?.query ?? activeGenre, 20);
    },
    enabled: activeGenre !== "Trending",
  });

  // AI Daily Mix — built from liked tracks' artists, else fallback to trending
  const dailyMixQuery = useQuery({
    queryKey: ["daily-mix", likedTracks.slice(0, 5).map((t) => t.videoId).join(",")],
    queryFn: async () => {
      if (likedTracks.length === 0) {
        return searchTracks("best hindi bollywood pop 2024", 8);
      }
      // Pick up to 3 unique artists from liked tracks
      const artists = [...new Set(likedTracks.slice(0, 10).map((t) => t.artist.split(",")[0].trim()))].slice(0, 3);
      const queries = artists.map((a) => searchTracks(a, 4));
      const results = await Promise.all(queries);
      const merged = results.flat();
      // Shuffle
      for (let i = merged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [merged[i], merged[j]] = [merged[j], merged[i]];
      }
      // Dedupe by videoId
      const seen = new Set<string>();
      return merged.filter((t) => { if (seen.has(t.videoId)) return false; seen.add(t.videoId); return true; }).slice(0, 8);
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const tracks = activeGenre === "Trending" ? trending.data : genreQuery.data;
  const isLoading = activeGenre === "Trending" ? trending.isLoading : genreQuery.isLoading;

  if (tracks?.length) prefetchQueue(tracks.slice(0, 4).map((t) => t.videoId));

  const handlePlay = useCallback(async (track: YouTubeTrack, list: YouTubeTrack[], idx: number) => {
    usePlayerStore.getState().setTrack(track, list, idx);
    await loadAndPlay(track.videoId);
    router.push(`/player/${track.videoId}`);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await trending.refetch();
    setRefreshing(false);
  }, []);

  const recent = tracks?.slice(0, 5) ?? [];
  const playlist = tracks?.slice(5, 8) ?? [];

  return (
    <View style={s.root}>
      <LinearGradient colors={[C.bg, "#0F0F12", C.bg]} style={StyleSheet.absoluteFillObject} />
      {/* Subtle top glow */}
      <View style={s.glowBlob} pointerEvents="none">
        <LinearGradient
          colors={["rgba(99,102,241,0.12)", "transparent"]}
          style={{ flex: 1, borderRadius: 300 }}
        />
      </View>

      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.indigo} />
          }
        >
          {/* ── Header ── */}
          <View style={s.header}>
            <TouchableOpacity style={s.headerLeft} activeOpacity={0.8} onPress={() => router.push("/(tabs)/profile")}>
              <View style={s.avatar}>
                <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                <Text style={s.avatarText}>{avatarInitial}</Text>
              </View>
              <View>
                <Text style={s.greeting}>{GREETING}</Text>
                <Text style={s.userName}>{user?.name ?? "Music Lover"}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.bellBtn}>
              <View style={s.bellBg} />
              <Bell size={18} color={C.textMuted} />
            </TouchableOpacity>
          </View>

          {/* ── Genre chips ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.genreRow}>
            {["Trending", ...GENRES.slice(1, 9).map((g) => g.label)].map((label) => (
              <TouchableOpacity
                key={label}
                style={[s.genreChip, activeGenre === label && s.genreChipActive]}
                onPress={() => setActiveGenre(label)}
                activeOpacity={0.75}
              >
                <Text style={[s.genreChipText, activeGenre === label && s.genreChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Featured card ── */}
          {!isLoading && recent[0] && (
            <TouchableOpacity
              style={s.featured}
              onPress={() => handlePlay(recent[0], tracks ?? [], 0)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: recent[0].thumbnail }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
              <LinearGradient
                colors={["rgba(9,9,11,0.1)", "rgba(9,9,11,0.85)"]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.featuredPill}>
                <Text style={s.featuredPillText}>TOP PICK</Text>
              </View>
              <View style={s.featuredBottom}>
                <View style={s.featuredText}>
                  <Text style={s.featuredTitle} numberOfLines={1}>{recent[0].title}</Text>
                  <Text style={s.featuredArtist} numberOfLines={1}>{recent[0].artist}</Text>
                </View>
                <View style={s.featuredPlay}>
                  <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                  <Play size={18} color="#fff" weight="fill" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          {isLoading && <View style={[s.featured, s.skeleton]} />}

          {/* ── Recently Played avatars ── */}
          <Text style={s.sectionLabel}>Recently Played</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.avatarRow}>
            {(isLoading ? Array(5).fill(null) : recent).map((track: YouTubeTrack | null, i) =>
              isLoading || !track ? (
                <View key={i} style={s.recentSkeleton} />
              ) : (
                <TouchableOpacity
                  key={track.videoId}
                  style={s.recentItem}
                  onPress={() => handlePlay(track, tracks ?? [], i)}
                  activeOpacity={0.8}
                >
                  <View style={[s.recentRing, currentTrack?.videoId === track.videoId && s.recentRingActive]}>
                    <Image source={{ uri: track.thumbnail }} style={s.recentThumb} />
                  </View>
                  <Text style={s.recentName} numberOfLines={1}>{track.artist.split(",")[0].trim()}</Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>

          {/* ── AI Daily Mix ── */}
          <View style={[s.sectionRow, { marginBottom: 6 }]}>
            <View>
              <Text style={[s.sectionLabel, { marginBottom: 2 }]}>Made For You</Text>
              <Text style={[s.sectionSub, { paddingHorizontal: 0 }]}>AI · Updated daily</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const mix = dailyMixQuery.data;
                if (mix?.length) handlePlay(mix[0], mix, 0);
              }}
              style={s.mixPlayAllBtn}
            >
              <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
              <Play size={12} color="#fff" weight="fill" />
              <Text style={s.mixPlayAllText}>Play Mix</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mixRow}>
            {(dailyMixQuery.isLoading ? Array(4).fill(null) : (dailyMixQuery.data ?? [])).map((track: YouTubeTrack | null, i) =>
              !track ? (
                <View key={i} style={s.mixCardSkeleton} />
              ) : (
                <TouchableOpacity
                  key={`${track.videoId}-${i}`}
                  style={s.mixCard}
                  onPress={() => handlePlay(track, dailyMixQuery.data ?? [], i)}
                  onPressIn={() => prewarmTrack(track.videoId)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: track.thumbnail }} style={s.mixThumb} resizeMode="cover" />
                  <LinearGradient
                    colors={["transparent", "rgba(9,9,11,0.85)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  {/* AI badge */}
                  <View style={s.mixBadge}>
                    <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                    <Text style={s.mixBadgeText}>AI</Text>
                  </View>
                  <View style={s.mixCardInfo}>
                    <Text style={s.mixTitle} numberOfLines={1}>{track.title}</Text>
                    <Text style={s.mixArtist} numberOfLines={1}>{track.artist.split(",")[0].trim()}</Text>
                  </View>
                </TouchableOpacity>
              )
            )}
          </ScrollView>

          {/* ── Top Daily Playlist ── */}
          <View style={s.sectionRow}>
            <Text style={s.sectionLabel}>Top Daily Playlist</Text>
            <Text style={s.seeAll}>See all</Text>
          </View>

          {(isLoading ? Array(3).fill(null) : playlist).map((track: YouTubeTrack | null, idx) =>
            !track ? (
              <View key={idx} style={s.playlistSkeleton} />
            ) : (
              <TouchableOpacity
                key={track.videoId}
                style={[s.playlistRow, currentTrack?.videoId === track.videoId && s.playlistRowActive]}
                onPress={() => handlePlay(track, tracks ?? [], idx + 5)}
                onPressIn={() => prewarmTrack(track.videoId)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: track.thumbnail }} style={s.playlistThumb} />
                <View style={s.playlistInfo}>
                  <Text style={s.playlistTitle} numberOfLines={1}>{track.title}</Text>
                  <Text style={s.playlistSub} numberOfLines={1}>
                    By {track.artist} · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                </View>
                <View style={[s.playlistPlay, currentTrack?.videoId === track.videoId && s.playlistPlayActive]}>
                  <Play size={13} color="#fff" weight="fill" />
                </View>
              </TouchableOpacity>
            )
          )}

          <View style={{ height: 180 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof import("../../lib/colors").useColors>) { return StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  scroll: { paddingBottom: 160 },
  glowBlob: {
    position: "absolute", top: -100, left: -60,
    width: 340, height: 340, zIndex: 0,
  },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 10, marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(99,102,241,0.45)",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 16, zIndex: 2 },
  greeting: { fontSize: 11, color: C.textMuted, fontWeight: "500" },
  userName: { fontSize: 16, fontWeight: "700", color: C.text },
  bellBtn: {
    width: 40, height: 40, borderRadius: 12, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  bellBg: {
    position: "absolute", inset: 0, borderRadius: 12,
    backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder,
  },

  // Genre chips
  genreRow: { paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  genreChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
  },
  genreChipActive: { backgroundColor: C.indigo, borderColor: "transparent" },
  genreChipText: { color: C.textMuted, fontSize: 13, fontWeight: "600" },
  genreChipTextActive: { color: "#fff" },

  // Featured
  featured: {
    marginHorizontal: 20, height: 185, borderRadius: 20,
    overflow: "hidden", marginBottom: 28, backgroundColor: C.zinc800,
  },
  skeleton: { backgroundColor: "rgba(24,24,27,0.6)" },
  featuredPill: {
    position: "absolute", top: 14, left: 14,
    backgroundColor: "rgba(99,102,241,0.28)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.5)",
  },
  featuredPillText: { color: C.indigo, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  featuredBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    padding: 16,
  },
  featuredText: { flex: 1, paddingRight: 12 },
  featuredTitle: { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 3 },
  featuredArtist: { fontSize: 12, color: C.textMuted },
  featuredPlay: {
    width: 44, height: 44, borderRadius: 22, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    shadowColor: C.indigo, shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },

  // Section labels
  sectionLabel: {
    fontSize: 16, fontWeight: "700", color: C.text,
    paddingHorizontal: 20, marginBottom: 14,
  },
  sectionRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingRight: 20, marginBottom: 14,
  },
  seeAll: { fontSize: 12, color: C.indigo, fontWeight: "600" },

  // Recent avatars
  avatarRow: { paddingHorizontal: 20, gap: 16, marginBottom: 28 },
  recentItem: { alignItems: "center", gap: 7, width: 62 },
  recentRing: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2, borderColor: "rgba(63,63,70,0.5)",
    padding: 2, overflow: "hidden",
  },
  recentRingActive: { borderColor: C.indigo },
  recentThumb: { width: "100%", height: "100%", borderRadius: 27 },
  recentName: { fontSize: 10, color: C.textMuted, textAlign: "center" },
  recentSkeleton: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "rgba(24,24,27,0.6)",
  },

  // Playlist rows
  playlistRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 10,
    padding: 12, borderRadius: 14,
    backgroundColor: C.glass,
    borderWidth: 1, borderColor: C.glassBorder,
    gap: 12,
  },
  playlistRowActive: {
    backgroundColor: C.indigoDim,
    borderColor: C.indigoBorder,
  },
  playlistSkeleton: {
    marginHorizontal: 20, marginBottom: 10, height: 68,
    borderRadius: 14, backgroundColor: "rgba(24,24,27,0.4)",
  },
  playlistThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: C.zinc800 },
  playlistInfo: { flex: 1 },
  playlistTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 4 },
  playlistSub: { fontSize: 11, color: C.textMuted },
  playlistPlay: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  playlistPlayActive: { backgroundColor: C.indigo },

  // Section sub label
  sectionSub: { fontSize: 11, color: C.indigo, fontWeight: "600", paddingHorizontal: 0, marginTop: 1, marginBottom: 0 },

  // Mix play all
  mixPlayAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14,
    overflow: "hidden", marginRight: 20,
  },
  mixPlayAllText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // AI Mix cards
  mixRow: { paddingHorizontal: 20, gap: 12, marginBottom: 28 },
  mixCard: {
    width: 140, height: 160, borderRadius: 16, overflow: "hidden",
    backgroundColor: C.zinc800,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.4)",
  },
  mixCardSkeleton: {
    width: 140, height: 160, borderRadius: 16,
    backgroundColor: "rgba(24,24,27,0.5)",
  },
  mixThumb: { width: "100%", height: "100%" },
  mixBadge: {
    position: "absolute", top: 10, left: 10,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6, overflow: "hidden",
  },
  mixBadgeText: { fontSize: 9, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  mixCardInfo: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 },
  mixTitle: { fontSize: 12, fontWeight: "700", color: C.text, marginBottom: 2 },
  mixArtist: { fontSize: 10, color: C.textMuted },
}); }
