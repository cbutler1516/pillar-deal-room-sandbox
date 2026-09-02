export type AppNavItem = {
  href: "/dashboard" | "/deals" | "/processor-queue" | "/tasks" | "/team";
  label: "Home" | "Deals" | "Work" | "Tasks" | "Team";
};

export const MOBILE_APP_NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/deals", label: "Deals" },
  { href: "/processor-queue", label: "Work" },
] as const satisfies readonly AppNavItem[];

export const DESKTOP_APP_NAV = [
  ...MOBILE_APP_NAV,
  { href: "/tasks", label: "Tasks" },
  { href: "/team", label: "Team" },
] as const satisfies readonly AppNavItem[];

export function isAppNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
