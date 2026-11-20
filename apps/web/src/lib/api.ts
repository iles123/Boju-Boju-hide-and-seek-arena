export type UserStats = {
  games_played: number;
  wins_as_seeker: number;
  wins_as_hider: number;
  eliminations: number;
  survival_time_seconds: number;
};

export type User = {
  id: string;
  email: string;
  username: string;
  is_verified: boolean;
  is_banned: boolean;
  role: string;
  avatar_skin: string | null;
  created_at: string;
  last_login: string | null;
  stats: UserStats;
};

export type AuthResponse = {
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type MessageResponse = { message: string };

export type RoomPlayer = {
  user_id: string;
  username: string;
  is_host: boolean;
  is_ready: boolean;
  connected: boolean;
  is_spectator: boolean;
  team?: "seeker" | "hider" | "spectator";
  alive?: boolean;
};

export type Room = {
  id: string;
  name: string;
  is_public: boolean;
  has_password: boolean;
  host_id: string | null;
  capacity: number;
  player_count: number;
  ready_count: number;
  status: "lobby" | "starting" | "in_progress";
  phase?: "lobby" | "hiding" | "seeking" | "ended";
  phase_ends_at?: string | null;
  winner_team?: "seekers" | "hiders" | null;
  created_at: string;
  players: RoomPlayer[];
};

export type RoomListItem = {
  id: string;
  name: string;
  is_public: boolean;
  has_password: boolean;
  host_id: string | null;
  capacity: number;
  player_count: number;
  status: "lobby" | "starting" | "in_progress";
  phase?: "lobby" | "hiding" | "seeking" | "ended";
  created_at: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function getApiBase() {
  return API_BASE;
}

export function getWsBase() {
  return API_BASE.replace(/^http/i, "ws");
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 401 && retry && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, init, false);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setAccessToken(null);
      return false;
    }
    const data = (await res.json()) as TokenResponse;
    setAccessToken(data.access_token);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

export const api = {
  register: (body: { email: string; username: string; password: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  logout: () => request<MessageResponse>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  forgotPassword: (body: { email: string }) =>
    request<MessageResponse>("/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body: { token: string; new_password: string }) =>
    request<MessageResponse>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body: { token: string }) =>
    request<MessageResponse>("/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),
  wsTicket: () => request<{ ticket: string; expires_in: number }>("/auth/ws-ticket", { method: "POST" }),
  listRooms: () => request<RoomListItem[]>("/rooms"),
  createRoom: (body: { name: string; is_public: boolean; password?: string | null }) =>
    request<Room>("/rooms", { method: "POST", body: JSON.stringify(body) }),
  joinRoom: (roomId: string, body: { password?: string | null; as_spectator?: boolean } = {}) =>
    request<Room>(`/rooms/${roomId}/join`, { method: "POST", body: JSON.stringify(body) }),
  leaveRoom: (roomId: string) => request<{ ok: boolean }>(`/rooms/${roomId}/leave`, { method: "POST" }),
  quickMatch: () => request<{ room: Room; joined: boolean }>("/rooms/quick-match", { method: "POST" }),
};
