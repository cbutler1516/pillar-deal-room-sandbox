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
import { DemoGuide } from "@/components/demo-guide";
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
  "/team": TeamIcon,
} as const;

export function AppShell({
  profile,
  children,
  demoGuide = null,
}: {
  profile: InternalProfile;
  children: ReactNode;
  demoGuide?: {
    caseyHref: string;
    readyHref: string;
    portalHref: string;
  } | null;
}) {
  const pathname = usePathname();
  const name = displayName(profile);
  const role = formatRoleLabel(profile.role);

  return (
    <div className="min-h-full bg-paper lg:flex">
      <aside className="print-hide hidden lg:flex lg:h-screen lg:w-[var(--app-rail-width)] lg:shrink-0 lg:flex-col lg:sticky lg:top-0 bg-pillar-ink text-white">
        <div className="px-5 pt-7 pb-6">
          <PillarMark size={30} decorative className="brightness-0 invert" />
          <p className="font-display mt-4 text-[1.35rem] font-semibold leading-none tracking-tight">
            PILLAR
          </p>
          <p className="mt-2.5 text-[10px] uppercase tracking-[0.18em] text-white/42">
            Private Lending
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-accent">
            Deal Room
          </p>
        </div>
        <div className="mx-5 h-px bg-white/10" />
        <nav aria-label="Primary" className="flex-1 py-5">
          <ul>
            {DESKTOP_APP_NAV.map((item) => {
              const active = isAppNavActive(pathname, item.href);
              const Icon = NAV_ICONS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 px-5 text-[13px] font-medium ${
                      active
                        ? "bg-white/[0.07] text-white"
                        : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-y-0 left-0 w-[2px] ${
                        active ? "bg-accent" : "bg-transparent"
                      }`}
                    />
                    <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto border-t border-white/10 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <SandboxBadge className="border-white/15 text-white/45" />
            {demoGuide ? <DemoGuide {...demoGuide} /> : null}
          </div>
          <AccountMenu name={name} role={role} />
        </div>
      </aside>

      <div className="min-w-0 flex-1 border-l border-transparent lg:border-pillar-navy">
        <header className="print-hide sticky top-0 z-20 flex h-[var(--app-header-height)] items-center justify-between gap-3 border-b border-white/10 bg-pillar-ink px-3 text-white lg:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <PillarMark size={22} decorative className="shrink-0 brightness-0 invert" />
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold leading-none">PILLAR</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-accent">
                Deal Room
              </p>
            </div>
            <SandboxBadge className="border-white/15 text-white/45" />
          </div>
          <div className="flex items-center gap-2">
            {demoGuide ? <DemoGuide {...demoGuide} /> : null}
            <AccountMenu name={name} role={role} compact />
          </div>
        </header>

        <main className="px-[var(--app-workspace-pad-x)] pb-[var(--app-bottom-nav-space)] pt-[var(--app-workspace-pad-y)]">
          {children}
        </main>
      </div>

      <nav
        aria-label="Application"
        className="print-hide fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden"
      >
        <ul className="flex items-stretch justify-between gap-1">
          {MOBILE_APP_NAV.map((item) => {
            const active = isAppNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.href];
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-center ${
                    active ? "text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {active ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-6 top-0 h-[2px] bg-accent"
                    />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate text-[10px] font-medium uppercase tracking-[0.1em]">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function AccountMenu({
  name,
  role,
  compact = false,
}: {
  name: string;
  role: string;
  compact?: boolean;
}) {
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
        aria-label="Account menu"
        className={
          compact
            ? "inline-flex items-center rounded-[8px] p-0.5 hover:bg-white/10"
            : "flex w-full items-center gap-2.5 rounded-[8px] px-1 py-1 text-left hover:bg-white/6"
        }
        onClick={() => setOpen((value) => !value)}
      >
        <StaffAvatar name={name} size={compact ? 28 : 32} />
        {compact ? null : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-white">{name}</span>
            <span className="block text-[11px] text-white/45">{role}</span>
          </span>
        )}
      </button>
      {open ? (
        <div
          role="menu"
          className={
            compact
              ? "absolute right-0 top-full z-30 mt-2 min-w-48 rounded-[10px] border border-line bg-surface p-2 text-ink shadow-[var(--shadow-float)]"
              : "absolute left-0 bottom-full z-30 mb-2 min-w-48 rounded-[10px] border border-line bg-surface p-2 text-ink shadow-[var(--shadow-float)]"
          }
        >
          <div className="border-b border-line px-2.5 py-2">
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
        strokeWidth="1.4"
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
        strokeWidth="1.4"
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
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TeamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden {...props}>
      <path
        d="M7 8.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM13 8.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM4.2 16c0-2.2 1.8-3.6 2.8-3.6h2M10.2 12.4h2c1 0 2.8 1.4 2.8 3.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
