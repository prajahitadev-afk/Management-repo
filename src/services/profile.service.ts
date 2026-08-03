import { supabase } from "../lib/supabase";

export interface ProfileRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  avatar?: string;
  employee_id?: string;
  phone?: string;
  status?: string;
  created_at?: string;
}

interface AuthUserLike {
  id: string;
  email?: string;
}

interface ProfileRow extends Record<string, unknown> {
  name?: string | null;
  department?: string | null;
  dept?: string | null;
  avatar?: string | null;
}

function buildProfileCompatibility(profileData: ProfileRow | null, authUser: AuthUserLike) {
  if (!profileData) {
    return null;
  }

  const name = profileData.name || authUser.email || "User";
  const avatar = profileData.avatar || name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    ...profileData,
    name,
    dept: profileData.department || profileData.dept || "",
    avatar,
  } as ProfileRecord & { dept: string; avatar: string };
}

export async function getCurrentProfile(authUser: AuthUserLike | null) {
  if (!authUser?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (error) {
    console.error("Failed to load profile:", error);
    return null;
  }

  return buildProfileCompatibility(data, authUser);
}

export async function getProfile(id: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (error) {
    throw error;
  }

  return data as ProfileRecord;
}

export async function updateProfile(id: string, updates: Partial<ProfileRecord>) {
  const allowedUpdates = {
    name: updates.name,
    email: updates.email,
    phone: updates.phone,
    role: updates.role,
    department: updates.department,
    status: updates.status,
    employee_id: updates.employee_id,
  };

  const { data, error } = await supabase.from("profiles").update(allowedUpdates).eq("id", id).select().single();

  if (error) {
    throw error;
  }

  return data as ProfileRecord;
}
