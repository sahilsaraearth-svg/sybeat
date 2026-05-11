import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect, useMemo } from "react";
import {
  PencilSimple, SignOut, Trash, Lock,
  EnvelopeSimple, User, X, Camera,
  Timer, CaretRight,
  Sliders, Bell, Download, Moon,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/authStore";
import { useLikedStore } from "../../store/likedStore";
import { usePlayerStore } from "../../store/playerStore";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useColors } from "../../lib/colors";
import { useThemeStore } from "../../store/themeStore";

const { width: SW } = Dimensions.get("window");

const AVATAR_KEY = "sybeat_avatar_uri";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return ""; }
}

// ─── Bottom Sheet Modal ───────────────────────────────────────────────────────
function BottomSheet({
  visible, onClose, title, children,
}: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={s.sheetClose}>
                <X size={16} color={C.zinc400} />
              </TouchableOpacity>
            </View>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────
function SettingsRow({
  icon, label, value, onPress, danger, right, iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  iconBg?: string;
}) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const content = (
    <View style={s.settingsRow}>
      <View style={[s.settingsIcon, { backgroundColor: iconBg ?? "rgba(99,102,241,0.15)" }]}>
        {icon}
      </View>
      <View style={s.settingsLabel}>
        <Text style={[s.settingsText, danger && { color: C.rose }]}>{label}</Text>
        {value ? <Text style={s.settingsValue}>{value}</Text> : null}
      </View>
      {right ?? (onPress ? <CaretRight size={15} color={C.zinc500} /> : null)}
    </View>
  );
  if (onPress) return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.65}>{content}</TouchableOpacity>
  );
  return content;
}

// ─── Section ─────────────────────────────────────────────────────────────────
function Section({ children, style }: { children: React.ReactNode; style?: any }) {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return <View style={[s.section, style]}>{children}</View>;
}

// ─── Divider ──────────────────────────────────────────────────────────────────
function Divider() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  return <View style={s.divider} />;
}

export default function ProfileScreen() {
  const C = useColors();
  const s = useMemo(() => makeStyles(C), [C]);
  const { isDark, setDark } = useThemeStore();
  const router = useRouter();
  const { user, logout, updateProfile, changePassword, deleteAccount, isLoading } = useAuthStore();
  const { likedTracks } = useLikedStore();
  const { currentTrack, crossfadeDuration, setCrossfadeDuration } = usePlayerStore();

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState(user?.name ?? "");
  const [editEmail, setEditEmail] = useState(user?.email ?? "");
  const [pwVisible, setPwVisible] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [eqPreset, setEqPreset] = useState("Normal");
  const [notifs, setNotifs] = useState(true);
  const [downloadHQ, setDownloadHQ] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AVATAR_KEY).then((uri) => { if (uri) setAvatarUri(uri); });
  }, []);

  const initials = (user?.name ?? "?").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  const pickAvatar = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to set a profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUri(uri);
      await AsyncStorage.setItem(AVATAR_KEY, uri);
    }
  };

  const handleSaveProfile = async () => {
    try { await updateProfile({ name: editName, email: editEmail }); setEditVisible(false); }
    catch (err: any) { Alert.alert("Error", err?.message ?? "Update failed"); }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { Alert.alert("Mismatch", "Passwords don't match"); return; }
    if (newPw.length < 6) { Alert.alert("Too short", "Min 6 characters"); return; }
    try {
      await changePassword(curPw, newPw);
      setPwVisible(false); setCurPw(""); setNewPw(""); setConfirmPw("");
      Alert.alert("Done", "Password changed.");
    } catch (err: any) { Alert.alert("Error", err?.message ?? "Failed"); }
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => logout() },
    ]);
  };

  const handleDelete = () => {
    Alert.alert("Delete account", "This is permanent and cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { try { await deleteAccount(); } catch (err: any) { Alert.alert("Error", err?.message); } } },
    ]);
  };

  if (!user) return null;

  const likedCount = likedTracks.length;

  return (
    <View style={s.root}>
      {/* Ambient gradient */}
      <LinearGradient
        colors={["rgba(99,102,241,0.15)", "transparent"]}
        style={s.ambientTop}
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
        >

          {/* ── Hero ── */}
          <View style={s.hero}>
            {/* Avatar */}
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85} style={s.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.avatarImg} />
              ) : (
                <LinearGradient
                  colors={["#818CF8", C.indigo, C.indigoDark]}
                  style={s.avatarGrad}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                >
                  <Text style={s.avatarLetters}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={s.cameraBadge}>
                <Camera size={11} color="#fff" weight="fill" />
              </View>
            </TouchableOpacity>

            <Text style={s.heroName}>{user.name}</Text>
            <Text style={s.heroEmail}>{user.email}</Text>

            <View style={s.heroBadgeRow}>
              <View style={s.badge}>
                <Text style={s.badgeText}>FREE</Text>
              </View>
              <View style={[s.badge, s.badgeMuted]}>
                <Text style={s.badgeMutedText}>Since {formatDate(user.createdAt)}</Text>
              </View>
            </View>

            {/* Edit button */}
            <TouchableOpacity
              style={s.editBtn}
              activeOpacity={0.8}
              onPress={() => { setEditName(user.name); setEditEmail(user.email); setEditVisible(true); }}
            >
              <PencilSimple size={14} color="#fff" weight="bold" />
              <Text style={s.editBtnText}>Edit profile</Text>
            </TouchableOpacity>
          </View>

          {/* ── Stats strip ── */}
          <View style={s.statsStrip}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{likedCount}</Text>
              <Text style={s.statLbl}>Liked</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{likedCount > 0 ? "🔥" : "—"}</Text>
              <Text style={s.statLbl}>Streak</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{currentTrack ? "▶" : "—"}</Text>
              <Text style={s.statLbl}>Playing</Text>
            </View>
          </View>

          {/* ── Now playing ── */}
          {currentTrack && (
            <TouchableOpacity
              style={s.nowPlaying}
              onPress={() => router.push(`/player/${currentTrack.videoId}`)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[C.indigoDim, "rgba(99,102,241,0.04)"]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              />
              <View style={s.nowStripe} />
              <Image source={{ uri: currentTrack.thumbnail }} style={s.nowArt} />
              <View style={{ flex: 1 }}>
                <Text style={s.nowLabel}>NOW PLAYING</Text>
                <Text style={s.nowTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <Text style={s.nowArtist} numberOfLines={1}>{currentTrack.artist}</Text>
              </View>
              <CaretRight size={16} color={C.indigo} />
            </TouchableOpacity>
          )}

          {/* ── Liked tracks strip ── */}
          {likedTracks.length > 0 && (
            <View>
              <View style={s.rowHeader}>
                <Text style={s.sectionTitle}>Liked Tracks</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/library")}>
                  <Text style={s.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tracksRow}>
                {likedTracks.slice(0, 12).map((track: any, i: number) => (
                  <TouchableOpacity
                    key={`${track.videoId}-${i}`}
                    style={s.trackCard}
                    activeOpacity={0.75}
                    onPress={() => router.push("/(tabs)/library")}
                  >
                    <Image source={{ uri: track.thumbnail }} style={s.trackThumb} />
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.75)"]}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={s.trackTitle} numberOfLines={2}>{track.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Account ── */}
          <Text style={s.groupLabel}>ACCOUNT</Text>
          <Section>
            <SettingsRow
              icon={<User size={15} color={C.indigo} weight="fill" />}
              label="Edit Profile"
              value={user.name}
              onPress={() => { setEditName(user.name); setEditEmail(user.email); setEditVisible(true); }}
            />
            <Divider />
            <SettingsRow
              icon={<EnvelopeSimple size={15} color={C.indigo} weight="fill" />}
              label="Email"
              value={user.email}
            />
            <Divider />
            <SettingsRow
              icon={<Lock size={15} color={C.violet} weight="fill" />}
              iconBg="rgba(139,92,246,0.15)"
              label="Change Password"
              onPress={() => { setCurPw(""); setNewPw(""); setConfirmPw(""); setPwVisible(true); }}
            />
          </Section>

          {/* ── Playback ── */}
          <Text style={s.groupLabel}>PLAYBACK</Text>
          <Section>
            <SettingsRow
              icon={<Timer size={15} color={C.emerald} weight="fill" />}
              iconBg="rgba(16,185,129,0.15)"
              label="Crossfade"
              value={crossfadeDuration === 0 ? "Off" : `${crossfadeDuration}s`}
            />
            {/* Crossfade chips */}
            <View style={s.chipsRow}>
              {[0, 1, 2, 3, 5, 8].map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[s.chip, crossfadeDuration === v && s.chipActive]}
                  onPress={() => setCrossfadeDuration(v)}
                >
                  <Text style={[s.chipText, crossfadeDuration === v && s.chipTextActive]}>
                    {v === 0 ? "Off" : `${v}s`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Divider />
            <SettingsRow
              icon={<Sliders size={15} color={C.amber} weight="fill" />}
              iconBg="rgba(245,158,11,0.15)"
              label="Equalizer"
              value={eqPreset}
            />
            {/* EQ chips */}
            <View style={[s.chipsRow, { flexWrap: "wrap" }]}>
              {["Normal", "Bass Boost", "Vocal", "Electronic", "Rock", "Jazz", "Hip-Hop"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.chip, eqPreset === p && s.chipActive]}
                  onPress={() => setEqPreset(p)}
                >
                  <Text style={[s.chipText, eqPreset === p && s.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Divider />
            <SettingsRow
              icon={<Download size={15} color={C.indigo} weight="fill" />}
              label="High Quality Downloads"
              right={
                <Switch
                  value={downloadHQ}
                  onValueChange={setDownloadHQ}
                  thumbColor={downloadHQ ? C.indigo : C.zinc500}
                  trackColor={{ false: C.zinc800, true: C.indigoDim }}
                />
              }
            />
          </Section>

          {/* ── Preferences ── */}
          <Text style={s.groupLabel}>PREFERENCES</Text>
          <Section>
            <SettingsRow
              icon={<Bell size={15} color={C.amber} weight="fill" />}
              iconBg="rgba(245,158,11,0.15)"
              label="Notifications"
              right={
                <Switch
                  value={notifs}
                  onValueChange={setNotifs}
                  thumbColor={notifs ? C.indigo : C.zinc500}
                  trackColor={{ false: C.zinc800, true: C.indigoDim }}
                />
              }
            />
            <Divider />
            <SettingsRow
              icon={<Moon size={15} color={C.violet} weight="fill" />}
              iconBg="rgba(139,92,246,0.15)"
              label="Dark Mode"
              right={
                <Switch
                  value={isDark}
                  onValueChange={setDark}
                  thumbColor={isDark ? C.indigo : C.zinc500}
                  trackColor={{ false: C.zinc800, true: C.indigoDim }}
                />
              }
            />
          </Section>

          {/* ── Security / Danger ── */}
          <Text style={s.groupLabel}>SESSION</Text>
          <Section>
            <SettingsRow
              icon={<SignOut size={15} color={C.amber} weight="fill" />}
              iconBg="rgba(245,158,11,0.15)"
              label="Sign Out"
              onPress={handleLogout}
            />
            <Divider />
            <SettingsRow
              icon={<Trash size={15} color={C.rose} weight="fill" />}
              iconBg="rgba(244,63,94,0.15)"
              label="Delete Account"
              danger
              onPress={handleDelete}
            />
          </Section>

          {/* App version */}
          <Text style={s.version}>Sybeat v1.0.0  ·  Made with ♥</Text>

          <View style={{ height: 160 }} />
        </ScrollView>
      </SafeAreaView>

      {/* ── Edit Profile Sheet ── */}
      <BottomSheet visible={editVisible} onClose={() => setEditVisible(false)} title="Edit Profile">
        {/* Avatar picker */}
        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={s.sheetAvatarWrap}>
          <View style={s.sheetAvatar}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={s.sheetAvatarImg} />
              : <Text style={s.sheetAvatarInitials}>{initials}</Text>}
          </View>
          <View style={s.sheetAvatarBadge}>
            <Camera size={14} color="#fff" weight="bold" />
          </View>
          <Text style={s.sheetAvatarHint}>Tap to change photo</Text>
        </TouchableOpacity>
        <View style={s.sheetFields}>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Full Name</Text>
            <TextInput
              style={s.fieldInput}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={C.zinc500}
              placeholder="Your name"
              autoCapitalize="words"
            />
          </View>
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              style={s.fieldInput}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholderTextColor={C.zinc500}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveProfile} disabled={isLoading} activeOpacity={0.85}>
          <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>
      </BottomSheet>

      {/* ── Change Password Sheet ── */}
      <BottomSheet visible={pwVisible} onClose={() => setPwVisible(false)} title="Change Password">
        <View style={s.sheetFields}>
          {[
            { label: "Current Password", val: curPw, set: setCurPw },
            { label: "New Password", val: newPw, set: setNewPw },
            { label: "Confirm New Password", val: confirmPw, set: setConfirmPw },
          ].map((f) => (
            <View key={f.label} style={s.fieldWrap}>
              <Text style={s.fieldLabel}>{f.label}</Text>
              <TextInput
                style={s.fieldInput}
                value={f.val}
                onChangeText={f.set}
                secureTextEntry
                placeholderTextColor={C.zinc500}
                placeholder="••••••••"
                autoCapitalize="none"
              />
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.saveBtn} onPress={handleChangePassword} disabled={isLoading} activeOpacity={0.85}>
          <LinearGradient colors={[C.indigo, C.indigoDark]} style={StyleSheet.absoluteFillObject} />
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnText}>Update Password</Text>}
        </TouchableOpacity>
      </BottomSheet>
    </View>
  );
}

function makeStyles(C: ReturnType<typeof import("../../lib/colors").useColors>) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { paddingBottom: 20 },

  ambientTop: {
    position: "absolute", top: -60, left: -60, right: -60,
    height: 340, borderRadius: 200,
  },

  // ── Hero ──
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  avatarWrap: { position: "relative", marginBottom: 16 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: C.indigo },
  avatarGrad: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  avatarLetters: { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  cameraBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: C.indigo,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.bg,
  },
  heroName: { fontSize: 24, fontWeight: "800", color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  heroEmail: { fontSize: 14, color: C.zinc400, marginBottom: 12 },
  heroBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: C.indigoDim, borderWidth: 1, borderColor: C.indigoBorder,
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#818CF8", letterSpacing: 1.5 },
  badgeMuted: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" },
  badgeMutedText: { fontSize: 10, fontWeight: "600", color: C.zinc500, letterSpacing: 0.5 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: C.indigo, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 24,
  },
  editBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // ── Stats strip ──
  statsStrip: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    paddingVertical: 16,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 20, fontWeight: "800", color: C.text },
  statLbl: { fontSize: 11, color: C.zinc500, fontWeight: "600" },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },

  // ── Now playing ──
  nowPlaying: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginBottom: 20, padding: 14,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: C.indigoBorder,
  },
  nowStripe: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: C.indigo,
  },
  nowArt: { width: 46, height: 46, borderRadius: 10, backgroundColor: C.zinc800 },
  nowLabel: { fontSize: 9, color: C.indigo, fontWeight: "800", letterSpacing: 2, marginBottom: 3 },
  nowTitle: { fontSize: 14, fontWeight: "700", color: C.text, marginBottom: 2 },
  nowArtist: { fontSize: 12, color: C.zinc400 },

  // ── Liked tracks ──
  rowHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  seeAll: { fontSize: 13, color: C.indigo, fontWeight: "600" },
  tracksRow: { paddingHorizontal: 20, gap: 10, paddingBottom: 4, marginBottom: 20 },
  trackCard: {
    width: 110, height: 110, borderRadius: 14, overflow: "hidden",
    backgroundColor: C.zinc800, justifyContent: "flex-end",
  },
  trackThumb: { ...StyleSheet.absoluteFillObject as any },
  trackTitle: { fontSize: 10, color: "#fff", fontWeight: "600", padding: 8, paddingTop: 0 },

  // ── Settings sections ──
  groupLabel: {
    fontSize: 11, fontWeight: "700", color: C.zinc500,
    letterSpacing: 1.5, paddingHorizontal: 20,
    paddingTop: 24, paddingBottom: 8,
  },
  section: {
    marginHorizontal: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  settingsIcon: {
    width: 32, height: 32, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  settingsLabel: { flex: 1, gap: 2 },
  settingsText: { fontSize: 15, color: C.text, fontWeight: "500" },
  settingsValue: { fontSize: 12, color: C.zinc500, fontWeight: "400" },
  divider: { height: 1, backgroundColor: C.border, marginLeft: 60 },

  // Crossfade / EQ chips
  chipsRow: {
    flexDirection: "row", flexWrap: "wrap",
    gap: 8, paddingHorizontal: 16, paddingBottom: 14,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: { backgroundColor: C.indigoDim, borderColor: C.indigo },
  chipText: { fontSize: 12, color: C.zinc500, fontWeight: "600" },
  chipTextActive: { color: "#818CF8", fontWeight: "700" },

  // ── Version ──
  version: {
    textAlign: "center", fontSize: 12, color: C.zinc700,
    marginTop: 32, fontWeight: "400",
  },

  // ── Bottom sheet ──
  overlay: { ...StyleSheet.absoluteFillObject as any, backgroundColor: "rgba(0,0,0,0.65)" },
  sheet: {
    backgroundColor: "#18181B",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center", marginTop: 12, marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  sheetClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.07)",
    alignItems: "center", justifyContent: "center",
  },
  // Sheet avatar picker
  sheetAvatarWrap: { alignItems: "center", marginBottom: 24, gap: 8 },
  sheetAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#6366F1",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  sheetAvatarImg: { width: 80, height: 80, borderRadius: 40 },
  sheetAvatarInitials: { fontSize: 28, fontWeight: "700", color: "#fff" },
  sheetAvatarBadge: {
    position: "absolute", bottom: 24, right: "50%",
    transform: [{ translateX: 28 }],
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#6366F1",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#18181B",
  },
  sheetAvatarHint: { fontSize: 12, color: "#71717A", fontWeight: "500" },
  sheetFields: { gap: 16, marginBottom: 24 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 12, color: C.zinc400, fontWeight: "600", letterSpacing: 0.4 },
  fieldInput: {
    backgroundColor: "rgba(9,9,11,0.8)", borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, height: 50, color: C.text, fontSize: 15,
  },
  saveBtn: {
    height: 52, borderRadius: 14, overflow: "hidden",
    alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
}); }
