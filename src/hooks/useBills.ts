import { useEffect, useState } from "react";
import {
  getBills,
  getPendingBills,
  createBill as createBillSvc,
  approveBill as approveBillSvc,
  reviewBill as reviewBillSvc,
  rejectBill as rejectBillSvc,
  returnBill as returnBillSvc,
  cancelApprovalBill as cancelApprovalBillSvc,
  type BillRecord,
} from "../services/bills.service";

export function useBills() {
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [pendingBills, setPendingBills] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshBills() {
    try {
      setLoading(true);
      const [nextBills, nextPending] = await Promise.all([getBills(), getPendingBills()]);
      setBills(nextBills);
      setPendingBills(nextPending);
      setError(null);
      return nextBills;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load bills";
      setError(message);
      return [] as BillRecord[];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshBills();
  }, []);

  async function createBill(payload: Parameters<typeof createBillSvc>[0]) {
    const data = await createBillSvc(payload);
    await refreshBills();
    return data;
  }

  async function approveBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
    const data = await approveBillSvc(id, actorId ?? null, actorRole ?? undefined, note);
    await refreshBills();
    return data;
  }

  async function reviewBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
    const data = await reviewBillSvc(id, actorId ?? null, actorRole ?? undefined, note);
    await refreshBills();
    return data;
  }

  async function rejectBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
    const data = await rejectBillSvc(id, actorId ?? null, actorRole ?? undefined, note);
    await refreshBills();
    return data;
  }

  async function returnBill(id: string, actorId?: string | null, actorRole?: string, note?: string): Promise<BillRecord> {
    const data = await returnBillSvc(id, actorId ?? null, actorRole ?? undefined, note);
    await refreshBills();
    return data;
  }

  async function cancelApproval(id: string, actorId?: string | null, actorRole?: string, reason?: string): Promise<BillRecord> {
    const data = await cancelApprovalBillSvc(id, actorId ?? null, actorRole ?? undefined, reason);
    await refreshBills();
    return data;
  }

  return { bills, pendingBills, loading, error, refreshBills, createBill, approveBill, reviewBill, rejectBill, returnBill, cancelApproval };
}
