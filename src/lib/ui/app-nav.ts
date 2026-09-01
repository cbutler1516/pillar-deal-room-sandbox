export type AppNavItem = {
  href: "/dashboard" | "/deals" | "/processor-queue" | "/tasks" | "/team";
  label: "Dashboard" | "Deals" | "Queue" | "Tasks" | "Team";
};

export const MOBILE_APP_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/deals", label: "Deals" },
  { href: "/processor-queue", label: "Queue" },
] as const satisfies readonly AppNavItem[];

export const DESKTOP_APP_NAV = [
  ...MOBILE_APP_NAV,
  { href: "/tasks", label: "Tasks" },
  { href: "/team", label: "Team" },
] as const satisfies readonly AppNavItem[];

export function isAppNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
