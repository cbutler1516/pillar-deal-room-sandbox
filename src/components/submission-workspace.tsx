"use client";

import { useMemo, useState } from "react";
import {
  markSubmittedAction,
  suggestSubmissionRewriteAction,
} from "@/lib/submission/actions";
import type { SubmissionBlocker, SubmissionReadyItem } from "@/lib/submission/blockers";
import type { SubmissionChecklistItem } from "@/lib/submission/checklist";
import type { SubmissionManifestItem } from "@/lib/submission/manifest";
import type { SubmissionMetric } from "@/lib/submission/metrics";
import type { DealSummarySection } from "@/lib/submission/summary";
import { buttonClass } from "@/components/ui/button";
import { CardHeader, SurfaceCard } from "@/components/ui/surface-card";
import { StaffPresence } from "@/components/ui/staff-avatar";
import { surfaceClass } from "@/components/ui/styles";
import { formatCurrency, formatDealStatus, formatTimestamp } from "@/lib/format";

export function SubmissionWorkspace({
  dealId,
  ready,
  submitted,
  submittedLabel,
  borrowerName,
  entityName,
  propertyLabel,
  loanType,
  loanAmount,
  processorName,
  fileStatus,
  blockerCount,
  blockers,
  readyItems,
  manifest,
  sections,
  metrics,
  checklist,
  emailSubject,
  emailBody,
  conditionSummary,
  summaryText,
  canMutate,
}: {
  dealId: string;
  ready: boolean;
  submitted: boolean;
  submittedLabel: string | null;
  borrowerName: string;
  entityName: string | null;
  propertyLabel: string;
  loanType: string | null;
  loanAmount: number | null;
  processorName: string | null;
  fileStatus: string;
  blockerCount: number;
  blockers: SubmissionBlocker[];
  readyItems: SubmissionReadyItem[];
  manifest: SubmissionManifestItem[];
  sections: DealSummarySection[];
  metrics: SubmissionMetric[];
  checklist: SubmissionChecklistItem[];
  emailSubject: string;
  emailBody: string;
  conditionSummary: { open: number; received: number; review: number; cleared: number };
  summaryText: string;
  canMutate: boolean;
}) {
  const [draft, setDraft] = useState(emailBody);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const copyTarget = useMemo(
    () => ({ subject: emailSubject, body: draft, summary: summaryText }),
    [emailSubject, draft, summaryText],
  );

  async function copy(label: string, value: string) {
    setError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setMessage(`${label} copied.`);
        return;
      }
    } catch {
      setMessage(null);
    }
    setMessage(`Select the ${label.toLowerCase()} text below if clipboard is unavailable.`);
  }

  return (
    <div className="submission-print space-y-6">
      <div className="submission-print-brand mb-6 hidden">
        <p className="text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">
          Pillar Private Lending
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">Lender submission package</p>
      </div>
      <section
        className={`border-l-2 bg-stone/40 px-5 py-5 ${
          submitted
            ? "border-l-pillar-ink"
            : ready
              ? "border-l-mineral"
              : "border-l-danger"
        }`}
      >
        <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-muted uppercase">
          Ready to send
        </p>
        <h3 className="font-display mt-2 text-2xl font-semibold tracking-tight text-ink">
          {submitted
            ? "Submitted"
            : ready
              ? "Ready to send"
              : "Not ready to send"}
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          {submitted && submittedLabel
            ? submittedLabel
            : ready
              ? "Needed-now items are complete."
              : `${blockerCount} item${blockerCount === 1 ? "" : "s"} still need attention.`}
        </p>
        <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Borrower" value={borrowerName} />
          <Fact label="Entity" value={entityName ?? "Not provided"} />
          <Fact label="Property" value={propertyLabel || "Not provided"} />
          <Fact label="Loan type" value={loanType ?? "Not provided"} />
          <Fact
            label="Requested loan"
            value={loanAmount == null ? "Not provided" : formatCurrency(loanAmount)}
          />
          <div>
            <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-muted">
              Processor
            </dt>
            <dd className="mt-1">
              <StaffPresence name={processorName} unassigned={!processorName} />
            </dd>
          </div>
          <Fact label="File status" value={formatDealStatus(fileStatus)} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
        <div className="space-y-6">
          <SurfaceCard>
            <CardHeader title="Blockers" />
            {blockers.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is blocking submission.</p>
            ) : (
              <ul className="divide-y divide-line">
                {blockers.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0">
                    <div>
                      <p className="text-sm font-medium text-ink">{row.title}</p>
                      <p className="text-xs text-ink-muted">{row.reason}</p>
                    </div>
                    <a href={row.href} className={`${buttonClass("secondary", "sm")} print-hide`}>
                      Open {submissionTargetLabel(row.target)}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <CardHeader title="Ready / Complete" />
            {readyItems.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is marked complete yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {readyItems.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-ink">{row.title}</span>
                    <span className="text-ink-muted">{row.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <CardHeader
              title="Lender package"
              description="Approved, linked documents. Nothing is sent from here."
            />
            {manifest.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No approved, linked documents are eligible for this package yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {manifest.map((row) => (
                  <li key={row.id} className="py-2.5 first:pt-0">
                    <p className="text-sm font-medium text-ink">{row.fileName}</p>
                    <p className="text-xs text-ink-muted">
                      {row.documentType}
                      {row.needLabels.length > 0 ? ` · ${row.needLabels.join(", ")}` : ""}
                      {` · ${row.status} · ${row.reviewStatus} · ${formatTimestamp(row.uploadedAt)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>

          <section className={`${surfaceClass("card")} px-5 py-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Deal summary</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Lender-facing facts from the file. Missing values stay Not provided.
                </p>
              </div>
              <div className="print-hide flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => void copy("Deal summary", copyTarget.summary)}
                >
                  Copy deal summary
                </button>
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => window.print()}
                >
                  Print summary
                </button>
              </div>
            </div>
            {metrics.length > 0 ? (
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((row) => (
                  <div key={row.key} className="rounded-[12px] bg-surface-muted px-3 py-2">
                    <dt className="text-[11px] text-ink-muted">{row.label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
                      {row.value}
                    </dd>
                    <p className="mt-1 text-[11px] text-ink-muted">{row.formula}</p>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {sections.map((section) => (
                <div key={section.title}>
                  <h4 className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
                    {section.title}
                  </h4>
                  <dl className="mt-2 space-y-1.5">
                    {section.fields.map((field) => (
                      <div key={field.label} className="flex justify-between gap-3 text-sm">
                        <dt className="text-ink-muted">{field.label}</dt>
                        <dd className="text-right text-ink">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          <section className={`${surfaceClass("card")} px-5 py-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Submission email draft</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  Copy only. Nothing is sent. Rewrite suggestions are not authority.
                </p>
              </div>
              <div className="print-hide flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => void copy("Subject", copyTarget.subject)}
                >
                  Copy subject
                </button>
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  onClick={() => void copy("Email", `Subject: ${emailSubject}\n\n${draft}`)}
                >
                  Copy email
                </button>
                <button
                  type="button"
                  className={buttonClass("secondary", "sm")}
                  disabled={pending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("body", draft);
                    setPending(true);
                    void suggestSubmissionRewriteAction(data).then((result) => {
                      setPending(false);
                      if (result.error || !result.body) {
                        setError(result.error ?? "Unable to suggest a rewrite.");
                        return;
                      }
                      setDraft(result.body);
                      setMessage("Suggestion only. The deterministic draft is still available above.");
                    });
                  }}
                >
                  Suggest rewrite
                </button>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-ink">{emailSubject}</p>
            <textarea
              className="mt-3 w-full rounded-[12px] border border-line bg-surface px-3 py-3 text-sm leading-6 text-ink"
              rows={16}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </section>
        </div>

        <div className="space-y-6">
          <SurfaceCard>
            <CardHeader title="Checklist" />
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-ink">{item.label}</span>
                  <span className="shrink-0 text-ink-muted">
                    {item.state === "complete" ? "Complete" : "Needs attention"}
                  </span>
                </li>
              ))}
            </ul>
          </SurfaceCard>

          <SurfaceCard>
            <CardHeader title="Conditions" />
            <p className="text-sm text-ink">
              {conditionSummary.open} open
              {conditionSummary.received > 0 ? ` · ${conditionSummary.received} received` : ""}
              {conditionSummary.review > 0 ? ` · ${conditionSummary.review} need review` : ""}
              {conditionSummary.cleared > 0 ? ` · ${conditionSummary.cleared} cleared` : ""}
            </p>
            <a
              href={`/deals/${dealId}?tab=conditions`}
              className={`${buttonClass("secondary", "sm")} print-hide mt-3`}
            >
              View conditions
            </a>
          </SurfaceCard>

          {canMutate && !submitted ? (
            <SurfaceCard>
              <CardHeader
                title="Mark submitted"
                description="Confirms the package was sent outside Deal Room. Nothing is emailed from here."
              />
              <button
                type="button"
                className={buttonClass("accent")}
                disabled={!ready || pending}
                onClick={() => {
                  const data = new FormData();
                  data.set("dealId", dealId);
                  setPending(true);
                  setError(null);
                  void markSubmittedAction(data).then((result) => {
                    setPending(false);
                    if (result.error) {
                      setError(result.error);
                    }
                  });
                }}
              >
                Mark submitted
              </button>
              {!ready ? (
                <p className="mt-2 text-xs text-ink-muted">
                  Available when the file is ready to send.
                </p>
              ) : null}
            </SurfaceCard>
          ) : null}
        </div>
      </div>
      {message ? <p className="print-hide text-sm text-pillar-teal">{message}</p> : null}
      {error ? <p className="print-hide text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function submissionTargetLabel(target: string): string {
  if (target === "contacts") return "People";
  if (target === "needs") return "Requests";
  if (target === "documents") return "Documents";
  if (target === "conditions") return "Conditions";
  if (target === "submission") return "Submission";
  if (target === "tasks") return "Tasks";
  return target;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
