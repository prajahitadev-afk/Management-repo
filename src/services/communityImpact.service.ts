import { supabase } from "../lib/supabase";

export interface CommunityImpact {
  id?: string;
  program_id?: string;
  beneficiaries: number;
  volunteers: number;
  communities_reached: number;
  recorded_at: string;
}

export interface CommunityImpactMetrics {
  totalBeneficiaries: number;
  totalVolunteers: number;
  communitiesReached: number;
  activePrograms: number;
  trend: Array<{ month: string; beneficiaries: number; volunteers: number }>;
}

export async function getCommunityImpact(): Promise<CommunityImpact[]> {
  const { data, error } = await supabase
    .from("program_impact")
    .select("id, program_id, beneficiaries, volunteers, communities_reached, recorded_at")
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    beneficiaries: Number(row.beneficiaries || 0),
    volunteers: Number(row.volunteers || 0),
    communities_reached: Number(row.communities_reached || 0),
  }));
}

export async function getCommunityImpactMetrics(): Promise<CommunityImpactMetrics> {
  try {
    const impactRows = await getCommunityImpact();
    const totalBeneficiaries = impactRows.reduce((sum, row) => sum + row.beneficiaries, 0);
    const totalVolunteers = impactRows.reduce((sum, row) => sum + row.volunteers, 0);
    const communitiesReached = impactRows.reduce((sum, row) => sum + row.communities_reached, 0);
    const activePrograms = impactRows.length;

    const trend = impactRows.map((row) => ({
      month: new Date(row.recorded_at).toLocaleString("en-US", { month: "short" }),
      beneficiaries: row.beneficiaries,
      volunteers: row.volunteers,
    }));

    return {
      totalBeneficiaries,
      totalVolunteers,
      communitiesReached,
      activePrograms,
      trend,
    };
  } catch (error) {
    console.error("Failed to load community impact metrics:", error);
    return {
      totalBeneficiaries: 0,
      totalVolunteers: 0,
      communitiesReached: 0,
      activePrograms: 0,
      trend: [],
    };
  }
}