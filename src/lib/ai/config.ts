import { assertSandboxGuard, getSandboxGuardError, type SandboxEnv } from "@/lib/sandbox";
import {
  SANDBOX_MOCK_AI_PROVIDER,
  isAIProviderName,
  type AIProviderName,
} from "@/lib/ai/types";

export const AI_PROVIDER_ENV = "AI_PROVIDER";

const BLOCKED_REAL_PROVIDER_NAMES = [
  "openai",
  "anthropic",
  "google",
  "gemini",
  "azure",
  "bedrock",
  "groq",
  "mistral",
  "cohere",
  "huggingface",
  "external_ai",
];

export function getAIProviderName(env: SandboxEnv = process.env): AIProviderName {
  const guardError = getSandboxGuardError(env);
  if (guardError) {
    throw new Error(guardError);
  }

  const raw = env[AI_PROVIDER_ENV]?.trim();
  const normalized = (raw || SANDBOX_MOCK_AI_PROVIDER).toLowerCase();

  if (BLOCKED_REAL_PROVIDER_NAMES.includes(normalized)) {
    throw new Error(
      "Real AI providers are disabled in this evaluation phase. Set AI_PROVIDER=sandbox_mock_ai.",
    );
  }

  if (isAIProviderName(normalized)) {
    return normalized;
  }

  throw new Error("Only sandbox_mock_ai is allowed while PRODUCTION_INTEGRATIONS_ENABLED=false.");
}

export function assertAIProviderGuard(env: SandboxEnv = process.env): void {
  assertSandboxGuard(env);
  getAIProviderName(env);
}
