import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Play, Headphones } from "phosphor-react-native";

const { width: W, height: H } = Dimensions.get("window");

const HEADPHONES_URI =
  "https://storage.googleapis.com/runable-templates/cli-uploads%2FTscRRJTDhTlF0rCIevpdKIFxtbgnycuw%2FEOWNQHuUj4fRoHXuo0lJM%2Fheadphones.png";

export default function IntroScreen() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      {/* Dark background */}
      <LinearGradient
        colors={["#0A1020", "#081018", "#060C14"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Blue ambient glow behind headphones */}
      <View style={styles.glow} pointerEvents="none">
        <LinearGradient
          colors={["rgba(30,100,255,0.45)", "rgba(30,100,255,0.05)", "transparent"]}
          style={{ flex: 1, borderRadius: 300 }}
        />
      </View>

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>

        {/* App name — top center */}
        <Text style={styles.appName}>SyBeat</Text>

        {/* Headphones image — fills most of screen, no card */}
        <View style={styles.imgWrap} pointerEvents="none">
          <Image
            source={{ uri: HEADPHONES_URI }}
            style={styles.headphones}
            resizeMode="contain"
          />

          {/* Sound wave — left */}
          <View style={[styles.waveGroup, styles.waveLeft]}>
            {[10, 18, 12, 20, 14].map((h, i) => (
              <View key={i} style={[styles.waveLine, { height: h }]} />
            ))}
          </View>

          {/* Sound wave — right */}
          <View style={[styles.waveGroup, styles.waveRight]}>
            {[14, 22, 10, 18, 12].map((h, i) => (
              <View key={i} style={[styles.waveLine, { height: h }]} />
            ))}
          </View>
        </View>

        {/* Bottom text + slider */}
        <View style={styles.bottomSection}>
          {/* Headline */}
          <Text style={styles.headline}>Start Your{"\n"}Sonic Journey</Text>

          {/* Subtitle */}
          <Text style={styles.sub}>
            Dive into a world of music — millions of songs, custom{"\n"}playlists, and every genre you love.
          </Text>

          {/* Slider pill bar — exactly like reference */}
          <BlurView intensity={20} tint="dark" style={styles.sliderBar}>
            <LinearGradient
              colors={["rgba(255,255,255,0.07)", "rgba(255,255,255,0.03)"]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <View style={styles.sliderBorder} />

            {/* Left: play/forward button — blue circle */}
            <TouchableOpacity
              style={styles.playCircle}
              onPress={() => router.replace("/(tabs)")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#2D7FFF", "#1A56D6"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Play size={20} color="#FFFFFF" weight="fill" />
            </TouchableOpacity>

            {/* Center text */}
            <TouchableOpacity
              style={styles.sliderTextBtn}
              onPress={() => router.replace("/(tabs)")}
              activeOpacity={0.7}
            >
              <Text style={styles.sliderText}>Turn on your music</Text>
            </TouchableOpacity>

            {/* Right: headphone icon — subtle circle */}
            <View style={styles.headCircle}>
              <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={styles.headCircleBorder} />
              <Headphones size={20} color="rgba(148,185,255,0.75)" />
            </View>
          </BlurView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },

  glow: {
    position: "absolute",
    top: H * 0.05,
    alignSelf: "center",
    width: W * 1.1,
    height: W * 1.1,
  },

  appName: {
    fontSize: 20,
    fontWeight: "700",
    color: "rgba(148,185,255,0.8)",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginTop: 6,
  },

  /* Headphones — no card, just floating image */
  imgWrap: {
    flex: 1,
    width: W,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headphones: {
    width: W * 0.92,
    height: W * 0.92,
  },

  /* Sound waves */
  waveGroup: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  waveLeft: {
    left: W * 0.04,
    bottom: "30%",
  },
  waveRight: {
    right: W * 0.04,
    bottom: "20%",
  },
  waveLine: {
    width: 2.5,
    borderRadius: 2,
    backgroundColor: "rgba(100,160,255,0.55)",
  },

  /* Bottom section */
  bottomSection: {
    width: "100%",
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 10,
  },
  headline: {
    fontSize: 38,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.8,
    lineHeight: 44,
  },
  sub: {
    fontSize: 13,
    color: "rgba(148,185,255,0.5)",
    lineHeight: 19,
    marginBottom: 4,
  },

  /* Slider bar — pill at bottom exactly like reference */
  sliderBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 50,
    overflow: "hidden",
    paddingVertical: 6,
    paddingHorizontal: 6,
    gap: 0,
    marginBottom: 6,
  },
  sliderBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "rgba(148,185,255,0.15)",
  },

  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3884FF",
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },

  sliderTextBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  headCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  headCircleBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(148,185,255,0.2)",
  },
});
