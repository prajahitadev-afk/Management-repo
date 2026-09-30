import { useState, useEffect, useCallback } from "react";
import {
  CollaborationApplication,
  CollaborationAuditLog,
  CollaborationBill,
  CollaboratorCompany,
  fetchCollaborationApplications,
  fetchCollaborationAuditLogs,
  fetchCollaboratorCompanies,
  fetchCollaborationBills,
  createCollaborationApplication,
  approveInternalStep,
  rejectInternalApplication,
  respondByCollaborator,
  toggleCollaboratorCompanyStatus,
  addCollaboratorCompany,
  canUserAccessCollaborationModule,
} from "../services/collaboration.service";

export function useCollaboration(user: { id: string; role: string; department: string; name: string; company_name?: string }) {
  const [applications, setApplications] = useState<CollaborationApplication[]>([]);
  const [auditLogs, setAuditLogs] = useState<CollaborationAuditLog[]>([]);
  const [companies, setCompanies] = useState<CollaboratorCompany[]>([]);
  const [bills, setBills] = useState<CollaborationBill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const hasAccess = canUserAccessCollaborationModule(user);

  const loadAllData = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [appsData, logsData, compsData, billsData] = await Promise.all([
        fetchCollaborationApplications(user),
        fetchCollaborationAuditLogs(),
        fetchCollaboratorCompanies(),
        fetchCollaborationBills(),
      ]);
      setApplications(appsData);
      setAuditLogs(logsData);
      setCompanies(compsData);
      setBills(billsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Collaboration data");
    } finally {
      setLoading(false);
    }
  }, [user, hasAccess]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleCreateApplication = async (params: {
    collaborator_company_id: string;
    collaborator_company_name: string;
    customer_name: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    currency: string;
    shipping_transport: string;
    delivery_location: string;
    payment_terms: string;
    required_date: string;
    notes?: string;
    supporting_document_name?: string;
  }) => {
    try {
      await createCollaborationApplication(params, user);
      await loadAllData();
    } catch (err) {
      throw err;
    }
  };

  const handleApproveStep = async (applicationId: string) => {
    try {
      await approveInternalStep(applicationId, user);
      await loadAllData();
    } catch (err) {
      throw err;
    }
  };

  const handleReject = async (applicationId: string, reason: string) => {
    try {
      await rejectInternalApplication(applicationId, reason, user);
      await loadAllData();
    } catch (err) {
      throw err;
    }
  };

  const handleCollaboratorRespond = async (applicationId: string, decision: "ACCEPTED" | "DECLINED", declineReason?: string) => {
    try {
      await respondByCollaborator(applicationId, decision, declineReason, user);
      await loadAllData();
    } catch (err) {
      throw err;
    }
  };

  const handleToggleCompany = async (companyId: string) => {
    const updated = await toggleCollaboratorCompanyStatus(companyId);
    setCompanies(updated);
  };

  const handleAddCompany = async (data: {
    company_name: string;
    company_code: string;
    collaborator_head_name: string;
    collaborator_head_email: string;
    contact_phone?: string;
    address?: string;
  }) => {
    const updated = await addCollaboratorCompany(data);
    setCompanies(updated);
  };

  return {
    hasAccess,
    applications,
    auditLogs,
    companies,
    bills,
    loading,
    error,
    refresh: loadAllData,
    createApplication: handleCreateApplication,
    approveStep: handleApproveStep,
    rejectApplication: handleReject,
    collaboratorRespond: handleCollaboratorRespond,
    toggleCompany: handleToggleCompany,
    addCompany: handleAddCompany,
  };
}
