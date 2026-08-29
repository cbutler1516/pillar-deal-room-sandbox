import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DealStatus } from "@/lib/data/types";

export type SnapshotDeal = {
  id: string;
  dealReference: string;
  borrowerName: string;
  entityName: string | null;
  loanType: string | null;
  loanAmount: number | null;
  propertyAddress: string | null;
  propertyCity: string | null;
  propertyState: string | null;
  status: DealStatus;
  assignedProcessorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SnapshotNeed = {
  id: string;
  dealId: string;
  required: boolean;
  status: string;
};

export type SnapshotDocument = {
  id: string;
  dealId: string;
  status: string;
};

export type SnapshotTask = {
  id: string;
  dealId: string;
  priority: string;
  status: string;
};

export async function loadDealSnapshot(supabase: SupabaseClient): Promise<{
  deals: SnapshotDeal[];
  needs: SnapshotNeed[];
  documents: SnapshotDocument[];
  tasks: SnapshotTask[];
}> {
  const [dealsRes, needsRes, docsRes, tasksRes] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, deal_reference, borrower_name, entity_name, loan_type, loan_amount, property_address, property_city, property_state, status, assigned_processor_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase.from("client_needs").select("id, deal_id, required, status"),
    supabase.from("documents").select("id, deal_id, status"),
    supabase.from("tasks").select("id, deal_id, priority, status"),
  ]);

  return {
    deals: (dealsRes.data ?? []).map((row) => ({
      id: row.id,
      dealReference: row.deal_reference,
      borrowerName: row.borrower_name,
      entityName: row.entity_name,
      loanType: row.loan_type,
      loanAmount: row.loan_amount,
      propertyAddress: row.property_address,
      propertyCity: row.property_city,
      propertyState: row.property_state,
      status: row.status,
      assignedProcessorId: row.assigned_processor_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    needs: (needsRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      required: row.required,
      status: row.status,
    })),
    documents: (docsRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      status: row.status,
    })),
    tasks: (tasksRes.data ?? []).map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      priority: row.priority,
      status: row.status,
    })),
  };
}
