import "server-only";

import { assertSandboxGuard, getSandboxGuardError, type SandboxEnv } from "@/lib/sandbox";

export type ShareFileConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  subdomain: string;
  apiControlPlane: string;
  rootFolderId: string;
};

function required(env: SandboxEnv, key: string): string {
  const value = env[key]?.trim() ?? "";
  if (!value) {
    throw new Error("ShareFile sandbox configuration is incomplete.");
  }
  return value;
}

export function assertShareFileSandboxGuard(env: SandboxEnv = process.env): void {
  const guardError = getSandboxGuardError(env);
  if (guardError) {
    throw new Error(guardError);
  }
  assertSandboxGuard(env);
}

export function getShareFileConfig(env: SandboxEnv = process.env): ShareFileConfig {
  assertShareFileSandboxGuard(env);
  return {
    clientId: required(env, "SHAREFILE_CLIENT_ID"),
    clientSecret: required(env, "SHAREFILE_CLIENT_SECRET"),
    refreshToken: required(env, "SHAREFILE_REFRESH_TOKEN"),
    subdomain: required(env, "SHAREFILE_SUBDOMAIN"),
    apiControlPlane: env.SHAREFILE_API_CONTROL_PLANE?.trim() || "sharefile.com",
    rootFolderId: required(env, "SHAREFILE_ROOT_FOLDER_ID"),
  };
}

export function sharefileTokenUrl(config: ShareFileConfig): string {
  return `https://${config.subdomain}.${config.apiControlPlane}/oauth/token`;
}

export function sharefileApiRoot(config: ShareFileConfig): string {
  return `https://${config.subdomain}.sf-api.com/sf/v3`;
}

export function buildShareFileAuthorizeUrl(
  config: ShareFileConfig,
  redirectUri: string,
  state: string,
): string {
  const url = new URL(`https://${config.subdomain}.${config.apiControlPlane}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}
