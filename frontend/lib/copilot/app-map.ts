import type {
  CopilotAction,
  CopilotClientContext,
  CopilotOnboardingState,
  CopilotProfileStatus,
} from "@/types";

export const TRACKER_VIEWS = {
  today: {
    label: "Today",
    description: "Daily action queue, urgent tasks, nudges, weekly progress, and next best action.",
  },
  applications: {
    label: "Applications",
    description: "Saved, applied, interviewing, offer, and rejected application tracking.",
  },
  goals_tasks: {
    label: "Goals & Tasks",
    description: "Career goals, linked todos, deadlines, and task progress.",
  },
  calendar: {
    label: "Calendar",
    description: "Todo due dates, goal target dates, and job deadlines.",
  },
  progress: {
    label: "Progress",
    description: "Real metrics, pipeline counts, attention items, and charts.",
  },
} as const;

export type TrackerViewKey = keyof typeof TRACKER_VIEWS;

export const COPILOT_ROUTES = {
  "/tracker": {
    label: "My Journey",
    purpose: "Main authenticated workspace and Today view.",
  },
  "/jobs": {
    label: "Jobs",
    purpose: "Job Hunter Agent with CV-based fit scores.",
  },
  "/chat": {
    label: "AI Assistant",
    purpose: "Full streaming RAG chat for longer career conversations.",
  },
  "/cv": {
    label: "Profile",
    purpose: "CV upload, manual profile building, and editable profile intelligence.",
  },
  "/cv/preview": {
    label: "Resume Preview",
    purpose: "Dedicated resume preview and print/export page generated from the saved profile.",
  },
} as const;

export const ALLOWED_COPILOT_ACTIONS = [
  "open_route",
  "prefill_job_search",
  "create_goal_with_todos",
  "create_roadmap_with_tasks",
  "create_todo",
  "save_application",
  "update_application_status",
  "save_application_note",
] as const;

const ALLOWED_ROUTE_PATHS = Object.keys(COPILOT_ROUTES);
const TRACKER_VIEW_KEYS = Object.keys(TRACKER_VIEWS);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateOnly(value: unknown): value is string {
  if (value === null || value === undefined || value === "") return true;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isApplicationStatus(value: unknown): value is "saved" | "applied" | "interviewing" | "offer" | "rejected" {
  return (
    value === "saved" ||
    value === "applied" ||
    value === "interviewing" ||
    value === "offer" ||
    value === "rejected"
  );
}

export function pageLabelForPath(pathname: string): string {
  const route = [...ALLOWED_ROUTE_PATHS]
    .sort((a, b) => b.length - a.length)
    .find((allowedPath) =>
      pathname === allowedPath || pathname.startsWith(`${allowedPath}/`),
    );
  return route ? COPILOT_ROUTES[route as keyof typeof COPILOT_ROUTES].label : "CareerPilot";
}

export function isAllowedCopilotHref(href: string): boolean {
  if (!href.startsWith("/") || href.startsWith("//")) return false;

  let parsed: URL;
  try {
    parsed = new URL(href, "https://careerpilot.local");
  } catch {
    return false;
  }

  const path = parsed.pathname;
  if (!ALLOWED_ROUTE_PATHS.includes(path)) return false;

  const params = parsed.searchParams;
  const paramKeys = Array.from(params.keys());

  if (path === "/tracker") {
    if (paramKeys.length === 0) return true;
    if (paramKeys.some((key) => key !== "view")) return false;
    const view = params.get("view");
    return Boolean(view && TRACKER_VIEW_KEYS.includes(view));
  }

  if (path === "/cv") {
    if (paramKeys.length === 0) return true;
    const allowedCvParams = ["upload", "build"];
    return paramKeys.every((key) => allowedCvParams.includes(key) && params.get(key) === "1");
  }

  if (path === "/cv/preview") {
    return paramKeys.length === 0;
  }

  if (path === "/jobs") {
    return paramKeys.every((key) => ["query", "location", "auto"].includes(key));
  }

  return paramKeys.length === 0;
}

export function buildJobSearchHref(query: string, location?: string, auto?: boolean): string {
  const params = new URLSearchParams();
  params.set("query", query.trim());
  if (location?.trim()) {
    params.set("location", location.trim());
  }
  if (auto) {
    params.set("auto", "1");
  }
  return `/jobs?${params.toString()}`;
}

export function validateCopilotAction(value: unknown): CopilotAction | null {
  if (!isPlainObject(value) || !isNonEmptyString(value.type)) return null;

  if (value.type === "open_route") {
    if (!isNonEmptyString(value.label) || !isNonEmptyString(value.href)) return null;
    if (!isAllowedCopilotHref(value.href)) return null;
    return {
      type: "open_route",
      label: value.label.trim(),
      href: value.href,
    };
  }

  if (value.type === "prefill_job_search") {
    if (!isNonEmptyString(value.label) || !isNonEmptyString(value.query)) return null;
    const location = typeof value.location === "string" ? value.location.trim() : "";
    return {
      type: "prefill_job_search",
      label: value.label.trim(),
      query: value.query.trim(),
      location,
      auto: value.auto === true,
    };
  }

  if (value.type === "create_goal_with_todos") {
    if (!isNonEmptyString(value.label) || !isPlainObject(value.goal)) return null;
    if (!isNonEmptyString(value.goal.title)) return null;
    if (!isValidDateOnly(value.goal.target_date)) return null;
    if (!Array.isArray(value.todos) || value.todos.length > 5) return null;

    const todos = value.todos
      .filter(isPlainObject)
      .map((todo) => ({
        title: typeof todo.title === "string" ? todo.title.trim() : "",
        due_date: isValidDateOnly(todo.due_date) && todo.due_date ? todo.due_date : null,
      }))
      .filter((todo) => todo.title.length > 0);

    if (todos.length !== value.todos.length) return null;

    return {
      type: "create_goal_with_todos",
      label: value.label.trim(),
      goal: {
        title: value.goal.title.trim(),
        target_date:
          isValidDateOnly(value.goal.target_date) && value.goal.target_date
            ? value.goal.target_date
            : null,
      },
      todos,
    };
  }

  if (value.type === "create_roadmap_with_tasks") {
    if (!isNonEmptyString(value.label) || !Array.isArray(value.goals)) return null;
    if (value.goals.length === 0 || value.goals.length > 4) return null;

    let totalTodos = 0;
    const goals = value.goals
      .filter(isPlainObject)
      .map((goal) => {
        const todosInput = Array.isArray(goal.todos) ? goal.todos : [];
        if (!isNonEmptyString(goal.title)) return null;
        if (!isValidDateOnly(goal.target_date)) return null;
        if (todosInput.length > 5) return null;

        const todos = todosInput
          .filter(isPlainObject)
          .map((todo) => ({
            title: typeof todo.title === "string" ? todo.title.trim() : "",
            due_date: isValidDateOnly(todo.due_date) && todo.due_date ? todo.due_date : null,
          }))
          .filter((todo) => todo.title.length > 0);

        if (todos.length !== todosInput.length) return null;
        totalTodos += todos.length;

        return {
          title: goal.title.trim(),
          target_date:
            isValidDateOnly(goal.target_date) && goal.target_date
              ? goal.target_date
              : null,
          todos,
        };
      });

    if (goals.some((goal) => goal === null) || goals.length !== value.goals.length) return null;
    if (totalTodos > 12) return null;

    return {
      type: "create_roadmap_with_tasks",
      label: value.label.trim(),
      goals: goals as NonNullable<(typeof goals)[number]>[],
    };
  }

  if (value.type === "create_todo") {
    if (!isNonEmptyString(value.label) || !isPlainObject(value.todo)) return null;
    if (!isNonEmptyString(value.todo.title)) return null;
    if (!isValidDateOnly(value.todo.due_date)) return null;
    return {
      type: "create_todo",
      label: value.label.trim(),
      todo: {
        title: value.todo.title.trim(),
        due_date:
          isValidDateOnly(value.todo.due_date) && value.todo.due_date
            ? value.todo.due_date
            : null,
      },
    };
  }

  if (value.type === "save_application") {
    if (!isNonEmptyString(value.label) || !isNonEmptyString(value.job_id)) return null;
    if (value.status !== undefined && !isApplicationStatus(value.status)) return null;
    return {
      type: "save_application",
      label: value.label.trim(),
      job_id: value.job_id.trim(),
      status: value.status,
    };
  }

  if (value.type === "update_application_status") {
    if (!isNonEmptyString(value.label) || !isNonEmptyString(value.application_id)) return null;
    if (!isApplicationStatus(value.status)) return null;
    return {
      type: "update_application_status",
      label: value.label.trim(),
      application_id: value.application_id.trim(),
      status: value.status,
    };
  }

  if (value.type === "save_application_note") {
    if (!isNonEmptyString(value.label) || !isNonEmptyString(value.application_id)) return null;
    if (!isNonEmptyString(value.note)) return null;
    return {
      type: "save_application_note",
      label: value.label.trim(),
      application_id: value.application_id.trim(),
      note: value.note.trim(),
    };
  }

  return null;
}

export function buildCopilotContext({
  currentPath,
  profileStatus,
  onboarding,
  preferences,
  appState,
}: {
  currentPath: string;
  profileStatus: CopilotProfileStatus;
  onboarding: CopilotOnboardingState;
  preferences?: CopilotClientContext["preferences"];
  appState?: CopilotClientContext["app_state"];
}): CopilotClientContext {
  const routeDescriptions = Object.entries(COPILOT_ROUTES)
    .map(([href, route]) => `${route.label}: ${href} (${route.purpose})`)
    .join(" | ");
  const viewDescriptions = Object.entries(TRACKER_VIEWS)
    .map(([key, view]) => `${view.label}: /tracker?view=${key}`)
    .join(" | ");
  const actionDescriptions = ALLOWED_COPILOT_ACTIONS.join(", ");

  return {
    current_path: currentPath,
    current_page_label: pageLabelForPath(currentPath),
    profile_status: profileStatus,
    onboarding: {
      completed: onboarding.completed,
      name: onboarding.name || undefined,
      targetRoles: onboarding.targetRoles,
      location: onboarding.location || undefined,
      workMode: onboarding.workMode || undefined,
      careerStage: onboarding.careerStage || undefined,
    },
    preferences,
    app_state: appState,
    app_map: [
      `Routes: ${routeDescriptions}`,
      "Profile route helpers: /cv?upload=1 opens CV upload, /cv?build=1 opens manual profile building, /cv/preview opens resume preview/export when a profile exists.",
      "If profile_status is no_profile, offer Upload CV or Build profile manually. Do not generate, create, or overwrite profile data automatically.",
      "After a profile is saved, suggest Preview Resume or Search Jobs when helpful.",
      `My Journey views: ${viewDescriptions}`,
      `Allowed actions: ${actionDescriptions}`,
      "Application and tracker mutations require backend validation and explicit user confirmation.",
      "Action directives must be hidden in <careerpilot_action>{json}</careerpilot_action>.",
    ].join("\n"),
  };
}
