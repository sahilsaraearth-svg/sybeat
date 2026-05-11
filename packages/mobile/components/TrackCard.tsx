import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { DotsThreeVertical, Queue, ShareNetwork, MusicNote, Download, Trash, CheckCircle, Plus } from "phosphor-react-native";
import { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import type { YouTubeTrack } from "../lib/youtube";
import { usePlaylistStore } from "../store/playlistStore";
import { useDownloadStore } from "../store/downloadStore";
import { downloadTrack, deleteDownload } from "../lib/download";
import { toast } from "./Toast";

interface Props {
  track: YouTubeTrack;
  onPress: () => void;
  onPressIn?: () => void;
  onMore?: () => void;
  isPlaying?: boolean;
  showIndex?: number;
}

export default function TrackCard({
  track,
  onPress,
  onPressIn,
  onMore,
  isPlaying,
  showIndex,
}: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [playlistPicker, setPlaylistPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const router = useRouter();
  const { playlists, addTrack, create: createPlaylist } = usePlaylistStore();
  const { isDownloaded, isDownloading } = useDownloadStore();

  const downloaded = isDownloaded(track.videoId);
  const downloading = isDownloading(track.videoId);

  const handleLongPress = useCallback(() => setMenuVisible(true), []);

  const handleDownload = useCallback(async () => {
    setMenuVisible(false);
    if (downloaded) {
      Alert.alert("Remove download?", `"${track.title}" will be removed from offline storage.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteDownload(track.videoId),
        },
      ]);
    } else {
      await downloadTrack(track);
    }
  }, [track, downloaded]);

  const handleAddToPlaylist = useCallback((playlistId: string) => {
    addTrack(playlistId, track);
    toast.success("Added to playlist");
    setPlaylistPicker(false);
    setMenuVisible(false);
  }, [track, addTrack]);

  const handleCreatePlaylist = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const pl = createPlaylist(name);
    addTrack(pl.id, track);
    toast.success(`Added to "${pl.name}"`);
    setNewName("");
    setCreating(false);
    setPlaylistPicker(false);
    setMenuVisible(false);
  }, [newName, track, createPlaylist, addTrack]);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, isPlaying && styles.containerActive]}
        onPress={onPress}
        onPressIn={onPressIn}
        onLongPress={handleLongPress}
        delayLongPress={400}
        activeOpacity={0.7}
      >
        {/* Thumbnail */}
        <View style={styles.thumbWrap}>
          <Image
            source={{
              uri:
                track.thumbnail ||
                "https://placehold.co/150x150/1a1a1a/666?text=♪",
            }}
            style={styles.thumb}
            resizeMode="cover"
          />
          {isPlaying && (
            <View style={styles.playingOverlay}>
              <View style={styles.playingBars}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={[styles.bar, { height: 8 + i * 4 }]} />
                ))}
              </View>
            </View>
          )}
          {showIndex !== undefined && !isPlaying && (
            <View style={styles.indexOverlay}>
              <Text style={styles.indexText}>{showIndex + 1}</Text>
            </View>
          )}
          {downloaded && !isPlaying && (
            <View style={styles.downloadedBadge}>
              <CheckCircle size={12} color="#22C55E" weight="fill" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text
            style={[styles.title, isPlaying && styles.titleActive]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <TouchableOpacity
            onPress={() => track.artist && router.push(`/artist/${encodeURIComponent(track.artist.split(",")[0].trim())}`)}
            activeOpacity={0.6}
            hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
          >
            <Text style={styles.artist} numberOfLines={1}>
              {track.artist}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Duration + More */}
        <View style={styles.right}>
          <Text style={styles.duration}>{track.duration}</Text>
          {onMore ? (
            <TouchableOpacity onPress={onMore} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <DotsThreeVertical size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleLongPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <DotsThreeVertical size={18} color="rgba(255,255,255,0.35)" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* Context Menu */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            {/* Track header */}
            <View style={styles.menuHeader}>
              <Image
                source={{ uri: track.thumbnail || "https://placehold.co/48x48/1a1a1a/666?text=♪" }}
                style={styles.menuThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.menuTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.menuArtist} numberOfLines={1}>{track.artist}</Text>
              </View>
            </View>

            <View style={styles.menuDivider} />

            {/* View Artist */}
            {track.artist && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  router.push(`/artist/${encodeURIComponent(track.artist.split(",")[0].trim())}`);
                }}
              >
                <MusicNote size={18} color="#A78BFA" />
                <Text style={styles.menuItemText}>View Artist</Text>
              </TouchableOpacity>
            )}

            {/* Add to playlist */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setPlaylistPicker(true); }}
            >
              <MusicNote size={18} color="#818CF8" />
              <Text style={styles.menuItemText}>Add to playlist</Text>
            </TouchableOpacity>

            {/* Download */}
            <TouchableOpacity style={styles.menuItem} onPress={handleDownload}>
              {downloading ? (
                <ActivityIndicator size={18} color="#6366F1" />
              ) : downloaded ? (
                <Trash size={18} color="#EF4444" />
              ) : (
                <Download size={18} color="#22C55E" />
              )}
              <Text style={[styles.menuItemText, downloaded && { color: "#EF4444" }]}>
                {downloading ? "Downloading..." : downloaded ? "Remove download" : "Download"}
              </Text>
            </TouchableOpacity>

            {/* Cancel */}
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Playlist Picker */}
      <Modal visible={playlistPicker} transparent animationType="slide" onRequestClose={() => setPlaylistPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setPlaylistPicker(false)}>
          <Pressable style={styles.picker} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Add to playlist</Text>

            {/* Create new */}
            <View style={styles.createRow}>
              <TextInput
                style={styles.createInput}
                placeholder="New playlist name..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleCreatePlaylist}
              />
              <TouchableOpacity
                style={[styles.createBtn, !newName.trim() && { opacity: 0.4 }]}
                onPress={handleCreatePlaylist}
                disabled={!newName.trim() || creating}
              >
                <Plus size={16} color="#fff" weight="bold" />
              </TouchableOpacity>
            </View>

            <View style={styles.menuDivider} />

            {/* Existing playlists */}
            <ScrollView style={{ maxHeight: 260 }}>
              {playlists.length === 0 && (
                <Text style={styles.emptyText}>No playlists yet. Create one above.</Text>
              )}
              {playlists.map((pl) => {
                const alreadyIn = pl.tracks.some((t) => t.videoId === track.videoId);
                return (
                  <TouchableOpacity
                    key={pl.id}
                    style={[styles.playlistRow, alreadyIn && styles.playlistRowAdded]}
                    onPress={() => !alreadyIn && handleAddToPlaylist(pl.id)}
                    disabled={alreadyIn}
                  >
                    <View style={styles.playlistIcon}>
                      {pl.tracks[0]?.thumbnail ? (
                        <Image source={{ uri: pl.tracks[0].thumbnail }} style={{ width: 36, height: 36, borderRadius: 6 }} />
                      ) : (
                        <MusicNote size={18} color="#6366F1" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.playlistName} numberOfLines={1}>{pl.name}</Text>
                      <Text style={styles.playlistCount}>{pl.tracks.length} tracks</Text>
                    </View>
                    {alreadyIn && <CheckCircle size={18} color="#22C55E" weight="fill" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  containerActive: {
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  thumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#222222",
    marginRight: 12,
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },
  playingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  playingBars: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar: { width: 3, backgroundColor: "#6366F1", borderRadius: 2 },
  indexOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  downloadedBadge: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    padding: 1,
  },
  info: { flex: 1, marginRight: 8 },
  title: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", marginBottom: 3 },
  titleActive: { color: "#818CF8" },
  artist: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  right: { alignItems: "flex-end", gap: 6 },
  duration: { fontSize: 12, color: "rgba(255,255,255,0.3)" },

  // Context menu
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menu: {
    backgroundColor: "#18181B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: "#222" },
  menuTitle: { fontSize: 15, fontWeight: "600", color: "#fff", marginBottom: 2 },
  menuArtist: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  menuDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  menuCancel: { marginTop: 4 },
  menuCancelText: { fontSize: 15, color: "rgba(255,255,255,0.4)", fontWeight: "500", paddingHorizontal: 20 },

  // Playlist picker
  picker: {
    backgroundColor: "#18181B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    paddingTop: 16,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  createInput: {
    flex: 1,
    height: 42,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 14,
  },
  createBtn: {
    width: 42,
    height: 42,
    backgroundColor: "#6366F1",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 20,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  playlistRowAdded: { opacity: 0.5 },
  playlistIcon: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(99,102,241,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  playlistName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  playlistCount: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 },
});
