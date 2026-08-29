export type SandboxEnv = {
  SANDBOX_MODE?: string;
  PRODUCTION_INTEGRATIONS_ENABLED?: string;
  [key: string]: string | undefined;
};

export function isSandboxMode(env: SandboxEnv = process.env): boolean {
  return env.SANDBOX_MODE === "true";
}

export function areProductionIntegrationsEnabled(
  env: SandboxEnv = process.env,
): boolean {
  return env.PRODUCTION_INTEGRATIONS_ENABLED === "true";
}

export function getSandboxGuardError(env: SandboxEnv = process.env): string | null {
  if (!isSandboxMode(env)) {
    return "SANDBOX_MODE must be true in this repository.";
  }
  if (areProductionIntegrationsEnabled(env)) {
    return "PRODUCTION_INTEGRATIONS_ENABLED must stay false. Production integrations are disabled.";
  }
  return null;
}

export function assertSandboxGuard(env: SandboxEnv = process.env): void {
  const error = getSandboxGuardError(env);
  if (error) {
    throw new Error(error);
  }
}
