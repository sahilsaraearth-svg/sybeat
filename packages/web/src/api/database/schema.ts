import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Firebase UID
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const listeningHistory = sqliteTable("listening_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  thumbnail: text("thumbnail"),
  duration: integer("duration"), // seconds
  playedAt: integer("played_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  completionPct: real("completion_pct").default(0), // 0-1
});

export const likedTracks = sqliteTable("liked_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  thumbnail: text("thumbnail"),
  duration: integer("duration"),
  likedAt: integer("liked_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playlists = sqliteTable("playlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const playlistTracks = sqliteTable("playlist_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id")
    .notNull()
    .references(() => playlists.id, { onDelete: "cascade" }),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  artist: text("artist"),
  thumbnail: text("thumbnail"),
  duration: integer("duration"),
  position: integer("position").notNull().default(0),
  addedAt: integer("added_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userPreferences = sqliteTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  favoriteGenres: text("favorite_genres"), // JSON array
  favoriteArtists: text("favorite_artists"), // JSON array
  audioQuality: text("audio_quality").default("high"), // low/medium/high
  theme: text("theme").default("dark"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
