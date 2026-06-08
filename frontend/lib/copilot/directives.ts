import type { CopilotAction } from "@/types";
import { validateCopilotAction } from "@/lib/copilot/app-map";

const ACTION_PATTERN = /<careerpilot_action>\s*([\s\S]*?)\s*<\/careerpilot_action>/g;
const ONBOARDING_PATTERN = /<careerpilot_onboarding>\s*([\s\S]*?)\s*<\/careerpilot_onboarding>/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stripCopilotDirectives(content: string): string {
  return content.replace(ACTION_PATTERN, "").replace(ONBOARDING_PATTERN, "").trim();
}

export function extractCopilotActions(content: string): CopilotAction[] {
  const actions: CopilotAction[] = [];
  const matches = content.matchAll(ACTION_PATTERN);

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      const action = validateCopilotAction(parsed);
      if (action) actions.push(action);
    } catch {
      continue;
    }
  }

  return actions;
}

export function extractOnboardingPatch(content: string): Record<string, unknown> | null {
  let patch: Record<string, unknown> | null = null;
  const matches = content.matchAll(ONBOARDING_PATTERN);

  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]) as unknown;
      if (isPlainObject(parsed)) {
        patch = { ...(patch ?? {}), ...parsed };
      }
    } catch {
      continue;
    }
  }

  return patch;
}
