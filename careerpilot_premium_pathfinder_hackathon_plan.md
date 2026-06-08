# CareerPilot Premium Pathfinder Redesign — Hackathon Scope

## 0. Purpose

This is the **revised hackathon-friendly frontend redesign plan** for CareerPilot.

The original full redesign roadmap was intentionally broad. This version is narrowed to what should realistically be implemented during a 17-day hackathon without stealing too much time from core product work, testing, deployment, README, and presentation.

The target implementation is:

> **V1 Foundation + V2 Lite key screens only**

No full V3 polish phase is included in this file.

---

## 1. Locked Design Direction

### Design name

**Premium Career Pathfinder**

### What the frontend should feel like

CareerPilot should feel like:

- a premium dark career cockpit
- a refined explorer/pathfinder interface
- an AI guide helping users discover career opportunities
- warm, cinematic, trustworthy, and memorable
- different from ordinary purple/blue AI dashboards

### What it should not become

Do **not** make it feel like:

- generic purple-blue AI SaaS
- pirate treasure game
- fantasy RPG
- overdecorated dashboard
- plain admin panel
- green/olive theme

### Core design rule

> **Minimal base, rich highlights.**

Most of the app should be clean and calm. Special moments like CareerPilot guide cards, fit scores, important CTAs, and the floating assistant can have warm copper/champagne glow.

---

## 2. Confirmed Tech Stack

The project uses:

- **Next.js App Router**
- **React**
- **Tailwind CSS**
- **shadcn-style components**
- `class-variance-authority`
- `tailwind-merge`
- `lucide-react`
- `@base-ui/react`

Project rules:

- Use Tailwind + shadcn/ui style components.
- Do **not** install MUI, Chakra, or Ant Design.
- Do **not** rewrite backend logic.
- Keep this redesign **desktop-first**.
- Mobile polish will be handled later in a separate plan.

---

## 3. Scope

## Must implement

### V1 Foundation

This is mandatory and should visually affect the whole app.

### V2 Lite

Only redesign the demo-critical screens:

1. My Journey — Today
2. My Journey — Applications Kanban
3. Jobs / Job Hunter
4. AI Assistant
5. Profile top section + CV upload state
6. Resume Preview surrounding UI only

## Do not implement now

Do not spend hackathon time on:

- full mobile responsiveness
- full custom date picker
- full custom select/dropdown rewrite everywhere
- deep chart redesign
- full accessibility overhaul
- full animation/motion system
- every single empty state
- full profile page restructure
- full calendar redesign
- full progress dashboard redesign
- perfect modal restructuring everywhere

These can be done after the hackathon.

---

## 4. Locked Color Palette

Use the following palette as the visual foundation.

```css
:root {
  /* Base */
  --cp-bg-main: #090909;
  --cp-bg-deep: #050505;
  --cp-bg-soft: #111111;
  --cp-surface: #181716;
  --cp-surface-elevated: #211F1D;
  --cp-surface-glass: rgba(24, 23, 22, 0.72);

  /* Text */
  --cp-text-main: #F6F0E8;
  --cp-text-soft: #D8CEC4;
  --cp-text-muted: #A7A09A;
  --cp-text-subtle: #716A63;

  /* Brand */
  --cp-copper: #C9824A;
  --cp-copper-strong: #E0A46A;
  --cp-copper-deep: #8F532B;
  --cp-champagne: #F2D6A2;
  --cp-gold-soft: #D8B878;

  /* Borders and glows */
  --cp-border-soft: rgba(242, 214, 162, 0.10);
  --cp-border-medium: rgba(224, 164, 106, 0.22);
  --cp-border-strong: rgba(224, 164, 106, 0.46);
  --cp-glow-copper: rgba(201, 130, 74, 0.28);
  --cp-glow-champagne: rgba(242, 214, 162, 0.18);

  /* Status */
  --cp-status-saved: #9CA3AF;
  --cp-status-applied: #E0A46A;
  --cp-status-interviewing: #F4C95D;
  --cp-status-offer: #3DDC97;
  --cp-status-rejected: #FF6B6B;

  /* Fit score */
  --cp-fit-high: #3DDC97;
  --cp-fit-good: #E0A46A;
  --cp-fit-mid: #F4C95D;
  --cp-fit-low: #FF6B6B;
}
```

### Usage ratio

Use the palette like this:

- **80%** deep black / graphite
- **15%** copper / champagne
- **5%** bright glow / magic highlight

Do not make every card glow. Glow should be reserved for active states, CTAs, AI guide moments, and fit scores.

---

## 5. Typography Direction

Use a two-font system.

### Display font

Used for:

- CareerPilot logo
- page titles
- hero card titles
- major section headings

Recommended:

- `Cormorant Garamond`
- `Playfair Display`
- `Libre Baskerville`

### UI/body font

Used for:

- body text
- forms
- buttons
- nav
- tabs
- card metadata
- chat text

Recommended:

- `Geist`
- `Inter`
- `Manrope`
- `Plus Jakarta Sans`

Example implementation:

```tsx
import { Cormorant_Garamond, Geist } from "next/font/google";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});
```

CSS:

```css
body {
  font-family: var(--font-sans), system-ui, sans-serif;
}

.font-display {
  font-family: var(--font-display), Georgia, serif;
}
```

If the repo already has a font setup, integrate into that instead of duplicating.

---

## 6. Subtle Product Language

Keep core nav labels unchanged:

- My Journey
- Jobs
- AI Assistant
- Profile

Use subtle pathfinder language only in key UI moments.

| Current | New frontend wording |
|---|---|
| CareerPilot nudge | CareerPilot guide |
| Next best action | Next discovery |
| Top ranked matches | Best matches |
| Scored and ranked | CV-ranked |
| Ready to hunt | Ready to discover |
| Activity history | Activity history or Journey log |

Do not overdo this. The app should still feel like a serious career product.

Backend values should stay unchanged.

---

# V1 — Foundation & Design System

## Goal

Make the entire app immediately feel like the new **Premium Career Pathfinder** design by updating the global visual system and shared UI.

Estimated implementation time with Codex:

> **4–8 hours**

---

## V1.1 Audit First

Before editing, Codex should inspect the project structure and identify:

- app routes
- shared layout/app shell
- sidebar
- floating CareerPilot assistant
- shared cards
- buttons
- tabs
- dialogs
- forms
- global CSS
- Tailwind config
- hardcoded purple/blue classes

Likely areas to inspect:

```txt
app/
src/app/
components/
src/components/
components/ui/
lib/
styles/
app/globals.css
tailwind.config.*
```

Search for visible text:

```txt
CareerPilot
My Journey
Job Hunter
AI Assistant
Profile
CareerPilot nudge
Next best action
Save to Tracker
Print / Download PDF
```

Search for old color classes:

```txt
purple
violet
blue
indigo
bg-purple
text-purple
border-purple
bg-blue
text-blue
border-blue
#8b5cf6
#6366f1
```

---

## V1.2 Add Theme Tokens

Add the locked color variables to the global CSS layer.

Possible files:

```txt
app/globals.css
src/app/globals.css
tailwind.config.ts
```

Also adapt existing shadcn variables if present.

Suggested shadcn-compatible values:

```css
.dark,
:root {
  --background: 24 10% 4%;
  --foreground: 35 45% 94%;

  --card: 24 8% 9%;
  --card-foreground: 35 45% 94%;

  --popover: 24 8% 9%;
  --popover-foreground: 35 45% 94%;

  --primary: 27 69% 58%;
  --primary-foreground: 24 18% 6%;

  --secondary: 24 8% 13%;
  --secondary-foreground: 35 34% 88%;

  --muted: 24 7% 15%;
  --muted-foreground: 26 9% 63%;

  --accent: 34 74% 79%;
  --accent-foreground: 24 18% 6%;

  --border: 34 74% 79% / 0.10;
  --input: 34 74% 79% / 0.12;
  --ring: 27 69% 58%;
}
```

---

## V1.3 Add Shared Utility Classes

Add reusable CSS utilities.

```css
.cp-app-bg {
  background:
    radial-gradient(circle at 80% 8%, rgba(201, 130, 74, 0.08), transparent 28%),
    radial-gradient(circle at 20% 80%, rgba(242, 214, 162, 0.04), transparent 32%),
    var(--cp-bg-main);
}

.cp-surface {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.015)),
    var(--cp-surface);
  border: 1px solid var(--cp-border-soft);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
}

.cp-surface-elevated {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.018)),
    var(--cp-surface-elevated);
  border: 1px solid var(--cp-border-medium);
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.44),
    0 0 40px rgba(201, 130, 74, 0.08);
}

.cp-active-glow {
  border-color: var(--cp-border-strong);
  box-shadow:
    inset 0 1px 0 rgba(242, 214, 162, 0.18),
    0 0 28px rgba(201, 130, 74, 0.18);
}

.cp-copper-text {
  color: var(--cp-copper-strong);
}

.cp-champagne-text {
  color: var(--cp-champagne);
}
```

---

## V1.4 Add Subtle Map Texture Utility

Use this only in special hero/AI/empty-state areas.

```css
.cp-map-lines {
  position: relative;
  overflow: hidden;
}

.cp-map-lines::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.08;
  background:
    radial-gradient(circle at 70% 45%, rgba(242, 214, 162, 0.18), transparent 18%),
    repeating-radial-gradient(
      circle at 65% 50%,
      rgba(242, 214, 162, 0.12) 0,
      rgba(242, 214, 162, 0.12) 1px,
      transparent 1px,
      transparent 18px
    );
  mask-image: linear-gradient(90deg, transparent, black 18%, black 82%, transparent);
}
```

Use it for:

- Next discovery card
- Job Hunter empty state
- CV upload empty state
- AI Assistant welcome area
- auth card background if tasteful

Do not use this on every small card.

---

## V1.5 Style Global Scrollbars

```css
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(224, 164, 106, 0.36) transparent;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(224, 164, 106, 0.28);
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(224, 164, 106, 0.46);
}
```

This is important because current native white scrollbars make dark modals feel unfinished.

---

## V1.6 Redesign App Shell

Apply the new theme to the global app shell.

### Sidebar

Update sidebar to:

- deep black/graphite background
- compass/pathfinder inspired logo area
- warm off-white CareerPilot wordmark
- copper/champagne active nav state
- muted inactive nav
- clean icons from `lucide-react`
- bottom user chip with initial/avatar
- keep existing nav items only

Keep:

- My Journey
- Jobs
- AI Assistant
- Profile
- Logout

Do not add new sidebar modules.

### Main background

Use `cp-app-bg` or equivalent.

Add very subtle background radial warmth, not bright glow.

---

## V1.7 Redesign Shared Buttons

### Primary buttons

Use for main actions like:

- Search
- Add task
- Save
- Apply Now
- Print / Download PDF
- Browse Files

Style:

- copper gradient
- champagne border
- dark text if contrast works, otherwise warm white
- subtle glow
- smooth hover

### Secondary buttons

Use for:

- Back
- Details
- Save to Tracker
- Edit
- Cancel

Style:

- graphite surface
- soft border
- warm off-white text
- subtle copper hover

### Destructive buttons

Use muted red. Avoid neon red.

---

## V1.8 Redesign Shared Cards

All existing cards should inherit a premium dark style.

Card principles:

- matte graphite background
- soft champagne/copper border
- restrained shadow
- more breathing room
- hover border glow only where interactive
- no heavy purple/blue glow

Create or refactor a reusable `PremiumCard` if useful.

---

## V1.9 Redesign Tabs

For My Journey sub-tabs:

- dark pill container
- active tab has copper/champagne glow
- active underline or filled capsule
- muted inactive text
- icons remain simple and thin

Tabs:

- Today
- Applications
- Goals & Tasks
- Calendar
- Progress

---

## V1.10 Redesign Floating CareerPilot Guide

The floating assistant should become one of the most iconic UI elements.

Collapsed state:

```txt
[ compass/star icon ] CareerPilot guide ✦
```

Style:

- pill/capsule shape
- copper/champagne border
- subtle glow
- dark graphite background
- warm text

Expanded chat:

- same theme
- assistant bubbles graphite/copper
- user bubbles copper-tinted, not purple
- send button copper/champagne

Preserve:

- expand/collapse behavior
- drag behavior if currently supported
- existing chat logic

---

## V1.11 Restyle Forms Quickly

For hackathon scope, do not rewrite every form component deeply.

But at minimum, restyle:

- input backgrounds
- borders
- text color
- placeholder color
- focus ring
- textarea
- select wrappers if easy
- date input wrappers if easy

Focus style:

```css
focus-visible:ring-2 focus-visible:ring-[var(--cp-copper-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cp-bg-main)]
```

---

## V1 Acceptance Criteria

V1 is complete when:

- The app no longer visually feels purple/blue.
- Global background, sidebar, buttons, cards, tabs, scrollbars, and floating assistant match the Premium Career Pathfinder style.
- Existing routes still work.
- Existing functionality is not broken.
- No backend files were changed unless necessary for imports/types.
- Validation commands pass if available.

Run one or more:

```bash
npm run lint
npm run typecheck
npm run build
```

Use whichever commands exist in the repo.

---

# V2 — Lite Screen Redesigns

## Goal

Apply the new design to the most important desktop demo screens only.

Estimated implementation time with Codex:

> **6–10 hours**

Do not redesign the entire product deeply. Focus on visual impact and demo stability.

---

## V2.1 My Journey — Today

### Target feeling

This should be the flagship screen. It should look very close to the locked Premium Career Pathfinder mockup.

### Implement

1. Top notice banner
   - compass/star icon
   - copper border
   - subtle glow
   - current interview-stage message
   - dismiss icon

2. Page header
   - eyebrow: `PRODUCTIVITY`
   - title: `My Journey`
   - subtitle unchanged or lightly refined

3. Next discovery hero card
   - label: `NEXT DISCOVERY`
   - title: `CareerPilot guide`
   - body uses existing nudge text
   - CTA: `View details`
   - subtle map-line texture
   - compass/pathfinder visual accent

4. Weekly progress
   - premium metric cards
   - warm icons
   - readable numbers

5. Due today and overdue
   - clean empty state
   - text: `All clear for today.`
   - subtext: `Nothing urgent due today.`

6. Active goals
   - clean progress rows
   - copper/champagne progress bars
   - keep existing goal logic

7. Upcoming deadlines and quick actions
   - restyle only
   - do not deeply restructure

### Acceptance

- Today screen has strong first-impression value.
- All existing data still renders.
- Links/buttons still work.

---

## V2.2 My Journey — Applications Kanban

### Target feeling

A polished opportunity-tracking board, not an admin panel.

### Implement

1. Keep current Kanban functionality.
2. Restyle columns:
   - matte graphite
   - soft champagne border
   - status icon
   - count badge
3. Restyle job/application cards:
   - elevated dark surface
   - warm title
   - muted company/location/date
   - fit score badge
   - subtle hover state
4. Restyle empty saved/drop column:
   - dashed copper border
   - small compass/bookmark icon
   - clear helper text
5. Restyle suggested task banner:
   - `CareerPilot guide — Follow up on strong matches this week.`
   - CTA: `Add task`
6. Keep drag/drop, details modal, notes, save-to-tracker, and status history working.

### Fit score colors

```txt
85–100: excellent / green
70–84: strong / champagne-green
55–69: good / copper
40–54: low / amber-red
0–39: weak / muted red
```

### Acceptance

- Drag/drop still works.
- Suggested task flow still works.
- Application detail opens.
- Status counts still work.

---

## V2.3 Jobs / Job Hunter

### Target feeling

This page should feel like CareerPilot is discovering opportunities from the market and ranking them for the user.

### Implement

1. Header
   - eyebrow: `AI-POWERED`
   - title: `Job Hunter`
   - subtitle can remain:
     `Search for jobs and get personalized fit scores based on your CV.`

2. Search area
   - premium search input
   - premium location input
   - copper Search button
   - loading state styled if already present

3. Empty state
   - text: `Ready to discover`
   - subtext:
     `Enter a job title and location to find roles and personalize fit scores.`
   - compass/briefcase icon
   - subtle map-line background

4. Results area
   - title: `Best matches`
   - small label: `CV-ranked`
   - job cards with new premium style

5. Job cards
   - title
   - company
   - location
   - salary/deadline
   - summary
   - fit score badge
   - source tag
   - actions:
     - Save to Tracker
     - Details
     - Apply

6. Job detail modal
   - restyle with new theme
   - keep current layout if time is tight
   - improve Fit Match card visually
   - keep save/apply behavior unchanged

### Acceptance

- Search works.
- Results render.
- Fit scores render.
- Save to Tracker works.
- Details modal works.
- Apply works.

---

## V2.4 AI Assistant

### Target feeling

This should feel like the full version of the `CareerPilot guide`.

### Implement

1. Chat sidebar
   - premium dark surface
   - selected chat copper active state
   - muted old chats

2. Main header
   - eyebrow: `CO-PILOT`
   - title: `AI Assistant`
   - subtitle: `CareerPilot guide`

3. Message area
   - assistant bubble: graphite with champagne/copper border
   - user bubble: copper-tinted, not purple
   - readable line-height

4. Input area
   - premium input
   - copper send button
   - keep Shift+Enter behavior if currently supported

5. Action chips/buttons
   - `Find jobs`
   - `Create prep tasks`
   - `Improve CV`
   - `What should I do today?`
   - Only add if simple and does not break logic.

6. Transparency rule
   - Keep explicit user-facing action buttons before AI creates goals/tasks/searches.
   - Do not make AI silently mutate data in the background.

### Acceptance

- Chat history renders.
- New chat works.
- Clear chat works.
- Message send works.
- Existing AI actions work.

---

## V2.5 Profile Top Section + CV Upload State

### Target feeling

Profile should feel like a polished career identity page, not just a form.

For hackathon scope, do not fully restructure the entire profile page. Focus on the top and upload states.

### Implement for existing profile view

1. Page header
   - eyebrow: `WORKSPACE`
   - title: `Profile`
   - subtitle can remain:
     `Your CV-powered career profile for matching, chat, and applications.`

2. Top overview card
   - premium surface
   - name/headline/location/email/phone
   - summary
   - action buttons:
     - Preview Resume
     - Edit
     - New CV

3. Links/skills/certifications
   - restyle enough to remove disabled-input feeling where easy
   - at minimum, style inputs/cards with new surface system

4. Edit mode
   - keep existing form logic
   - restyle inputs/buttons only
   - do not deeply rewrite

### Implement for empty/CV upload state

Copy:

```txt
Turn your CV into a career engine.
Upload your resume and CareerPilot will build your profile, match jobs, and personalize guidance.
Supports PDF and DOCX — max 5 MB.
```

Style:

- large upload card
- dotted copper/champagne border
- upload/compass icon
- subtle map-line texture
- copper Browse Files button

### Acceptance

- Profile data still renders.
- Edit/save still works.
- New CV upload still works.
- Drag/drop upload still works.
- Upload validation still works.

---

## V2.6 Resume Preview Surrounding UI

### Important

Do **not** redesign the resume document itself.

The resume should remain:

- white
- clean
- ATS-friendly
- printable
- professional

Only redesign the app UI around it.

### Implement

1. App shell/sidebar uses new theme.
2. Page header:
   - eyebrow: `PROFILE`
   - title: `Resume Preview`
   - subtitle:
     `A clean resume view generated from your latest saved profile.`
3. Buttons:
   - Back to Profile
   - Edit Profile
   - Print / Download PDF
   should use the new premium button styles.
4. Resume paper container:
   - centered
   - subtle shadow
   - neutral canvas around it

### Print dialog note

Native browser print dialogs cannot be styled. Do not attempt to customize them.

### Acceptance

- Resume preview renders.
- Print/download still works.
- `@media print` still outputs only the clean resume.
- Surrounding app matches the new theme.

---

## V2 Acceptance Criteria

V2 Lite is complete when:

- The demo-critical screens look cohesive and premium.
- The locked black/graphite/copper/champagne direction is visible.
- No old purple/blue dominant styling remains on these screens.
- My Journey Today looks close to the approved reference.
- Applications Kanban looks premium and remains draggable.
- Jobs page feels like CV-ranked opportunity discovery.
- AI Assistant feels like CareerPilot guide.
- Profile/CV upload has a strong first impression.
- Resume Preview shell matches theme but resume stays printable.
- Existing functionality still works.

Run validation:

```bash
npm run lint
npm run typecheck
npm run build
```

Use whichever commands exist.

---

# 7. What Not To Do

Codex must not:

- implement full V3
- spend time on mobile
- rewrite backend logic
- change database schemas
- change API contracts
- change CV parsing
- change job scoring logic
- change Supabase storage logic
- add new product modules
- add unrelated sidebar items
- install MUI/Chakra/Ant Design
- turn the app into a game/RPG/pirate theme
- overuse glow or map textures
- style the actual printable resume with dark theme

---

# 8. Recommended Codex Prompt

Use this prompt with Codex:

```txt
Read `careerpilot_premium_pathfinder_hackathon_plan.md` and implement only the hackathon-scoped redesign.

Do V1 Foundation first:
- theme tokens
- typography
- app shell/sidebar
- buttons/cards/tabs
- scrollbars
- floating CareerPilot guide
- remove purple/blue dominance

Then do V2 Lite only:
- My Journey Today
- My Journey Applications Kanban
- Jobs / Job Hunter
- AI Assistant
- Profile top section + CV upload state
- Resume Preview surrounding UI only

Do not implement any V3/full polish work.
Do not change backend logic, API routes, database schema, auth logic, CV parsing, job scoring, chat logic, or Supabase storage.
Do not add new product modules.
Keep the app desktop-first.
Prioritize visual impact, stability, and demo readiness over perfect redesign.

After implementation, summarize changed files, validation commands run, and any remaining TODOs.
```

---

# 9. Suggested Time Budget

For the hackathon, allocate:

## Maximum redesign time

> **1–2 days total**

### Suggested breakdown

| Work | Time |
|---|---:|
| V1 foundation | 4–8 hours |
| V2 Lite key screens | 6–10 hours |
| Bug fixing / visual cleanup | 2–4 hours |

If time runs out, stop after:

1. V1 foundation
2. My Journey Today
3. Jobs page
4. Applications Kanban

Those are the highest-impact screens.

---

# 10. Demo Flow To Optimize

Design should support this demo flow:

1. Login
2. Show Profile/CV intelligence
3. Go to Job Hunter
4. Search jobs
5. Show CV-ranked best matches
6. Open job detail and show fit reasoning
7. Save job to tracker
8. Go to Applications Kanban
9. Move card to Interviewing
10. CareerPilot guide suggests prep task
11. Add task
12. Show task in Goals/Tasks or Calendar
13. Open AI Assistant / floating guide
14. Ask what to do next

This tells the complete product story:

> CV becomes profile → profile powers matching → matching powers applications → applications create tasks → CareerPilot guide helps the user navigate the journey.

---

# 11. Final Acceptance Criteria

The hackathon redesign is successful when:

- The app no longer looks like a generic AI-generated purple dashboard.
- It has a memorable Premium Career Pathfinder identity.
- Key screens look polished enough for judging/demo.
- Existing functionality still works.
- No backend logic is broken.
- The redesign did not consume more than 1–2 days of work.
