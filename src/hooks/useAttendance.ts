import { useEffect, useState } from "react";
import { getAttendanceByDate, getAttendanceForWeek, getAttendanceSummary, type AttendanceRow, type AttendanceScope } from "../services/attendance.service";

export function useAttendance(selectedDate?: string, user?: AttendanceScope) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [weekly, setWeekly] = useState<any[]>([]);
  const [summary, setSummary] = useState({ present: 0, absent: 0, halfDay: 0, onLeave: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeRole = user?.role;
  const scopeDepartment = user?.department;

  async function loadAttendance(date: string) {
    try {
      setLoading(true);
      const nextRows = await getAttendanceByDate(date, { role: scopeRole, department: scopeDepartment });
      const nextWeekly = await getAttendanceForWeek(date, { role: scopeRole, department: scopeDepartment });
      const nextSummary = getAttendanceSummary(nextRows);
      setRows(nextRows);
      setWeekly(nextWeekly);
      setSummary(nextSummary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const effectiveDate = selectedDate ?? new Date().toISOString().split("T")[0];
    void loadAttendance(effectiveDate);
  }, [selectedDate, scopeRole, scopeDepartment]);

  return { rows, setRows, weekly, summary, loading, error, reloadAttendance: loadAttendance };
}
