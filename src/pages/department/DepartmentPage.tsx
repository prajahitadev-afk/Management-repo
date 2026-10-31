import { useEffect, useMemo, useState } from "react";
import { DepartmentHeader } from "../../components/department/DepartmentHeader";
import { DepartmentOverview } from "../../components/department/DepartmentOverview";
import { DepartmentTabs } from "../../components/department/DepartmentTabs";
import { AdministrationDashboard } from "../../components/AdministrationDashboard";
import { getDepartmentMetadata } from "../../services/department.service";
import { isValidUUID } from "../../utils/uuid";
import { canAccessTab, getAllowedTabs } from "../../services/department-access.service";
import {
  calculateTargetVsActual,
  getCMDashboard as getMarketingCMDashboard,
  getCampaigns,
  getGMDashboard as getMarketingGMDashboard,
  getMDMarketingDashboard,
  getWorkerDashboard as getMarketingWorkerDashboard,
  getLeadsByEmployee,
  getConversionsByEmployee,
  getManagerDashboard as getMarketingManagerDashboard,
  getSupervisorDashboard as getMarketingSupervisorDashboard,
  createCampaign,
  createLead,
  createTarget as createMarketingTarget,
  recordConversion,
} from "../../services/marketing.service";
import {
  createTrip,
  createTarget as createTransportationTarget,
  getCMDashboard as getTransportationCMDashboard,
  getDistanceLogsByDriver,
  getDelayLogsByDriver,
  getFuelLogsByDriver,
  getGMDashboard as getTransportationGMDashboard,
  getMDTransportationDashboard,
  getManagerDashboard as getTransportationManagerDashboard,
  getSupervisorDashboard as getTransportationSupervisorDashboard,
  getTripsByDriver,
  getWorkerDashboard as getTransportationWorkerDashboard,
  recordDelay,
  recordDistance,
  recordFuelUsage,
} from "../../services/transportation.service";
import {
  createExperiment,
  createMilestone,
  createProject,
  createSample,
  createTarget as createResearchTarget,
  getCMDashboard as getResearchCMDashboard,
  getExperimentsByEmployee,
  getGMDashboard as getResearchGMDashboard,
  getMDResearchDashboard,
  getManagerDashboard as getResearchManagerDashboard,
  getMilestones,
  getProjects,
  getResearchLogsByEmployee,
  getSamplesByEmployee,
  getSupervisorDashboard as getResearchSupervisorDashboard,
  getWorkerDashboard as getResearchWorkerDashboard,
} from "../../services/research.service";
import {
  getDefects,
  getDefectsByWorker,
  getGMDashboard,
  getCMDashboard,
  getManagerDashboard,
  getMDManufacturingDashboard,
  getOutputsByWorker,
  getHoursByWorker,
  getSupervisorDashboard,
  createBatch,
  createTarget as createManufacturingTarget,
  recordDefect,
  recordOutput,
  recordWorkingHours,
  type CMDashboard,
  type GMDashboard,
  type ManagerDashboard,
  type MDManufacturingDashboard,
  type ManufacturingDefect,
  type ManufacturingOutput,
  type SupervisorDashboard,
} from "../../services/manufacturing.service";

interface DepartmentPageProps { profile: { id: string; department?: string | null; role: string }; routeDepartment?: string; routeTab?: string; }

const VALID_DEPARTMENTS = ["Administration", "Manufacturing", "Marketing", "Transportation", "Research & Development"] as const;
const DEPARTMENT_EXECUTIVE_ROLES = new Set(["Managing Director", "President", "Vice President", "Vice Chairman"]);

function canonicalDepartment(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  return VALID_DEPARTMENTS.find((department) => department.toLowerCase() === normalized) ?? null;
}

function departmentFromRoute(value: string | undefined): string | null {
  const routeDepartments: Record<string, string> = {
    administration: "Administration",
    manufacturing: "Manufacturing",
    marketing: "Marketing",
    transportation: "Transportation",
    transport: "Transportation",
    research: "Research & Development",
    "research-and-development": "Research & Development",
    rd: "Research & Development",
  };
  return value ? routeDepartments[value.trim().toLowerCase()] ?? null : null;
}

type ManufacturingData = {
  worker?: { outputs: ManufacturingOutput[]; defects: ManufacturingDefect[]; hours: { total_hours: number; overtime_hours: number; average_daily_hours: number } };
  supervisor?: SupervisorDashboard;
  manager?: ManagerDashboard;
  cm?: CMDashboard;
  gm?: GMDashboard;
  md?: MDManufacturingDashboard;
};

type MarketingData = {
  worker?: Awaited<ReturnType<typeof getMarketingWorkerDashboard>>["data"];
  supervisor?: Awaited<ReturnType<typeof getMarketingSupervisorDashboard>>["data"];
  manager?: Awaited<ReturnType<typeof getMarketingManagerDashboard>>["data"];
  targetActual?: Awaited<ReturnType<typeof calculateTargetVsActual>>["data"];
  campaigns?: Awaited<ReturnType<typeof getCampaigns>>["data"];
  cm?: Awaited<ReturnType<typeof getMarketingCMDashboard>>["data"];
  gm?: Awaited<ReturnType<typeof getMarketingGMDashboard>>["data"];
  md?: Awaited<ReturnType<typeof getMDMarketingDashboard>>["data"];
};

function getRouteTab(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "department" ? parts[2] : undefined;
}

export default function DepartmentPage({ profile, routeDepartment, routeTab }: DepartmentPageProps) {
  const profileDepartment = canonicalDepartment(profile.department);
  const requestedDepartment = routeDepartment ? departmentFromRoute(routeDepartment) : null;
  const canSwitchDepartment = DEPARTMENT_EXECUTIVE_ROLES.has(profile.role);
  const department = canSwitchDepartment ? (requestedDepartment ?? profileDepartment ?? "") : (profileDepartment ?? "");
    const departmentError = !profileDepartment
      ? "Your profile has no valid department assigned."
      : routeDepartment && canSwitchDepartment && !requestedDepartment
        ? "The requested department is invalid."
        : "";
  const metadata = useMemo(() => getDepartmentMetadata(department), [department]);
  const tabs = useMemo(() => getAllowedTabs(profile.role, department), [profile.role, department]);
  const requestedTab = routeTab || getRouteTab();
  const matchingTab = tabs.find((tab) => tab.toLowerCase().replace(/[^a-z0-9]+/g, "-") === requestedTab?.toLowerCase());
  const initialTab = matchingTab && canAccessTab(profile.role, department, matchingTab) ? matchingTab : tabs[0];
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [metrics, setMetrics] = useState<Array<{ label: string; value: string }>>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [manufacturingData, setManufacturingData] = useState<ManufacturingData>({});
  const [marketingData, setMarketingData] = useState<MarketingData>({});
  const [tableData, setTableData] = useState<Record<string, Record<string, unknown>[]>>({});
  const [activeForm, setActiveForm] = useState<FormDefinition | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDataError("");
    setMetrics([]);
    setRecentActivity([]);
    setManufacturingData({});
    setMarketingData({});
    setTableData({});

    if (!isValidUUID(profile?.id)) {
      console.warn("Missing or invalid Department profile ID");
      setDataError("Loading department profile...");
      setLoading(false);
      return () => { active = false; };
    }

    if (departmentError) {
      setDataError(departmentError);
      setLoading(false);
      return () => { active = false; };
    }

    async function loadDepartmentData() {
      try {
        if (metadata.key === "manufacturing") {
          const role = profile.role;
          if (role === "Admin") {
            const [outputs, defects, hours, supervisor, manager, cm, gm, md] = await Promise.all([
              getOutputsByWorker(profile.id), getDefectsByWorker(profile.id), getHoursByWorker(profile.id),
              getSupervisorDashboard(profile.id, profile.department), getManagerDashboard(profile.id, profile.department), getCMDashboard(profile.department), getGMDashboard(profile.department), getMDManufacturingDashboard(profile.department),
            ]);
            const failure = [outputs, defects, hours, supervisor, manager, cm, gm, md].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Worker output", value: String((outputs.data ?? []).reduce((sum, row) => sum + Number(row.quantity_produced || 0), 0)) },
              { label: "Worker defects", value: String((defects.data ?? []).length) },
              { label: "Worker hours", value: String((hours.data ?? []).reduce((sum, row) => sum + Number(row.hours_worked || 0), 0)) },
              { label: "Team output", value: String(supervisor.data?.team_output ?? 0) },
              { label: "Target achievement", value: `${(manager.data?.achievement_percentage ?? 0).toFixed(1)}%` },
              { label: "Department quality", value: `${(cm.data?.quality_score ?? 0).toFixed(1)}%` },
              { label: "Department hours", value: String(gm.data?.total_hours ?? 0) },
              { label: "Annual achievement", value: `${(md.data?.achievement_percentage ?? 0).toFixed(1)}%` },
            ]);
            setTableData({ outputs: asRecords(outputs.data), defects: asRecords(defects.data), hours: asRecords(hours.data) });
            setRecentActivity((outputs.data ?? []).slice(0, 5).map((row) => `Batch ${row.batch_id} Â· ${row.quantity_produced} units Â· ${row.production_date}`));
          } else if (role === "Worker") {
            const [outputs, defects, hours] = await Promise.all([
              getOutputsByWorker(profile.id),
              getDefectsByWorker(profile.id),
              getHoursByWorker(profile.id),
            ]);
            const failure = [outputs, defects, hours].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            const totalHours = (hours.data ?? []).reduce((sum, row) => sum + Number(row.hours_worked || 0), 0);
            const overtimeHours = (hours.data ?? []).reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0);
            setManufacturingData({ worker: { outputs: outputs.data ?? [], defects: defects.data ?? [], hours: { total_hours: totalHours, overtime_hours: overtimeHours, average_daily_hours: hours.data?.length ? totalHours / new Set(hours.data.map((row) => row.work_date)).size : 0 } } });
            setTableData({ outputs: asRecords(outputs.data), defects: asRecords(defects.data), hours: asRecords(hours.data) });
            setMetrics([
              { label: "Total soaps produced", value: String((outputs.data ?? []).reduce((sum, row) => sum + Number(row.quantity_produced || 0), 0)) },
              { label: "Today's output", value: String((outputs.data ?? []).filter((row) => row.production_date === new Date().toISOString().slice(0, 10)).reduce((sum, row) => sum + Number(row.quantity_produced || 0), 0)) },
              { label: "Defects reported", value: String((defects.data ?? []).length) },
            ]);
            setRecentActivity((outputs.data ?? []).slice(0, 4).map((row) => `Batch ${row.batch_id} Â· ${row.quantity_produced} units Â· ${row.production_date}`));
          } else if (role === "Supervisor") {
            const result = await getSupervisorDashboard(profile.id, profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setManufacturingData({ supervisor: result.data! });
            setMetrics([
              { label: "Team output", value: String(result.data!.team_output) },
              { label: "Quality", value: `${result.data!.quality_percentage.toFixed(1)}%` },
              { label: "Active batches", value: String(result.data!.active_batches) },
            ]);
          } else if (role === "Manager") {
            const result = await getManagerDashboard(profile.id, profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setManufacturingData({ manager: result.data! });
            setMetrics([{ label: "Target quantity", value: String(result.data!.targets) }, { label: "Actual quantity", value: String(result.data!.actuals) }, { label: "Achievement", value: `${result.data!.achievement_percentage.toFixed(1)}%` }]);
          } else if (role === "Chief Manager") {
            const result = await getCMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setManufacturingData({ cm: result.data! });
            setMetrics([{ label: "Department output", value: String(result.data!.department_output) }, { label: "Quality score", value: `${result.data!.quality_score.toFixed(1)}%` }, { label: "Target achievement", value: `${result.data!.target_achievement.toFixed(1)}%` }]);
          } else if (role === "General Manager") {
            const result = await getGMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setManufacturingData({ gm: result.data! });
            setMetrics([{ label: "Department output", value: String(result.data!.department_output) }, { label: "Total hours", value: String(result.data!.total_hours) }, { label: "Defect rate", value: `${result.data!.defect_rate.toFixed(1)}%` }]);
          } else {
            const result = await getMDManufacturingDashboard();
            if (result.error) throw result.error;
            if (!active) return;
            setManufacturingData({ md: result.data! });
            setMetrics([{ label: "Annual output", value: String(result.data!.annual_output) }, { label: "Annual targets", value: String(result.data!.annual_targets) }, { label: "Achievement", value: `${result.data!.achievement_percentage.toFixed(1)}%` }]);
          }
          const defectQueue = await getDefects();
          if (defectQueue.error) throw defectQueue.error;
          if (active) setTableData((current) => ({ ...current, defects: asRecords(defectQueue.data) }));
        } else if (metadata.key === "marketing") {
          const role = profile.role;
          if (role === "Admin") {
            const [worker, leads, conversions, supervisor, campaigns, manager, targetActual, cm, gm, md] = await Promise.all([
              getMarketingWorkerDashboard(profile.id), getLeadsByEmployee(profile.id), getConversionsByEmployee(profile.id),
              getMarketingSupervisorDashboard(profile.id), getCampaigns(), getMarketingManagerDashboard(profile.id, profile.department), calculateTargetVsActual(profile.id),
              getMarketingCMDashboard(profile.department), getMarketingGMDashboard(profile.department), getMDMarketingDashboard(),
            ]);
            const failure = [worker, leads, conversions, supervisor, campaigns, manager, targetActual, cm, gm, md].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Worker leads", value: String(worker.data?.total_leads ?? 0) },
              { label: "Worker conversions", value: String(worker.data?.converted_leads ?? 0) },
              { label: "Team leads", value: String(supervisor.data?.team_leads ?? 0) },
              { label: "Campaign count", value: String(manager.data?.campaign_count ?? 0) },
              { label: "Target achievement", value: `${(targetActual.data?.achievement_percentage ?? 0).toFixed(1)}%` },
              { label: "Department efficiency", value: `${(cm.data?.department_efficiency ?? 0).toFixed(1)}%` },
              { label: "Department analytics", value: String(gm.data?.department_analytics ?? 0) },
              { label: "Annual achievement", value: `${(md.data?.annual_target_achievement ?? 0).toFixed(1)}%` },
            ]);
            setTableData({ leads: asRecords(leads.data), conversions: asRecords(conversions.data), campaigns: asRecords(campaigns.data) });
            setRecentActivity([
              ...(leads.data ?? []).slice(0, 3).map((lead) => `Lead ${lead.name} Â· ${lead.status}`),
              ...(campaigns.data ?? []).slice(0, 2).map((campaign) => `${campaign.name} Â· ${campaign.status}`),
            ].slice(0, 5));
          } else if (role === "Worker") {
            const [worker, leads, conversions] = await Promise.all([getMarketingWorkerDashboard(profile.id), getLeadsByEmployee(profile.id), getConversionsByEmployee(profile.id)]);
            const failure = [worker, leads, conversions].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMarketingData({ worker: worker.data });
            setTableData({ leads: asRecords(leads.data), conversions: asRecords(conversions.data) });
            setMetrics([{ label: "Total leads", value: String(worker.data?.total_leads ?? 0) }, { label: "Qualified leads", value: String(worker.data?.qualified_leads ?? 0) }, { label: "Converted leads", value: String(worker.data?.converted_leads ?? 0) }, { label: "Conversion rate", value: `${(worker.data?.conversion_rate ?? 0).toFixed(1)}%` }]);
            setRecentActivity([
              ...(leads.data ?? []).slice(0, 3).map((lead) => `Lead ${lead.name} Â· ${lead.status}`),
              ...(conversions.data ?? []).slice(0, 3).map((conversion) => `Conversion ${conversion.lead_id} Â· â‚¹${Number(conversion.revenue || 0).toLocaleString("en-IN")}`),
            ].slice(0, 5));
          } else if (role === "Supervisor") {
            const result = await getMarketingSupervisorDashboard(profile.id);
            if (result.error) throw result.error;
            if (!active) return;
            setMarketingData({ supervisor: result.data });
            setMetrics([{ label: "Team leads", value: String(result.data?.team_leads ?? 0) }, { label: "Team conversions", value: String(result.data?.team_conversions ?? 0) }, { label: "Team conversion rate", value: `${(result.data?.team_conversion_rate ?? 0).toFixed(1)}%` }, { label: "Active campaigns", value: String(result.data?.active_campaigns ?? 0) }]);
          } else if (role === "Manager") {
            const [campaigns, manager, targetActual] = await Promise.all([getCampaigns(), getMarketingManagerDashboard(profile.id, profile.department), calculateTargetVsActual(profile.id)]);
            const failure = [campaigns, manager, targetActual].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMarketingData({ campaigns: campaigns.data, manager: manager.data, targetActual: targetActual.data });
            setTableData({ campaigns: asRecords(campaigns.data) });
            setMetrics([{ label: "Campaign count", value: String(manager.data?.campaign_count ?? 0) }, { label: "Revenue", value: `â‚¹${(manager.data?.revenue ?? 0).toLocaleString("en-IN")}` }, { label: "Target quantity", value: String(targetActual.data?.target_quantity ?? 0) }, { label: "Actual quantity", value: String(targetActual.data?.actual_quantity ?? 0) }, { label: "Achievement", value: `${(targetActual.data?.achievement_percentage ?? 0).toFixed(1)}%` }]);
            setRecentActivity((campaigns.data ?? []).slice(0, 5).map((campaign) => `${campaign.name} Â· ${campaign.status}`));
          } else if (role === "Chief Manager") {
            const result = await getMarketingCMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMarketingData({ cm: result.data });
            setMetrics([{ label: "Department efficiency", value: `${(result.data?.department_efficiency ?? 0).toFixed(1)}%` }, { label: "Campaign performance", value: String(result.data?.campaign_performance ?? 0) }, { label: "Target achievement", value: `${(result.data?.target_achievement ?? 0).toFixed(1)}%` }]);
          } else if (role === "General Manager") {
            const result = await getMarketingGMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMarketingData({ gm: result.data });
            setMetrics([{ label: "Department analytics", value: String(result.data?.department_analytics ?? 0) }, { label: "Revenue trend points", value: String(result.data?.revenue_trends.length ?? 0) }, { label: "Conversion trend points", value: String(result.data?.conversion_trends.length ?? 0) }]);
            setRecentActivity((result.data?.revenue_trends ?? []).slice(-5).map((trend) => `${trend.period} Â· â‚¹${trend.revenue.toLocaleString("en-IN")}`));
          } else {
            const result = await getMDMarketingDashboard();
            if (result.error) throw result.error;
            if (!active) return;
            setMarketingData({ md: result.data });
            setMetrics([{ label: "Revenue growth", value: `â‚¹${(result.data?.revenue_growth ?? 0).toLocaleString("en-IN")}` }, { label: "Strategic campaign metrics", value: String(result.data?.strategic_campaign_metrics ?? 0) }, { label: "Annual target achievement", value: `${(result.data?.annual_target_achievement ?? 0).toFixed(1)}%` }]);
          }
        } else if (metadata.key === "research") {
          const role = profile.role;
          if (role === "Admin") {
            const [worker, experiments, samples, logs, supervisor, manager, projects, milestones, cm, gm, md] = await Promise.all([
              getResearchWorkerDashboard(profile.id), getExperimentsByEmployee(profile.id), getSamplesByEmployee(profile.id), getResearchLogsByEmployee(profile.id),
              getResearchSupervisorDashboard(profile.id), getResearchManagerDashboard(profile.id), getProjects(), getMilestones(),
              getResearchCMDashboard(profile.department), getResearchGMDashboard(profile.department), getMDResearchDashboard(),
            ]);
            const failure = [worker, experiments, samples, logs, supervisor, manager, projects, milestones, cm, gm, md].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Worker experiments", value: String(worker.data?.experiments ?? 0) },
              { label: "Worker samples", value: String(worker.data?.samples ?? 0) },
              { label: "Worker research logs", value: String(worker.data?.research_logs ?? 0) },
              { label: "Team progress", value: `${(supervisor.data?.team_progress ?? 0).toFixed(1)}%` },
              { label: "Project progress", value: `${(manager.data?.project_progress ?? 0).toFixed(1)}%` },
              { label: "Research progress", value: `${(cm.data?.research_progress ?? 0).toFixed(1)}%` },
              { label: "Department capacity", value: String(gm.data?.department_capacity ?? 0) },
              { label: "Innovation roadmap", value: String(md.data?.innovation_roadmap ?? 0) },
            ]);
            setTableData({ projects: asRecords(projects.data), experiments: asRecords(experiments.data), samples: asRecords(samples.data) });
            setRecentActivity([
              ...(experiments.data ?? []).slice(0, 2).map((experiment) => `${experiment.name} Â· ${experiment.status}`),
              ...(projects.data ?? []).slice(0, 3).map((project) => `${project.name} Â· ${project.status}`),
            ].slice(0, 5));
          } else if (role === "Worker") {
            const [dashboard, experiments, samples, logs] = await Promise.all([
              getResearchWorkerDashboard(profile.id),
              getExperimentsByEmployee(profile.id),
              getSamplesByEmployee(profile.id),
              getResearchLogsByEmployee(profile.id),
            ]);
            const failure = [dashboard, experiments, samples, logs].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Experiments", value: String(dashboard.data?.experiments ?? 0) },
              { label: "Samples", value: String(dashboard.data?.samples ?? 0) },
              { label: "Research Logs", value: String(dashboard.data?.research_logs ?? 0) },
            ]);
            setTableData({ experiments: asRecords(experiments.data), samples: asRecords(samples.data), logs: asRecords(logs.data) });
            setRecentActivity([
              ...(experiments.data ?? []).slice(0, 2).map((experiment) => `${experiment.name} Â· ${experiment.status}`),
              ...(logs.data ?? []).slice(0, 3).map((log) => `${log.log_date} Â· ${log.description}`),
            ].slice(0, 5));
          } else if (role === "Supervisor") {
            const result = await getResearchSupervisorDashboard(profile.id);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Team Progress", value: `${(result.data?.team_progress ?? 0).toFixed(1)}%` },
              { label: "Active Experiments", value: String(result.data?.active_experiments ?? 0) },
              { label: "Sample Count", value: String(result.data?.sample_count ?? 0) },
            ]);
          } else if (role === "Manager") {
            const [dashboard, projects, milestones] = await Promise.all([
              getResearchManagerDashboard(profile.id),
              getProjects(),
              getMilestones(),
            ]);
            const failure = [dashboard, projects, milestones].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Milestones", value: String(dashboard.data?.milestones ?? 0) },
              { label: "Project Progress", value: `${(dashboard.data?.project_progress ?? 0).toFixed(1)}%` },
              { label: "Target Achievement", value: `${(dashboard.data?.target_achievement ?? 0).toFixed(1)}%` },
            ]);
            setTableData({ projects: asRecords(projects.data), milestones: asRecords(milestones.data) });
            setRecentActivity([
              ...(projects.data ?? []).slice(0, 3).map((project) => `${project.name} Â· ${project.status}`),
              ...(milestones.data ?? []).slice(0, 2).map((milestone) => `${milestone.name} Â· ${milestone.status}`),
            ].slice(0, 5));
          } else if (role === "Chief Manager") {
            const result = await getResearchCMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Research Progress", value: `${(result.data?.research_progress ?? 0).toFixed(1)}%` },
              { label: "Project Comparison", value: String(result.data?.project_comparison ?? 0) },
              { label: "Risk Indicators", value: String(result.data?.risk_indicators ?? 0) },
            ]);
          } else if (role === "General Manager") {
            const result = await getResearchGMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Innovation Reports", value: String(result.data?.innovation_reports ?? 0) },
              { label: "Portfolio Analytics", value: String(result.data?.portfolio_analytics ?? 0) },
              { label: "Department Capacity", value: String(result.data?.department_capacity ?? 0) },
            ]);
          } else {
            const result = await getMDResearchDashboard();
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Product Development", value: String(result.data?.product_development ?? 0) },
              { label: "Strategic Portfolio", value: String(result.data?.strategic_portfolio ?? 0) },
              { label: "Innovation Roadmap", value: String(result.data?.innovation_roadmap ?? 0) },
            ]);
          }
        } else if (metadata.key === "transportation") {
          const role = profile.role;
          if (role === "Admin") {
            const [worker, distance, fuel, trips, delays, supervisor, manager, cm, gm, md] = await Promise.all([
              getTransportationWorkerDashboard(profile.id), getDistanceLogsByDriver(profile.id), getFuelLogsByDriver(profile.id), getTripsByDriver(profile.id), getDelayLogsByDriver(profile.id),
              getTransportationSupervisorDashboard(profile.id), getTransportationManagerDashboard(profile.id), getTransportationCMDashboard(profile.department), getTransportationGMDashboard(profile.department), getMDTransportationDashboard(),
            ]);
            const failure = [worker, distance, fuel, trips, delays, supervisor, manager, cm, gm, md].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Worker trips", value: String(worker.data?.trips_completed ?? 0) },
              { label: "Worker distance", value: String(worker.data?.total_distance ?? 0) },
              { label: "Worker fuel", value: String(worker.data?.fuel_consumed ?? 0) },
              { label: "Team trips", value: String(supervisor.data?.team_trips ?? 0) },
              { label: "Fleet operations", value: String(manager.data?.fleet_operations ?? 0) },
              { label: "Route efficiency", value: `${(cm.data?.route_efficiency ?? 0).toFixed(1)}%` },
              { label: "Fleet utilization", value: String(gm.data?.fleet_utilization ?? 0) },
              { label: "Transportation performance", value: `${(md.data?.transportation_performance ?? 0).toFixed(1)}%` },
            ]);
            setTableData({ trips: asRecords(trips.data), fuel: asRecords(fuel.data), distance: asRecords(distance.data), delays: asRecords(delays.data) });
            setRecentActivity((trips.data ?? []).slice(0, 5).map((trip) => `${trip.route_name ?? trip.route_id ?? "Trip"} Â· ${trip.status} Â· ${trip.trip_date}`));
          } else if (role === "Worker") {
            const [dashboard, distance, fuel, trips, delays] = await Promise.all([
              getTransportationWorkerDashboard(profile.id),
              getDistanceLogsByDriver(profile.id),
              getFuelLogsByDriver(profile.id),
              getTripsByDriver(profile.id),
              getDelayLogsByDriver(profile.id),
            ]);
            const failure = [dashboard, distance, fuel, trips, delays].find((result) => result.error);
            if (failure?.error) throw failure.error;
            if (!active) return;
            setMetrics([
              { label: "Trips completed", value: String(dashboard.data?.trips_completed ?? 0) },
              { label: "Total distance", value: String(dashboard.data?.total_distance ?? 0) },
              { label: "Fuel consumed", value: String(dashboard.data?.fuel_consumed ?? 0) },
              { label: "Delay count", value: String(dashboard.data?.delay_count ?? 0) },
            ]);
            setTableData({ trips: asRecords(trips.data), fuel: asRecords(fuel.data), distance: asRecords(distance.data), delays: asRecords(delays.data) });
            setRecentActivity((trips.data ?? []).slice(0, 4).map((trip) => `${trip.route_name ?? trip.route_id ?? "Trip"} Â· ${trip.status} Â· ${trip.trip_date}`));
          } else if (role === "Supervisor") {
            const result = await getTransportationSupervisorDashboard(profile.id);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Team trips", value: String(result.data?.team_trips ?? 0) },
              { label: "Team distance", value: String(result.data?.team_distance ?? 0) },
              { label: "Team delays", value: String(result.data?.team_delays ?? 0) },
              { label: "Active routes", value: String(result.data?.active_routes ?? 0) },
            ]);
          } else if (role === "Manager") {
            const result = await getTransportationManagerDashboard(profile.id);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Fleet operations", value: String(result.data?.fleet_operations ?? 0) },
              { label: "Target deliveries", value: String(result.data?.target_deliveries ?? 0) },
              { label: "Actual deliveries", value: String(result.data?.actual_deliveries ?? 0) },
              { label: "Achievement", value: `${(result.data?.achievement_percentage ?? 0).toFixed(1)}%` },
            ]);
          } else if (role === "Chief Manager") {
            const result = await getTransportationCMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Route efficiency", value: `${(result.data?.route_efficiency ?? 0).toFixed(1)}%` },
              { label: "Cost analysis", value: String(result.data?.cost_analysis ?? 0) },
              { label: "Service quality", value: `${(result.data?.service_quality ?? 0).toFixed(1)}%` },
            ]);
          } else if (role === "General Manager") {
            const result = await getTransportationGMDashboard(profile.department);
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Logistics analytics", value: String(result.data?.logistics_analytics ?? 0) },
              { label: "Fleet utilization", value: String(result.data?.fleet_utilization ?? 0) },
              { label: "Department comparison", value: String(result.data?.department_comparison ?? 0) },
            ]);
          } else {
            const result = await getMDTransportationDashboard();
            if (result.error) throw result.error;
            if (!active) return;
            setMetrics([
              { label: "Strategic fleet metrics", value: String(result.data?.strategic_fleet_metrics ?? 0) },
              { label: "Annual delivery achievement", value: `${(result.data?.annual_delivery_achievement ?? 0).toFixed(1)}%` },
              { label: "Transportation performance", value: `${(result.data?.transportation_performance ?? 0).toFixed(1)}%` },
            ]);
          }
        } else if (active) {
          setMetrics([{ label: "Data status", value: "Placeholder" }, { label: "Available views", value: String(tabs.length) }]);
          setRecentActivity([`${metadata.name} data integrations are ready for implementation.`]);
        }
      } catch (error) {
        if (active) setDataError(error instanceof Error ? error.message : "Unable to load department data");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDepartmentData();
    return () => { active = false; };
  }, [departmentError, metadata.key, metadata.name, profile.id, profile.role, tabs.length, refreshVersion]);

  function changeTab(tab: string) {
    setActiveTab(tab);
    if (typeof window !== "undefined") window.history.replaceState({}, "", `/department/${metadata.key}/${tab.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
  }

  const manufacturingMetrics = manufacturingData.worker;
  const activeMetrics = activeTab === "Production" && manufacturingMetrics ? [
    { label: "Total soaps produced", value: String(manufacturingMetrics.outputs.reduce((sum, row) => sum + Number(row.quantity_produced || 0), 0)) },
    { label: "Today's output", value: String(manufacturingMetrics.outputs.filter((row) => row.production_date === new Date().toISOString().slice(0, 10)).reduce((sum, row) => sum + Number(row.quantity_produced || 0), 0)) },
    { label: "Recent batch outputs", value: String(manufacturingMetrics.outputs.slice(0, 5).length) },
  ] : activeTab === "Defects" && manufacturingMetrics ? [{ label: "Defect tracking", value: "No defect tracking data available" }] : activeTab === "Hours" && manufacturingMetrics ? [{ label: "Hours worked", value: String(manufacturingMetrics.hours.total_hours) }, { label: "Average daily hours", value: manufacturingMetrics.hours.average_daily_hours.toFixed(1) }, { label: "Overtime", value: String(manufacturingMetrics.hours.overtime_hours) }] : metrics;
  const tableConfig: { key: string; columns: TableColumn[] } | null = metadata.key === "manufacturing" && activeTab === "Production" ? { key: "outputs", columns: [{ label: "Date", value: (row) => recordValue(row, "production_date") }, { label: "Batch", value: (row) => recordValue(row, "batch_id") }, { label: "Quantity", value: (row) => recordValue(row, "quantity") }, { label: "Remarks", value: (row) => recordValue(row, "remarks", "description") }] } : metadata.key === "manufacturing" && activeTab === "Defects" ? { key: "defects", columns: [{ label: "Type", value: (row) => recordValue(row, "defect_type", "type") }, { label: "Quantity", value: (row) => recordValue(row, "quantity") }, { label: "Severity", value: (row) => recordValue(row, "severity", "defect_type") }, { label: "Status", value: (row) => recordValue(row, "status") }] } : metadata.key === "manufacturing" && activeTab === "Hours" ? { key: "hours", columns: [{ label: "Date", value: (row) => recordValue(row, "work_date") }, { label: "Hours", value: (row) => recordValue(row, "hours_worked") }, { label: "Overtime", value: (row) => recordValue(row, "overtime_hours") }, { label: "Remarks", value: (row) => recordValue(row, "remarks", "description") }] } : metadata.key === "marketing" && activeTab === "Leads" ? { key: "leads", columns: [{ label: "Lead Name", value: (row) => recordValue(row, "name", "lead_name") }, { label: "Status", value: (row) => recordValue(row, "status") }, { label: "Source", value: (row) => recordValue(row, "source") }, { label: "Created", value: (row) => recordValue(row, "created_at") }] } : metadata.key === "marketing" && activeTab === "Conversions" ? { key: "conversions", columns: [{ label: "Customer", value: (row) => recordValue(row, "customer", "customer_name", "lead_id") }, { label: "Revenue", value: (row) => recordValue(row, "conversion_value") }, { label: "Date", value: (row) => recordValue(row, "conversion_date", "created_at") }] } : metadata.key === "marketing" && activeTab === "Campaigns" ? { key: "campaigns", columns: [{ label: "Campaign", value: (row) => recordValue(row, "name") }, { label: "Status", value: (row) => recordValue(row, "status") }, { label: "Budget", value: (row) => recordValue(row, "budget") }, { label: "Start Date", value: (row) => recordValue(row, "start_date") }, { label: "End Date", value: (row) => recordValue(row, "end_date") }] } : metadata.key === "transportation" && activeTab === "Trips" ? { key: "trips", columns: [{ label: "Route", value: (row) => recordValue(row, "route_name", "route_id") }, { label: "Vehicle", value: (row) => recordValue(row, "vehicle_id") }, { label: "Status", value: (row) => recordValue(row, "status") }, { label: "Date", value: (row) => recordValue(row, "trip_date") }] } : metadata.key === "transportation" && activeTab === "Fuel" ? { key: "fuel", columns: [{ label: "Vehicle", value: (row) => recordValue(row, "vehicle_id", "trip_id") }, { label: "Fuel Used", value: (row) => recordValue(row, "fuel_consumed") }, { label: "Cost", value: (row) => recordValue(row, "fuel_cost") }, { label: "Date", value: (row) => recordValue(row, "recorded_at") }] } : metadata.key === "transportation" && activeTab === "Distance" ? { key: "distance", columns: [{ label: "Route", value: (row) => recordValue(row, "route_name", "route_id", "trip_id") }, { label: "Distance", value: (row) => recordValue(row, "distance", "distance_unit") }, { label: "Date", value: (row) => recordValue(row, "recorded_at") }] } : metadata.key === "transportation" && (activeTab === "Delays" || activeTab === "Delay Tracking") ? { key: "delays", columns: [{ label: "Route", value: (row) => recordValue(row, "route_name", "route_id", "trip_id") }, { label: "Delay Reason", value: (row) => recordValue(row, "reason") }, { label: "Duration", value: (row) => recordValue(row, "delay_minutes") }, { label: "Date", value: (row) => recordValue(row, "recorded_at") }] } : metadata.key === "research" && activeTab === "Projects" ? { key: "projects", columns: [{ label: "Project", value: (row) => recordValue(row, "name", "project_name") }, { label: "Status", value: (row) => recordValue(row, "status") }, { label: "Start Date", value: (row) => recordValue(row, "start_date") }, { label: "End Date", value: (row) => recordValue(row, "end_date") }] } : metadata.key === "research" && activeTab === "Experiments" ? { key: "experiments", columns: [{ label: "Experiment", value: (row) => recordValue(row, "name", "experiment_name") }, { label: "Status", value: (row) => recordValue(row, "status") }, { label: "Progress", value: (row) => recordValue(row, "progress") }] } : metadata.key === "research" && activeTab === "Samples" ? { key: "samples", columns: [{ label: "Sample", value: (row) => recordValue(row, "name", "sample_name") }, { label: "Type", value: (row) => recordValue(row, "type", "sample_type") }, { label: "Collected Date", value: (row) => recordValue(row, "collected_date", "created_at") }] } : null;
  if (tableConfig?.key === "defects" && profile.role !== "Worker") {
    tableConfig.columns.push({ label: "Action", value: () => "", action: true });
  }
  const secondaryForm = getSecondaryFormDefinition(metadata.key, activeTab);
  const availableForm = getFormDefinition(metadata.key, activeTab);
  const openForm = (definition: FormDefinition | null) => { if (!definition) return; setFormValues({}); setFormError(""); setActiveForm(definition); };
  const handleReviewDefect = async (row: Record<string, unknown>) => {
    const defectId = String(row.id ?? "");
    if (!defectId) { setDataError("Defect ID is missing"); return; }
    const result = await reviewDefect(defectId, profile.id);
    if (result.error) { setDataError(result.error.message); return; }
    setDataError("");
    setSuccessMessage("Defect reviewed successfully");
    setRefreshVersion((version) => version + 1);
  };
  const submitForm = async () => {
    if (!activeForm) return;
    const missing = activeForm.fields.find((field) => field.required && !formValues[field.key]?.trim());
    if (missing) { setFormError(`${missing.label} is required`); return; }
    const invalidNumber = activeForm.fields.find((field) => field.type === "number" && formValues[field.key] && Number(formValues[field.key]) <= 0);
    if (invalidNumber) { setFormError(`${invalidNumber.label} must be greater than zero`); return; }
    const dateFields = activeForm.fields.filter((field) => field.type === "date" && formValues[field.key]);
    if (dateFields.some((field) => Number.isNaN(new Date(formValues[field.key]).getTime()))) { setFormError("Enter valid dates"); return; }
    setSubmitting(true);
    setFormError("");
    try {
      const value = formValues;
      let result: { error: Error | null };
      switch (activeForm.kind) {
        case "batch": result = await createBatch({ batch_number: value.batch_number, product_name: value.product_name, target_quantity: Number(value.target_quantity), start_date: value.start_date, end_date: value.end_date, supervisor_id: value.supervisor_id || null, manager_id: profile.id }); break;
        case "output": result = await recordOutput({ batch_id: value.batch_id, worker_id: profile.id, quantity_produced: Number(value.quantity_produced), production_date: value.production_date, remarks: value.remarks }); break;
        case "defect": result = await recordDefect({ batch_id: value.batch_id, worker_id: profile.id, defect_type: value.defect_type, quantity: Number(value.quantity), severity: (value.severity || "Medium") as "Low" | "Medium" | "High" | "Critical", description: value.description }); break;
        case "hours": result = await recordWorkingHours({ batch_id: value.batch_id, worker_id: profile.id, work_date: value.work_date, hours_worked: Number(value.hours_worked), overtime_hours: Number(value.overtime_hours || 0), remarks: value.remarks }); break;
        case "manufacturing-target": result = await createManufacturingTarget({ manager_id: profile.id, target_quantity: Number(value.target_quantity), period_start: value.period_start, period_end: value.period_end }); break;
        case "lead": result = await createLead({ assigned_to: profile.id, name: value.name, source: value.source, status: value.status }); break;
        case "campaign": result = await createCampaign({ manager_id: profile.id, name: value.name, budget: Number(value.budget), start_date: value.start_date, end_date: value.end_date, status: value.status }); break;
        case "conversion": result = await recordConversion({ lead_id: value.lead_id, converted_by: profile.id, conversion_value: Number(value.conversion_value), conversion_date: value.conversion_date }); break;
        case "marketing-target": result = await createMarketingTarget({ manager_id: profile.id, target_quantity: Number(value.target_quantity), target_period: value.target_period, start_date: value.start_date, end_date: value.end_date }); break;
        case "trip": result = await createTrip({ driver_id: value.driver_id, vehicle_id: value.vehicle_id || null, route_name: value.route_name, trip_date: value.trip_date, status: value.status, manager_id: profile.id }); break;
        case "distance": result = await recordDistance({ driver_id: profile.id, distance: Number(value.distance), log_date: value.log_date }); break;
        case "fuel": result = await recordFuelUsage({ driver_id: profile.id, fuel_consumed: Number(value.fuel_consumed), fuel_cost: Number(value.fuel_cost), log_date: value.log_date }); break;
        case "delay": result = await recordDelay({ trip_id: value.trip_id, delay_minutes: Number(value.delay_minutes), reason: value.reason, recorded_at: value.recorded_at }); break;
        case "transportation-target": result = await createTransportationTarget({ manager_id: profile.id, target_deliveries: Number(value.target_deliveries), period_start: value.period_start, period_end: value.period_end }); break;
        case "project": result = await createProject({ name: value.name, description: value.description, start_date: value.start_date, end_date: value.end_date, status: value.status, manager_id: profile.id }); break;
        case "experiment": result = await createExperiment({ project_id: value.project_id || null, owner_id: profile.id, name: value.name, description: value.description, status: value.status }); break;
        case "sample": result = await createSample({ collected_by: profile.id, name: value.name }); break;
        case "milestone": result = await createMilestone({ project_id: value.project_id, title: value.title, description: value.description || null, target_date: value.target_date, status: value.status }); break;
        case "research-target": result = await createResearchTarget({ manager_id: profile.id, target_quantity: Number(value.target_quantity), period_start: value.period_start, period_end: value.period_end }); break;
        default: throw new Error("Unsupported department form");
      }
      if (metadata.key === "administration") return <AdministrationDashboard profile={profile} />;
      if (result.error) throw result.error;
      setActiveForm(null); setSuccessMessage(`${activeForm.title} saved successfully`); setRefreshVersion((version) => version + 1);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to save record"); }
    finally { setSubmitting(false); }
  };
  return <main className="min-h-full p-4 sm:p-6" style={{ background: "linear-gradient(180deg, #F7E7CB 0%, #EFD7AF 100%)" }}><div className="mx-auto max-w-7xl space-y-5"><DepartmentHeader metadata={metadata} role={profile.role} /><div className="rounded-2xl border border-white/60 bg-white/45 p-2 shadow-sm"><DepartmentTabs tabs={tabs} activeTab={activeTab} onChange={changeTab} /></div>{successMessage && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>}{dataError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{dataError}</div>}{loading ? <div className="rounded-2xl border border-white/60 bg-white/45 p-6 text-sm text-slate-600">Loading department data...</div> : activeTab === tabs[0] && !availableForm && !secondaryForm ? <DepartmentOverview metadata={metadata} tabs={tabs} metrics={activeMetrics} recentActivity={recentActivity} /> : <section className="rounded-2xl border border-white/60 bg-white/45 p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-800">{activeTab}</h2><div className="flex gap-2">{availableForm && <button type="button" onClick={() => openForm(availableForm)} className="rounded-lg bg-[#4e8050] px-3 py-2 text-sm font-medium text-white">+ {availableForm.title}</button>}{secondaryForm && <button type="button" onClick={() => openForm(secondaryForm)} className="rounded-lg bg-[#4e8050] px-3 py-2 text-sm font-medium text-white">+ {secondaryForm.title}</button>}</div></div>{tableConfig ? <DepartmentDataTable loading={loading} error={dataError} rows={tableData[tableConfig.key] ?? []} columns={tableConfig.columns} onReviewDefect={handleReviewDefect} /> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{metrics.slice(0, 3).map((metric) => <div key={metric.label} className="rounded-xl bg-white/45 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-slate-800">{metric.value}</p></div>)}</div>}</section>}</div>{activeForm && <DepartmentFormModal definition={activeForm} values={formValues} error={formError} submitting={submitting} onChange={(key, value) => setFormValues((current) => ({ ...current, [key]: value }))} onClose={() => { setActiveForm(null); setFormError(""); }} onSubmit={submitForm} />}</main>;
}

type TableColumn = { label: string; value: (row: Record<string, unknown>) => string; action?: boolean };

function recordValue(row: Record<string, unknown>, ...keys: string[]): string {
  const value = keys.map((key) => row[key]).find((entry) => entry !== null && entry !== undefined && entry !== "");
  return value === undefined || value === null ? "-" : String(value);
}

function asRecords<T>(rows: T[] | null): Record<string, unknown>[] {
  return (rows ?? []) as unknown as Record<string, unknown>[];
}

function DepartmentDataTable({ loading, error, rows, columns, onReviewDefect }: { loading: boolean; error: string; rows: Record<string, unknown>[]; columns: TableColumn[]; onReviewDefect?: (row: Record<string, unknown>) => void }) {
  if (loading) return <p className="mt-4 text-sm text-slate-600">Loading records...</p>;
  if (error) return <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>;
  if (!rows.length) return <p className="mt-4 text-sm text-slate-600">No records found</p>;
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-black/10 text-xs uppercase tracking-wide text-slate-500">{columns.map((column) => <th key={column.label} className="px-3 py-2 font-semibold">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={recordValue(row, "id") || String(index)} className="border-b border-black/5 text-slate-700">{columns.map((column) => <td key={column.label} className="px-3 py-3">{column.action ? (row.status === "Open" ? <button type="button" onClick={() => onReviewDefect?.(row)} className="rounded-md bg-[#4e8050] px-3 py-1.5 text-xs font-medium text-white">Review</button> : <span className="text-slate-500">Reviewed</span>) : column.value(row)}</td>)}</tr>)}</tbody></table></div>;
}

type FormField = { key: string; label: string; type?: "number" | "date"; required?: boolean };
type FormDefinition = { kind: string; title: string; fields: FormField[] };

function getFormDefinition(department: string, tab: string): FormDefinition | null {
  const definitions: Record<string, FormDefinition> = {
    "manufacturing:Production": { kind: "batch", title: "New Batch", fields: [{ key: "batch_number", label: "Batch Code", required: true }, { key: "product_name", label: "Product Name", required: true }, { key: "target_quantity", label: "Planned Quantity", type: "number", required: true }, { key: "start_date", label: "Start Date", type: "date", required: true }, { key: "end_date", label: "End Date", type: "date", required: true }, { key: "supervisor_id", label: "Assigned Supervisor", required: false }] },
    "manufacturing:Defects": { kind: "defect", title: "Record Defect", fields: [{ key: "batch_id", label: "Batch", required: true }, { key: "defect_type", label: "Defect Type", required: true }, { key: "quantity", label: "Quantity", type: "number", required: true }, { key: "severity", label: "Severity", required: true }, { key: "description", label: "Description", required: true }] },
    "manufacturing:Hours": { kind: "hours", title: "Record Hours", fields: [{ key: "batch_id", label: "Batch ID", required: true }, { key: "work_date", label: "Date", type: "date", required: true }, { key: "hours_worked", label: "Hours Worked", type: "number", required: true }, { key: "overtime_hours", label: "Overtime Hours", type: "number", required: false }, { key: "remarks", label: "Remarks", required: false }] },
    "manufacturing:Targets": { kind: "manufacturing-target", title: "Create Target", fields: [{ key: "target_name", label: "Target Name", required: false }, { key: "target_quantity", label: "Target Quantity", type: "number", required: true }, { key: "period_start", label: "Start Date", type: "date", required: true }, { key: "period_end", label: "End Date", type: "date", required: true }] },
    "marketing:Leads": { kind: "lead", title: "New Lead", fields: [{ key: "name", label: "Lead Name", required: true }, { key: "source", label: "Lead Source", required: true }, { key: "status", label: "Status", required: true }, { key: "notes", label: "Notes", required: false }] },
    "marketing:Campaigns": { kind: "campaign", title: "New Campaign", fields: [{ key: "name", label: "Campaign Name", required: true }, { key: "budget", label: "Budget", type: "number", required: true }, { key: "start_date", label: "Start Date", type: "date", required: true }, { key: "end_date", label: "End Date", type: "date", required: true }, { key: "status", label: "Status", required: true }] },
    "marketing:Conversions": { kind: "conversion", title: "Record Conversion", fields: [{ key: "lead_id", label: "Lead", required: true }, { key: "customer", label: "Customer", required: true }, { key: "conversion_value", label: "Conversion Value", type: "number", required: true }, { key: "conversion_date", label: "Conversion Date", type: "date", required: true }] },
    "marketing:Targets": { kind: "marketing-target", title: "Create Target", fields: [{ key: "target_name", label: "Target Name", required: false }, { key: "target_quantity", label: "Target Quantity", type: "number", required: true }, { key: "target_period", label: "Target Period", required: true }, { key: "start_date", label: "Start Date", type: "date", required: true }, { key: "end_date", label: "End Date", type: "date", required: true }] },
    "transportation:Trips": { kind: "trip", title: "New Trip", fields: [{ key: "route_name", label: "Route", required: true }, { key: "vehicle_id", label: "Vehicle", required: false }, { key: "driver_id", label: "Driver", required: true }, { key: "trip_date", label: "Start Date", type: "date", required: true }, { key: "status", label: "Status", required: true }] },
    "transportation:Distance": { kind: "distance", title: "Record Distance", fields: [{ key: "route_name", label: "Route", required: false }, { key: "distance", label: "Distance", type: "number", required: true }, { key: "log_date", label: "Date", type: "date", required: true }] },
    "transportation:Fuel": { kind: "fuel", title: "Record Fuel", fields: [{ key: "vehicle_id", label: "Vehicle", required: false }, { key: "fuel_consumed", label: "Fuel Used", type: "number", required: true }, { key: "fuel_cost", label: "Cost", type: "number", required: true }, { key: "log_date", label: "Date", type: "date", required: true }] },
    "transportation:Delay Tracking": { kind: "delay", title: "Record Delay", fields: [{ key: "trip_id", label: "Trip", required: true }, { key: "reason", label: "Delay Reason", required: true }, { key: "delay_minutes", label: "Duration (minutes)", type: "number", required: true }, { key: "recorded_at", label: "Date", type: "date", required: true }] },
    "transportation:Targets": { kind: "transportation-target", title: "Create Target", fields: [{ key: "target_name", label: "Target Name", required: false }, { key: "target_deliveries", label: "Target Quantity", type: "number", required: true }, { key: "period_start", label: "Start Date", type: "date", required: true }, { key: "period_end", label: "End Date", type: "date", required: true }] },
    "research:Projects": { kind: "project", title: "New Project", fields: [{ key: "name", label: "Project Name", required: true }, { key: "description", label: "Description", required: true }, { key: "start_date", label: "Start Date", type: "date", required: true }, { key: "end_date", label: "End Date", type: "date", required: true }, { key: "status", label: "Status", required: true }] },
    "research:Experiments": { kind: "experiment", title: "New Experiment", fields: [{ key: "project_id", label: "Project", required: false }, { key: "name", label: "Experiment Name", required: true }, { key: "description", label: "Description", required: true }, { key: "status", label: "Status", required: true }] },
    "research:Samples": { kind: "sample", title: "New Sample", fields: [{ key: "name", label: "Sample Name", required: true }, { key: "sample_type", label: "Sample Type", required: true }, { key: "collected_date", label: "Collection Date", type: "date", required: true }] },
    "research:Milestones": { kind: "milestone", title: "Add Milestone", fields: [{ key: "project_id", label: "Project", required: true }, { key: "title", label: "Milestone Name", required: true }, { key: "description", label: "Description", required: false }, { key: "target_date", label: "Due Date", type: "date", required: true }, { key: "status", label: "Status", required: true }] },
    "research:Targets": { kind: "research-target", title: "Create Target", fields: [{ key: "target_name", label: "Target Name", required: false }, { key: "target_quantity", label: "Target Quantity", type: "number", required: true }, { key: "period_start", label: "Start Date", type: "date", required: true }, { key: "period_end", label: "End Date", type: "date", required: true }] },
  };
  return definitions[`${department}:${tab}`] ?? null;
}

function getSecondaryFormDefinition(department: string, tab: string): FormDefinition | null {
  if (department === "manufacturing" && tab === "Production") return { kind: "output", title: "Record Output", fields: [{ key: "batch_id", label: "Batch", required: true }, { key: "quantity_produced", label: "Quantity Produced", type: "number", required: true }, { key: "production_date", label: "Production Date", type: "date", required: true }, { key: "remarks", label: "Remarks", required: false }] };
  return null;
}

function DepartmentFormModal({ definition, values, error, submitting, onChange, onClose, onSubmit }: { definition: FormDefinition; values: Record<string, string>; error: string; submitting: boolean; onChange: (key: string, value: string) => void; onClose: () => void; onSubmit: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="department-form-title"><form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-center justify-between"><h2 id="department-form-title" className="text-lg font-semibold text-slate-800">{definition.title}</h2><button type="button" onClick={onClose} className="text-sm text-slate-500">Close</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{definition.fields.map((field) => <label key={field.key} className="text-sm text-slate-700"><span>{field.label}{field.required ? " *" : ""}</span><input required={field.required} type={field.type ?? "text"} min={field.type === "number" ? "0.01" : undefined} value={values[field.key] ?? ""} onChange={(event) => onChange(field.key, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-[#4e8050]" /></label>)}</div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button><button type="submit" disabled={submitting} className="rounded-lg bg-[#4e8050] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{submitting ? "Saving..." : "Save"}</button></div></form></div>;
}
