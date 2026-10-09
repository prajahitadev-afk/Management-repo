import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getExecutiveAnalytics, type ExecutiveAnalytics, type ExecutiveAnalyticsRole } from "../services/executive-analytics.service";

interface Props { role: ExecutiveAnalyticsRole; department?: string | null; userId: string; }
const colors = ["#4E8050", "#167A8A", "#B7791F", "#805AD5"];
const chartStyle = { backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 };
const format = (value: number) => `${value.toFixed(1)}%`;

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/60 bg-white/55 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p></div>;
}

export function ExecutiveAnalyticsDashboard({ role, department, userId }: Props) {
  const [analytics, setAnalytics] = useState<ExecutiveAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void getExecutiveAnalytics(role, department, userId).then((result) => {
      if (!active) return;
      if (result.error) setError(result.error.message);
      else setAnalytics(result.data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [role, department, userId]);

  if (loading) return <div className="p-6 text-sm text-slate-600">Loading executive analytics...</div>;
  if (error) return <div role="alert" className="p-6 text-sm text-red-700">Unable to load executive analytics: {error}</div>;
  if (!analytics || !analytics.departments.length) return <div className="p-6 text-sm text-slate-600">No accessible department analytics found.</div>;

  const average = (key: keyof typeof analytics.departments[number]) => analytics.departments.reduce((sum, item) => sum + Number(item[key]), 0) / analytics.departments.length;
  const metrics = [
    ["Total Employees", analytics.departments.reduce((sum, item) => sum + item.employees, 0)], ["Active Employees", analytics.departments.reduce((sum, item) => sum + item.activeEmployees, 0)], ["Performance Index", average("completionRate")], ["Target Achievement", average("targetAchievement")], ["Productivity", average("productivity")], ["Efficiency", average("efficiency")], ["Growth", average("growth")], ["Risk Score", average("riskScore")],
  ];
  const ranking = [...analytics.departments].sort((left, right) => right.completionRate - left.completionRate);

  return <section className="space-y-5 p-6"><div><h1 className="text-2xl font-bold text-slate-800">{role} Executive Analytics</h1><p className="mt-1 text-sm text-slate-600">{role === "MD" ? "Department-wide strategic view" : role === "Chief Manager" || role === "General Manager" ? "Accessible department performance" : "Organization-wide executive view"}</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metrics.map(([label, value]) => <Metric key={label} label={label} value={label === "Total Employees" || label === "Active Employees" ? String(value) : format(Number(value))} />)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/60 bg-white/45 p-5"><h2 className="mb-4 font-semibold text-slate-800">Department Ranking</h2><ResponsiveContainer width="100%" height={260}><BarChart data={ranking}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis domain={[0, 100]} /><Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} /><Bar dataKey="completionRate" fill={colors[0]} name="Completion %" /></BarChart></ResponsiveContainer></div><div className="rounded-2xl border border-white/60 bg-white/45 p-5"><h2 className="mb-4 font-semibold text-slate-800">Target Achievement</h2><ResponsiveContainer width="100%" height={260}><BarChart data={analytics.departments} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="department" width={100} /><Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} /><Bar dataKey="targetAchievement" fill={colors[1]} name="Achievement %" /></BarChart></ResponsiveContainer></div><div className="rounded-2xl border border-white/60 bg-white/45 p-5"><h2 className="mb-4 font-semibold text-slate-800">Productivity Comparison</h2><ResponsiveContainer width="100%" height={260}><BarChart data={analytics.departments}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis domain={[0, 100]} /><Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} /><Bar dataKey="productivity" fill={colors[2]} name="Productivity %" /></BarChart></ResponsiveContainer></div><div className="rounded-2xl border border-white/60 bg-white/45 p-5"><h2 className="mb-4 font-semibold text-slate-800">Utilization Comparison</h2><ResponsiveContainer width="100%" height={260}><BarChart data={analytics.departments.map((item) => ({ ...item, utilization: item.employees ? (item.activeEmployees / item.employees) * 100 : 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="department" /><YAxis domain={[0, 100]} /><Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} /><Bar dataKey="utilization" fill={colors[3]} name="Utilization %" /></BarChart></ResponsiveContainer></div><div className="rounded-2xl border border-white/60 bg-white/45 p-5 lg:col-span-2"><h2 className="mb-4 font-semibold text-slate-800">Performance Trend</h2><ResponsiveContainer width="100%" height={260}><LineChart data={analytics.trend}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis domain={[0, 100]} /><Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} /><Legend /><Line type="monotone" dataKey="performance" stroke={colors[0]} name="Performance %" /><Line type="monotone" dataKey="achievement" stroke={colors[1]} name="Achievement %" /><Line type="monotone" dataKey="productivity" stroke={colors[2]} name="Productivity %" /><Line type="monotone" dataKey="efficiency" stroke={colors[3]} name="Efficiency %" /></LineChart></ResponsiveContainer></div></div></section>;
}
