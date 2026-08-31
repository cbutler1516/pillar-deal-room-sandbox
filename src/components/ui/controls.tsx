import Link from "next/link";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
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
    <Link
      href={href}
      className={`inline-flex min-h-8 items-center rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-pillar-teal text-white"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink"
      }`}
    >
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
      className={`inline-flex min-h-8 items-center rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-pillar-teal text-white"
          : "text-ink-muted hover:bg-surface-muted hover:text-ink"
      }`}
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
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((option) => (
        <Link
          key={option.label}
          href={option.href}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            option.active
              ? "bg-pillar-teal text-white"
              : "text-ink-muted hover:text-ink"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

export function TabList({
  tabs,
}: {
  tabs: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab.active
              ? "border-pillar-teal text-ink"
              : "border-transparent text-ink-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
