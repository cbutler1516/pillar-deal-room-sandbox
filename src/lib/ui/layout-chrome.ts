/**
 * App chrome tokens. Values must match :root in globals.css.
 * Desktop: dark left rail, no top header — deal tabs stick to workspace top.
 * Mobile: slim dark top bar; inspector stops above the bottom nav.
 */
export const APP_HEADER_HEIGHT = "3.25rem";
export const DEAL_TABS_HEIGHT = "2.75rem";
export const CHROME_GAP = "0.25rem";
export const APP_BOTTOM_NAV_SPACE = "5.5rem";
export const APP_BOTTOM_NAV_SPACE_DESKTOP = "1.5rem";

export const inspectorStickyClass = [
  "lg:sticky",
  "lg:top-[var(--inspector-sticky-top)]",
  "lg:z-0",
  "lg:max-h-[calc(100vh-var(--inspector-sticky-top)-var(--app-bottom-nav-space))]",
  "lg:overflow-y-auto",
].join(" ");

export const dealTabsStickyClass =
  "pointer-events-none sticky top-[var(--app-header-height)] z-10 -mx-3 bg-paper/90 px-3 backdrop-blur-sm sm:-mx-5 sm:px-5";
