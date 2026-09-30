import { useEffect, useState, useCallback } from "react";
import { getEmployeeById } from "../services/employee.service";
import type { EmployeeProfile } from "../types/employee.types";

export function useEmployeeProfile(employeeId: string | null) {
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextProfile = await getEmployeeById(employeeId);
      setProfile(nextProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee profile");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { profile, loading, error, refresh };
}
