import { supabase } from "../lib/supabase";
import { inDashboardScope, resolveDashboardScope } from "./dashboard-scope.service";
import { getSubordinates } from "./hierarchy.service";

export interface ResearchProject {
  id: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchExperiment {
  id: string;
  project_id: string | null;
  owner_id: string;
  name: string;
  description: string | null;
  status: string;
  risk_level: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchSample {
  id: string;
  project_id: string | null;
  experiment_id: string | null;
  collected_by: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchLog {
  id: string;
  project_id: string | null;
  experiment_id: string | null;
  employee_id: string;
  log_date: string;
  description: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchMilestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchTarget {
  id: string;
  manager_id: string;
  target_quantity: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface ResearchResult<T> {
  data: T | null;
  error: Error | null;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  manager_id?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface CreateExperimentInput {
  project_id?: string | null;
  owner_id: string;
  name: string;
  description?: string | null;
  status?: string;
  risk_level?: string | null;
}

export interface CreateSampleInput {
  project_id?: string | null;
  experiment_id?: string | null;
  collected_by: string;
  name: string;
  status?: string;
}

export interface CreateResearchLogInput {
  project_id?: string | null;
  experiment_id?: string | null;
  employee_id: string;
  log_date: string;
  description: string;
}

export interface CreateMilestoneInput {
  project_id: string;
  title: string;
  description?: string | null;
  target_date: string;
  status?: string;
}

export interface CreateTargetInput {
  manager_id: string;
  target_quantity: number;
  period_start: string;
  period_end: string;
}

export interface TargetVsActual {
  target_quantity: number;
  actual_value: number;
  variance: number;
  achievement_percentage: number;
}

export interface WorkerDashboard {
  experiments: number;
  samples: number;
  research_logs: number;
}

export interface SupervisorDashboard {
  team_progress: number;
  active_experiments: number;
  sample_count: number;
}

export interface ManagerDashboard {
  milestones: number;
  project_progress: number;
  target_achievement: number;
}

export interface CMDashboard {
  research_progress: number;
  project_comparison: number;
  risk_indicators: number;
}

export interface GMDashboard {
  innovation_reports: number;
  portfolio_analytics: number;
  department_capacity: number;
}

export interface MDResearchDashboard {
  product_development: number;
  strategic_portfolio: number;
  innovation_roadmap: number;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error ?? "Research request failed"));
}

function invalid<T = never>(message: string): ResearchResult<T> {
  return { data: null, error: new Error(message) };
}

function requireId(value: string | undefined, label: string): Error | null {
  return value?.trim() ? null : new Error(`${label} is required`);
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function statusValue(row: Record<string, unknown>): string {
  return String(row.status ?? "").toLowerCase();
}

async function readTable<T>(table: string): Promise<ResearchResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function readOne<T>(table: string, id: string): Promise<ResearchResult<T>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return { data: null, error: asError(error) };
    return { data: (data as T | null) ?? null, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function readByColumn<T>(table: string, column: string, value: string): Promise<ResearchResult<T[]>> {
  try {
    const { data, error } = await supabase.from(table).select("*").eq(column, value);
    if (error) return { data: null, error: asError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function insertOne<T>(table: string, payload: Record<string, unknown>): Promise<ResearchResult<T>> {
  try {
    const { data, error } = await supabase.from(table).insert(payload).select("*").single();
    if (error) return { data: null, error: asError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

async function updateOne<T>(table: string, id: string, updates: Record<string, unknown>): Promise<ResearchResult<T>> {
  try {
    const { data, error } = await supabase.from(table).update(updates).eq("id", id).select("*").single();
    if (error) return { data: null, error: asError(error) };
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

export async function getProjects(): Promise<ResearchResult<ResearchProject[]>> { return readTable<ResearchProject>("research_projects"); }

export async function getProjectById(id: string): Promise<ResearchResult<ResearchProject>> {
  const error = requireId(id, "Project ID");
  return error ? invalid(error.message) : readOne<ResearchProject>("research_projects", id);
}

export async function createProject(data: CreateProjectInput): Promise<ResearchResult<ResearchProject>> {
  if (!data.name.trim()) return invalid("Project name is required");
  return insertOne<ResearchProject>("research_projects", { ...data, description: data.description ?? null, manager_id: data.manager_id ?? null, status: data.status ?? "Planned", start_date: data.start_date ?? null, end_date: data.end_date ?? null });
}

export async function updateProject(id: string, data: Partial<ResearchProject>): Promise<ResearchResult<ResearchProject>> {
  const error = requireId(id, "Project ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateOne<ResearchProject>("research_projects", id, updates);
}

export async function getExperiments(): Promise<ResearchResult<ResearchExperiment[]>> { return readTable<ResearchExperiment>("research_experiments"); }

export async function getExperimentById(id: string): Promise<ResearchResult<ResearchExperiment>> {
  const error = requireId(id, "Experiment ID");
  return error ? invalid(error.message) : readOne<ResearchExperiment>("research_experiments", id);
}

export async function getExperimentsByEmployee(employeeId: string): Promise<ResearchResult<ResearchExperiment[]>> {
  const error = requireId(employeeId, "Employee ID");
  return error ? invalid(error.message) : readByColumn<ResearchExperiment>("research_experiments", "owner_id", employeeId);
}

export async function createExperiment(data: CreateExperimentInput): Promise<ResearchResult<ResearchExperiment>> {
  if (!data.owner_id.trim() || !data.name.trim()) return invalid("Owner ID and experiment name are required");
  return insertOne<ResearchExperiment>("research_experiments", { ...data, project_id: data.project_id ?? null, description: data.description ?? null, status: data.status ?? "Planned", risk_level: data.risk_level ?? null });
}

export async function updateExperiment(id: string, data: Partial<ResearchExperiment>): Promise<ResearchResult<ResearchExperiment>> {
  const error = requireId(id, "Experiment ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateOne<ResearchExperiment>("research_experiments", id, updates);
}

export async function getSamples(): Promise<ResearchResult<ResearchSample[]>> { return readTable<ResearchSample>("research_samples"); }

export async function getSamplesByEmployee(employeeId: string): Promise<ResearchResult<ResearchSample[]>> {
  const error = requireId(employeeId, "Employee ID");
  return error ? invalid(error.message) : readByColumn<ResearchSample>("research_samples", "collected_by", employeeId);
}

export async function createSample(data: CreateSampleInput): Promise<ResearchResult<ResearchSample>> {
  if (!data.collected_by.trim() || !data.name.trim()) return invalid("Collector ID and sample name are required");
  return insertOne<ResearchSample>("research_samples", { ...data, project_id: data.project_id ?? null, experiment_id: data.experiment_id ?? null, status: data.status ?? "Collected" });
}

export async function getResearchLogs(): Promise<ResearchResult<ResearchLog[]>> { return readTable<ResearchLog>("research_logs"); }

export async function getResearchLogsByEmployee(employeeId: string): Promise<ResearchResult<ResearchLog[]>> {
  const error = requireId(employeeId, "Employee ID");
  return error ? invalid(error.message) : readByColumn<ResearchLog>("research_logs", "employee_id", employeeId);
}

export async function createResearchLog(data: CreateResearchLogInput): Promise<ResearchResult<ResearchLog>> {
  if (!data.employee_id.trim() || !data.log_date || !data.description.trim()) return invalid("Employee ID, log date, and description are required");
  return insertOne<ResearchLog>("research_logs", { ...data, project_id: data.project_id ?? null, experiment_id: data.experiment_id ?? null });
}

export async function getMilestones(): Promise<ResearchResult<ResearchMilestone[]>> { return readTable<ResearchMilestone>("research_milestones"); }

export async function getMilestonesByProject(projectId: string): Promise<ResearchResult<ResearchMilestone[]>> {
  const error = requireId(projectId, "Project ID");
  return error ? invalid(error.message) : readByColumn<ResearchMilestone>("research_milestones", "project_id", projectId);
}

export async function createMilestone(data: CreateMilestoneInput): Promise<ResearchResult<ResearchMilestone>> {
  if (!data.project_id.trim() || !data.title.trim() || !data.target_date) return invalid("Project ID, milestone title, and target date are required");
  if (Number.isNaN(new Date(data.target_date).getTime())) return invalid("Target date must be valid");
  return insertOne<ResearchMilestone>("research_milestones", { project_id: data.project_id, name: data.title, description: data.description ?? null, due_date: data.target_date, status: data.status ?? "Planned", progress: 0 });
}

export async function updateMilestone(id: string, data: Partial<ResearchMilestone>): Promise<ResearchResult<ResearchMilestone>> {
  const error = requireId(id, "Milestone ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateOne<ResearchMilestone>("research_milestones", id, updates);
}

export async function getTargets(): Promise<ResearchResult<ResearchTarget[]>> { return readTable<ResearchTarget>("research_targets"); }

export async function getTargetByManager(managerId: string): Promise<ResearchResult<ResearchTarget[]>> {
  const error = requireId(managerId, "Manager ID");
  return error ? invalid(error.message) : readByColumn<ResearchTarget>("research_targets", "manager_id", managerId);
}

export async function createTarget(data: CreateTargetInput): Promise<ResearchResult<ResearchTarget>> {
  if (!data.manager_id.trim() || !data.period_start || !data.period_end) return invalid("Manager ID and target period are required");
  if (!Number.isFinite(data.target_quantity) || data.target_quantity < 0) return invalid("Target quantity must be zero or greater");
  return insertOne<ResearchTarget>("research_targets", data as unknown as Record<string, unknown>);
}

export async function updateTarget(id: string, data: Partial<ResearchTarget>): Promise<ResearchResult<ResearchTarget>> {
  const error = requireId(id, "Target ID");
  if (error) return invalid(error.message);
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...updates } = data;
  return updateOne<ResearchTarget>("research_targets", id, updates);
}

export async function calculateTargetVsActual(managerId: string): Promise<ResearchResult<TargetVsActual>> {
  const scope = await resolveDashboardScope(managerId, "Manager");
  const targets = await getTargetByManager(managerId);
  if (targets.error || !targets.data) return { data: null, error: targets.error };
  const projects = await getProjects();
  if (projects.error || !projects.data) return { data: null, error: projects.error };
  const target = targets.data.reduce((sum, row) => sum + numberValue(row.target_quantity), 0);
  const actual = projects.data.filter((project) => inDashboardScope(scope, project.manager_id) && ["completed", "closed"].includes(statusValue(project))).length;
  return { data: { target_quantity: target, actual_value: actual, variance: actual - target, achievement_percentage: target ? (actual / target) * 100 : 0 }, error: null };
}

async function getTeamIds(supervisorId: string): Promise<ResearchResult<string[]>> {
  try {
    const subordinates = await getSubordinates(supervisorId);
    return { data: [supervisorId, ...subordinates], error: null };
  } catch (error) {
    return { data: null, error: asError(error) };
  }
}

export async function getWorkerDashboard(employeeId: string): Promise<ResearchResult<WorkerDashboard>> {
  const error = requireId(employeeId, "Employee ID");
  if (error) return invalid(error.message);
  const [experiments, samples, logs] = await Promise.all([getExperimentsByEmployee(employeeId), getSamplesByEmployee(employeeId), getResearchLogsByEmployee(employeeId)]);
  const failure = [experiments, samples, logs].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  return { data: { experiments: experiments.data!.length, samples: samples.data!.length, research_logs: logs.data!.length }, error: null };
}

export async function getSupervisorDashboard(supervisorId: string): Promise<ResearchResult<SupervisorDashboard>> {
  const scope = await resolveDashboardScope(supervisorId, "Supervisor");
  const error = requireId(supervisorId, "Supervisor ID");
  if (error) return invalid(error.message);
  const ids = await getTeamIds(supervisorId);
  if (ids.error || !ids.data) return { data: null, error: ids.error };
  const [experiments, samples] = await Promise.all([getExperiments(), getSamples()]);
  const failure = [experiments, samples].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const teamExperiments = experiments.data!.filter((experiment) => inDashboardScope(scope, experiment.owner_id));
  const activeExperiments = teamExperiments.filter((experiment) => !["completed", "closed", "cancelled"].includes(statusValue(experiment))).length;
  const progress = teamExperiments.length ? teamExperiments.reduce((sum, experiment) => sum + numberValue(experiment.progress), 0) / teamExperiments.length : 0;
  return { data: { team_progress: progress, active_experiments: activeExperiments, sample_count: samples.data!.filter((sample) => inDashboardScope(scope, sample.collected_by)).length }, error: null };
}

export async function getManagerDashboard(managerId: string): Promise<ResearchResult<ManagerDashboard>> {
  const error = requireId(managerId, "Manager ID");
  if (error) return invalid(error.message);
  const scope = await resolveDashboardScope(managerId, "Manager");
  const [milestones, projects, targetActual] = await Promise.all([getMilestones(), getProjects(), calculateTargetVsActual(managerId)]);
  const failure = [milestones, projects, targetActual].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const managerProjects = projects.data!.filter((project) => inDashboardScope(scope, project.manager_id));
  const projectIds = new Set(managerProjects.map((project) => project.id));
  const managerMilestones = milestones.data!.filter((milestone) => projectIds.has(milestone.project_id));
  return { data: { milestones: managerMilestones.length, project_progress: managerMilestones.length ? managerMilestones.reduce((sum, milestone) => sum + numberValue(milestone.progress), 0) / managerMilestones.length : 0, target_achievement: targetActual.data!.achievement_percentage }, error: null };
}

export async function getCMDashboard(department?: string | null): Promise<ResearchResult<CMDashboard>> {
  const scope = await resolveDashboardScope("", "Chief Manager", department);
  const [projects, experiments, milestones] = await Promise.all([getProjects(), getExperiments(), getMilestones()]);
  const failure = [projects, experiments, milestones].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const scopedProjects = projects.data!.filter((project) => inDashboardScope(scope, project.manager_id));
  const projectIds = new Set(scopedProjects.map((project) => project.id));
  const scopedMilestones = milestones.data!.filter((milestone) => projectIds.has(milestone.project_id));
  const scopedExperiments = experiments.data!.filter((experiment) => inDashboardScope(scope, experiment.owner_id));
  const completedProjects = scopedProjects.filter((project) => ["completed", "closed"].includes(statusValue(project))).length;
  const completedMilestones = scopedMilestones.filter((milestone) => ["completed", "closed"].includes(statusValue(milestone))).length;
  const highRisk = scopedExperiments.filter((experiment) => ["high", "critical"].includes(String(experiment.risk_level ?? "").toLowerCase())).length;
  return { data: { research_progress: scopedProjects.length ? (completedProjects / scopedProjects.length) * 100 : 0, project_comparison: scopedMilestones.length ? (completedMilestones / scopedMilestones.length) * 100 : 0, risk_indicators: scopedExperiments.length ? (highRisk / scopedExperiments.length) * 100 : 0 }, error: null };
}

export async function getGMDashboard(department?: string | null): Promise<ResearchResult<GMDashboard>> {
  const scope = await resolveDashboardScope("", "General Manager", department);
  const [projects, experiments, samples, milestones] = await Promise.all([getProjects(), getExperiments(), getSamples(), getMilestones()]);
  const failure = [projects, experiments, samples, milestones].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const scopedProjects = projects.data!.filter((project) => inDashboardScope(scope, project.manager_id));
  const scopedExperiments = experiments.data!.filter((experiment) => inDashboardScope(scope, experiment.owner_id));
  const scopedSamples = samples.data!.filter((sample) => inDashboardScope(scope, sample.collected_by));
  const projectIds = new Set(scopedProjects.map((project) => project.id));
  const scopedMilestones = milestones.data!.filter((milestone) => projectIds.has(milestone.project_id));
  const completedExperiments = scopedExperiments.filter((experiment) => ["completed", "successful", "closed"].includes(statusValue(experiment))).length;
  const completedProjects = scopedProjects.filter((project) => ["completed", "closed"].includes(statusValue(project))).length;
  const completedMilestones = scopedMilestones.filter((milestone) => ["completed", "closed"].includes(statusValue(milestone))).length;
  return { data: { innovation_reports: scopedProjects.length ? (completedProjects / scopedProjects.length) * 100 : 0, portfolio_analytics: scopedExperiments.length ? (completedExperiments / scopedExperiments.length) * 100 : 0, department_capacity: scopedProjects.length ? Math.min(100, (scopedSamples.length / scopedProjects.length) * 100) : 0 }, error: null };
}

export async function getMDResearchDashboard(): Promise<ResearchResult<MDResearchDashboard>> {
  const [projects, milestones, experiments] = await Promise.all([getProjects(), getMilestones(), getExperiments()]);
  const failure = [projects, milestones, experiments].find((result) => result.error);
  if (failure?.error) return { data: null, error: failure.error };
  const activeProjects = projects.data!.filter((project) => !["completed", "closed", "cancelled"].includes(statusValue(project))).length;
  const completedMilestones = milestones.data!.filter((milestone) => ["completed", "closed"].includes(statusValue(milestone))).length;
  const completedExperiments = experiments.data!.filter((experiment) => ["completed", "successful", "closed"].includes(statusValue(experiment))).length;
  return { data: { product_development: projects.data!.length ? (activeProjects / projects.data!.length) * 100 : 0, strategic_portfolio: experiments.data!.length ? (completedExperiments / experiments.data!.length) * 100 : 0, innovation_roadmap: milestones.data!.length ? (completedMilestones / milestones.data!.length) * 100 : 0 }, error: null };
}
