import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: any;
  profile: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildProfileCompatibility(profileData: any, authUser: any) {
  if (!profileData) {
    return null;
  }

  const name = profileData.name || authUser?.email || "User";
  const avatar = profileData.avatar || name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    ...profileData,
    department: profileData.department || "",
    avatar,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function syncProfile(sessionUser: any) {
    if (!sessionUser?.id) {
      setUser(null);
      setProfile(null);
      return;
    }

    setUser(sessionUser);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .single();

    if (error) {
      setProfile(null);
      return;
    }

    setProfile(buildProfileCompatibility(profileData, sessionUser));
  }

  async function refreshProfile() {
    const activeUserId = user?.id || profile?.id;
    if (!activeUserId) {
      return;
    }

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", activeUserId)
      .single();

    if (error) {
      return;
    }

    setProfile(buildProfileCompatibility(profileData, user ?? { id: activeUserId, email: profileData.email }));
  }

  useEffect(() => {
    async function loadSession() {
      setLoading(true);

      // Supabase handles PKCE and recovery URL callbacks through detectSessionInUrl.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await syncProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined" && window.location.pathname !== "/reset-password") {
        window.history.replaceState({}, "", "/reset-password");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      if (session?.user) {
        await syncProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
      if (!data?.user) throw new Error("Unable to sign in with those credentials.");

      await syncProfile(data.user);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setLoading(false);

    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}