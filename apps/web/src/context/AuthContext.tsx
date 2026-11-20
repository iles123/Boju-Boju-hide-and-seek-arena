import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken, tryRefresh, type User } from "../lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshMe() {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    (async () => {
      const ok = await tryRefresh();
      if (ok) {
        await refreshMe();
      } else {
        setAccessToken(null);
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password) {
        const res = await api.login({ email, password });
        setAccessToken(res.access_token);
        setUser(res.user);
      },
      async register(email, username, password) {
        const res = await api.register({ email, username, password });
        setAccessToken(res.access_token);
        setUser(res.user);
        return "Account created. Check console/dev email logs for verification link/token.";
      },
      async logout() {
        try {
          await api.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
        }
      },
      refreshMe,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
