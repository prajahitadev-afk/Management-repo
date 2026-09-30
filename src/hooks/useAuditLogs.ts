import { useCallback, useEffect, useState } from "react";
import { getAuditActors, getAuditLogs, type AuditLogFilters } from "../services/audit-log.service";
import type { AuditLogRecord } from "../types/audit-log.types";

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [actors, setActors] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setLoading(true); setError(null); const [nextLogs, nextActors] = await Promise.all([getAuditLogs(filters), getAuditActors()]); setLogs(nextLogs); setActors(nextActors); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load audit logs"); }
    finally { setLoading(false); }
  }, [filters.action, filters.actorId, filters.from, filters.search, filters.to]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { logs, actors, loading, error, refresh };
}
