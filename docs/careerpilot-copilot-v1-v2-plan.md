# CareerPilot Copilot V1 + V2 Implementation Plan

## Summary

CareerPilot Copilot should become the center of the product experience: an always-available guide that helps users move through CV upload, job discovery, fit scoring, applications, goals, tasks, and progress tracking without needing to understand the whole app first.

V1 should be a trustworthy guided copilot. It should welcome first-time users, learn lightweight preferences, detect whether they have uploaded a CV, route them to the correct page, prefill job searches, and propose tracker actions only after explicit confirmation.

V2 should build on that foundation with richer confirmed workflows, persistent preferences, backend action validation, and deeper app-state awareness.

The key design rule is simple: CareerPilot may guide, prepare, and propose. It must not silently mutate user data.

## Product Principles

- CareerPilot should feel like the product's main guide, not a separate chatbot hidden on one page.
- The user should think less. CareerPilot should ask small questions, suggest the next step, and offer one-click actions.
- Every important recommendation should be grounded in the user's CV/profile when available.
- The assistant should know where every major feature lives and provide direct links or native action buttons.
- The tone should be warm, concise, practical, and personal.
- V1 should optimize for demo reliability and user trust over full autonomy.
- Mutating actions should always require confirmation in V1 and V2 unless a later explicit "trusted automation" setting is designed.

## Current App Foundation

The current codebase already has most of the foundations needed for Copilot V1:

- Authenticated dashboard layout with canonical routes:
  - `/tracker` for My Journey
  - `/jobs` for Job Hunter
  - `/chat` for AI Assistant
  - `/cv` for Profile/CV intelligence
- Chat streaming through frontend `/api/chat` to FastAPI `/chat/`.
- Chat session persistence through `chat_sessions` and `chat_messages`.
- CV upload and profile generation through `/api/cv/upload` and `/api/cv/profile`.
- Job search and scoring through `/jobs/hunt` and `/jobs/score/{job_id}`.
- Save-to-tracker behavior through `/tracker/applications`.
- Goals and todos through `/tracker/goals` and `/tracker/todos`.
- My Journey internal views for Today, Applications, Goals & Tasks, Calendar, and Progress.

Because these exist, V1 does not need to build a new agent platform from scratch. It needs a strong copilot layer over the existing product.

## V1 Scope

### Core Experience

- Add a floating `CareerPilot` widget to the authenticated dashboard layout.
- Show it on `/tracker`, `/jobs`, `/chat`, and `/cv`.
- Auto-open it for first-time users as an expanded panel.
- Allow users to minimize or close it without losing progress.
- Keep `/chat` as the full AI Assistant page, but make the floating widget the main "copilot everywhere" experience.
- Store V1 onboarding preferences in local storage plus regular chat memory.
- Avoid a V1 database migration for preferences unless it becomes necessary later.

### First-Time Onboarding

On first authenticated visit, CareerPilot should open and say something like:

> Hi, I am CareerPilot. I will help you turn your CV into job matches, applications, goals, and next steps. What can I call you?

It should collect:

- Preferred name
- Target role or roles
- Preferred location
- Work mode preference, such as on-site, hybrid, remote, or any
- Career stage, such as student, fresh graduate, experienced, switching career, or urgent job search

The onboarding should feel conversational but lightweight. It should not become a long form.

### CV-Aware Guidance

CareerPilot should check whether the user has an active profile/CV.

If no profile exists:

- Tell the user the CV is the foundation of matching.
- Show a primary action card: `Upload your CV`.
- Route to `/cv?upload=1`.

If a profile exists:

- Address the user by name when known.
- Reference their target role/preferences.
- Suggest the next useful action, usually job search or goal setup.

After CV upload succeeds:

- Reuse the existing `careerpilot:cv-updated` browser event.
- Update local copilot state.
- Suggest a job search based on onboarding preferences and profile.
- Route to `/jobs?query={query}&location={location}&auto=1`.

### Job Search Guidance

On `/jobs`, CareerPilot should:

- Explain what kind of search is likely to work best.
- Prefill job search fields from route params.
- Optionally auto-run one search when `auto=1`.
- Suggest broader or narrower searches if results are weak.
- Explain that fit scores are based on the user's CV.
- Encourage saving promising roles to My Journey.

V1 should continue using existing job cards for save/apply actions. The copilot can guide the user to save a job, but job cards remain the primary reliable save surface.

### My Journey Guidance

On `/tracker`, CareerPilot should:

- Understand the five My Journey views:
  - Today
  - Applications
  - Goals & Tasks
  - Calendar
  - Progress
- Route users to internal views using query params.
- Suggest one next useful action based on available state.
- Propose goals and tasks after user intent is clear.

Example:

User: "I need a job this month. What should I do?"

CareerPilot:

- Suggests a weekly application goal.
- Suggests 3-5 tasks.
- Shows a confirmation card.
- Creates records only after the user confirms.

## V1 Route Map

CareerPilot should know and use these routes:

| Intent | Route |
| --- | --- |
| Main workspace | `/tracker` |
| Applications tracker | `/tracker?view=applications` |
| Goals and tasks | `/tracker?view=goals_tasks` |
| Calendar | `/tracker?view=calendar` |
| Progress dashboard | `/tracker?view=progress` |
| Job search | `/jobs` |
| Prefilled job search | `/jobs?query={query}&location={location}` |
| Auto-start job search | `/jobs?query={query}&location={location}&auto=1` |
| Profile/CV | `/cv` |
| Open CV uploader | `/cv?upload=1` |
| Full AI Assistant | `/chat` |

## V1 Implementation Plan

### 1. Product Rule Update

Update project docs so the previous rule "AI Assistant action automation is deferred" becomes more precise:

- Hidden autonomous state changes are deferred.
- Confirmed copilot proposals are allowed.
- The assistant may prepare goals, todos, searches, and navigation links.
- The user must explicitly confirm before records are created or changed.

This prevents future implementation conflict.

### 2. Shared Copilot App Map

Create a frontend app-map module that defines:

- Route labels
- Page purposes
- Internal tracker views
- Allowed action types
- Human-readable descriptions for the assistant context

This should be deterministic frontend data, not invented dynamically by the model.

Suggested module:

- `frontend/lib/copilot/app-map.ts`

It should export data like:

- `COPILOT_ROUTES`
- `TRACKER_VIEWS`
- `ALLOWED_COPILOT_ACTIONS`
- `buildCopilotContext(...)`

### 3. Floating Copilot Widget

Add a new client component:

- `frontend/components/copilot-widget.tsx`

Core states:

- `closed`
- `open`
- `minimized`
- `streaming`
- `action_pending`
- `action_success`
- `action_error`

It should:

- Render a floating button in the dashboard layout.
- Expand into a chat panel.
- Keep conversation state in memory during the session.
- Load/store onboarding state from local storage per user.
- Send messages to the existing `/api/chat` endpoint.
- Include `client_context` in the request payload.
- Parse hidden action directives from assistant output.
- Render native action cards.

Add the widget inside:

- `frontend/app/(dashboard)/layout.tsx`

The widget should be positioned:

- Desktop: bottom-right.
- Mobile: above the bottom nav.
- It must not cover primary navigation or create layout shifts.

### 4. Onboarding State

Use local storage key:

```text
careerpilot:onboarding:v1:{userId}
```

Store:

```json
{
  "completed": false,
  "name": "",
  "targetRoles": [],
  "location": "",
  "workMode": "",
  "careerStage": "",
  "lastStep": "name",
  "updatedAt": ""
}
```

V1 should not require perfect structured extraction. It can use simple step-by-step onboarding:

1. Ask name.
2. Ask target role.
3. Ask location/work mode.
4. Ask career stage or urgency.
5. Check CV status.
6. Route to CV upload or job search.

### 5. Client Context For Chat

Extend the frontend `/api/chat` request body to include optional `client_context`:

```json
{
  "user_id": "uuid",
  "session_id": "uuid",
  "message": "string",
  "client_context": {
    "current_path": "/jobs",
    "current_page_label": "Jobs",
    "profile_status": "has_profile",
    "onboarding": {
      "name": "Araf",
      "targetRoles": ["ML Engineer"],
      "location": "Dhaka",
      "workMode": "Hybrid"
    },
    "app_map": "compact route/action description"
  }
}
```

Backend changes:

- Update `backend/routers/chat.py` request model with optional `client_context`.
- Pass it into `stream_chat`.
- Update `backend/services/chat.py` system prompt.

The prompt should explain:

- CareerPilot is the product guide.
- It knows the current page.
- It can recommend routes.
- It can propose action cards.
- It must not claim an action has been completed unless the UI confirms it.
- It must only reference the user's background from CV context.

### 6. Hidden Action Directives

The assistant can include a hidden action directive at the end of a response.

Recommended marker:

```text
<careerpilot_action>
{
  "type": "open_route",
  "label": "Upload your CV",
  "href": "/cv?upload=1"
}
</careerpilot_action>
```

The frontend should:

- Remove this block from visible assistant text.
- Parse JSON safely.
- Validate the action type and route against the app map.
- Render a native action card.
- Ignore invalid or unsafe directives.

### 7. V1 Action Types

#### `open_route`

Use for safe navigation.

```json
{
  "type": "open_route",
  "label": "Open My Journey",
  "href": "/tracker"
}
```

Validation:

- `href` must be one of the whitelisted app routes or allowed query-param variants.
- No external URLs.

#### `prefill_job_search`

Use to route users to job search with fields prefilled.

```json
{
  "type": "prefill_job_search",
  "label": "Search ML roles in Dhaka",
  "query": "ML engineer",
  "location": "Dhaka",
  "auto": true
}
```

Frontend turns this into:

```text
/jobs?query=ML%20engineer&location=Dhaka&auto=1
```

#### `create_goal_with_todos`

Use for confirmed My Journey setup.

```json
{
  "type": "create_goal_with_todos",
  "label": "Create this job search plan",
  "goal": {
    "title": "Apply to 5 ML engineering jobs this week",
    "target_date": "2026-06-14"
  },
  "todos": [
    {
      "title": "Upload or review my CV",
      "due_date": "2026-06-08"
    },
    {
      "title": "Search ML engineer jobs in Dhaka",
      "due_date": "2026-06-09"
    }
  ]
}
```

Execution:

- Show preview card first.
- User clicks confirm.
- POST `/tracker/goals`.
- POST `/tracker/todos` for each linked todo using created `goal_id`.
- Show success state.
- Link to `/tracker?view=goals_tasks`.

Limits:

- Maximum 1 goal per action.
- Maximum 5 todos per action.
- Empty titles are invalid.

#### `create_todo`

Use for one confirmed task.

```json
{
  "type": "create_todo",
  "label": "Add this task",
  "todo": {
    "title": "Update my CV summary",
    "due_date": "2026-06-08"
  }
}
```

Execution:

- Show preview card.
- User confirms.
- POST `/tracker/todos`.

### 8. Query Param Support

Update Profile page:

- Use `useSearchParams`.
- If `upload=1`, open uploader automatically.

Update Jobs page:

- Use `useSearchParams`.
- If `query` exists, prefill query.
- If `location` exists, prefill location.
- If `auto=1`, run search once after user and CV metadata are loaded.
- Prevent repeated auto-search loops with a ref.

Update Tracker page:

- Use `useSearchParams`.
- If `view=applications`, open Applications.
- If `view=goals_tasks`, open Goals & Tasks.
- If `view=calendar`, open Calendar.
- If `view=progress`, open Progress.
- Default remains Today.

### 9. Persona And Copy

Rename visible assistant references where appropriate:

- Floating widget: `CareerPilot`
- Full chat page can keep `AI Assistant`, but the assistant identity should say `CareerPilot`.
- Empty-state copy should say:
  - "I know your CV once you upload it."
  - "I can guide you to jobs, applications, goals, and prep."

Avoid:

- Long feature explanations.
- Dev/demo wording.
- "AI Nudge:" visible text.
- Claims that actions were done before confirmation.

### 10. Error Handling

Action errors should preserve the proposed plan/action so the user can retry.

Examples:

- "I could not create those tasks. Your plan is still here."
- "I could not open that page. Try the navigation link instead."
- "I need your CV first before I can make this search personal."

For chat backend failures, reuse current fallback:

- "Sorry, something went wrong connecting to the server."

But for the widget, make it more product-specific:

- "I lost connection for a moment. Send that again and I will pick it back up."

## V1 Test Plan

### Onboarding

- First authenticated visit to `/tracker` opens widget automatically.
- Widget asks for the user's name.
- User completes onboarding steps.
- Refresh keeps preferences.
- Closing widget does not erase onboarding state.

### CV Flow

- User without a profile gets an Upload CV action.
- Clicking action opens `/cv?upload=1`.
- Profile page opens uploader.
- Uploading a CV updates profile state.
- Existing `careerpilot:cv-updated` event still clears stale job search storage.

### Job Flow

- CareerPilot suggests a search after CV upload.
- Clicking action opens `/jobs?query=...&location=...&auto=1`.
- Jobs page pre-fills fields.
- Auto-search runs once.
- Refresh does not repeatedly auto-run the same search.
- Existing manual search still works.

### Tracker Flow

- `/tracker?view=applications` opens Applications.
- `/tracker?view=goals_tasks` opens Goals & Tasks.
- `/tracker?view=calendar` opens Calendar.
- `/tracker?view=progress` opens Progress.
- CareerPilot proposal card creates no records before confirmation.
- Confirming a goal/todo plan creates one goal and linked todos.
- Success card links to Goals & Tasks.

### Chat

- Full `/chat` page still streams.
- Chat sessions still persist.
- Widget chat streams without breaking full chat.
- Backend handles missing `client_context`.
- Assistant does not display raw hidden action JSON.

### UI

- Desktop widget does not cover sidebar or key buttons.
- Mobile widget does not cover bottom navigation.
- Text fits inside widget controls.
- Streaming state is visible.
- Action cards have loading, success, and error states.

## V1 Acceptance Criteria

- CareerPilot is visible across the authenticated app.
- First-run onboarding feels conversational and short.
- Users can reach CV upload, job search, My Journey views, and full chat from CareerPilot.
- CareerPilot knows the current page and app route map.
- CareerPilot can propose job searches and tracker plans.
- No tracker records are created before explicit user confirmation.
- Existing CV, Jobs, Chat, and Tracker flows continue to work.

## V2 Scope

V2 should deepen the same confirmed-action model rather than jumping straight to hidden autonomy.

### Persistent Preferences

Add durable career preference storage.

Possible table:

```sql
career_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferred_name text,
  target_roles jsonb not null default '[]',
  preferred_locations jsonb not null default '[]',
  work_modes jsonb not null default '[]',
  seniority text,
  weekly_capacity_hours int,
  target_start_date date,
  industries jsonb not null default '[]',
  updated_at timestamptz default now()
)
```

V2 should load these preferences into copilot context.

### Backend Copilot Service

Add a dedicated backend service for structured planning and action validation.

Suggested files:

- `backend/routers/copilot.py`
- `backend/services/copilot.py`

Responsibilities:

- Classify user intent.
- Generate structured action proposals.
- Validate proposed actions.
- Keep action schemas separate from normal chat text.
- Optionally log proposals and outcomes.

The normal chat endpoint can remain for streaming conversation.

### Action Registry

Create a server-side action registry.

Action families:

- Navigation actions
- Job search actions
- Tracker goal/todo actions
- Application tracker actions
- Roadmap actions
- Cover letter/application note actions

Validation rules:

- Only known action types.
- Only whitelisted routes.
- Only allowed database fields.
- User ID always comes from authenticated/session context, not model output.
- Maximum record counts per action.

### Rich Confirmed Workflows

V2 should support:

- "Build my 3-month roadmap"
  - Preview weekly plan.
  - Confirm.
  - Create goals and todos.
- "I like this job"
  - Save application.
  - Create apply checklist.
  - Link to Applications.
- "I applied to this job"
  - Move application to `applied`.
  - Set `applied_at`.
  - Suggest follow-up task.
- "I got an interview"
  - Move application to `interviewing`.
  - Create interview prep tasks.
  - Link to Calendar.
- "Draft a cover letter for this job"
  - Use CV context plus job description.
  - Produce letter.
  - Optionally save note to application after confirmation.

### Proactive Contextual Suggestions

V2 should show suggestions based on app state:

- No CV uploaded -> upload CV.
- CV exists but no recent job search -> search suggested roles.
- High-fit saved job exists -> apply or draft cover letter.
- No applications this week -> find/apply to roles.
- Interviewing application exists -> create prep tasks.
- Overdue tasks exist -> focus Today view.

These should be deterministic or lightly AI-assisted, not random generated nudges.

### Audit Trail

Add audit records for copilot-created actions.

Examples:

- Goal created by Copilot
- Todo created by Copilot
- Application status changed by Copilot
- Cover letter note saved by Copilot

This improves trust, debugging, and demo credibility.

### V2 Evaluation

Add tests or evaluation cases for:

- Intent routing
- Action validation
- User confirmation safety
- Roadmap-to-task conversion
- Job-to-application flow
- Interview-prep flow
- Refusal/fallback when action is unsafe or ambiguous

## V2 Acceptance Criteria

- Preferences persist across devices/sessions.
- CareerPilot can prepare multi-step plans from natural language.
- Every mutation is validated server-side.
- Every mutation requires explicit confirmation.
- CareerPilot can transform advice into goals, tasks, and application updates.
- The user always sees what will happen before it happens.
- The app can explain what Copilot changed after confirmation.

## Implementation Order

1. Update product docs to allow confirmed copilot proposals.
2. Add query param support for `/cv`, `/jobs`, and `/tracker`.
3. Add shared copilot app map.
4. Add floating widget shell.
5. Add onboarding local state.
6. Add client context to chat request.
7. Update backend chat prompt with app map/current page/action rules.
8. Add hidden action directive parsing.
9. Add navigation and job-search action cards.
10. Add confirmed goal/todo action cards.
11. Polish persona, copy, and responsive UI.
12. Run lint and manually test V1 flows.
13. After V1 is stable, start V2 with persistent preferences and backend action registry.

## Key Risks

### Risk: The assistant suggests broken routes

Mitigation:

- Use a deterministic route map.
- Validate all route actions before rendering.

### Risk: The assistant creates bad records

Mitigation:

- Preview before confirmation.
- Limit goal/todo count.
- Validate required fields.

### Risk: The widget feels like duplicate chat

Mitigation:

- Make widget action-oriented.
- Keep full `/chat` for longer conversations.
- Use page-aware guidance and native action cards.

### Risk: V1 gets too large

Mitigation:

- Build navigation and prefill first.
- Add confirmed goal/todo creation only after the widget and route flow work.
- Defer persistent preferences and backend action registry to V2.

## Final Recommendation

Implement V1 now because the core product is already mostly complete.

The best hackathon path is:

```text
Stable core app -> CareerPilot V1 shell and guidance -> confirmed actions -> polish -> V2 agent workflows
```

This gives users the feeling that CareerPilot is truly guiding the whole app while keeping the system safe, understandable, and demo-ready.
