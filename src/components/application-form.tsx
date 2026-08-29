"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { submitSandboxApplicationAction } from "@/lib/application/actions";
import {
  applicationFieldVisibility,
  defaultTransactionForLoanType,
} from "@/lib/application/fields";
import {
  APPLICATION_LOAN_TYPES,
  APPLICATION_TRANSACTIONS,
  CREDIT_RANGES,
  ENTITY_TYPES,
  FUNDING_TIMELINES,
  PROPERTY_TYPES,
  emptyApplicationDraft,
  type ApplicationDraft,
  type ApplicationFieldKey,
} from "@/lib/application/types";
import { SandboxBadge } from "@/components/sandbox-badge";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/styles";

const STEPS = [
  { id: "loan", title: "Loan" },
  { id: "borrower", title: "Borrower" },
  { id: "property", title: "Property" },
  { id: "financials", title: "Financials" },
  { id: "review", title: "Review" },
] as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs text-ink-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function ApplicationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDraft>(emptyApplicationDraft());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visibility = useMemo(
    () => applicationFieldVisibility(draft.loanType, draft.transactionType),
    [draft.loanType, draft.transactionType],
  );

  function set<K extends ApplicationFieldKey>(key: K, value: string) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "loanType" && !current.transactionType) {
        next.transactionType = defaultTransactionForLoanType(value);
      }
      return next;
    });
  }

  function show(key: ApplicationFieldKey) {
    return visibility[key];
  }

  async function submit() {
    setError(null);
    setPending(true);
    const formData = new FormData();
    for (const [key, value] of Object.entries(draft)) {
      formData.set(key, value);
    }
    const result = await submitSandboxApplicationAction(formData);
    setPending(false);
    if (result.error || !result.portalPath) {
      setError(result.error ?? "Unable to submit the application.");
      return;
    }
    router.push(
      `/apply/received?ref=${encodeURIComponent(result.dealReference)}&portal=${encodeURIComponent(result.portalPath)}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-muted">
            Business-purpose lending
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-pillar-navy">
            Deal Room application
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Evaluation intake only. Use fictitious borrower information.
          </p>
        </div>
        <SandboxBadge />
      </div>

      <ol className="flex flex-wrap gap-2 text-[11px]">
        {STEPS.map((item, index) => (
          <li
            key={item.id}
            className={
              index === step
                ? "rounded-md bg-pillar-navy px-2 py-1 font-medium text-white"
                : "rounded-md border border-line px-2 py-1 text-ink-muted"
            }
          >
            {index + 1}. {item.title}
          </li>
        ))}
      </ol>

      <div className="space-y-4 rounded-[10px] border border-line bg-surface p-5">
        {step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loan type">
              <select
                className={inputClass + " w-full"}
                value={draft.loanType}
                onChange={(event) => set("loanType", event.target.value)}
              >
                <option value="">Select</option>
                {APPLICATION_LOAN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Transaction">
              <select
                className={inputClass + " w-full"}
                value={draft.transactionType}
                onChange={(event) => set("transactionType", event.target.value)}
              >
                <option value="">Select</option>
                {APPLICATION_TRANSACTIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name">
              <input className={inputClass + " w-full"} value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} />
            </Field>
            <Field label="Last name">
              <input className={inputClass + " w-full"} value={draft.lastName} onChange={(e) => set("lastName", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className={inputClass + " w-full"} value={draft.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputClass + " w-full"} value={draft.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
            {show("entityName") ? (
              <Field label="Entity name">
                <input className={inputClass + " w-full"} value={draft.entityName} onChange={(e) => set("entityName", e.target.value)} />
              </Field>
            ) : null}
            {show("entityType") ? (
              <Field label="Entity type">
                <select className={inputClass + " w-full"} value={draft.entityType} onChange={(e) => set("entityType", e.target.value)}>
                  <option value="">Select</option>
                  {ENTITY_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            {show("ownershipPercent") ? (
              <Field label="Ownership %">
                <input className={inputClass + " w-full"} value={draft.ownershipPercent} onChange={(e) => set("ownershipPercent", e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address">
              <input className={inputClass + " w-full"} value={draft.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} />
            </Field>
            <Field label="City">
              <input className={inputClass + " w-full"} value={draft.propertyCity} onChange={(e) => set("propertyCity", e.target.value)} />
            </Field>
            <Field label="State">
              <input className={inputClass + " w-full"} value={draft.propertyState} onChange={(e) => set("propertyState", e.target.value)} />
            </Field>
            <Field label="ZIP">
              <input className={inputClass + " w-full"} value={draft.propertyZip} onChange={(e) => set("propertyZip", e.target.value)} />
            </Field>
            <Field label="Property type">
              <select className={inputClass + " w-full"} value={draft.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
                <option value="">Select</option>
                {PROPERTY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </Field>
            {show("units") ? (
              <Field label="Units">
                <input className={inputClass + " w-full"} value={draft.units} onChange={(e) => set("units", e.target.value)} />
              </Field>
            ) : null}
            {show("squareFootage") ? (
              <Field label="Square footage">
                <input className={inputClass + " w-full"} value={draft.squareFootage} onChange={(e) => set("squareFootage", e.target.value)} />
              </Field>
            ) : null}
            {show("occupancy") ? (
              <Field label="Occupancy">
                <input className={inputClass + " w-full"} value={draft.occupancy} onChange={(e) => set("occupancy", e.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {show("purchasePrice") ? (
              <Field label="Purchase price">
                <input className={inputClass + " w-full"} value={draft.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} />
              </Field>
            ) : null}
            {show("currentValue") ? (
              <Field label="Current value">
                <input className={inputClass + " w-full"} value={draft.currentValue} onChange={(e) => set("currentValue", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Requested loan amount">
              <input className={inputClass + " w-full"} value={draft.loanAmount} onChange={(e) => set("loanAmount", e.target.value)} />
            </Field>
            {show("existingPayoff") ? (
              <Field label="Existing payoff">
                <input className={inputClass + " w-full"} value={draft.existingPayoff} onChange={(e) => set("existingPayoff", e.target.value)} />
              </Field>
            ) : null}
            {show("cashOutAmount") ? (
              <Field label="Cash-out requested">
                <input className={inputClass + " w-full"} value={draft.cashOutAmount} onChange={(e) => set("cashOutAmount", e.target.value)} />
              </Field>
            ) : null}
            {show("estimatedArv") ? (
              <Field label="Estimated ARV">
                <input className={inputClass + " w-full"} value={draft.estimatedArv} onChange={(e) => set("estimatedArv", e.target.value)} />
              </Field>
            ) : null}
            {show("rehabBudget") ? (
              <Field label="Rehab budget">
                <input className={inputClass + " w-full"} value={draft.rehabBudget} onChange={(e) => set("rehabBudget", e.target.value)} />
              </Field>
            ) : null}
            {show("monthlyRent") ? (
              <Field label="Monthly rent">
                <input className={inputClass + " w-full"} value={draft.monthlyRent} onChange={(e) => set("monthlyRent", e.target.value)} />
              </Field>
            ) : null}
            {show("noi") ? (
              <Field label="NOI">
                <input className={inputClass + " w-full"} value={draft.noi} onChange={(e) => set("noi", e.target.value)} />
              </Field>
            ) : null}
            {show("landOwned") ? (
              <Field label="Land owned?">
                <select className={inputClass + " w-full"} value={draft.landOwned} onChange={(e) => set("landOwned", e.target.value)}>
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </Field>
            ) : null}
            {show("landValue") ? (
              <Field label="Land value">
                <input className={inputClass + " w-full"} value={draft.landValue} onChange={(e) => set("landValue", e.target.value)} />
              </Field>
            ) : null}
            {show("constructionBudget") ? (
              <Field label="Construction budget">
                <input className={inputClass + " w-full"} value={draft.constructionBudget} onChange={(e) => set("constructionBudget", e.target.value)} />
              </Field>
            ) : null}
            {show("completedValue") ? (
              <Field label="Completed value">
                <input className={inputClass + " w-full"} value={draft.completedValue} onChange={(e) => set("completedValue", e.target.value)} />
              </Field>
            ) : null}
            {show("plansPermitsStatus") ? (
              <Field label="Plans / permits status">
                <input className={inputClass + " w-full"} value={draft.plansPermitsStatus} onChange={(e) => set("plansPermitsStatus", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Credit range">
              <select className={inputClass + " w-full"} value={draft.creditRange} onChange={(e) => set("creditRange", e.target.value)}>
                <option value="">Select</option>
                {CREDIT_RANGES.map((range) => (
                  <option key={range}>{range}</option>
                ))}
              </select>
            </Field>
            <Field label="Experience">
              <input className={inputClass + " w-full"} value={draft.experience} onChange={(e) => set("experience", e.target.value)} />
            </Field>
            {show("liquidity") ? (
              <Field label="Liquidity">
                <input className={inputClass + " w-full"} value={draft.liquidity} onChange={(e) => set("liquidity", e.target.value)} />
              </Field>
            ) : null}
            {show("netWorth") ? (
              <Field label="Net worth">
                <input className={inputClass + " w-full"} value={draft.netWorth} onChange={(e) => set("netWorth", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Under contract?">
              <select className={inputClass + " w-full"} value={draft.underContract} onChange={(e) => set("underContract", e.target.value)}>
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </Field>
            {show("closingDate") ? (
              <Field label="Closing date">
                <input className={inputClass + " w-full"} value={draft.closingDate} onChange={(e) => set("closingDate", e.target.value)} />
              </Field>
            ) : null}
            <Field label="Funding timeline">
              <select className={inputClass + " w-full"} value={draft.fundingTimeline} onChange={(e) => set("fundingTimeline", e.target.value)}>
                <option value="">Select</option>
                {FUNDING_TIMELINES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
            <label className="sm:col-span-2 text-xs text-ink-muted">
              Borrower comments
              <textarea className={inputClass + " mt-1 min-h-20 w-full"} value={draft.borrowerComments} onChange={(e) => set("borrowerComments", e.target.value)} />
            </label>
            <label className="sm:col-span-2 text-xs text-ink-muted">
              Loan officer notes
              <textarea className={inputClass + " mt-1 min-h-20 w-full"} value={draft.loanOfficerNotes} onChange={(e) => set("loanOfficerNotes", e.target.value)} />
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Borrower</dt>
              <dd className="font-medium text-ink">
                {draft.firstName} {draft.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Loan</dt>
              <dd className="font-medium text-ink">
                {draft.loanType || "—"} · {draft.transactionType || "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-ink-muted">Property</dt>
              <dd className="font-medium text-ink">
                {[draft.propertyAddress, draft.propertyCity, draft.propertyState].filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Requested amount</dt>
              <dd className="font-medium text-ink">{draft.loanAmount || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Entity</dt>
              <dd className="font-medium text-ink">{draft.entityName || "Individual"}</dd>
            </div>
          </dl>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-between gap-2">
          <button
            type="button"
            className={buttonClass("secondary")}
            disabled={step === 0 || pending}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className={buttonClass("primary")}
              onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className={buttonClass("primary")}
              disabled={pending}
              onClick={() => void submit()}
            >
              Submit evaluation application
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
