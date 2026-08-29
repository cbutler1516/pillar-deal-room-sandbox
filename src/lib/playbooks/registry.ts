import { BRIDGE_BASELINE_KEYS } from "@/lib/playbooks/bridge";
import { COMMERCIAL_BASELINE_KEYS } from "@/lib/playbooks/commercial";
import { COMMON_PLAYBOOKS } from "@/lib/playbooks/common";
import { CONSTRUCTION_BASELINE_KEYS } from "@/lib/playbooks/construction";
import {
  DSCR_PURCHASE_BASELINE_KEYS,
  DSCR_REFINANCE_BASELINE_KEYS,
} from "@/lib/playbooks/dscr";
import { FIX_AND_FLIP_BASELINE_KEYS } from "@/lib/playbooks/fix-and-flip";
import type { PlaybookDefinition } from "@/lib/playbooks/types";

const BY_KEY = new Map(
  COMMON_PLAYBOOKS.map((playbook) => [playbook.playbookKey, playbook]),
);

export function listPlaybooks(): PlaybookDefinition[] {
  return [...COMMON_PLAYBOOKS];
}

export function getPlaybook(playbookKey: string): PlaybookDefinition | null {
  return BY_KEY.get(playbookKey) ?? null;
}

export function requirePlaybook(playbookKey: string): PlaybookDefinition {
  const playbook = getPlaybook(playbookKey);
  if (!playbook) {
    throw new Error(`Unknown playbook: ${playbookKey}`);
  }
  return playbook;
}

export function playbooksForKeys(keys: readonly string[]): PlaybookDefinition[] {
  return keys.map((key) => requirePlaybook(key));
}

const COMMON_EVALUATION_KEYS = [
  "request_government_id",
  "request_entity_documents",
  "request_bank_statements",
  "request_insurance_binder",
  "prepare_submission",
] as const;

export function baselinePlaybookKeysForLoanType(loanType: string): string[] {
  const value = loanType.toLowerCase();
  if (value.includes("flip")) {
    return [...FIX_AND_FLIP_BASELINE_KEYS];
  }
  if (value.includes("dscr") && value.includes("refi")) {
    return [...DSCR_REFINANCE_BASELINE_KEYS];
  }
  if (value.includes("dscr")) {
    return [...DSCR_PURCHASE_BASELINE_KEYS];
  }
  if (value.includes("construction") || value.includes("ground-up") || value.includes("ground up")) {
    return [...CONSTRUCTION_BASELINE_KEYS];
  }
  if (value.includes("commercial") || value.includes("multifamily")) {
    return [...COMMERCIAL_BASELINE_KEYS];
  }
  if (value.includes("bridge")) {
    return [...BRIDGE_BASELINE_KEYS];
  }
  return [...COMMON_EVALUATION_KEYS];
}

export function baselinePlaybooksForLoanType(
  loanType: string,
): PlaybookDefinition[] {
  return playbooksForKeys(baselinePlaybookKeysForLoanType(loanType));
}
