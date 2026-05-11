import React, { useEffect, useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Image, TextInput, Alert, ScrollView, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  MusicNotes, Clock, ChartBar, Plus, Trash, PencilSimple,
  Play, Heart, List, Download, MagnifyingGlass, User,
  Bell, ArrowRight, Shuffle,
} from "phosphor-react-native";
import { usePlaylistStore, type Playlist } from "../../store/playlistStore";
import { useRecentStore } from "../../store/recentStore";
import { useLikedStore } from "../../store/likedStore";
import { useStatsStore } from "../../store/statsStore";
import { usePlayerStore } from "../../store/playerStore";
import { useDownloadStore } from "../../store/downloadStore";
import { useAuthStore } from "../../store/authStore";
import { loadAndPlay } from "../../lib/player";
import { deleteDownload } from "../../lib/download";
import { toast } from "../../components/Toast";
import type { YouTubeTrack } from "../../lib/youtube";
import { useColors } from "../../lib/colors";

const { width: W } = Dimensions.get("window");
const CARD_W = (W - 48) / 2;

type Tab = "overview" | "playlists" | "recent" | "liked" | "downloads" | "stats";

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function PlaylistCard({ playlist, onPress, onDelete, onRename }: {
  playlist: Playlist;
  onPress: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const C = useColors();
  const pl = useMemo(() => StyleSheet.create({
    card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg2, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border },
    thumbGrid: { width: 52, height: 52, borderRadius: 10, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
    thumbCell: { width: 26, height: 26 },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 15, fontWeight: "700", color: C.text },
    cardCount: { fontSize: 12, color: C.muted, marginTop: 3 },
    cardActions: { flexDirection: "row", gap: 6 },
    iconBtn: { padding: 6 },
  }), [C]);
  const thumbs = playlist.tracks.slice(0, 4).map((t) => t.thumbnail).filter(Boolean);
  return (
    <TouchableOpacity style={pl.card} onPress={onPress}>
      {thumbs.length > 0 ? (
        <View style={pl.thumbGrid}>
          {thumbs.slice(0, 4).map((uri, i) => (
            <Image key={i} source={{ uri }} style={pl.thumbCell} />
          ))}
        </View>
      ) : (
        <View style={[pl.thumbGrid, { backgroundColor: C.zinc800, alignItems: "center", justifyContent: "center" }]}>
          <MusicNotes size={28} color={C.indigo} />
        </View>
      )}
      <View style={pl.cardInfo}>
        <Text style={pl.cardName} numberOfLines={1}>{playlist.name}</Text>
        <Text style={pl.cardCount}>{playlist.tracks.length} tracks</Text>
      </View>
      <View style={pl.cardActions}>
        <TouchableOpacity onPress={onRename} style={pl.iconBtn}>
          <PencilSimple size={16} color={C.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={pl.iconBtn}>
          <Trash size={16} color="#f87171" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function TrackRow({ track, onPress }: { track: YouTubeTrack; onPress: () => void }) {
  const C = useColors();
  const tr = useMemo(() => StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
    thumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: C.zinc800 },
    info: { flex: 1 },
    title: { fontSize: 14, fontWeight: "600", color: C.text },
    artist: { fontSize: 12, color: C.muted, marginTop: 2 },
  }), [C]);
  return (
    <TouchableOpacity style={tr.row} onPress={onPress} activeOpacity={0.7}>
      <Image source={{ uri: track.thumbnail || "https://placehold.co/40x40/18181B/6366F1?text=♪" }} style={tr.thumb} />
      <View style={tr.info}>
        <Text style={tr.title} numberOfLines={1}>{track.title}</Text>
        <Text style={tr.artist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Play size={16} color={C.muted} weight="fill" />
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const [tab, setTab] = useState<Tab>("overview");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  const { playlists, hydrate: hydratePl, create, rename, delete: deletePl } = usePlaylistStore();
  const { tracks: recent, hydrate: hydrateRecent } = useRecentStore();
  const { likedTracks: liked } = useLikedStore();
  const { totalSeconds, topTracks, topArtists, hydrate: hydrateStats } = useStatsStore();
  const { downloads } = useDownloadStore();
  const { user } = useAuthStore();

  useEffect(() => {
    hydratePl();
    hydrateRecent();
    hydrateStats();
  }, []);

  const { setQueue } = usePlayerStore();

  const playTrack = async (track: YouTubeTrack, queue: YouTubeTrack[], idx: number) => {
    setQueue(queue, idx);
    await loadAndPlay(track.videoId);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    create(newName.trim());
    setNewName("");
    setShowCreate(false);
    toast.success(`Playlist "${newName}" created`);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Playlist", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { deletePl(id); toast.info("Playlist deleted"); } },
    ]);
  };

  const handleRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      rename(editingId, editName.trim());
      toast.success("Playlist renamed");
    }
    setEditingId(null);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "playlists", label: "Playlists" },
    { id: "recent", label: "Recent" },
    { id: "liked", label: "Liked" },
    { id: "downloads", label: "Offline" },
    { id: "stats", label: "Stats" },
  ];

  // Playlist detail view
  if (selectedPlaylist) {
    const p = playlists.find((pl) => pl.id === selectedPlaylist.id) ?? selectedPlaylist;
    return (
      <SafeAreaView style={s.safe}>
        <LinearGradient colors={["#0F0A1E", "#09090B"]} style={StyleSheet.absoluteFillObject} />
        <View style={s.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={s.backBtn}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.detailTitle} numberOfLines={1}>{p.name}</Text>
          <Text style={s.detailCount}>{p.tracks.length} tracks</Text>
        </View>
        {p.tracks.length === 0 ? (
          <View style={s.empty}>
            <MusicNotes size={40} color={C.muted} />
            <Text style={s.emptyText}>No tracks yet</Text>
            <Text style={s.emptyHint}>Long-press any track to add to playlist</Text>
          </View>
        ) : (
          <FlatList
            data={p.tracks}
            keyExtractor={(t) => t.videoId}
            renderItem={({ item, index }) => (
              <TrackRow track={item} onPress={() => playTrack(item, p.tracks, index)} />
            )}
            contentContainerStyle={{ paddingBottom: 140 }}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient colors={["#0F0A1E", "#09090B", "#09090B"]} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.heading}>Library</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.headerBtn}>
            <Bell size={19} color={C.muted} />
          </TouchableOpacity>
          {tab === "playlists" && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowCreate(true)}>
              <Plus size={18} color="#fff" weight="bold" />
            </TouchableOpacity>
          )}
          <View style={s.avatarBtn}>
            <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
            <Text style={s.avatarText}>{(user?.email?.[0] ?? "?").toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.tabRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[s.tabBtn, tab === t.id && s.tabBtnActive]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Create playlist modal */}
      {showCreate && (
        <View style={s.createBox}>
          <TextInput
            style={s.input}
            placeholder="Playlist name..."
            placeholderTextColor={C.muted}
            value={newName}
            onChangeText={setNewName}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.createCancelBtn} onPress={() => { setShowCreate(false); setNewName(""); }}>
              <Text style={{ color: C.muted, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.createConfirmBtn} onPress={handleCreate}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rename modal */}
      {editingId && (
        <View style={s.createBox}>
          <TextInput
            style={s.input}
            value={editName}
            onChangeText={setEditName}
            autoFocus
            onSubmitEditing={confirmRename}
            placeholderTextColor={C.muted}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={s.createCancelBtn} onPress={() => setEditingId(null)}>
              <Text style={{ color: C.muted, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.createConfirmBtn} onPress={confirmRename}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Rename</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── OVERVIEW TAB ── big grid cards like the mockup */}
      {tab === "overview" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 12, paddingTop: 8 }}>
          <View style={ov.grid}>
            {/* Liked Songs */}
            <TouchableOpacity style={ov.card} onPress={() => setTab("liked")} activeOpacity={0.8}>
              <LinearGradient colors={["#1E1B4B", "#312E81"]} style={StyleSheet.absoluteFillObject} />
              {liked.length > 0 ? (
                <Image source={{ uri: liked[0].thumbnail }} style={ov.cardBg} />
              ) : null}
              <LinearGradient colors={["rgba(30,27,75,0.5)", "rgba(30,27,75,0.95)"]} style={StyleSheet.absoluteFillObject} />
              <Heart size={26} color="#fff" weight="fill" style={{ marginBottom: 8 }} />
              <Text style={ov.cardTitle}>Liked Songs</Text>
              <Text style={ov.cardSub}>{liked.length} songs</Text>
            </TouchableOpacity>

            {/* Downloads */}
            <TouchableOpacity style={ov.card} onPress={() => setTab("downloads")} activeOpacity={0.8}>
              <LinearGradient colors={["#0C2340", "#0F3050"]} style={StyleSheet.absoluteFillObject} />
              {downloads.length > 0 ? (
                <Image source={{ uri: downloads[0].thumbnail }} style={ov.cardBg} />
              ) : null}
              <LinearGradient colors={["rgba(12,35,64,0.5)", "rgba(12,35,64,0.95)"]} style={StyleSheet.absoluteFillObject} />
              <Download size={26} color="#fff" weight="fill" style={{ marginBottom: 8 }} />
              <Text style={ov.cardTitle}>Downloads</Text>
              <Text style={ov.cardSub}>{downloads.length} songs</Text>
            </TouchableOpacity>

            {/* Playlists */}
            <TouchableOpacity style={ov.card} onPress={() => setTab("playlists")} activeOpacity={0.8}>
              <LinearGradient colors={["#1A0A2E", "#2D1B4E"]} style={StyleSheet.absoluteFillObject} />
              {playlists[0]?.tracks[0]?.thumbnail ? (
                <Image source={{ uri: playlists[0].tracks[0].thumbnail }} style={ov.cardBg} />
              ) : null}
              <LinearGradient colors={["rgba(26,10,46,0.5)", "rgba(26,10,46,0.95)"]} style={StyleSheet.absoluteFillObject} />
              <List size={26} color="#fff" weight="fill" style={{ marginBottom: 8 }} />
              <Text style={ov.cardTitle}>Playlists</Text>
              <Text style={ov.cardSub}>{playlists.length} playlists</Text>
            </TouchableOpacity>

            {/* Recent */}
            <TouchableOpacity style={ov.card} onPress={() => setTab("recent")} activeOpacity={0.8}>
              <LinearGradient colors={["#0D1F12", "#143320"]} style={StyleSheet.absoluteFillObject} />
              {recent[0]?.thumbnail ? (
                <Image source={{ uri: recent[0].thumbnail }} style={ov.cardBg} />
              ) : null}
              <LinearGradient colors={["rgba(13,31,18,0.5)", "rgba(13,31,18,0.95)"]} style={StyleSheet.absoluteFillObject} />
              <Clock size={26} color="#fff" weight="fill" style={{ marginBottom: 8 }} />
              <Text style={ov.cardTitle}>Recent</Text>
              <Text style={ov.cardSub}>{recent.length} tracks</Text>
            </TouchableOpacity>
          </View>

          {/* Stats quick card */}
          <TouchableOpacity style={ov.statsCard} onPress={() => setTab("stats")} activeOpacity={0.85}>
            <LinearGradient colors={["#1e1b4b", "#312e81"]} style={StyleSheet.absoluteFillObject} />
            <View style={{ flex: 1 }}>
              <Text style={ov.statsLabel}>Listening Time</Text>
              <Text style={ov.statsVal}>{fmtTime(totalSeconds)}</Text>
            </View>
            <ChartBar size={32} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>

          {/* Recent tracks quick list */}
          {recent.length > 0 && (
            <>
              <View style={[s.sectionRow, { marginTop: 8 }]}>
                <Text style={s.sectionTitle}>Recently Played</Text>
                <TouchableOpacity onPress={() => setTab("recent")} style={s.seeAll}>
                  <Text style={s.seeAllText}>See all</Text>
                  <ArrowRight size={13} color={C.indigo} />
                </TouchableOpacity>
              </View>
              {recent.slice(0, 5).map((t, i) => (
                <TrackRow key={t.videoId + i} track={t} onPress={() => playTrack(t, recent, i)} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── PLAYLISTS TAB ── */}
      {tab === "playlists" && (
        playlists.length === 0 ? (
          <View style={s.empty}>
            <List size={40} color={C.muted} />
            <Text style={s.emptyText}>No playlists yet</Text>
            <TouchableOpacity style={s.createFirstBtn} onPress={() => setShowCreate(true)}>
              <Text style={{ color: C.indigo, fontWeight: "700" }}>Create your first playlist</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <PlaylistCard
                playlist={item}
                onPress={() => setSelectedPlaylist(item)}
                onDelete={() => handleDelete(item.id, item.name)}
                onRename={() => handleRename(item.id, item.name)}
              />
            )}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 10, paddingTop: 8 }}
          />
        )
      )}

      {/* ── RECENT TAB ── */}
      {tab === "recent" && (
        recent.length === 0 ? (
          <View style={s.empty}>
            <Clock size={40} color={C.muted} />
            <Text style={s.emptyText}>No recent tracks</Text>
          </View>
        ) : (
          <FlatList
            data={recent}
            keyExtractor={(t, i) => `${t.videoId}-${i}`}
            renderItem={({ item, index }) => (
              <TrackRow track={item} onPress={() => playTrack(item, recent, index)} />
            )}
            contentContainerStyle={{ paddingBottom: 140 }}
          />
        )
      )}

      {/* ── LIKED TAB ── */}
      {tab === "liked" && (
        liked.length === 0 ? (
          <View style={s.empty}>
            <Heart size={40} color={C.muted} />
            <Text style={s.emptyText}>No liked tracks yet</Text>
          </View>
        ) : (
          <FlatList
            data={liked}
            keyExtractor={(t) => t.videoId}
            ListHeaderComponent={
              <TouchableOpacity style={ov.shuffleBar} onPress={async () => {
                if (!liked.length) return;
                const shuffled = [...liked].sort(() => Math.random() - 0.5);
                setQueue(shuffled, 0);
                await loadAndPlay(shuffled[0].videoId);
              }}>
                <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
                <Shuffle size={18} color="#fff" />
                <Text style={ov.shuffleText}>Shuffle All ({liked.length})</Text>
              </TouchableOpacity>
            }
            renderItem={({ item, index }) => (
              <TrackRow track={item} onPress={() => playTrack(item, liked, index)} />
            )}
            contentContainerStyle={{ paddingBottom: 140 }}
          />
        )
      )}

      {/* ── DOWNLOADS TAB ── */}
      {tab === "downloads" && (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.videoId}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 60, gap: 10 }}>
              <Download size={40} color="rgba(255,255,255,0.15)" />
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No offline tracks</Text>
              <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", paddingHorizontal: 40 }}>
                Long-press any track or tap the download icon in the player
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}>
              <Image source={{ uri: item.thumbnail }} style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: "#222" }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }} numberOfLines={1}>{item.title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 }}>{item.artist}</Text>
                {item.fileSize && (
                  <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 1 }}>
                    {(item.fileSize / 1024 / 1024).toFixed(1)} MB
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity onPress={() => {
                  const { setTrack } = usePlayerStore.getState();
                  setTrack(item, downloads, downloads.indexOf(item));
                  loadAndPlay(item.videoId);
                }}>
                  <Play size={20} color="#6366F1" weight="fill" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  Alert.alert("Remove", `Remove "${item.title}" from downloads?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Remove", style: "destructive", onPress: () => deleteDownload(item.videoId) },
                  ]);
                }}>
                  <Trash size={20} color="#EF4444" weight="fill" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}
        />
      )}

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 20, paddingTop: 8 }}>
          <LinearGradient colors={["#1e1b4b", "#312e81"]} style={s.statTotalCard}>
            <Text style={s.statTotalLabel}>Total Listening Time</Text>
            <Text style={s.statTotalValue}>{fmtTime(totalSeconds)}</Text>
          </LinearGradient>

          <View>
            <Text style={s.statSectionTitle}>Top Tracks</Text>
            {topTracks(5).length === 0 ? (
              <Text style={s.statNoData}>Play some music to see stats</Text>
            ) : (
              topTracks(5).map((t, i) => (
                <View key={t.videoId} style={s.statRow}>
                  <Text style={s.statRank}>{i + 1}</Text>
                  <Image source={{ uri: t.thumbnail }} style={s.statThumb} />
                  <View style={s.statInfo}>
                    <Text style={s.statTrackTitle} numberOfLines={1}>{t.title}</Text>
                    <Text style={s.statTrackArtist}>{t.artist}</Text>
                  </View>
                  <Text style={s.statPlays}>{t.plays}x</Text>
                </View>
              ))
            )}
          </View>

          <View>
            <Text style={s.statSectionTitle}>Top Artists</Text>
            {topArtists(5).length === 0 ? (
              <Text style={s.statNoData}>Play some music to see stats</Text>
            ) : (
              topArtists(5).map((a, i) => (
                <View key={a.name} style={s.statRow}>
                  <Text style={s.statRank}>{i + 1}</Text>
                  <View style={s.statArtistAvatar}>
                    <Text style={s.statArtistInitial}>{a.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={s.statInfo}>
                    <Text style={s.statTrackTitle} numberOfLines={1}>{a.name}</Text>
                    <Text style={s.statTrackArtist}>{fmtTime(a.totalSeconds)} listened</Text>
                  </View>
                  <Text style={s.statPlays}>{a.plays}x</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(C: ReturnType<typeof import("../../lib/colors").useColors>) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10,
  },
  heading: { flex: 1, fontSize: 28, fontWeight: "800", color: C.text, letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(24,24,27,0.7)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.5)",
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.indigo, alignItems: "center", justifyContent: "center",
  },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15, zIndex: 2 },

  tabRow: { marginBottom: 8 },
  tabBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.bg2,
  },
  tabBtnActive: { borderColor: C.indigo, backgroundColor: C.indigoDim },
  tabText: { fontSize: 13, fontWeight: "600", color: C.muted },
  tabTextActive: { color: C.indigo },

  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: C.text, letterSpacing: -0.3 },
  seeAll: { flexDirection: "row", alignItems: "center", gap: 4 },
  seeAllText: { fontSize: 13, color: C.indigo, fontWeight: "600" },

  createBox: {
    margin: 16, padding: 16, backgroundColor: C.bg2,
    borderRadius: 16, borderWidth: 1, borderColor: C.border, gap: 12,
  },
  input: {
    backgroundColor: "#27272A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: C.text, fontSize: 15,
  },
  createCancelBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: "#27272A",
  },
  createConfirmBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: C.indigo,
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 16, color: C.muted, fontWeight: "600" },
  emptyHint: { fontSize: 13, color: "#52525B", textAlign: "center", paddingHorizontal: 40 },
  createFirstBtn: { marginTop: 4 },
  backBtn: { marginRight: 12 },
  backText: { color: C.indigo, fontSize: 15, fontWeight: "600" },
  detailHeader: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  detailTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: C.text },
  detailCount: { fontSize: 13, color: C.muted },
  // stats tab
  statTotalCard: { borderRadius: 18, padding: 20, alignItems: "center" as const, gap: 6 },
  statTotalLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "600" as const },
  statTotalValue: { fontSize: 36, fontWeight: "800" as const, color: "#fff" },
  statSectionTitle: { fontSize: 16, fontWeight: "700" as const, color: C.text, marginBottom: 10 },
  statNoData: { fontSize: 14, color: C.muted, fontStyle: "italic" as const },
  statRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, marginBottom: 12 },
  statRank: { width: 20, fontSize: 13, fontWeight: "700" as const, color: C.muted, textAlign: "center" as const },
  statThumb: { width: 42, height: 42, borderRadius: 8, backgroundColor: C.zinc800 },
  statArtistAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.zinc800, alignItems: "center" as const, justifyContent: "center" as const },
  statArtistInitial: { fontSize: 18, fontWeight: "800" as const, color: C.indigo },
  statInfo: { flex: 1 },
  statTrackTitle: { fontSize: 13, fontWeight: "600" as const, color: C.text },
  statTrackArtist: { fontSize: 12, color: C.muted, marginTop: 2 },
  statPlays: { fontSize: 12, fontWeight: "700" as const, color: C.indigo },
}); }

const ov = StyleSheet.create({
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    marginBottom: 12,
  },
  card: {
    width: CARD_W, height: 130, borderRadius: 16, overflow: "hidden",
    padding: 16, justifyContent: "flex-end",
    borderWidth: 1, borderColor: "rgba(63,63,70,0.3)",
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject as any,
    width: "100%", height: "100%", opacity: 0.35,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#FAFAFA", letterSpacing: -0.3 },
  cardSub: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3 },

  statsCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    overflow: "hidden", padding: 20,
    borderWidth: 1, borderColor: "rgba(99,102,241,0.3)",
  },
  statsLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: "600", marginBottom: 4 },
  statsVal: { fontSize: 28, fontWeight: "900", color: "#fff" },

  shuffleBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    overflow: "hidden", borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12,
    marginHorizontal: 16, marginBottom: 12, marginTop: 8,
  },
  shuffleText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
