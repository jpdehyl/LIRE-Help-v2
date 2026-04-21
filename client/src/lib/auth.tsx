import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { canInviteAnyone, type StaffRole } from "../../../shared/roles";

export type { StaffRole };

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  tenantId: string | null;
  propertyId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: StaffUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // H6: track the previously-seen user id so that if a different user signs
  // in (e.g. logout → login as someone else in the same tab, or an SSO flow
  // that rotates identity) we drop every cached query. Otherwise TanStack
  // Query would surface the prior user's tenant-scoped data for a tick
  // before refetches kicked in.
  const lastUserIdRef = useRef<string | null>(null);

  const fetchMe = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (lastUserIdRef.current && data.user?.id && lastUserIdRef.current !== data.user.id) {
          queryClient.clear();
        }
        lastUserIdRef.current = data.user?.id ?? null;
        setUser(data.user);
      } else {
        if (lastUserIdRef.current !== null) queryClient.clear();
        lastUserIdRef.current = null;
        setUser(null);
      }
    } catch {
      if (lastUserIdRef.current !== null) queryClient.clear();
      lastUserIdRef.current = null;
      setUser(null);
    }
  };

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Login failed" }));
      throw new Error(err.message ?? "Login failed");
    }
    const data = await res.json();
    // H6: if we already had a user cached and the new login is a different
    // identity, nuke the cache before showing the new dashboard.
    if (lastUserIdRef.current && data.user?.id && lastUserIdRef.current !== data.user.id) {
      queryClient.clear();
    }
    lastUserIdRef.current = data.user?.id ?? null;
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // H6: hard-clear every cached query so the next signed-in user never
    // sees the previous user's tenant-scoped data even for a tick.
    queryClient.clear();
    lastUserIdRef.current = null;
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCanAccess(...roles: StaffRole[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  if (roles.length === 0) return true;
  return roles.includes(user.role);
}

export function useCanInvite(): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return canInviteAnyone(user.role);
}
