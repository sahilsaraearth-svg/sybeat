import { View, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 8, style }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: "#2A2A2A", opacity },
        style,
      ]}
    />
  );
}

export function TrackSkeleton() {
  return (
    <View style={styles.trackRow}>
      <Skeleton width={52} height={52} borderRadius={8} />
      <View style={styles.trackInfo}>
        <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="45%" height={12} />
      </View>
      <Skeleton width={32} height={12} borderRadius={6} />
    </View>
  );
}

export function TrackSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <TrackSkeleton key={i} />
      ))}
    </>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width={140} height={140} borderRadius={12} />
      <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
      <Skeleton width={70} height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 2,
  },
  trackInfo: { flex: 1, marginHorizontal: 12 },
  card: { marginRight: 12, width: 140 },
});
