import Link from "next/link";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { compactInputClass, inputClass } from "@/components/ui/styles";

export function SearchField({
  compact = false,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { compact?: boolean }) {
  return (
    <input
      type="search"
      className={`${compact ? compactInputClass : inputClass} ${className}`.trim()}
      {...props}
    />
  );
}

export function SelectField({
  compact = false,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <select
      className={`${compact ? compactInputClass : inputClass} ${className}`.trim()}
      {...props}
    />
  );
}

const CHIP_BASE =
  "inline-flex min-h-8 items-center rounded-[8px] border px-2.5 py-1 text-xs font-medium transition motion-reduce:transition-none";
const CHIP_ACTIVE = "border-mineral bg-mineral text-white";
const CHIP_IDLE =
  "border-line text-ink-muted hover:border-mineral/40 hover:text-ink";

function chipClass(active: boolean): string {
  return `${CHIP_BASE} ${active ? CHIP_ACTIVE : CHIP_IDLE}`;
}

export function FilterChip({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: string;
}) {
  return (
    <Link href={href} aria-current={active ? "true" : undefined} className={chipClass(active)}>
      {children}
    </Link>
  );
}

export function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={chipClass(active)}
    >
      {children}
    </button>
  );
}

export function SegmentedControl({
  options,
}: {
  options: { href: string; label: string; active: boolean }[];
}) {
  return (
    <div className="inline-flex rounded-[8px] border border-line bg-surface p-0.5">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          className={`rounded-[6px] px-3 py-1 text-xs font-medium transition ${
            option.active
              ? "bg-pillar-ink text-white"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/**
 * Filter toolbar. Replaces raw <details> disclosures so filtering reads as
 * part of the workspace chrome rather than a developer affordance.
 */
export function Toolbar({
  children,
  chips,
  trailing,
}: {
  children: ReactNode;
  chips?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="border-y border-line bg-stone/40">
      <div className="flex flex-wrap items-center gap-2 px-0 py-2.5">
        {children}
        {trailing ? <div className="ml-auto flex items-center gap-2">{trailing}</div> : null}
      </div>
      {chips ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line/70 px-0 py-2">
          {chips}
        </div>
      ) : null}
    </div>
  );
}

export function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

export function TabList({
  tabs,
}: {
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav className="flex flex-wrap gap-0 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`min-h-10 border-b-2 px-3 py-2 text-[13px] font-medium transition duration-160 motion-reduce:transition-none ${
            tab.active
              ? "border-mineral text-ink"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
