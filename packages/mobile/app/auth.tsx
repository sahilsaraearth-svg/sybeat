import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useRouter } from "expo-router";
import { Headphones, Eye, EyeSlash, EnvelopeSimple, Lock, User } from "phosphor-react-native";
import { useAuthStore } from "../store/authStore";

const { width: W } = Dimensions.get("window");



type Mode = "login" | "register";
type ResetStep = "email" | "otp" | "newpass";

export default function AuthScreen() {
  const router = useRouter();
  const { login, register, forgotPassword, verifyOTP, resetPassword, isLoading } = useAuthStore();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  // Reset flow
  const [resetMode, setResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("email");
  const [resetEmail, setResetEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handle = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Fill in all fields"); return; }
    if (mode === "register" && !name.trim()) { setError("Enter your name"); return; }
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    }
  };

  const handleForgotSendOTP = async () => {
    setError(""); setSuccessMsg("");
    if (!resetEmail.trim()) { setError("Enter your email"); return; }
    try {
      await forgotPassword(resetEmail.trim());
      setSuccessMsg("OTP sent! Check your email.");
      setResetStep("otp");
    } catch (err: any) {
      setError(err?.message ?? "Failed to send OTP");
    }
  };

  const handleVerifyOTP = async () => {
    setError(""); setSuccessMsg("");
    if (!otp.trim()) { setError("Enter the OTP"); return; }
    try {
      const token = await verifyOTP(resetEmail.trim(), otp.trim());
      setResetToken(token);
      setResetStep("newpass");
    } catch (err: any) {
      setError(err?.message ?? "Invalid OTP");
    }
  };

  const handleResetPassword = async () => {
    setError(""); setSuccessMsg("");
    if (!newPassword.trim()) { setError("Enter new password"); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    try {
      await resetPassword(resetEmail.trim(), resetToken, newPassword);
      setSuccessMsg("Password reset! You can now sign in.");
      setResetMode(false);
      setResetStep("email");
      setOtp(""); setResetToken(""); setNewPassword("");
      setEmail(resetEmail.trim());
    } catch (err: any) {
      setError(err?.message ?? "Reset failed");
    }
  };

  if (resetMode) {
    return (
      <View style={s.root}>
        <LinearGradient colors={["#0A0A12", "#09090B", "#09090B"]} style={StyleSheet.absoluteFillObject} />
        <View style={s.glow} pointerEvents="none">
          <LinearGradient colors={["rgba(99,102,241,0.22)", "transparent"]} style={{ flex: 1, borderRadius: 400 }} />
        </View>
        <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.logoWrap}>
                <LinearGradient colors={["#6366F1", "#4F46E5"]} style={s.logoCircle}>
                  <Headphones size={32} color="#fff" weight="fill" />
                </LinearGradient>
                <Text style={s.appName}>SyBeat</Text>
                <Text style={s.tagline}>Reset your password</Text>
              </View>

              <View style={s.card}>
                <Text style={s.cardTitle}>
                  {resetStep === "email" ? "Forgot Password" : resetStep === "otp" ? "Enter OTP" : "New Password"}
                </Text>
                <Text style={s.cardSub}>
                  {resetStep === "email"
                    ? "We'll send a 6-digit OTP to your email"
                    : resetStep === "otp"
                    ? `OTP sent to ${resetEmail}`
                    : "Enter your new password"}
                </Text>

                {resetStep === "email" && (
                  <View style={s.inputWrap}>
                    <EnvelopeSimple size={18} color={"#A1A1AA"} style={s.inputIcon} />
                    <TextInput
                      style={s.input}
                      placeholder="Email address"
                      placeholderTextColor={"#A1A1AA"}
                      value={resetEmail}
                      onChangeText={setResetEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                )}

                {resetStep === "otp" && (
                  <View style={s.inputWrap}>
                    <TextInput
                      style={[s.input, { letterSpacing: 8, fontSize: 20, textAlign: "center" }]}
                      placeholder="000000"
                      placeholderTextColor={"#A1A1AA"}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                )}

                {resetStep === "newpass" && (
                  <View style={s.inputWrap}>
                    <Lock size={18} color={"#A1A1AA"} style={s.inputIcon} />
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      placeholder="New password"
                      placeholderTextColor={"#A1A1AA"}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPw}
                    />
                    <TouchableOpacity onPress={() => setShowNewPw(!showNewPw)} style={s.eyeBtn}>
                      {showNewPw ? <EyeSlash size={18} color={"#A1A1AA"} /> : <Eye size={18} color={"#A1A1AA"} />}
                    </TouchableOpacity>
                  </View>
                )}

                {!!error && (
                  <View style={s.errorWrap}><Text style={s.errorText}>{error}</Text></View>
                )}
                {!!successMsg && (
                  <View style={s.successWrap}><Text style={s.successText}>{successMsg}</Text></View>
                )}

                <TouchableOpacity
                  style={s.submitBtn}
                  onPress={resetStep === "email" ? handleForgotSendOTP : resetStep === "otp" ? handleVerifyOTP : handleResetPassword}
                  activeOpacity={0.85}
                  disabled={isLoading}
                >
                  <LinearGradient colors={["#6366F1", "#4F46E5"]} style={StyleSheet.absoluteFillObject} />
                  {isLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.submitText}>
                        {resetStep === "email" ? "Send OTP" : resetStep === "otp" ? "Verify OTP" : "Reset Password"}
                      </Text>}
                </TouchableOpacity>

                {resetStep === "otp" && (
                  <TouchableOpacity onPress={() => { setError(""); handleForgotSendOTP(); }}>
                    <Text style={s.forgotLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => { setResetMode(false); setError(""); setSuccessMsg(""); setResetStep("email"); }}>
                  <Text style={s.forgotLink}>← Back to Sign In</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <LinearGradient colors={["#0A0A12", "#09090B", "#09090B"]} style={StyleSheet.absoluteFillObject} />
      <View style={s.glow} pointerEvents="none">
        <LinearGradient colors={["rgba(99,102,241,0.22)", "transparent"]} style={{ flex: 1, borderRadius: 400 }} />
      </View>

      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.logoWrap}>
              <LinearGradient colors={["#6366F1", "#4F46E5"]} style={s.logoCircle}>
                <Headphones size={32} color="#fff" weight="fill" />
              </LinearGradient>
              <Text style={s.appName}>SyBeat</Text>
              <Text style={s.tagline}>Music without limits</Text>
            </View>

            <View style={s.card}>
              <View style={s.modeRow}>
                <TouchableOpacity style={[s.modeBtn, mode === "login" && s.modeBtnActive]} onPress={() => { setMode("login"); setError(""); }} activeOpacity={0.8}>
                  <Text style={[s.modeBtnText, mode === "login" && s.modeBtnTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modeBtn, mode === "register" && s.modeBtnActive]} onPress={() => { setMode("register"); setError(""); }} activeOpacity={0.8}>
                  <Text style={[s.modeBtnText, mode === "register" && s.modeBtnTextActive]}>Create Account</Text>
                </TouchableOpacity>
              </View>

              <Text style={s.cardTitle}>{mode === "login" ? "Welcome back" : "Join SyBeat"}</Text>
              <Text style={s.cardSub}>{mode === "login" ? "Sign in to continue listening" : "Create your free account"}</Text>

              {mode === "register" && (
                <View style={s.inputWrap}>
                  <User size={18} color={"#A1A1AA"} style={s.inputIcon} />
                  <TextInput style={s.input} placeholder="Full name" placeholderTextColor={"#A1A1AA"} value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="next" />
                </View>
              )}

              <View style={s.inputWrap}>
                <EnvelopeSimple size={18} color={"#A1A1AA"} style={s.inputIcon} />
                <TextInput style={s.input} placeholder="Email address" placeholderTextColor={"#A1A1AA"} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
              </View>

              <View style={s.inputWrap}>
                <Lock size={18} color={"#A1A1AA"} style={s.inputIcon} />
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Password" placeholderTextColor={"#A1A1AA"} value={password} onChangeText={setPassword} secureTextEntry={!showPw} returnKeyType="done" onSubmitEditing={handle} />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                  {showPw ? <EyeSlash size={18} color={"#A1A1AA"} /> : <Eye size={18} color={"#A1A1AA"} />}
                </TouchableOpacity>
              </View>

              {mode === "login" && (
                <TouchableOpacity onPress={() => { setResetEmail(email); setResetMode(true); setError(""); setSuccessMsg(""); }} style={{ alignSelf: "flex-end", marginTop: -4 }}>
                  <Text style={s.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              )}

              {!!error && <View style={s.errorWrap}><Text style={s.errorText}>{error}</Text></View>}
              {!!successMsg && <View style={s.successWrap}><Text style={s.successText}>{successMsg}</Text></View>}

              <TouchableOpacity style={s.submitBtn} onPress={handle} activeOpacity={0.85} disabled={isLoading}>
                <LinearGradient colors={["#6366F1", "#4F46E5"]} style={StyleSheet.absoluteFillObject} />
                {isLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.submitText}>{mode === "login" ? "Sign In" : "Create Account"}</Text>}
              </TouchableOpacity>


            </View>

            <Text style={s.footer}>By continuing you agree to our Terms of Service</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090B" },
  safe: { flex: 1 },
  glow: { position: "absolute", top: -100, left: W / 2 - 200, width: 400, height: 400 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32, gap: 24 },
  logoWrap: { alignItems: "center", gap: 10, marginBottom: 8 },
  logoCircle: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", shadowColor: "#6366F1", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  appName: { fontSize: 32, fontWeight: "900", color: "#FAFAFA", letterSpacing: -1 },
  tagline: { fontSize: 14, color: "#A1A1AA" },
  card: { backgroundColor: "rgba(24,24,27,0.7)", borderRadius: 20, padding: 24, gap: 14, borderWidth: 1, borderColor: "rgba(63,63,70,0.6)" },
  modeRow: { flexDirection: "row", backgroundColor: "rgba(9,9,11,0.6)", borderRadius: 12, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#6366F1" },
  modeBtnText: { fontSize: 14, fontWeight: "600", color: "#A1A1AA" },
  modeBtnTextActive: { color: "#fff" },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#FAFAFA", letterSpacing: -0.3, marginTop: 4 },
  cardSub: { fontSize: 13, color: "#A1A1AA", marginBottom: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(9,9,11,0.6)", borderRadius: 12, borderWidth: 1, borderColor: "rgba(63,63,70,0.6)", paddingHorizontal: 14, height: 52, gap: 10 },
  inputIcon: {},
  input: { flex: 1, color: "#FAFAFA", fontSize: 15 },
  eyeBtn: { padding: 4 },
  forgotLink: { color: "#6366F1", fontSize: 13, fontWeight: "500", textAlign: "center", paddingVertical: 4 },
  errorWrap: { backgroundColor: "rgba(244,63,94,0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(244,63,94,0.3)" },
  errorText: { color: "#F43F5E", fontSize: 13, fontWeight: "500" },
  successWrap: { backgroundColor: "rgba(34,197,94,0.1)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" },
  successText: { color: "#22C55E", fontSize: 13, fontWeight: "500" },
  submitBtn: { height: 52, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: "#6366F1", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  footer: { textAlign: "center", fontSize: 12, color: "#52525B" },

});
