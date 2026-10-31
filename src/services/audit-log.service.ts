import { supabase } from "../lib/supabase";
import type { AuditLogRecord } from "../types/audit-log.types";

export interface AuditLogFilters {
  search?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogRecord[]> {
  let query = supabase
    .from("audit_logs")
    .select("id, user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false });

  if (filters.action && filters.action !== "All") query = query.eq("action", filters.action);
  if (filters.actorId && filters.actorId !== "All") query = query.eq("user_id", filters.actorId);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00.000Z`);
  if (filters.to) query = query.lt("created_at", `${filters.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const actorIds = Array.from(new Set(rows.map((row) => String(row.user_id ?? "")).filter(Boolean)));
  const profiles = actorIds.length
    ? await supabase.from("profiles").select("id, name, email").in("id", actorIds)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;

  const actorNames = new Map(
    (profiles.data ?? []).map((profile) => [
      String(profile.id),
      String(profile.name ?? profile.email ?? profile.id),
    ]),
  );
  const search = filters.search?.trim().toLowerCase();

  return rows
    .map((row) => {
      const actorId = String(row.user_id ?? "");
      return {
        id: String(row.id),
        actorId,
        actorName: actorNames.get(actorId) ?? actorId,
        action: String(row.action ?? ""),
        entityType: String(row.entity_type ?? ""),
        entityId: String(row.entity_id ?? ""),
        oldValues: null,
        newValues: null,
        createdAt: String(row.created_at ?? ""),
      };
    })
    .filter((log) =>
      !search ||
      [log.actorName, log.action, log.entityType, log.entityId]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
}

export async function getAuditActors(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .not("role", "is", null)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((profile) => ({
    id: String(profile.id),
    name: String(profile.name ?? profile.email ?? profile.id),
  }));
}
