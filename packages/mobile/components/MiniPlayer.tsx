import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Animated, PanResponder,
} from "react-native";
import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "expo-router";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Pause, SkipForward, SkipBack, Broadcast } from "phosphor-react-native";
import { usePlayerStore } from "../store/playerStore";
import { togglePlayPause, loadAndPlay } from "../lib/player";
import * as Haptics from "expo-haptics";
import { useColors } from "../lib/colors";

const SWIPE_UP_THRESHOLD = -60;

export default function MiniPlayer() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const router = useRouter();
  const { currentTrack, isPlaying, position, duration, radioMode, isFetchingRadio } = usePlayerStore();
  const translateY = useRef(new Animated.Value(100)).current;
  const swipeDelta = useRef(new Animated.Value(0)).current;

  // Slide in/out on track change
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: currentTrack ? 0 : 100,
      useNativeDriver: true,
      tension: 80, friction: 10,
    }).start();
  }, [!!currentTrack]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy < 0) swipeDelta.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < SWIPE_UP_THRESHOLD) {
          // Open full player
          Animated.timing(swipeDelta, { toValue: -120, duration: 150, useNativeDriver: true }).start(() => {
            swipeDelta.setValue(0);
            const track = usePlayerStore.getState().currentTrack;
            if (track) router.push(`/player/${track.videoId}`);
          });
        } else {
          Animated.spring(swipeDelta, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
        }
      },
    })
  ).current;

  if (!currentTrack) return null;

  const progress = duration > 0 ? position / duration : 0;

  const handlePlayPause = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await togglePlayPause();
  };
  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = usePlayerStore.getState().nextTrack(); // updates store → UI instant
    if (next) loadAndPlay(next.videoId); // fire-and-forget
  };
  const handlePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prev = usePlayerStore.getState().prevTrack();
    if (prev) loadAndPlay(prev.videoId);
  };

  const openPlayer = () => router.push(`/player/${currentTrack.videoId}`);

  const combinedY = Animated.add(translateY, swipeDelta);

  return (
    <Animated.View
      style={[s.container, { transform: [{ translateY: combinedY }] }]}
      {...panResponder.panHandlers}
    >
      <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(9,9,11,0.94)" }]} />

      {/* Progress bar */}
      <View style={s.progressBg}>
        <Animated.View style={[s.progressFill, { width: `${Math.min(progress * 100, 100)}%` as any }]} />
      </View>

      {/* Swipe indicator */}
      <View style={s.swipeHint} />

      <TouchableOpacity style={s.content} onPress={openPlayer} activeOpacity={0.85}>
        <Image
          source={{ uri: currentTrack.thumbnail || "https://placehold.co/48x48/18181B/6366F1?text=♪" }}
          style={s.art}
        />
        <View style={s.info}>
          <View style={s.titleRow}>
            <Text style={s.title} numberOfLines={1}>{currentTrack.title}</Text>
            {radioMode && (
              <View style={s.radioBadge}>
                <Broadcast size={9} color="#6366F1" weight="fill" />
              </View>
            )}
          </View>
          <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <View style={s.controls}>
          <TouchableOpacity style={s.controlBtn} onPress={handlePrev} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <SkipBack size={20} color="#fff" weight="fill" />
          </TouchableOpacity>
          <TouchableOpacity style={s.playBtn} onPress={handlePlayPause}>
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={s.playBtnGrad}>
              {isPlaying
                ? <Pause size={18} color="#fff" weight="fill" />
                : <Play size={18} color="#fff" weight="fill" />}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={s.controlBtn} onPress={handleNext} hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
            <SkipForward size={20} color="#fff" weight="fill" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(C: ReturnType<typeof import("../lib/colors").useColors>) { return StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 70,
    left: 0, right: 0,
    height: 68,
    zIndex: 100,
    borderTopWidth: 1,
    borderTopColor: C.border,
    overflow: "hidden",
  },
  swipeHint: {
    width: 32, height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center", marginTop: 6, marginBottom: -4,
  },
  progressBg: { height: 2, backgroundColor: "rgba(255,255,255,0.06)" },
  progressFill: { height: 2, backgroundColor: C.indigo },
  content: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, gap: 10,
  },
  art: { width: 42, height: 42, borderRadius: 8 },
  info: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  title: { fontSize: 13, fontWeight: "700", color: "#fff", flexShrink: 1 },
  radioBadge: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "rgba(99,102,241,0.2)",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  artist: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  controlBtn: { padding: 6 },
  playBtn: { marginHorizontal: 2 },
  playBtnGrad: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
}); }
