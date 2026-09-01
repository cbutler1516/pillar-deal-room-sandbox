"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type SVGProps } from "react";
import { PillarMark } from "@/components/brand/pillar-logo";
import { LogoutButton } from "@/components/logout-button";
import { SandboxBadge } from "@/components/sandbox-badge";
import { StaffAvatar } from "@/components/ui/staff-avatar";
import { displayName, type InternalProfile } from "@/lib/auth/authorization";
import { formatRoleLabel } from "@/lib/auth/roles";
import {
  DESKTOP_APP_NAV,
  MOBILE_APP_NAV,
  isAppNavActive,
} from "@/lib/ui/app-nav";

const NAV_ICONS = {
  "/dashboard": DashboardIcon,
  "/deals": DealsIcon,
  "/processor-queue": QueueIcon,
  "/tasks": TasksIcon,
} as const;

export function AppShell({
  profile,
  children,
}: {
  profile: InternalProfile;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const name = displayName(profile);
  const role = formatRoleLabel(profile.role);

  return (
    <div className="min-h-full bg-workspace">
      <header className="sticky top-0 z-20 h-[var(--app-header-height)] border-b border-line bg-surface/95 backdrop-blur">
        <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <PillarMark size={32} decorative className="shrink-0" />
            <p className="truncate text-sm font-semibold text-pillar-navy">
              Deal Room
            </p>
            <SandboxBadge />
          </div>
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-2">
              {DESKTOP_APP_NAV.map((item) => {
                const active = isAppNavActive(pathname, item.href);
                const Icon = NAV_ICONS[item.href];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-navy/30 ${
                        active
                          ? "bg-pillar-teal-soft text-pillar-teal"
                          : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <StaffAvatar name={name} size={32} />
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-medium text-ink">{name}</p>
              <p className="text-[11px] text-ink-muted">{role}</p>
            </div>
            <AccountMenu name={name} role={role} />
          </div>
        </div>
      </header>

      <main className="px-3 pb-[var(--app-bottom-nav-space)] pt-4 sm:px-5 sm:pt-5">{children}</main>

      <nav
        aria-label="Application"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md sm:bottom-4 sm:left-1/2 sm:right-auto sm:w-[min(64rem,calc(100%-2.5rem))] sm:-translate-x-1/2 sm:rounded-[14px] sm:border sm:px-3 sm:py-1.5 sm:shadow-[var(--shadow-elevated)] lg:hidden"
      >
        <div className="flex items-center">
          <ul className="flex min-w-0 flex-1 items-stretch justify-between gap-1 sm:gap-2">
          {MOBILE_APP_NAV.map((item) => {
            const active = isAppNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.href];
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pillar-navy/30 sm:justify-center ${
                    active
                      ? "text-pillar-teal"
                      : "text-ink-muted hover:bg-surface-muted hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="max-w-full truncate text-[13px] font-medium">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          </ul>
        </div>
      </nav>
    </div>
  );
}

function AccountMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-xs font-medium text-ink hover:bg-surface-muted"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="hidden sm:inline">Account</span>
        <span className="sm:hidden">Menu</span>
        <span aria-hidden className="text-ink-muted">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-48 rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-line px-2.5 py-2 sm:hidden">
            <p className="text-xs font-medium text-ink">{name}</p>
            <p className="text-[11px] text-ink-muted">{role}</p>
          </div>
          <div className="px-1 pt-1">
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M3.5 3.5h5.5v6H3.5zM11 3.5h5.5v3.5H11zM11 8.5h5.5v8H11zM3.5 11h5.5v5.5H3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DealsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M3.5 6.5h13v9.2a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1zM7 6.5V5.2A1.7 1.7 0 0 1 8.7 3.5h2.6A1.7 1.7 0 0 1 13 5.2v1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QueueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M4 5.5h12M4 10h12M4 14.5h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TasksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M4.4 5.2h2.2v2.2H4.4zM8.6 6.3h7M4.4 8.9h2.2v2.2H4.4zM8.6 10h7M4.4 12.6h2.2v2.2H4.4zM8.6 13.7h5.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

