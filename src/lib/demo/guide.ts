import { isSandboxMode, type SandboxEnv } from "@/lib/sandbox";

export function canShowDemoGuide(env: SandboxEnv = process.env): boolean {
  return isSandboxMode(env);
}

export const DEMO_GUIDE_STEPS = [
  {
    title: "Open Dashboard",
    body: "Everything needing attention is derived from live file state.",
  },
  {
    title: "Open Casey",
    body: "Application, Needs, documents, processor work, contacts, conditions, and timeline live in one file.",
  },
  {
    title: "Open Documents",
    body: "Processors can review, classify, and link documents without exposing file content to AI.",
  },
  {
    title: "Open Conditions",
    body: "Lender conditions become structured work instead of separate tickets.",
  },
  {
    title: "Open Team",
    body: "Ownership and workload are visible across the processing team.",
  },
  {
    title: "Open borrower portal",
    body: "The borrower sees only what they need to provide.",
  },
  {
    title: "Open the ready file",
    body: "Readiness is deterministic — not an AI guess.",
  },
] as const;
