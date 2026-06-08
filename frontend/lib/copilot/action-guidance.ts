import type { CopilotAction } from "@/types";

function routeHint(href?: string): string {
  if (!href) return "";

  let parsed: URL;
  try {
    parsed = new URL(href, "https://careerpilot.local");
  } catch {
    return "";
  }

  if (parsed.pathname === "/cv" && parsed.searchParams.get("upload") === "1") {
    return "Now click Upload CV and choose your file.";
  }

  if (parsed.pathname === "/cv" && parsed.searchParams.get("build") === "1") {
    return "Now fill in your details and click Save.";
  }

  if (parsed.pathname === "/cv/preview") {
    return "Now review it and use print or download if you want a copy.";
  }

  if (parsed.pathname === "/jobs") {
    return "Now click Search.";
  }

  if (parsed.pathname === "/tracker") {
    const view = parsed.searchParams.get("view");
    if (view === "applications") return "Now check Applications.";
    if (view === "goals_tasks" && parsed.searchParams.get("draft") === "1") {
      return "Now review the draft and click Create.";
    }
    if (view === "goals_tasks") return "Now check Goals & Tasks.";
    if (view === "calendar") return "Now check Calendar.";
    if (view === "progress") return "Now check Progress.";
    return "Now review My Journey.";
  }

  return "";
}

export function getCopilotActionSuccessMessage(action: CopilotAction, href?: string): string {
  if (action.type === "open_route") {
    const hint = routeHint(href ?? action.href);
    return hint ? `Opened. ${hint}` : "Opened.";
  }

  if (action.type === "prefill_job_search") {
    return "Search prepared. Now click Search.";
  }

  if (action.type === "prefill_goal_with_todos") {
    return "Goal draft prepared. Now review it and click Create.";
  }

  if (action.type === "prefill_todo") {
    return "Task draft prepared. Now review it and click Add.";
  }

  if (action.type === "prefill_application_note") {
    return "Note draft prepared. Now review it in Applications and click Save.";
  }

  if (action.type === "show_feature_explainer") {
    return action.href ? `Opened. ${routeHint(action.href)}` : "Shown.";
  }

  if (
    action.type === "save_application" ||
    action.type === "update_application_status" ||
    action.type === "save_application_note"
  ) {
    return "Saved. Now open Applications.";
  }

  return "Confirmed. Now open Goals & Tasks.";
}
