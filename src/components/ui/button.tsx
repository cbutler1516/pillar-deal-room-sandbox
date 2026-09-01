import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-pillar-navy text-white shadow-[0_1px_2px_rgb(11_31_58/0.2)] hover:-translate-y-px hover:bg-pillar-navy-soft hover:shadow-[0_4px_10px_rgb(11_31_58/0.18)] disabled:opacity-60 motion-reduce:hover:translate-y-0",
  secondary:
    "border border-line bg-surface text-ink shadow-[var(--shadow-card)] hover:-translate-y-px hover:bg-surface-muted hover:shadow-[var(--shadow-elevated)] disabled:opacity-60 motion-reduce:hover:translate-y-0",
  accent:
    "bg-pillar-teal text-white shadow-[0_1px_2px_rgb(27_122_114/0.28)] hover:-translate-y-px hover:bg-pillar-teal/90 hover:shadow-[0_4px_12px_rgb(27_122_114/0.22)] disabled:opacity-60 motion-reduce:hover:translate-y-0",
  danger:
    "border border-danger/20 bg-danger-soft text-danger hover:bg-danger/10 disabled:opacity-60",
  ghost: "text-ink hover:bg-surface-muted disabled:opacity-60",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "rounded-md px-2.5 py-1.5 text-xs font-medium",
  md: "rounded-md px-3.5 py-2 text-sm font-medium",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className = "",
): string {
  return `inline-flex min-h-8 items-center justify-center transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pillar-teal motion-reduce:transition-none disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`.trim();
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...props} />
  );
}
