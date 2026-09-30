import { useEffect, useState, useCallback } from "react";
import { getEmployees, getEmployeesForUser, searchEmployees } from "../services/employee.service";
import type { Employee, EmployeeFilters } from "../types/employee.types";

export function useEmployees(filters: EmployeeFilters = {}, userId?: string) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextEmployees = userId
        ? await getEmployeesForUser(userId, filters)
        : filters.search ? await searchEmployees(filters.search, filters) : await getEmployees(filters);
      setEmployees(nextEmployees);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [filters.department, filters.role, filters.search, filters.status, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { employees, loading, error, refresh };
}
