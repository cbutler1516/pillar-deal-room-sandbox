import { assertAIProviderGuard, getAIProviderName } from "@/lib/ai/config";
import { getSandboxMockAIProvider } from "@/lib/ai/mock-provider";
import type { AIProvider } from "@/lib/ai/types";
import { SANDBOX_MOCK_AI_PROVIDER } from "@/lib/ai/types";
import type { SandboxEnv } from "@/lib/sandbox";

export function getAIProvider(env: SandboxEnv = process.env): AIProvider {
  assertAIProviderGuard(env);
  const name = getAIProviderName(env);
  if (name === SANDBOX_MOCK_AI_PROVIDER) {
    return getSandboxMockAIProvider();
  }
  throw new Error("Unsupported AI provider.");
}
