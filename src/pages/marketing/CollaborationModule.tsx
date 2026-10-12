import React, { useState } from "react";
import {
  Handshake, Building2, ShieldAlert, CheckCircle2, XCircle, Clock, FileText,
  Plus, Search, Filter, ShieldCheck, ArrowRight, UserCheck, ChevronRight,
  Download, Eye, Lock, RefreshCw, AlertCircle, Building, Layers,
  Send, FileCheck, DollarSign, Tag, Calendar, MapPin, Truck, Check, X
} from "lucide-react";
import { useCollaboration } from "../../hooks/useCollaboration";
import { CollaborationApplication, ApproverRole } from "../../services/collaboration.service";

interface AppUser {
  id: string;
  name: string;
  role: string;
  department: string;
  company_name?: string;
}

export function CollaborationModule({ currentUser }: { currentUser: AppUser }) {
  const [formNotice, setFormNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const activeUser = currentUser;
  const isExternalCollaborator = activeUser.role === "External Collaborator" || activeUser.role === "Collaborator Head";
  
  const {
    hasAccess,
    applications,
    auditLogs,
    companies,
    bills,
    loading,
    error,
    refresh,
    createApplication,
    approveStep,
    rejectApplication,
    collaboratorRespond,
    toggleCompany,
    addCompany,
  } = useCollaboration(activeUser);
  const activeCompanies = companies.filter((company) => company.status === "active");

  // UI state
  const [activeTab, setActiveTab] = useState<"applications" | "bills" | "audit" | "admin">("applications");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedApp, setSelectedApp] = useState<CollaborationApplication | null>(null);

  // Modals state
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompany, setNewCompany] = useState({
    company_name: "",
    company_code: "",
    collaborator_head_name: "",
    collaborator_head_email: "",
    contact_phone: "",
    address: "",
  });

  // Apply Bill form state
  const [applyForm, setApplyForm] = useState({
    collaborator_company_id: "",
    customer_name: "",
    product_name: "",
    quantity: 1,
    unit_price: 0,
    currency: "INR",
    shipping_transport: "",
    delivery_location: "",
    payment_terms: "",
    required_date: "",
    notes: "",
  });

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormNotice(null);

    if (!activeCompanies.length) {
      setFormNotice({ type: "error", text: "No partner companies are available yet. Add one in the admin panel first." });
      return;
    }

    const comp = activeCompanies.find((company) => company.id === applyForm.collaborator_company_id) || activeCompanies[0];

    try {
      await createApplication({
        collaborator_company_id: comp.id,
        collaborator_company_name: comp.company_name,
        customer_name: applyForm.customer_name,
        product_name: applyForm.product_name,
        quantity: Number(applyForm.quantity),
        unit_price: Number(applyForm.unit_price),
        currency: applyForm.currency,
        shipping_transport: applyForm.shipping_transport,
        delivery_location: applyForm.delivery_location,
        payment_terms: applyForm.payment_terms,
        required_date: applyForm.required_date,
        notes: applyForm.notes,
      });

      setShowApplyModal(false);
      setActiveTab("applications");
      setFormNotice({ type: "success", text: "Application submitted successfully and routed for approval." });
    } catch (error) {
      setFormNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The application could not be submitted. Please try again.",
      });
    }
  };

  const runSelectedAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    setActionPending(true);
    try {
      await action();
      setSelectedApp(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action could not be saved.");
      await refresh();
    } finally {
      setActionPending(false);
    }
  };

  const handleApproveSelected = () => {
    if (!selectedApp) return;
    return runSelectedAction(() => approveStep(selectedApp.id));
  };

  const handleAcceptSelected = () => {
    if (!selectedApp) return;
    return runSelectedAction(() => collaboratorRespond(selectedApp.id, "ACCEPTED"));
  };

  const handleRejectConfirm = async () => {
    if (!selectedApp || !rejectReason) return;
    await runSelectedAction(async () => {
      await rejectApplication(selectedApp.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
    });
  };

  const handleDeclineConfirm = async () => {
    if (!selectedApp || !declineReason) return;
    await runSelectedAction(async () => {
      await collaboratorRespond(selectedApp.id, "DECLINED", declineReason);
      setShowDeclineModal(false);
      setDeclineReason("");
    });
  };

  const handleAddCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCompany(newCompany);
    setShowAddCompanyModal(false);
    setNewCompany({
      company_name: "",
      company_code: "",
      collaborator_head_name: "",
      collaborator_head_email: "",
      contact_phone: "",
      address: "",
    });
  };

  // Filtering applications
  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.application_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.collaborator_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.product_name.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "ALL") return matchesSearch;
    return matchesSearch && app.status === statusFilter;
  });

  // Section 4 & 12 requirement: Access Control Authorization Denial Page for non-marketing sectors
  if (!hasAccess) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="rounded-3xl p-10 text-center shadow-xl border border-red-200 bg-gradient-to-b from-red-50 to-white">
          <div className="w-20 h-20 rounded-full bg-red-100 border border-red-300 flex items-center justify-center mx-auto mb-6 text-red-600 shadow-inner">
            <ShieldAlert size={40} />
          </div>
          <span className="inline-block px-3 py-1 bg-red-100 text-red-700 font-bold text-xs rounded-full tracking-wider uppercase mb-3">
            Sector Restriction Enforced
          </span>
          <h2 className="text-2xl font-black text-slate-800 mb-3">Access Denied: Collaboration Module</h2>
          <p className="text-slate-600 text-sm max-w-xl mx-auto leading-relaxed mb-6">
            According to Prajahita EMS security policy, the <strong className="text-red-700">Collaboration module is strictly restricted to the Marketing sector</strong> and authorized executive hierarchy (Vice Chairman, President, Marketing MD).
          </p>
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-left max-w-md mx-auto text-xs text-slate-600 space-y-2 mb-6">
            <div className="flex justify-between border-b pb-1">
              <span>Your Sector:</span>
              <strong className="text-red-600 uppercase">{activeUser.department}</strong>
            </div>
            <div className="flex justify-between border-b pb-1">
              <span>Your Role:</span>
              <strong>{activeUser.role}</strong>
            </div>
            <div className="flex justify-between">
              <span>Authorized Sectors:</span>
              <strong className="text-emerald-700">Marketing & Executive Hierarchy Only</strong>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800">
      
      {formNotice && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${formNotice.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-700"}`}>
          {formNotice.text}
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> {error}</span>
          <button onClick={() => void refresh()} className="inline-flex shrink-0 items-center gap-2 font-semibold hover:underline">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}
      {loading && <div className="text-sm text-slate-500">Loading collaboration data...</div>}

      {/* ─── HEADER BAR (SECTION 5: EXTERNAL COLLABORATOR WORKSPACE HEADER `# THEIR COMPANY NAME`) ─── */}
      {isExternalCollaborator ? (
        <div className="rounded-3xl bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 p-8 text-white shadow-2xl relative overflow-hidden border border-emerald-500/30">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold uppercase tracking-wider mb-3">
                <Lock size={12} /> Restricted External Workspace Portal
              </div>
              {/* PDF REQUIREMENT: Display header as # THEIR COMPANY NAME */}
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-mono">
                # {activeUser.company_name || "Collaborator workspace"}
              </h1>
              <p className="mt-2 text-indigo-200 text-sm max-w-2xl leading-relaxed">
                External Collaborator Workspace. View your collaboration applications, review internal Prajahita approvals, accept or decline offers, and access generated bills.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center min-w-44">
              <span className="block text-xs uppercase tracking-wider text-emerald-200 font-semibold">Active Collaborator Head</span>
              <span className="block text-base font-bold text-white mt-1">{activeUser.name}</span>
              <span className="inline-block mt-2 px-2.5 py-0.5 bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold rounded-full">
                VERIFIED ACCREDITED
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Internal Prajahita EMS Header */
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-900 to-teal-900 p-8 text-white shadow-2xl relative overflow-hidden border border-emerald-500/25">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
                <span>EMS</span> <ChevronRight size={14} /> <span>Marketing</span> <ChevronRight size={14} /> <span className="text-white bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">Collaboration Module</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                Marketing Collaboration & Approval Engine
              </h1>
              <p className="mt-2 text-emerald-100/80 text-sm max-w-2xl">
                Integrated sector collaboration hub for Prajahita Charitable Trust. Enforces strict 3-tier internal approval hierarchy and external collaborator handshake.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ─── STATS SUMMARY BAR ─── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white/80 p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Applications</span>
            <FileText size={18} className="text-slate-400" />
          </div>
          <span className="text-2xl font-black text-slate-800">{applications.length}</span>
        </div>

        <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Internal</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <span className="text-2xl font-black text-amber-800">
            {applications.filter((a) => a.status === "PENDING INTERNAL APPROVAL").length}
          </span>
        </div>

        <div className="bg-indigo-50/80 p-5 rounded-2xl border border-indigo-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Awaiting Collaborator</span>
            <Send size={18} className="text-indigo-500" />
          </div>
          <span className="text-2xl font-black text-indigo-800">
            {applications.filter((a) => a.status === "AWAITING COLLABORATOR ACCEPTANCE").length}
          </span>
        </div>

        <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Collaboration Accepted</span>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-800">
            {applications.filter((a) => a.status === "COLLABORATION ACCEPTED").length}
          </span>
        </div>

        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Generated Bills</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-slate-800">{bills.length}</span>
        </div>
      </div>

      {/* ─── CONTROLS & NAVIGATION TABS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 bg-white/60 rounded-2xl px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("applications")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "applications"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Layers size={16} /> Applications & Approvals
          </button>
          
          <button
            onClick={() => setActiveTab("bills")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "bills"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FileCheck size={16} /> Generated Bills ({bills.length})
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ShieldCheck size={16} /> Audit Trail Log
          </button>

          {!isExternalCollaborator && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === "admin"
                  ? "bg-slate-900 text-white shadow-md"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Building2 size={16} /> Collaboration Admin Panel
            </button>
          )}
        </div>

        {/* Action: + Apply Bill (PDF Section 6 requirement) */}
        {!isExternalCollaborator && (
          <button
            onClick={() => setShowApplyModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:via-emerald-800 hover:to-teal-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all"
          >
            <Plus size={18} /> Apply Bill (New Application)
          </button>
        )}
      </div>

      {/* ─── TAB 1: APPLICATIONS & APPROVAL WORKFLOW ─── */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search app ID, customer, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter size={16} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING INTERNAL APPROVAL">Pending Internal Approval</option>
                <option value="AWAITING COLLABORATOR ACCEPTANCE">Awaiting Collaborator Acceptance</option>
                <option value="COLLABORATION ACCEPTED">Collaboration Accepted (Bill Generated)</option>
                <option value="DECLINED - ORDER CANCELLED">Declined - Order Cancelled</option>
              </select>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Application ID</th>
                    <th className="py-3.5 px-4">Collaborator Company</th>
                    <th className="py-3.5 px-4">Customer / Product</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">Approval Status</th>
                    <th className="py-3.5 px-4 text-center">Hierarchy / Next Step</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        No collaboration applications match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredApps.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-4 px-4 font-mono font-bold text-slate-900">
                          {app.application_number}
                          <span className="block text-xs font-normal text-slate-400 font-sans mt-0.5">
                            {new Date(app.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-slate-800">{app.collaborator_company_name}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold block text-slate-800">{app.customer_name}</span>
                          <span className="text-xs text-slate-500 truncate block max-w-xs">{app.product_name}</span>
                        </td>
                        <td className="py-4 px-4 font-bold text-slate-900">
                          {app.currency} {app.total_amount.toLocaleString()}
                        </td>
                        <td className="py-4 px-4">
                          {app.status === "PENDING INTERNAL APPROVAL" && (
                            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg inline-flex items-center gap-1">
                              <Clock size={12} /> Pending Internal Approval
                            </span>
                          )}
                          {app.status === "AWAITING COLLABORATOR ACCEPTANCE" && (
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg inline-flex items-center gap-1">
                              <Send size={12} /> Awaiting Collaborator
                            </span>
                          )}
                          {app.status === "COLLABORATION ACCEPTED" && (
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> Bill Generated
                            </span>
                          )}
                          {app.status === "DECLINED - ORDER CANCELLED" && (
                            <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-lg inline-flex items-center gap-1">
                              <XCircle size={12} /> Order Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-center">
                          {/* Progress Dots for Approval Hierarchy */}
                          <div className="flex items-center justify-center gap-1">
                            <span
                              title="1. Vice Chairman"
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                app.vice_chairman_approved
                                  ? "bg-emerald-500 text-white"
                                  : app.current_approver_role === "Vice Chairman"
                                  ? "bg-amber-500 text-white animate-pulse"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              VC
                            </span>
                            <span className="text-slate-300">→</span>
                            <span
                              title="2. President"
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                app.president_approved
                                  ? "bg-emerald-500 text-white"
                                  : app.current_approver_role === "President"
                                  ? "bg-amber-500 text-white animate-pulse"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              P
                            </span>
                            <span className="text-slate-300">→</span>
                            <span
                              title="3. Marketing MD"
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                app.marketing_md_approved
                                  ? "bg-emerald-500 text-white"
                                  : app.current_approver_role === "MD-Marketing"
                                  ? "bg-amber-500 text-white animate-pulse"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              MD
                            </span>
                            <span className="text-slate-300">→</span>
                            <span
                              title="Collaborator Decision"
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                app.collaborator_decision === "ACCEPTED"
                                  ? "bg-indigo-600 text-white"
                                  : app.collaborator_decision === "DECLINED"
                                  ? "bg-red-600 text-white"
                                  : app.status === "AWAITING COLLABORATOR ACCEPTANCE"
                                  ? "bg-indigo-400 text-white animate-pulse"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              EXT
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => setSelectedApp(app)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1"
                          >
                            <Eye size={14} /> Review & Action
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: GENERATED BILLS (SECTION 9) ─── */}
      {activeTab === "bills" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Generated Collaboration Bills</h2>
              <p className="text-xs text-slate-500">Bills automatically issued after external collaborator acceptance.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
              {bills.length} Verified Bills
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b">
                <tr>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Collaborator Company</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">{bill.bill_number}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{bill.collaborator_company_name}</td>
                    <td className="py-3.5 px-4">{bill.customer_name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">{bill.product_name}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {bill.currency} {bill.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-md">
                        {bill.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => alert(`Downloading official bill document: ${bill.bill_number}.pdf`)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                        title="Download Bill PDF"
                      >
                        <Download size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: AUDIT TRAIL LOG (SECTION 13 REQUIREMENT) ─── */}
      {activeTab === "audit" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Immutable Audit Trail Log</h2>
              <p className="text-xs text-slate-500">Every approval, rejection, and decision is cryptographically logged with IP and device stamps.</p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded-full">
              {auditLogs.length} Log Entries
            </span>
          </div>

          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-200 px-2 py-0.5 rounded">
                      {log.application_number}
                    </span>
                    <span className="text-xs font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {log.action}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-slate-700 font-medium">{log.details}</p>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                  <span>User: <strong className="text-slate-600">{log.user_name}</strong> ({log.user_role} - Sector: {log.user_sector})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: COLLABORATION ADMIN PANEL (SECTION 15 REQUIREMENT) ─── */}
      {activeTab === "admin" && !isExternalCollaborator && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Collaboration Admin Panel</h2>
              <p className="text-xs text-slate-500">Manage registered partner companies, assign Collaborator Heads, and manage sector access.</p>
            </div>
            <button
              onClick={() => setShowAddCompanyModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-all"
            >
              <Plus size={14} /> Add Partner Company
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {companies.map((comp) => (
              <div key={comp.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {comp.company_code}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                      comp.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {comp.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-base">{comp.company_name}</h3>
                
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Collaborator Head: <strong className="text-slate-800">{comp.collaborator_head_name}</strong></div>
                  <div>Email: <span className="text-indigo-600">{comp.collaborator_head_email}</span></div>
                  <div>Phone: <span>{comp.contact_phone}</span></div>
                </div>

                <div className="pt-2 border-t flex justify-end">
                  <button
                    onClick={() => toggleCompany(comp.id)}
                    className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all"
                  >
                    {comp.status === "active" ? "Suspend Company" : "Activate Company"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: APPLY BILL (NEW APPLICATION) ─── */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">Apply Bill (Collaboration Application)</h3>
                <p className="text-xs text-slate-500">Generates a unique Collaboration ID (e.g. PRJ-COL-2026-XXXXXX)</p>
              </div>
              <button onClick={() => setShowApplyModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Partner Company</label>
                  <select
                    value={activeCompanies.some((company) => company.id === applyForm.collaborator_company_id)
                      ? applyForm.collaborator_company_id
                      : activeCompanies[0]?.id ?? ""}
                    onChange={(e) => setApplyForm({ ...applyForm, collaborator_company_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500"
                    required
                    disabled={loading || activeCompanies.length === 0}
                  >
                    {activeCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} ({c.company_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Customer / Buyer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reliance Retail / Star Bazaar"
                    value={applyForm.customer_name}
                    onChange={(e) => setApplyForm({ ...applyForm, customer_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Product Description</label>
                <input
                  type="text"
                  required
                  value={applyForm.product_name}
                  onChange={(e) => setApplyForm({ ...applyForm, product_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={applyForm.quantity}
                    onChange={(e) => setApplyForm({ ...applyForm, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Unit Price (INR)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={applyForm.unit_price}
                    onChange={(e) => setApplyForm({ ...applyForm, unit_price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Total Calculated</label>
                  <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-black">
                    INR {(applyForm.quantity * applyForm.unit_price).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Shipping / Transport</label>
                  <input
                    type="text"
                    required
                    value={applyForm.shipping_transport}
                    onChange={(e) => setApplyForm({ ...applyForm, shipping_transport: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Delivery Location</label>
                  <input
                    type="text"
                    required
                    placeholder="City / Warehouse Location"
                    value={applyForm.delivery_location}
                    onChange={(e) => setApplyForm({ ...applyForm, delivery_location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Terms</label>
                  <input
                    type="text"
                    required
                    value={applyForm.payment_terms}
                    onChange={(e) => setApplyForm({ ...applyForm, payment_terms: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Required Delivery Date</label>
                  <input
                    type="date"
                    required
                    value={applyForm.required_date}
                    onChange={(e) => setApplyForm({ ...applyForm, required_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Notes & Instructions</label>
                <textarea
                  rows={2}
                  value={applyForm.notes}
                  onChange={(e) => setApplyForm({ ...applyForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  placeholder="Additional notes for approval hierarchy..."
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowApplyModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || activeCompanies.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: APPLICATION REVIEW & APPROVAL DRAWER ─── */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
                  {selectedApp.application_number}
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-1">{selectedApp.customer_name}</h3>
                <p className="text-xs text-slate-500">Collaborator: {selectedApp.collaborator_company_name}</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={24} />
              </button>
            </div>

            {/* Approval Hierarchy Progress Pipeline (PDF Requirements) */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Approval Hierarchy Workflow Progress
              </span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {/* Step 1: Vice Chairman */}
                <div
                  className={`p-3 rounded-xl border ${
                    selectedApp.vice_chairman_approved
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                      : selectedApp.current_approver_role === "Vice Chairman"
                      ? "bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span className="block font-bold text-[10px] uppercase">Step 1 (Highest)</span>
                  <span className="block font-black text-sm">Vice Chairman</span>
                  <span className="block text-[10px] mt-1 font-mono">
                    {selectedApp.vice_chairman_approved ? "APPROVED ✓" : selectedApp.current_approver_role === "Vice Chairman" ? "PENDING APPROVAL" : "WAITING"}
                  </span>
                </div>

                {/* Step 2: President */}
                <div
                  className={`p-3 rounded-xl border ${
                    selectedApp.president_approved
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                      : selectedApp.current_approver_role === "President"
                      ? "bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span className="block font-bold text-[10px] uppercase">Step 2 (Second)</span>
                  <span className="block font-black text-sm">President</span>
                  <span className="block text-[10px] mt-1 font-mono">
                    {selectedApp.president_approved ? "APPROVED ✓" : selectedApp.current_approver_role === "President" ? "PENDING APPROVAL" : "WAITING"}
                  </span>
                </div>

                {/* Step 3: Marketing MD */}
                <div
                  className={`p-3 rounded-xl border ${
                    selectedApp.marketing_md_approved
                      ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                      : selectedApp.current_approver_role === "MD-Marketing"
                      ? "bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span className="block font-bold text-[10px] uppercase">Step 3 (Third)</span>
                  <span className="block font-black text-sm">Marketing MD</span>
                  <span className="block text-[10px] mt-1 font-mono">
                    {selectedApp.marketing_md_approved ? "APPROVED ✓" : selectedApp.current_approver_role === "MD-Marketing" ? "PENDING APPROVAL" : "WAITING"}
                  </span>
                </div>

                {/* External Handshake */}
                <div
                  className={`p-3 rounded-xl border ${
                    selectedApp.collaborator_decision === "ACCEPTED"
                      ? "bg-indigo-950/80 border-indigo-500 text-indigo-300"
                      : selectedApp.collaborator_decision === "DECLINED"
                      ? "bg-red-950/80 border-red-500 text-red-300"
                      : selectedApp.status === "AWAITING COLLABORATOR ACCEPTANCE"
                      ? "bg-indigo-950/80 border-indigo-400 text-indigo-300 animate-pulse"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <span className="block font-bold text-[10px] uppercase">External Handshake</span>
                  <span className="block font-black text-sm">Collaborator</span>
                  <span className="block text-[10px] mt-1 font-mono">
                    {selectedApp.collaborator_decision || (selectedApp.status === "AWAITING COLLABORATOR ACCEPTANCE" ? "AWAITING" : "LOCKED")}
                  </span>
                </div>
              </div>
            </div>

            {/* Application Data Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-2xl border">
              <div>
                <span className="text-slate-400 block font-semibold">Product Name</span>
                <span className="font-bold text-slate-900">{selectedApp.product_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Quantity & Unit Price</span>
                <span className="font-bold text-slate-900">{selectedApp.quantity} Units @ ₹{selectedApp.unit_price}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Total Amount</span>
                <span className="font-black text-emerald-700 text-sm">₹{selectedApp.total_amount.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Shipping Transport</span>
                <span className="font-bold text-slate-800">{selectedApp.shipping_transport}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Delivery Location</span>
                <span className="font-bold text-slate-800">{selectedApp.delivery_location}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold">Payment Terms</span>
                <span className="font-bold text-slate-800">{selectedApp.payment_terms}</span>
              </div>
            </div>

            {/* Generated Bill Display (If Accepted) */}
            {selectedApp.generated_bill_number && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-700 uppercase block">Official Generated Bill</span>
                  <span className="font-mono font-black text-emerald-900 text-lg">{selectedApp.generated_bill_number}</span>
                </div>
                <button
                  onClick={() => alert(`Downloading Generated Bill: ${selectedApp.generated_bill_number}.pdf`)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow"
                >
                  <Download size={14} /> Download Final Bill
                </button>
              </div>
            )}

            {/* Rejection / Decline Details */}
            {(selectedApp.rejection_reason || selectedApp.collaborator_decline_reason) && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-200 text-red-800 text-xs space-y-1">
                <strong>Reason for Cancellation / Rejection:</strong>
                <p>{selectedApp.rejection_reason || selectedApp.collaborator_decline_reason}</p>
              </div>
            )}
            {actionError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {actionError}
              </div>
            )}

            {/* Dynamic Approval / Action Buttons */}
            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500 font-mono">
                Log User: <strong>{activeUser.name}</strong> ({activeUser.role})
              </span>

              <div className="flex items-center gap-2">
                {/* INTERNAL APPROVAL BUTTON */}
                {selectedApp.status === "PENDING INTERNAL APPROVAL" && (
                  <>
                    {(activeUser.role === "Admin"
                      || activeUser.role === selectedApp.current_approver_role
                      || (selectedApp.current_approver_role === "MD-Marketing"
                        && activeUser.role === "Managing Director"
                        && activeUser.department === "Marketing")) && (
                      <button
                        onClick={() => void handleApproveSelected()}
                        disabled={actionPending}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={16} /> {actionPending ? "Saving Approval..." : selectedApp.current_approver_role === "Vice Chairman"
                          ? "Approve Step 1/3 & Send to President"
                          : selectedApp.current_approver_role === "President"
                            ? "Approve Step 2/3 & Send to Marketing MD"
                            : "Final Approve & Send to Collaborator"}
                      </button>
                    )}

                    {(activeUser.role === "Admin"
                      || activeUser.role === selectedApp.current_approver_role
                      || (selectedApp.current_approver_role === "MD-Marketing"
                        && activeUser.role === "Managing Director"
                        && activeUser.department === "Marketing")) && (
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionPending}
                        className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl flex items-center gap-1"
                      >
                        <XCircle size={16} /> Reject Current Step
                      </button>
                    )}
                  </>
                )}

                {/* EXTERNAL COLLABORATOR HANDSHAKE BUTTONS (SECTION 8) */}
                {selectedApp.status === "AWAITING COLLABORATOR ACCEPTANCE" && isExternalCollaborator && (
                  <>
                    <button
                      onClick={() => void handleAcceptSelected()}
                      disabled={actionPending}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={16} /> {actionPending ? "Saving Decision..." : "Approve Offer & Generate Bill"}
                    </button>
                    <button
                      onClick={() => setShowDeclineModal(true)}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1"
                    >
                      <XCircle size={16} /> DECLINE OFFER
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2.5 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: REJECT REASON MODAL ─── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-red-600 flex items-center gap-2">
              <AlertCircle size={20} /> Reject Internal Application
            </h3>
            <p className="text-xs text-slate-500">
              Please enter the explicit reason for rejection. This will be stored permanently in the audit trail.
            </p>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide reason for rejection..."
              className="w-full p-3 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border text-xs font-bold rounded-xl text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: DECLINE REASON MODAL ─── */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-red-600 flex items-center gap-2">
              <AlertCircle size={20} /> Decline Collaboration Offer
            </h3>
            <p className="text-xs text-slate-500">
              Please state why your company is declining this collaboration application.
            </p>
            <textarea
              rows={3}
              required
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining..."
              className="w-full p-3 bg-slate-50 border rounded-xl text-xs focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 border text-xs font-bold rounded-xl text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeclineConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow"
              >
                Confirm Decline & Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: ADD PARTNER COMPANY ─── */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Add Partner Collaborator Company</h3>
            <form onSubmit={handleAddCompanySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter company name"
                  value={newCompany.company_name}
                  onChange={(e) => setNewCompany({ ...newCompany, company_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ABC-001"
                    value={newCompany.company_code}
                    onChange={(e) => setNewCompany({ ...newCompany, company_code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={newCompany.contact_phone}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Collaborator Head Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Sharma"
                  value={newCompany.collaborator_head_name}
                  onChange={(e) => setNewCompany({ ...newCompany, collaborator_head_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Collaborator Head Email</label>
                <input
                  type="email"
                  required
                  placeholder="head@abctrading.com"
                  value={newCompany.collaborator_head_email}
                  onChange={(e) => setNewCompany({ ...newCompany, collaborator_head_email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs"
                />
              </div>
              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 border text-xs font-bold rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow"
                >
                  Save Partner Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
export default CollaborationModule;
