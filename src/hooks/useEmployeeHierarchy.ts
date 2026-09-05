import { useCallback, useEffect, useState } from "react";
import {
  getEmployeeHierarchy,
  upsertEmployeeHierarchy,
} from "../services/employee-hierarchy.service";
import type {
  EmployeeHierarchyInput,
  EmployeeHierarchyRecord,
} from "../types/employee-hierarchy.types";

export function useEmployeeHierarchy() {
  const [hierarchy, setHierarchy] = useState<EmployeeHierarchyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setHierarchy(await getEmployeeHierarchy());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employee hierarchy");
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (input: EmployeeHierarchyInput) => {
    const saved = await upsertEmployeeHierarchy(input);
    setHierarchy((current) => {
      const remaining = current.filter((item) => item.employeeId !== saved.employeeId);
      return [...remaining, saved].sort((left, right) => left.hierarchyLevel - right.hierarchyLevel);
    });
    return saved;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { hierarchy, loading, error, refresh, save };
}
