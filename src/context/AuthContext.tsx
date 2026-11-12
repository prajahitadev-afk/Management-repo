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
  if (!profileData) return null;

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

function deriveRoleAndDepartment(email?: string | null, meta?: Record<string, any>) {
  const normalized = String(email || "").toLowerCase().trim();
  if (normalized === "prajahitadev@gmail.com" || normalized.startsWith("prajahitadev")) {
    return { role: "Vice Chairman", department: "Administration", hierarchyLevel: 8 };
  }
  if (meta?.role && typeof meta.role === "string") {
    return {
      role: meta.role,
      department: meta.department || "Administration",
      hierarchyLevel: meta.hierarchyLevel || 6,
    };
  }

  if (normalized.startsWith("admin") || normalized.includes("admin")) {
    return { role: "Admin", department: "Administration", hierarchyLevel: 9 };
  }
  if (normalized.includes("vice") || normalized.includes("chairman")) {
    return { role: "Vice Chairman", department: "Administration", hierarchyLevel: 8 };
  }
  if (normalized.includes("president")) {
    return { role: "President", department: "Administration", hierarchyLevel: 7 };
  }
  if (normalized.includes("mdmar") || normalized.includes("marketing") || normalized.includes("mktg")) {
    return { role: "MD-Marketing", department: "Marketing", hierarchyLevel: 6 };
  }
  if (normalized.includes("mdmfg") || normalized.includes("manufacturing") || normalized.includes("factory")) {
    return { role: "MD-Manufacturing", department: "Manufacturing", hierarchyLevel: 6 };
  }
  if (normalized.includes("transport")) {
    return { role: "MD-Transport", department: "Transport", hierarchyLevel: 6 };
  }
  if (normalized.includes("rd") || normalized.includes("research")) {
    return { role: "MD-RD", department: "Research & Development", hierarchyLevel: 6 };
  }
  return { role: "Worker", department: "Administration", hierarchyLevel: 1 };
}

function deriveNameFromEmail(email?: string | null): string {
  if (!email) return "Employee";
  const userPart = email.split("@")[0] || "User";
  return userPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

    let { data: profileData, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionUser.id)
      .maybeSingle();

    // Check by email if id was not found
    if (!profileData && sessionUser.email) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", sessionUser.email)
        .maybeSingle();

      if (byEmail) {
        profileData = byEmail;
      }
    }

    const isPrajahitaAdmin = String(sessionUser.email || "").toLowerCase().includes("prajahitadev");

    // Auto-provision initial profile if none exists
    if (!profileData) {
      const { role, department, hierarchyLevel } = deriveRoleAndDepartment(sessionUser.email, sessionUser.user_metadata);
      const name = isPrajahitaAdmin ? "Prajahita Dev" : (sessionUser.user_metadata?.name || sessionUser.user_metadata?.full_name || deriveNameFromEmail(sessionUser.email));
      const autoProfile = {
        id: sessionUser.id,
        employee_id: isPrajahitaAdmin ? "EMP-000001" : `EMP-${Date.now().toString().slice(-6)}`,
        employee_code: isPrajahitaAdmin ? "ADMIN-01" : `EMP-${sessionUser.id.slice(0, 6).toUpperCase()}`,
        name,
        email: sessionUser.email,
        phone: sessionUser.phone || "",
        role,
        department,
        designation: role,
        hierarchy_level: hierarchyLevel,
        joining_date: new Date().toISOString().split("T")[0],
      };

      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(autoProfile, { onConflict: "id" })
        .select("*")
        .maybeSingle();

      if (!createError && created) {
        profileData = created;
        error = null;
      }
    } else if (isPrajahitaAdmin && profileData.role !== "Vice Chairman") {
      const { data: updated } = await supabase
        .from("profiles")
        .update({
          role: "Vice Chairman",
          designation: "Vice Chairman",
          hierarchy_level: 8,
          department: "Administration",
        })
        .eq("id", profileData.id)
        .select("*")
        .maybeSingle();

      if (updated) {
        profileData = updated;
      }
    }

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
    if (!activeUserId) return;

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
    let authEventVersion = 0;

    async function loadSession() {
      const versionAtStart = authEventVersion;
      setLoading(true);

      try {
        // Supabase owns URL callback parsing and persisted-session restoration.
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        // Ignore this snapshot if an auth event arrived while getSession was pending.
        if (!mounted || versionAtStart !== authEventVersion) return;

        if (session?.user) {
          await syncProfile(session.user);
        } else {
          setUser(null);
          setProfile(null);
          setProfileError(null);
        }
      } catch (error) {
        if (mounted && versionAtStart === authEventVersion) {
          setUser(null);
          setProfile(null);
          setProfileError(error instanceof Error ? error.message : "Unable to restore your sign-in session.");
        }
      } finally {
        if (mounted && versionAtStart === authEventVersion) setLoading(false);
      }
    }

    void loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authEventVersion += 1;
      const eventVersion = authEventVersion;

      // Do not await Supabase queries inside onAuthStateChange. The callback runs
      // while the auth client holds its internal lock; re-entering the client here
      // can stall session refresh and cause overlapping refresh-token requests.
      if (event === "PASSWORD_RECOVERY" && typeof window !== "undefined" && window.location.pathname !== "/reset-password") {
        window.history.replaceState({}, "", "/reset-password");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }

      setTimeout(() => {
        if (!mounted || eventVersion !== authEventVersion) return;

        void (async () => {
          try {
            if (session?.user) {
              await syncProfile(session.user);
            } else {
              setUser(null);
              setProfile(null);
              setProfileError(null);
            }
          } catch (error) {
            if (mounted && eventVersion === authEventVersion) {
              setProfile(null);
              setProfileError(error instanceof Error ? error.message : "Unable to load your employee profile.");
            }
          } finally {
            if (mounted && eventVersion === authEventVersion) setLoading(false);
          }
        })();
      }, 0);
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      if (!data?.user) throw new Error("Unable to sign in with those credentials.");

      const profileLoadError = await syncProfile(data.user);
      if (profileLoadError) throw new Error(profileLoadError);
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

    if (typeof window !== "undefined") window.location.replace("/");
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
