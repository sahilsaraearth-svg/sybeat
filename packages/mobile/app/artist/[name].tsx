/**
 * Artist page — shows tracks by a specific artist
 */
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, MusicNote, Shuffle } from "phosphor-react-native";
import { searchTracks, type SaavnTrack } from "../../lib/saavn";
import { loadAndPlay, prefetchQueue } from "../../lib/player";
import { usePlayerStore } from "../../store/playerStore";
import TrackCard from "../../components/TrackCard";
import { TrackSkeletonList } from "../../components/SkeletonLoader";
import { useColors } from "../../lib/colors";

export default function ArtistPage() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const goBack = () => router.canGoBack() ? router.back() : router.replace("/(tabs)" as any);
  const { setQueue } = usePlayerStore();
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);

  const [tracks, setTracks] = useState<SaavnTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const artistName = decodeURIComponent(name ?? "");

  useEffect(() => {
    if (!artistName) return;
    setLoading(true);
    setError(null);

    searchTracks(artistName, 30)
      .then((results) => {
        // Filter to tracks more likely to be by this artist
        const filtered = results.filter((t) =>
          t.artist?.toLowerCase().includes(artistName.toLowerCase()) ||
          t.title?.toLowerCase().includes(artistName.toLowerCase())
        );
        setTracks(filtered.length >= 5 ? filtered : results);
      })
      .catch((err) => {
        setError(err?.message ?? "Failed to load");
      })
      .finally(() => setLoading(false));
  }, [artistName]);

  const handlePlay = useCallback(
    (track: SaavnTrack, index: number) => {
      const queue = tracks.slice(index);
      loadAndPlay(track as any);
      prefetchQueue(queue.slice(1, 4) as any[]);
      setQueue(queue as any[]);
    },
    [tracks, setQueue]
  );

  const handleShuffle = useCallback(() => {
    if (!tracks.length) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    loadAndPlay(shuffled[0] as any);
    prefetchQueue(shuffled.slice(1, 4) as any[]);
    setQueue(shuffled as any[]);
  }, [tracks, setQueue]);

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=6366F1&color=fff&size=200&bold=true`;

  return (
    <View style={s.root}>
      <LinearGradient
        colors={["#1E1B4B", C.bg, C.bg]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={goBack} style={s.backBtn}>
            <ArrowLeft size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Artist hero */}
        <View style={s.hero}>
          <Image source={{ uri: avatarUrl }} style={s.avatar} />
          <Text style={s.artistName} numberOfLines={2}>{artistName}</Text>
          {!loading && tracks.length > 0 && (
            <Text style={s.trackCount}>{tracks.length} tracks</Text>
          )}
          {!loading && tracks.length > 0 && (
            <TouchableOpacity style={s.shuffleBtn} onPress={handleShuffle}>
              <Shuffle size={16} color="#fff" />
              <Text style={s.shuffleTxt}>Shuffle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Track list */}
        {loading ? (
          <TrackSkeletonList count={8} />
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        ) : tracks.length === 0 ? (
          <View style={s.center}>
            <MusicNote size={48} color={C.muted} />
            <Text style={s.emptyTxt}>No tracks found</Text>
          </View>
        ) : (
          <FlatList
            data={tracks}
            keyExtractor={(t, i) => `${t.videoId}-${i}`}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <TrackCard
                track={item as any}
                onPress={() => handlePlay(item, index)}
              />
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    safe: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    backBtn: {
      width: 36, height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.08)",
      alignItems: "center", justifyContent: "center",
    },
    hero: {
      alignItems: "center",
      paddingVertical: 24,
      paddingHorizontal: 24,
      gap: 8,
    },
    avatar: {
      width: 120, height: 120,
      borderRadius: 60,
      backgroundColor: C.zinc800,
      marginBottom: 4,
    },
    artistName: {
      fontSize: 26, fontWeight: "800",
      color: C.text, textAlign: "center",
      letterSpacing: -0.5,
    },
    trackCount: {
      fontSize: 13, color: C.muted,
    },
    shuffleBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      backgroundColor: C.indigo,
      paddingHorizontal: 20, paddingVertical: 10,
      borderRadius: 24, marginTop: 8,
    },
    shuffleTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
    list: { paddingHorizontal: 16, paddingBottom: 120 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    emptyTxt: { color: C.muted, fontSize: 15 },
    errorTxt: { color: "#f87171", fontSize: 14, textAlign: "center" },
  });
}
