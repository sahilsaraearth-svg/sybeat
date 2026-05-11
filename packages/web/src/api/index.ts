import { Hono } from "hono";
import { cors } from "hono/cors";
// @ts-ignore — des.js has no types but works fine in Node/Bun
import desjs from "des.js";
import { createHash, randomBytes } from "crypto";
import { exec } from "child_process";

// ─── JioSaavn DES-ECB decryption ──────────────────────────────────────────────
function decryptSaavnUrl(encrypted: string): string {
  const key = Array.from(Buffer.from("38346591"));
  const enc = Array.from(Buffer.from(encrypted, "base64"));
  const cipher = new desjs.DES({ type: "decrypt", key });
  const out: number[] = cipher.update(enc);
  let end = out.length;
  while (end > 0 && out[end - 1] === 0) end--;
  return Buffer.from(out.slice(0, end)).toString("utf8");
}

function getStreamUrl(encryptedUrl: string, quality: "320" | "128" | "96" = "320"): string {
  const base = decryptSaavnUrl(encryptedUrl);
  const withExt = base.endsWith(".mp4") ? base : base + ".mp4";
  return withExt.replace(/_\d+\.mp4$/, `_${quality}.mp4`);
}

// ─── Saavn API ────────────────────────────────────────────────────────────────
const SAAVN_BASE = "https://www.jiosaavn.com/api.php";
const SAAVN_COMMON = "app_version=5.7.50&api_version=4&_format=json&_marker=0&ctx=wap6dot0";
const UA = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/100";

async function saavnGet(extra: string): Promise<any> {
  const res = await fetch(`${SAAVN_BASE}?${SAAVN_COMMON}&${extra}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Saavn HTTP ${res.status}`);
  return res.json();
}

// ─── In-memory URL cache (6hr TTL) ───────────────────────────────────────────
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL = 6 * 60 * 60 * 1000;

function getCached(id: string): string | null {
  const e = urlCache.get(id);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { urlCache.delete(id); return null; }
  return e.url;
}
function setCache(id: string, url: string) {
  urlCache.set(id, { url, expiresAt: Date.now() + CACHE_TTL });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}
const users = new Map<string, User>(); // email → user
const tokens = new Map<string, string>(); // token → userId

// ─── OTP store for password reset ────────────────────────────────────────────
interface OTPEntry { otp: string; expiresAt: number; }
const otpStore = new Map<string, OTPEntry>(); // email → otp

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function sendOTPEmail(email: string, otp: string): Promise<void> {
  return new Promise((resolve) => {
    const cmd = `send-email --to "${email}" --subject "SyBeat - Password Reset OTP" --body "Your OTP is: ${otp}\n\nValid for 10 minutes. Do not share this with anyone."`;
    exec(cmd, () => resolve());
  });
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password + "sybeat_salt_2024").digest("hex");
}
function generateToken(): string {
  return randomBytes(32).toString("hex");
}
function getUserFromToken(token: string): User | null {
  const userId = tokens.get(token);
  if (!userId) return null;
  for (const u of users.values()) {
    if (u.id === userId) return u;
  }
  return null;
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SaavnTrack {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
  album: string;
  language: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function html(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'");
}

function bigThumb(url: string) {
  return url.replace(/\d+x\d+\.jpg$/, "500x500.jpg").replace(/\d+x\d+\.webp$/, "500x500.webp");
}

function formatSearchResult(item: any): SaavnTrack | null {
  const mi = item.more_info ?? {};
  if (item.type && item.type !== "song") return null;
  const id = item.id ?? "";
  if (!id) return null;

  const artists: string = (mi.artistMap?.primary_artists ?? [])
    .map((a: any) => a.name)
    .join(", ") || html(mi.music ?? item.subtitle?.split(" - ")[0] ?? "Unknown");

  return {
    id,
    title: html(item.title ?? item.song ?? "Unknown"),
    artist: artists,
    thumbnail: bigThumb(item.image ?? ""),
    duration: parseInt(mi.duration ?? "0", 10),
    album: html(mi.album ?? ""),
    language: item.language ?? "",
  };
}

async function resolveSaavnUrl(songId: string, encryptedUrl?: string, has320?: boolean): Promise<string> {
  const cached = getCached(songId);
  if (cached) return cached;

  let enc = encryptedUrl;
  let use320 = has320;

  if (!enc) {
    const data = await saavnGet(`__call=song.getDetails&cc=in&pids=${songId}`);
    const song = data[songId];
    if (!song) throw new Error(`Song not found: ${songId}`);
    enc = song.encrypted_media_url;
    use320 = song["320kbps"] === "true" || song["320kbps"] === true;
  }

  if (!enc) throw new Error("No encrypted_media_url");
  const quality = use320 !== false ? "320" : "128";
  const url = getStreamUrl(enc, quality);
  setCache(songId, url);
  return url;
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = new Hono()
  .basePath("api")
  .use(cors({ origin: (o) => o ?? "*", credentials: true }))
  .get("/ping", (c) => c.json({ message: `Pong! ${Date.now()}` }))
  .get("/health", (c) => c.json({ status: "ok", provider: "jiosaavn" }))

  // ─── Auth ──────────────────────────────────────────────────────────────────
  .post("/auth/register", async (c) => {
    try {
      const body = await c.req.json();
      const { name, email, password } = body ?? {};
      if (!name || !email || !password)
        return c.json({ error: "name, email, and password required" }, 400);
      if (password.length < 6)
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      const key = email.toLowerCase().trim();
      if (users.has(key))
        return c.json({ error: "Email already registered" }, 409);
      const user: User = {
        id: randomBytes(8).toString("hex"),
        name: name.trim(),
        email: key,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      users.set(key, user);
      const token = generateToken();
      tokens.set(token, user.id);
      return c.json({ token, user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } }, 201);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  .post("/auth/login", async (c) => {
    try {
      const body = await c.req.json();
      const { email, password } = body ?? {};
      if (!email || !password)
        return c.json({ error: "email and password required" }, 400);
      const key = email.toLowerCase().trim();
      const user = users.get(key);
      if (!user || user.passwordHash !== hashPassword(password))
        return c.json({ error: "Invalid email or password" }, 401);
      const token = generateToken();
      tokens.set(token, user.id);
      return c.json({ token, user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  .get("/auth/me", async (c) => {
    const auth = c.req.header("Authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    const user = getUserFromToken(token);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    return c.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, 200);
  })

  .post("/auth/logout", async (c) => {
    const auth = c.req.header("Authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    tokens.delete(token);
    return c.json({ ok: true }, 200);
  })

  .put("/auth/profile", async (c) => {
    try {
      const auth = c.req.header("Authorization") ?? "";
      const token = auth.replace("Bearer ", "").trim();
      const user = getUserFromToken(token);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const body = await c.req.json();
      const { name, email } = body ?? {};
      const key = user.email;
      if (name) user.name = name.trim();
      if (email) {
        const newKey = email.toLowerCase().trim();
        if (newKey !== key && users.has(newKey))
          return c.json({ error: "Email already taken" }, 409);
        users.delete(key);
        user.email = newKey;
        users.set(newKey, user);
      } else {
        users.set(key, user);
      }
      return c.json({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  .put("/auth/password", async (c) => {
    try {
      const auth = c.req.header("Authorization") ?? "";
      const token = auth.replace("Bearer ", "").trim();
      const user = getUserFromToken(token);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      const body = await c.req.json();
      const { currentPassword, newPassword } = body ?? {};
      if (!currentPassword || !newPassword)
        return c.json({ error: "currentPassword and newPassword required" }, 400);
      if (user.passwordHash !== hashPassword(currentPassword))
        return c.json({ error: "Current password is wrong" }, 401);
      if (newPassword.length < 6)
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      user.passwordHash = hashPassword(newPassword);
      users.set(user.email, user);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  // ── Password Reset – step 1: send OTP ─────────────────────────────────────
  .post("/auth/forgot-password", async (c) => {
    try {
      const { email } = await c.req.json() ?? {};
      if (!email) return c.json({ error: "email required" }, 400);
      const key = email.toLowerCase().trim();
      if (!users.has(key)) return c.json({ ok: true }, 200); // silent — don't reveal user existence
      const otp = generateOTP();
      otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
      await sendOTPEmail(key, otp);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  // ── Password Reset – step 2: verify OTP ───────────────────────────────────
  .post("/auth/verify-otp", async (c) => {
    try {
      const { email, otp } = await c.req.json() ?? {};
      if (!email || !otp) return c.json({ error: "email and otp required" }, 400);
      const key = email.toLowerCase().trim();
      const entry = otpStore.get(key);
      if (!entry || entry.otp !== otp || Date.now() > entry.expiresAt)
        return c.json({ error: "Invalid or expired OTP" }, 400);
      // Issue a short-lived reset token
      const resetToken = randomBytes(24).toString("hex");
      otpStore.set(key, { otp: `reset:${resetToken}`, expiresAt: Date.now() + 5 * 60 * 1000 });
      return c.json({ resetToken }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  // ── Password Reset – step 3: set new password ─────────────────────────────
  .post("/auth/reset-password", async (c) => {
    try {
      const { email, resetToken, newPassword } = await c.req.json() ?? {};
      if (!email || !resetToken || !newPassword)
        return c.json({ error: "email, resetToken, and newPassword required" }, 400);
      if (newPassword.length < 6)
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      const key = email.toLowerCase().trim();
      const entry = otpStore.get(key);
      if (!entry || entry.otp !== `reset:${resetToken}` || Date.now() > entry.expiresAt)
        return c.json({ error: "Invalid or expired reset token" }, 400);
      const user = users.get(key);
      if (!user) return c.json({ error: "User not found" }, 404);
      user.passwordHash = hashPassword(newPassword);
      users.set(key, user);
      otpStore.delete(key);
      return c.json({ ok: true }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  .delete("/auth/account", async (c) => {
    const auth = c.req.header("Authorization") ?? "";
    const token = auth.replace("Bearer ", "").trim();
    const user = getUserFromToken(token);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    users.delete(user.email);
    tokens.delete(token);
    return c.json({ ok: true }, 200);
  })

  // ─── Search ────────────────────────────────────────────────────────────────
  .get("/search", async (c) => {
    const q = (c.req.query("q") ?? "").trim();
    if (!q) return c.json([], 200);
    try {
      const data = await saavnGet(
        `__call=search.getResults&q=${encodeURIComponent(q)}&n=20&p=1`
      );
      const results: any[] = data.results ?? [];
      const tracks: SaavnTrack[] = [];
      for (const item of results) {
        const t = formatSearchResult(item);
        if (!t) continue;
        const mi = item.more_info ?? {};
        const enc = mi.encrypted_media_url;
        const has320 = mi["320kbps"] === "true" || mi["320kbps"] === true;
        if (enc && !getCached(t.id)) {
          try { setCache(t.id, getStreamUrl(enc, has320 ? "320" : "128")); } catch {}
        }
        tracks.push(t);
      }
      return c.json(tracks, 200);
    } catch (err) {
      console.error("[search]", err);
      return c.json({ error: String(err) }, 500);
    }
  })

  // ─── Trending ──────────────────────────────────────────────────────────────
  .get("/trending", async (c) => {
    const q = c.req.query("q") ?? "bollywood";
    try {
      const data = await saavnGet(
        `__call=search.getResults&q=${encodeURIComponent(q)}&n=20&p=1`
      );
      const results: any[] = data.results ?? [];
      const tracks: SaavnTrack[] = [];
      for (const item of results) {
        const t = formatSearchResult(item);
        if (!t) continue;
        const mi = item.more_info ?? {};
        const enc = mi.encrypted_media_url;
        const has320 = mi["320kbps"] === "true" || mi["320kbps"] === true;
        if (enc && !getCached(t.id)) {
          try { setCache(t.id, getStreamUrl(enc, has320 ? "320" : "128")); } catch {}
        }
        tracks.push(t);
      }
      return c.json(tracks, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  // ─── Song info ─────────────────────────────────────────────────────────────
  .get("/stream/:songId/info", async (c) => {
    const songId = c.req.param("songId");
    try {
      const data = await saavnGet(`__call=song.getDetails&cc=in&pids=${songId}`);
      const song = data[songId];
      if (!song) return c.json({ error: "Not found" }, 404);
      return c.json({
        id: song.id,
        title: html(song.song ?? ""),
        artist: html(song.primary_artists ?? song.singers ?? ""),
        thumbnail: bigThumb(song.image ?? ""),
        duration: parseInt(song.duration ?? "0", 10),
        album: html(song.album ?? ""),
        language: song.language ?? "",
      }, 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  })

  // ─── Resolve stream URL ────────────────────────────────────────────────────
  .get("/stream/:songId/url", async (c) => {
    const songId = c.req.param("songId");
    try {
      const url = await resolveSaavnUrl(songId);
      return c.json({ url, contentType: "audio/mp4" }, 200);
    } catch (err) {
      console.error("[url] resolve failed:", songId, err);
      return c.json({ error: "Failed to resolve audio URL", details: String(err) }, 500);
    }
  })

  // ─── Pre-warm ──────────────────────────────────────────────────────────────
  .get("/stream/:songId/warm", async (c) => {
    const songId = c.req.param("songId");
    resolveSaavnUrl(songId).catch((e) => console.warn("[warm]", songId, e?.message));
    return c.json({ status: "warming" }, 202);
  })

  // ─── Warm batch ────────────────────────────────────────────────────────────
  .post("/stream/warm-batch", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const ids: string[] = body.ids ?? [];
    ids.slice(0, 5).forEach((id) =>
      resolveSaavnUrl(id).catch((e) => console.warn("[warm-batch]", id, e?.message))
    );
    return c.json({ status: "warming", count: Math.min(ids.length, 5) }, 202);
  })

  // ─── Recommendations ──────────────────────────────────────────────────────
  // Strategy: multi-signal search using artist + language + album context.
  // Returns up to 20 similar tracks, excluding the seed track itself.
  .get("/recommend/:songId", async (c) => {
    const songId = c.req.param("songId");
    const artist = (c.req.query("artist") ?? "").trim();
    const language = (c.req.query("language") ?? "").trim();
    const album = (c.req.query("album") ?? "").trim();
    const title = (c.req.query("title") ?? "").trim();
    const excludeIds = new Set((c.req.query("exclude") ?? "").split(",").filter(Boolean));
    excludeIds.add(songId);

    // Session intent detection
    const devotionalKeywords = /hanuman|shiva|ram|krishna|durga|ganesh|chalisa|bhajan|aarti|mantra|stuti|vishnu|lakshmi|saraswati|om |jai |bhagwan|puja|kirtan|navratri|devi|mahadev|ganpati|santoshi|bajrang/i;
    const isDevotional = devotionalKeywords.test(title) || devotionalKeywords.test(artist) || language === "devotional";

    try {
      const collected = new Map<string, SaavnTrack>(); // id → track, deduplicated

      // Build search queries in priority order
      const queries: string[] = [];

      if (isDevotional) {
        queries.push("bhajan aarti devotional hindi");
        queries.push("hanuman chalisa bhakti songs");
        queries.push("mantra stotra prayers");
      } else {
        // 1. Artist-first (strongest signal)
        if (artist) queries.push(artist);

        // 2. Artist + language combo
        if (artist && language) queries.push(`${artist} ${language}`);

        // 3. Album (same album tracks)
        if (album && album.length > 3) queries.push(album);

        // 4. Language-based popular songs
        if (language) {
          const langMap: Record<string, string> = {
            hindi: "bollywood hits hindi",
            english: "english hits pop",
            punjabi: "punjabi hits",
            tamil: "tamil hits",
            telugu: "telugu hits",
            bengali: "bengali hits",
            marathi: "marathi hits",
            devotional: "bhajan devotional",
            bhojpuri: "bhojpuri hits",
          };
          const langQ = langMap[language.toLowerCase()];
          if (langQ) queries.push(langQ);
          else queries.push(`${language} popular songs`);
        }
      }

      // Fetch all queries in parallel
      const results = await Promise.allSettled(
        queries.slice(0, 3).map((q) =>
          saavnGet(`__call=search.getResults&q=${encodeURIComponent(q)}&n=20&p=1`)
        )
      );

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const items: any[] = r.value.results ?? [];
        for (const item of items) {
          const t = formatSearchResult(item);
          if (!t || excludeIds.has(t.id) || collected.has(t.id)) continue;
          // Pre-warm the URL cache
          const mi = item.more_info ?? {};
          const enc = mi.encrypted_media_url;
          const has320 = mi["320kbps"] === "true" || mi["320kbps"] === true;
          if (enc && !getCached(t.id)) {
            try { setCache(t.id, getStreamUrl(enc, has320 ? "320" : "128")); } catch {}
          }
          collected.set(t.id, t);
          if (collected.size >= 25) break;
        }
        if (collected.size >= 25) break;
      }

      const tracks = Array.from(collected.values()).slice(0, 20);
      return c.json(tracks, 200);
    } catch (err) {
      console.error("[recommend]", err);
      return c.json({ error: String(err) }, 500);
    }
  })

  // ─── Radio — smarter recommendations with skip/like signals ───────────────
  // Client sends: seed songId, recent played IDs (to avoid repeats),
  // liked IDs (to boost similar artists), skipped IDs (to penalize)
  .post("/radio/:songId", async (c) => {
    const songId = c.req.param("songId");
    let body: any = {};
    try { body = await c.req.json(); } catch {}

    const artist = (body.artist ?? "").trim();
    const language = (body.language ?? "").trim();
    const album = (body.album ?? "").trim();
    const title = (body.title ?? "").trim();
    const recentIds: string[] = body.recentIds ?? []; // played in last session
    const likedArtists: string[] = body.likedArtists ?? []; // artists user likes
    const skipCount: Record<string, number> = body.skipCount ?? {}; // trackId → skip count

    const excludeIds = new Set([songId, ...recentIds.slice(0, 30)]);

    // ── Session intent detection ──────────────────────────────────────────────
    // If the current song is devotional/bhajan, override all queries to stay in that mood
    const devotionalKeywords = /hanuman|shiva|ram|krishna|durga|ganesh|chalisa|bhajan|aarti|mantra|stuti|vishnu|lakshmi|saraswati|om |jai |bhagwan|puja|kirtan|navratri|devi|mahadev|mahadeva|ganpati|santoshi|bajrang/i;
    const isDevotional = devotionalKeywords.test(title) || devotionalKeywords.test(artist) || language === "devotional";

    // Detect party/dance mood
    const partyKeywords = /dj |remix|party|dance|club|beat|groove|banger/i;
    const isParty = partyKeywords.test(title) || partyKeywords.test(artist);

    try {
      const scored = new Map<string, { track: SaavnTrack; score: number }>();

      const queries: Array<{ q: string; weight: number }> = [];

      if (isDevotional) {
        // Devotional mode — ignore artist, stay in devotional space
        queries.push({ q: "bhajan aarti devotional hindi", weight: 10 });
        queries.push({ q: "hanuman chalisa bhakti", weight: 8 });
        queries.push({ q: "mantra stotra prayers hindi", weight: 6 });
      } else if (isParty) {
        queries.push({ q: `${artist} remix dance`, weight: 10 });
        queries.push({ q: `bollywood party dj remix`, weight: 8 });
        queries.push({ q: `${language} dance hits`, weight: 6 });
      } else {
        // Normal mode: artist-first strategy
        // Artist songs — highest weight
        if (artist) queries.push({ q: artist, weight: 10 });

        // Liked artists — strong signal
        for (const la of likedArtists.slice(0, 2)) {
          if (la !== artist) queries.push({ q: la, weight: 8 });
        }

        // Album
        if (album && album.length > 3) queries.push({ q: album, weight: 6 });

        // Language
        if (language) {
          const langMap: Record<string, string> = {
            hindi: "bollywood hindi romantic",
            english: "english pop hits",
            punjabi: "punjabi pop",
            tamil: "tamil melody",
            telugu: "telugu melody",
            devotional: "bhajan devotional aarti",
          };
          queries.push({ q: langMap[language.toLowerCase()] ?? `${language} songs`, weight: 4 });
        }
      }

      const results = await Promise.allSettled(
        queries.slice(0, 4).map(({ q }) =>
          saavnGet(`__call=search.getResults&q=${encodeURIComponent(q)}&n=20&p=1`)
        )
      );

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status !== "fulfilled") continue;
        const weight = queries[i]?.weight ?? 1;
        const items: any[] = r.value.results ?? [];

        for (const item of items) {
          const t = formatSearchResult(item);
          if (!t || excludeIds.has(t.id)) continue;

          // Pre-warm URL cache
          const mi = item.more_info ?? {};
          const enc = mi.encrypted_media_url;
          const has320 = mi["320kbps"] === "true" || mi["320kbps"] === true;
          if (enc && !getCached(t.id)) {
            try { setCache(t.id, getStreamUrl(enc, has320 ? "320" : "128")); } catch {}
          }

          const existing = scored.get(t.id);
          const skipPenalty = (skipCount[t.id] ?? 0) * 5; // skip = -5 score per skip
          const score = weight - skipPenalty;

          if (existing) {
            existing.score += score;
          } else {
            scored.set(t.id, { track: t, score });
          }
        }
      }

      // Sort by score descending, add slight shuffle to avoid always same order
      const sorted = Array.from(scored.values())
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score + (Math.random() - 0.5) * 2)
        .slice(0, 20)
        .map((x) => x.track);

      return c.json(sorted, 200);
    } catch (err) {
      console.error("[radio]", err);
      return c.json({ error: String(err) }, 500);
    }
  })

  // ─── Pipe stream (fallback) ────────────────────────────────────────────────
  .get("/stream/:songId", async (c) => {
    const songId = c.req.param("songId");
    try {
      const url = await resolveSaavnUrl(songId);
      const upstream = await fetch(url, {
        headers: { "User-Agent": UA, Referer: "https://www.jiosaavn.com/" },
      });
      if (!upstream.ok) throw new Error(`CDN ${upstream.status}`);
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "audio/mp4",
          "Content-Length": upstream.headers.get("content-length") ?? "",
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      console.error("[stream pipe]", err);
      return c.json({ error: String(err) }, 500);
    }
  });

export type AppType = typeof app;
export default app;
