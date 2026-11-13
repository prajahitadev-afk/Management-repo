import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getExecutiveAnalytics, type ExecutiveAnalytics, type ExecutiveAnalyticsRole } from "../services/executive-analytics.service";

interface Props { role: ExecutiveAnalyticsRole; department?: string | null; userId: string; }
const colors = ["#176B52", "#5A8D7A", "#C58A2A", "#6688A0"];
const chartStyle = {
  backgroundColor: "var(--portal-surface)",
  border: "1px solid var(--portal-line)",
  borderRadius: 12,
  boxShadow: "var(--portal-shadow-float)",
  color: "var(--portal-ink)",
  backdropFilter: "blur(18px) saturate(140%)",
};
const format = (value: number) => `${value.toFixed(1)}%`;
const axisTick = { fill: "var(--portal-muted)", fontSize: 11 };
const chartMargin = { top: 8, right: 12, bottom: 4, left: 0 };

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="portal-analytics-metric rounded-xl border border-white/60 bg-white/55 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-slate-800">{value}</p></div>;
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
  const workforceDistribution = analytics.departments.filter((item) => item.employees > 0);
  const totalEmployees = workforceDistribution.reduce((sum, item) => sum + item.employees, 0);

  return (
    <section className="portal-executive-dashboard portal-role-dashboard portal-module-page p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{role} Executive Analytics</h1>
        <p className="mt-1 text-sm text-slate-600">
          {role === "MD" ? "Department-wide strategic view" : role === "Chief Manager" || role === "General Manager" ? "Accessible department performance" : "Organization-wide executive view"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Metric
            key={String(label)}
            label={String(label)}
            value={label === "Total Employees" || label === "Active Employees" ? String(value) : format(Number(value))}
          />
        ))}
      </div>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Department Performance</h2>
          <p className="mt-1 text-sm text-slate-500">Compare completion, achievement, productivity, and utilization across departments.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5">
            <h2 className="mb-4 font-semibold text-slate-800">Department Ranking</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ranking} margin={chartMargin}>
                <defs>
                  <linearGradient id="exec-completion-bars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[0]} stopOpacity={1} />
                    <stop offset="100%" stopColor={colors[0]} stopOpacity={0.68} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="department" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} />
                <Bar dataKey="completionRate" fill="url(#exec-completion-bars)" radius={[7, 7, 0, 0]} name="Completion %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5">
            <h2 className="mb-4 font-semibold text-slate-800">Target Achievement</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.departments} layout="vertical" margin={chartMargin}>
                <defs>
                  <linearGradient id="exec-achievement-bars" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={colors[1]} stopOpacity={0.68} />
                    <stop offset="100%" stopColor={colors[1]} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} tickMargin={8} />
                <YAxis type="category" dataKey="department" width={100} tick={axisTick} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} />
                <Bar dataKey="targetAchievement" fill="url(#exec-achievement-bars)" radius={[0, 7, 7, 0]} name="Achievement %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5">
            <h2 className="mb-4 font-semibold text-slate-800">Productivity Comparison</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.departments} margin={chartMargin}>
                <defs>
                  <linearGradient id="exec-productivity-bars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[2]} stopOpacity={1} />
                    <stop offset="100%" stopColor={colors[2]} stopOpacity={0.68} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="department" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} />
                <Bar dataKey="productivity" fill="url(#exec-productivity-bars)" radius={[7, 7, 0, 0]} name="Productivity %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5">
            <h2 className="mb-4 font-semibold text-slate-800">Utilization Comparison</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={analytics.departments.map((item) => ({
                  ...item,
                  utilization: item.employees ? (item.activeEmployees / item.employees) * 100 : 0,
                }))}
                margin={chartMargin}
              >
                <defs>
                  <linearGradient id="exec-utilization-bars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors[3]} stopOpacity={1} />
                    <stop offset="100%" stopColor={colors[3]} stopOpacity={0.68} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="department" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} />
                <Bar dataKey="utilization" fill="url(#exec-utilization-bars)" radius={[7, 7, 0, 0]} name="Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">Workforce & Trends</h2>
          <p className="mt-1 text-sm text-slate-500">Review department headcount mix alongside changes in key performance indicators.</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-5">
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5 xl:col-span-2">
            <h2 className="mb-4 font-semibold text-slate-800">Workforce Mix by Department</h2>
            {totalEmployees > 0 ? (
              <div className="relative">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={workforceDistribution}
                      dataKey="employees"
                      nameKey="department"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="84%"
                      paddingAngle={3}
                      stroke="var(--portal-chart-glass)"
                      strokeWidth={3}
                    >
                      {workforceDistribution.map((item, index) => (
                        <Cell key={item.department} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartStyle}
                      formatter={(value, name) => {
                        const count = Number(value);
                        const share = (count / totalEmployees) * 100;
                        return [`${count.toLocaleString()} employees · ${share.toFixed(1)}%`, name];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[220px] flex-col items-center justify-center">
                  <span className="text-2xl font-semibold text-slate-800">{totalEmployees.toLocaleString()}</span>
                  <span className="text-xs text-slate-500">employees</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-2">
                  {workforceDistribution.map((item, index) => (
                    <div key={item.department} className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                      <span className="truncate">{item.department}</span>
                      <span className="ml-auto shrink-0 font-semibold text-slate-800">{item.employees}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div role="status" className="flex h-[260px] items-center justify-center text-sm text-slate-500">
                No employee distribution data available.
              </div>
            )}
          </div>
          <div className="portal-analytics-panel portal-chart-panel rounded-2xl border border-white/60 bg-white/45 p-5 xl:col-span-3">
            <h2 className="mb-4 font-semibold text-slate-800">Performance Trend</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={analytics.trend} margin={chartMargin}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} />
                <XAxis dataKey="period" tick={axisTick} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={chartStyle} formatter={(value) => format(Number(value))} />
                <Legend />
                <Line type="monotone" dataKey="performance" stroke={colors[0]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} name="Performance %" />
                <Line type="monotone" dataKey="achievement" stroke={colors[1]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} name="Achievement %" />
                <Line type="monotone" dataKey="productivity" stroke={colors[2]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} name="Productivity %" />
                <Line type="monotone" dataKey="efficiency" stroke={colors[3]} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 2 }} activeDot={{ r: 5 }} name="Efficiency %" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </section>
  );
}
