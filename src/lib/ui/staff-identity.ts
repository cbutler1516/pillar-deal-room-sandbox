export const STAFF_AVATAR_SIZES = [24, 28, 32, 40, 48] as const;

export type StaffAvatarSize = (typeof STAFF_AVATAR_SIZES)[number];

export const STAFF_AVATAR_TONES = [
  { bg: "bg-info-soft", fg: "text-info" },
  { bg: "bg-pillar-teal-soft", fg: "text-pillar-teal" },
  { bg: "bg-surface-muted", fg: "text-pillar-navy" },
  { bg: "bg-[#eef2f6]", fg: "text-pillar-navy-soft" },
] as const;

export function staffInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0 && !/^[^a-z0-9]+$/i.test(part));
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] ?? "";
  const last = parts[parts.length - 1][0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export function staffAvatarToneIndex(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 997;
  }
  return hash % STAFF_AVATAR_TONES.length;
}
