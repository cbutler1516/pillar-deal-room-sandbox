export const DEMO_REFERENCE_PREFIX = "PDR-SBX-";

export function demoUuid(n: number): string {
  return `00000000-0000-4000-a000-${n.toString().padStart(12, "0")}`;
}

export function isDemoReference(reference: string): boolean {
  return reference.startsWith(DEMO_REFERENCE_PREFIX);
}

/** Deterministic join-row id for a sandbox document ↔ Client Need pair. */
export function demoDocumentLinkId(
  documentId: string,
  clientNeedId: string,
): string {
  const documentKey = documentId.replaceAll("-", "").slice(-6);
  const needKey = clientNeedId.replaceAll("-", "").slice(-6);
  return `00000000-0000-4000-c000-${documentKey}${needKey}`;
}
