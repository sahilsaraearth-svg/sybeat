import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../lib/player";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  provider?: "email" | "google";
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  hydrate: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<string>;
  resetPassword: (email: string, resetToken: string, newPassword: string) => Promise<void>;
}

const TOKEN_KEY = "sybeat_auth_token";

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isInitialized: false,

  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) { set({ isInitialized: true }); return; }
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        set({ user, token, isInitialized: true });
      } else {
        await AsyncStorage.removeItem(TOKEN_KEY);
        set({ isInitialized: true });
      }
    } catch {
      set({ isInitialized: true });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      set({ user: data.user, token: data.token, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const { token } = get();
    try {
      if (token) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}
    await AsyncStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },

  updateProfile: async (data) => {
    const { token } = get();
    if (!token) throw new Error("Not authenticated");
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error ?? "Update failed");
      set({ user: updated, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    const { token } = get();
    if (!token) throw new Error("Not authenticated");
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  deleteAccount: async () => {
    const { token } = get();
    if (!token) throw new Error("Not authenticated");
    const res = await fetch(`${API_BASE}/api/auth/account`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Delete failed");
    await AsyncStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },

  forgotPassword: async (email) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send OTP");
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  verifyOTP: async (email, otp) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid OTP");
      set({ isLoading: false });
      return data.resetToken as string;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  resetPassword: async (email, resetToken, newPassword) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      set({ isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },
}));
