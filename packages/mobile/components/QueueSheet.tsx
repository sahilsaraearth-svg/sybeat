import React, { useEffect, useRef, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, Image, Animated, Alert, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Queue, ArrowUp, ArrowDown, Plus } from "phosphor-react-native";
import { usePlayerStore } from "../store/playerStore";
import { loadAndPlay } from "../lib/player";
import * as Haptics from "expo-haptics";
import { toast } from "./Toast";
import { usePlaylistStore } from "../store/playlistStore";
import type { YouTubeTrack } from "../lib/youtube";
import { useColors } from "../lib/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function QueueSheet({ visible, onClose }: Props) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(600)).current;
  const { queue, currentTrack, setQueue } = usePlayerStore();
  const { playlists, addTrack } = usePlaylistStore();

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 65, friction: 12,
    }).start();
  }, [visible]);

  const handlePlay = async (track: YouTubeTrack, idx: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const store = usePlayerStore.getState();
    store.setQueue(store.queue, idx);
    await loadAndPlay(track.videoId);
  };

  const moveTrack = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= queue.length) return;
    const newQueue = [...queue];
    const [moved] = newQueue.splice(fromIdx, 1);
    newQueue.splice(toIdx, 0, moved);
    const newCurrentIdx = newQueue.findIndex((t) => t.videoId === currentTrack?.videoId);
    setQueue(newQueue, newCurrentIdx >= 0 ? newCurrentIdx : 0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAddToPlaylist = (track: YouTubeTrack) => {
    if (playlists.length === 0) {
      toast.info("No playlists yet — create one in Library");
      return;
    }
    Alert.alert(
      "Add to Playlist",
      "Choose a playlist",
      playlists.map((p) => ({
        text: p.name,
        onPress: () => {
          addTrack(p.id, track);
          toast.success(`Added to "${p.name}"`);
        },
      })).concat([{ text: "Cancel", onPress: () => {}, style: "cancel" } as any]),
    );
  };

  const renderItem = ({ item, index }: { item: YouTubeTrack; index: number }) => {
    const isCurrent = item.videoId === currentTrack?.videoId;

    return (
      <TouchableOpacity
        style={[s.row, isCurrent && s.rowActive]}
        onPress={() => handlePlay(item, index)}
        activeOpacity={0.75}
      >
        <Image
          source={{ uri: item.thumbnail || "https://placehold.co/48x48/18181B/6366F1?text=♪" }}
          style={s.thumb}
        />

        <View style={s.info}>
          <Text style={[s.title, isCurrent && s.titleActive]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={s.artist} numberOfLines={1}>{item.artist}</Text>
        </View>

        {isCurrent && <View style={s.playingDot} />}

        <View style={s.actions}>
          <TouchableOpacity
            style={s.moveBtn}
            onPress={() => moveTrack(index, index - 1)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <ArrowUp size={15} color={index === 0 ? C.zinc700 : C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.moveBtn}
            onPress={() => moveTrack(index, index + 1)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <ArrowDown size={15} color={index === queue.length - 1 ? C.zinc700 : C.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => handleAddToPlaylist(item)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Plus size={16} color={C.muted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[s.sheet, { paddingBottom: insets.bottom + 8, transform: [{ translateY }] }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <Queue size={18} color={C.indigo} weight="fill" />
            <Text style={s.headerTitle}>Queue</Text>
            <Text style={s.headerCount}>{queue.length} tracks</Text>
            <TouchableOpacity onPress={onClose}><X size={18} color={C.muted} /></TouchableOpacity>
          </View>

          <FlatList
            data={queue}
            keyExtractor={(item) => item.videoId}
            renderItem={renderItem}
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/colors").useColors>) { return StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: C.border, paddingTop: 8,
  },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: "#3F3F46", alignSelf: "center", marginBottom: 14 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text },
  headerCount: { fontSize: 13, color: C.muted },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  rowActive: { backgroundColor: "rgba(99,102,241,0.08)" },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600", color: C.text },
  titleActive: { color: C.indigo },
  artist: { fontSize: 12, color: C.muted, marginTop: 2 },
  playingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.indigo },
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
  moveBtn: { padding: 5 },
  addBtn: { padding: 6 },
}); }
