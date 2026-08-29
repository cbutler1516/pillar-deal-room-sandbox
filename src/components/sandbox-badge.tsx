export function SandboxBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink-muted uppercase ${className}`}
    >
      Sandbox
    </span>
  );
}
