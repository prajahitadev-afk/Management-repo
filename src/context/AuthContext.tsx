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
  profileError: string | null;
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

function getProfileLoadError(error: { code?: string; message?: string } | null, profileData: unknown) {
  if (!error && !profileData) {
    return "Your account is signed in, but no employee profile is linked to it. Ask an administrator to link your Auth account to an employee profile.";
  }

  if (error?.code === "PGRST116") {
    return "Your account is signed in, but no employee profile is linked to it. Ask an administrator to link your Auth account to an employee profile.";
  }

  return `Your account is signed in, but its employee profile could not be loaded. ${error?.message || "Please check the profiles table permissions and try again."}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function syncProfile(sessionUser: any): Promise<string | null> {
    if (!sessionUser?.id) {
      setUser(null);
      setProfile(null);
      setProfileError(null);
      return null;
    }

    setUser(sessionUser);

    const { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (error || !profileData) {
      const message = getProfileLoadError(error, profileData);
      setProfile(null);
      setProfileError(message);
      return message;
    }

    setProfile(buildProfileCompatibility(profileData, sessionUser));
    setProfileError(null);
    return null;
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
      .maybeSingle();

    if (error || !profileData) {
      setProfileError(getProfileLoadError(error, profileData));
      return;
    }

    setProfile(buildProfileCompatibility(profileData, user ?? { id: activeUserId, email: profileData.email }));
    setProfileError(null);
  }

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      setLoading(true);
      try {
        // Supabase handles PKCE and recovery URL callbacks through detectSessionInUrl.
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (session?.user) {
          await syncProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setProfileError(null);
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setProfile(null);
          setProfileError(error instanceof Error ? error.message : "Unable to restore your sign-in session.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined" && window.location.pathname !== "/reset-password") {
        window.history.replaceState({}, "", "/reset-password");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      try {
        if (session?.user) {
          await syncProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setProfileError(null);
        }
      } catch (error) {
        setProfile(null);
        setProfileError(error instanceof Error ? error.message : "Unable to load your employee profile.");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    setProfileError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
      if (!data?.user) throw new Error("Unable to sign in with those credentials.");

      const profileLoadError = await syncProfile(data.user);
      if (profileLoadError) {
        throw new Error(profileLoadError);
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setProfileError(null);
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
        profileError,
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