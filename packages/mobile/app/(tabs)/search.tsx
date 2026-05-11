import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, Keyboard, Image, Dimensions, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "expo-router";
import { MagnifyingGlass, X, MusicNote, ClockCounterClockwise, ArrowRight, Bell, User } from "phosphor-react-native";
import { searchTracks, GENRES, type YouTubeTrack } from "../../lib/youtube";
import { loadAndPlay, prewarmTrack, prefetchQueue } from "../../lib/player";
import { usePlayerStore } from "../../store/playerStore";
import { useSearchHistoryStore } from "../../store/searchHistoryStore";
import { useRecentStore } from "../../store/recentStore";
import { useAuthStore } from "../../store/authStore";
import TrackCard from "../../components/TrackCard";
import { TrackSkeletonList } from "../../components/SkeletonLoader";
import { useColors } from "../../lib/colors";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 48) / 2;

// Trending image cards with real concert/music images
const TRENDING_CARDS = [
  { label: "Pop Hits", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80&auto=format" },
  { label: "Hip Hop", image: "https://images.unsplash.com/photo-1547355253-ff0740f859f4?w=400&q=80&auto=format" },
  { label: "Bollywood", image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80&auto=format" },
  { label: "EDM", image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80&auto=format" },
  { label: "Indie", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80&auto=format" },
  { label: "Jazz", image: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&q=80&auto=format" },
];

const GENRE_COLORS: [string, string][] = [
  ["#1E1B4B","#312E81"], ["#18181B","#27272A"], ["#1C1917","#292524"],
  ["#0C1445","#1E3A5F"], ["#14172B","#1E1E3F"], ["#1A0A2E","#2D1B4E"],
  ["#0A1628","#0F2942"], ["#1A1A1A","#2D2D2D"], ["#1F1A10","#2E2410"],
  ["#0D1F12","#143320"],
];

export default function SearchScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { currentTrack } = usePlayerStore();
  const { queries: history, add: addHistory, remove: removeHistory, clear: clearHistory, hydrate } = useSearchHistoryStore();
  const { user } = useAuthStore();
  const displayName = user?.email?.split("@")[0] ?? "there";

  useEffect(() => { hydrate(); }, []);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    Keyboard.dismiss();
    setIsLoading(true);
    setHasSearched(true);
    addHistory(q.trim());
    try {
      const data = await searchTracks(q, 25);
      setResults(data);
      prefetchQueue(data.slice(0, 4).map((t) => t.videoId));
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePlay = useCallback(
    async (track: YouTubeTrack, idx: number) => {
      usePlayerStore.getState().setTrack(track, results, idx);
      useRecentStore.getState().add(track);
      await loadAndPlay(track.videoId);
      router.push(`/player/${track.videoId}`);
    },
    [results]
  );

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0F0A1E","#09090B","#09090B"]} style={StyleSheet.absoluteFillObject} />
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.container}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Search</Text>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.headerBtn}>
                <Bell size={19} color={C.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={s.avatarBtn}>
                <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                <Text style={s.avatarText}>{displayName[0]?.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={s.searchBar}>
            <MagnifyingGlass size={18} color={C.zinc400} />
            <TextInput
              ref={inputRef}
              style={s.input}
              placeholder="What do you want to listen to?"
              placeholderTextColor="#52525B"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(query)}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={handleClear}>
                <X size={16} color={C.zinc400} />
              </TouchableOpacity>
            )}
          </View>

          {!hasSearched ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 160 }}>
              {/* Search History */}
              {history.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <View style={s.sectionRow}>
                    <Text style={s.sectionTitle}>Recent Searches</Text>
                    <TouchableOpacity onPress={clearHistory}>
                      <Text style={s.clearText}>Clear all</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.historyList}>
                    {history.slice(0, 6).map((q) => (
                      <View key={q} style={s.historyRow}>
                        <TouchableOpacity
                          style={s.historyBtn}
                          onPress={() => { setQuery(q); handleSearch(q); }}
                        >
                          <ClockCounterClockwise size={14} color={C.zinc400} />
                          <Text style={s.historyText}>{q}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeHistory(q)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X size={13} color={C.zinc700} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Genre pills */}
              <Text style={s.sectionTitle}>Popular</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 28 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {["Hip Hop", "Soft", "Pop", "Soothing", "Lo-fi", "EDM", "Bollywood", "Indie"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={s.pill}
                    onPress={() => { setQuery(g); handleSearch(g); }}
                    activeOpacity={0.75}
                  >
                    <Text style={s.pillText}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Hot & Trending — image cards grid */}
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Hot & Trending 🔥</Text>
                <TouchableOpacity style={s.seeAll} onPress={() => handleSearch("trending music 2024")}>
                  <Text style={s.seeAllText}>See all</Text>
                  <ArrowRight size={13} color={C.indigo} />
                </TouchableOpacity>
              </View>
              <View style={s.trendingGrid}>
                {TRENDING_CARDS.map((card, i) => (
                  <TouchableOpacity
                    key={card.label}
                    style={s.trendCard}
                    onPress={() => { setQuery(card.label); handleSearch(card.label); }}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: card.image }} style={s.trendImg} />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.85)"]}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={s.trendLabel}>{card.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Browse Genres */}
              <Text style={[s.sectionTitle, { marginTop: 8 }]}>Browse Genres</Text>
              <View style={s.genreGrid}>
                {GENRES.map((genre, i) => {
                  const [c1, c2] = GENRE_COLORS[i % GENRE_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={genre.label} style={[s.genreCard, { backgroundColor: c1 }]}
                      onPress={() => { setQuery(genre.label); handleSearch(genre.query); }}
                      activeOpacity={0.8}
                    >
                      <View style={[s.genreCircle, { backgroundColor: c2 }]} />
                      <MusicNote size={16} color="rgba(255,255,255,0.4)" style={{ marginBottom: 4 }} />
                      <Text style={s.genreText}>{genre.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          ) : isLoading ? (
            <View style={{ marginTop: 20 }}><TrackSkeletonList count={8} /></View>
          ) : results.length === 0 ? (
            <View style={s.empty}>
              <MagnifyingGlass size={48} color={C.zinc700} />
              <Text style={s.emptyTitle}>No results found</Text>
              <Text style={s.emptySubtitle}>Try different keywords</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(t) => t.videoId}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 160 }}
              ListHeaderComponent={
                <Text style={s.resultsCount}>{results.length} results for "{query}"</Text>
              }
              renderItem={({ item, index }) => (
                <TrackCard
                  track={item}
                  onPress={() => handlePlay(item, index)}
                  onPressIn={() => prewarmTrack(item.videoId)}
                  isPlaying={currentTrack?.videoId === item.videoId}
                  showIndex={index}
                />
              )}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof import("../../lib/colors").useColors>) { return StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
  },
  title: { fontSize: 28, fontWeight: "800", color: "#FAFAFA", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(24,24,27,0.7)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.5)",
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15, zIndex: 2 },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginBottom: 20,
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: "rgba(24,24,27,0.85)", borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.6)", gap: 10,
  },
  input: { flex: 1, color: "#FAFAFA", fontSize: 15, fontWeight: "500", padding: 0 },

  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17, fontWeight: "800", color: "#FAFAFA",
    paddingHorizontal: 16, marginBottom: 12, letterSpacing: -0.3,
  },
  clearText: { fontSize: 13, color: C.indigo, fontWeight: "600" },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 4 },
  seeAllText: { fontSize: 13, color: C.indigo, fontWeight: "600" },

  historyList: { paddingHorizontal: 16, gap: 2 },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  historyBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  historyText: { fontSize: 14, color: C.text, fontWeight: "500" },

  pill: {
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: "rgba(24,24,27,0.9)",
    borderRadius: 50, borderWidth: 1, borderColor: "rgba(63,63,70,0.6)",
  },
  pillText: { color: "#D4D4D8", fontSize: 14, fontWeight: "600" },

  trendingGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 12, gap: 10, marginBottom: 28,
  },
  trendCard: {
    width: CARD_W, height: 120, borderRadius: 14,
    overflow: "hidden", justifyContent: "flex-end", padding: 12,
    backgroundColor: C.zinc800,
    borderWidth: 1, borderColor: "rgba(63,63,70,0.3)",
  },
  trendImg: {
    ...StyleSheet.absoluteFillObject as any,
    width: "100%", height: "100%",
  },
  trendLabel: {
    color: "#FAFAFA", fontSize: 15, fontWeight: "800",
    letterSpacing: -0.3, textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },

  genreGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  genreCard: {
    width: "47%", height: 80, borderRadius: 14, padding: 14,
    justifyContent: "flex-end", overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.3)",
  },
  genreCircle: {
    position: "absolute", right: -14, top: -14,
    width: 70, height: 70, borderRadius: 35, opacity: 0.5,
  },
  genreText: { color: "#FAFAFA", fontSize: 14, fontWeight: "700" },

  resultsCount: { fontSize: 12, color: "#71717A", paddingHorizontal: 16, paddingVertical: 10 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#A1A1AA" },
  emptySubtitle: { fontSize: 13, color: "#52525B", textAlign: "center" },
}); }
