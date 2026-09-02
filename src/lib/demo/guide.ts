import { isSandboxMode, type SandboxEnv } from "@/lib/sandbox";

export function canShowDemoGuide(env: SandboxEnv = process.env): boolean {
  return isSandboxMode(env);
}

export const DEMO_GUIDE_STEPS = [
  {
    title: "Open Home",
    body: "Start here. See what to do first, what is waiting, and what can move.",
  },
  {
    title: "Open Casey",
    body: "Overview, requests, documents, conditions, people, and activity live in one file.",
  },
  {
    title: "Open Documents",
    body: "Review, name, and link files. AI suggestions stay secondary.",
  },
  {
    title: "Open Conditions",
    body: "Lender conditions are tracked on the file.",
  },
  {
    title: "Open Team",
    body: "See who owns which files.",
  },
  {
    title: "Open borrower portal",
    body: "The borrower sees only what they need to provide.",
  },
  {
    title: "Open the ready file",
    body: "Casey Brooks opens on Submission. Ready to send is file state — not an AI guess.",
  },
] as const;
