import { createHmac, timingSafeEqual } from "node:crypto";

function portalSecret(): string {
  return (
    process.env.SANDBOX_PORTAL_SECRET?.trim() ||
    "pillar-sandbox-portal-evaluation-only"
  );
}

function sign(dealId: string): string {
  return createHmac("sha256", portalSecret()).update(dealId).digest("base64url");
}

export function createPortalToken(dealId: string): string {
  return `${dealId}.${sign(dealId)}`;
}

export function readPortalToken(token: string): string | null {
  const [dealId, signature] = token.split(".");
  if (!dealId || !signature) {
    return null;
  }
  const expected = sign(dealId);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }
  return dealId;
}
