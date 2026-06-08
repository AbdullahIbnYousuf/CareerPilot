# CareerPilot CV Builder + Resume Export Implementation Plan

## Summary

CareerPilot already understands an uploaded CV and turns it into an editable `profiles` row plus embedded `cv_chunks`. The missing product capability is the reverse path:

- A user may not have a CV yet.
- A user may edit their CareerPilot profile after uploading a CV.
- A user needs a clean, updated resume they can preview and download/print.

The best implementation is **not** a separate random JSON file workflow. The best implementation is to treat the existing `profiles` table as the canonical resume JSON, add a manual profile builder for users without a CV, regenerate `cv_chunks` whenever the profile changes, and render a polished resume preview from the saved profile.

V1 should use browser print-to-PDF from a clean resume preview. This avoids adding heavyweight PDF tooling while still giving users a real downloadable PDF through the browser's native print/save flow.

## Product Goal

Give users two complete paths into CareerPilot's CV intelligence:

1. **Upload an existing CV**: current PDF/DOCX upload flow parses, profiles, chunks, embeds, and stores.
2. **Build a CV from scratch**: user fills the existing Profile form, CareerPilot saves it as the active profile, creates CV chunks, and allows resume preview/export.

Both paths should produce the same downstream behavior:

- AI Assistant can answer with CV context.
- Job Hunter can compute fit scores.
- Profile page can be edited.
- Resume preview/export can render from the latest saved profile.

## Current Architecture Observations

The current codebase already has the right foundation:

- `frontend/app/(dashboard)/cv/page.tsx` displays and edits `UserProfile`.
- `frontend/components/cv-upload.tsx` uploads PDF/DOCX files.
- `backend/routers/cv.py` has upload, list, get, search, get profile, and patch profile endpoints.
- `backend/services/profile.py` normalizes and stores profile-shaped data.
- `backend/services/chunker.py` stores one chunk per section: `skills`, `experience`, `education`, `projects`.
- `backend/services/embedder.py` embeds chunks using Gemini `models/gemini-embedding-001`.
- `profiles.active_cv_id` identifies the active CV used by fit scoring.
- `cv_chunks` powers RAG and fit scoring.
- The latest branch already includes a partial CareerPilot Copilot implementation:
  - `frontend/components/copilot-widget.tsx`
  - `frontend/lib/copilot/app-map.ts`
  - Copilot action types and context types in `frontend/types/index.ts`
  - `upload=1` query-param support in the Profile page
- This feature should extend the existing Copilot implementation carefully instead of rebuilding it, replacing it, or creating a second assistant flow.

Important technical invariant:

> Whenever profile content changes, the active `cv_chunks` must be regenerated. Otherwise chat, search, and fit scoring may use stale CV content.

## V1 Scope

### Included

- Manual profile creation for users without an uploaded CV.
- Reuse of the existing editable Profile form.
- A "Preview Resume" view/panel rendered from `UserProfile`.
- Browser print/save-to-PDF export.
- Backend profile-save flow that creates or refreshes active CV metadata and regenerated chunks.
- Job score invalidation after profile/chunk changes.
- Copilot route/action support for starting manual CV building and opening resume preview.

### Excluded From V1

- Multiple resume templates.
- Backend-generated PDF files.
- DOCX export.
- Drag-and-drop resume section ordering.
- AI rewriting of every resume bullet.
- Persistent generated PDF storage.
- A separate `resume_json` table or external JSON file.

## UX Design

### Profile Empty State

When a signed-in user has no profile, the Profile page should show two primary choices:

- `Upload CV`
- `Build profile manually`

The current empty state only shows upload. V1 should add the manual builder option without weakening the upload path.

Recommended copy:

- Heading: `Start your career profile`
- Body: `Upload an existing CV or build one here. CareerPilot uses this profile for job matching, chat, and your resume export.`
- Primary actions:
  - `Upload CV`
  - `Build manually`

### Manual Builder Flow

When the user clicks `Build manually`:

- Create an empty `UserProfile`-shaped draft in the existing form.
- Set the page into edit mode.
- Show all existing editable sections:
  - Overview
  - Links
  - Skills
  - Certifications
  - Experience
  - Education
  - Projects
- Save button creates the first profile through a new backend endpoint.

The builder should feel like the current Profile editor, not a totally new UI.

### Existing Profile Flow

When a profile already exists:

- Keep existing `Edit`, `New CV`, and `Save` behavior.
- Add `Preview Resume`.
- Add `Print / Download PDF` from the preview.
- When profile edits are saved, regenerate chunks from the edited profile.

### Resume Preview

Add a preview experience that renders a polished, ATS-friendly resume from `UserProfile`.

Recommended UI:

- Button in Profile page header: `Preview Resume`
- Opens either:
  - a full-width preview section below the editor, or
  - a modal/side panel

For V1, a full-width preview section is simpler and safer than a modal because printing a contained resume section is easier.

Preview should include:

- Full name
- Headline
- Location, email, phone
- Links
- Summary
- Skills
- Experience
- Projects
- Education
- Certifications

The preview should be clean, dense, and resume-like. It should not look like the dark app UI when printed.

### Print / PDF Export

Use browser print for V1:

- Add `Print / Download PDF` button.
- Call `window.print()`.
- Add print CSS in `frontend/app/globals.css` only.
- Print CSS should hide app chrome and print only the resume preview.

The browser's print dialog lets the user choose "Save as PDF", which satisfies V1 PDF export without backend PDF tooling.

## Backend Plan

### Profile-To-Sections Helper

Add helper logic in `backend/services/profile.py` to convert normalized profile data into the existing four-section RAG structure:

```python
{
    "skills": "...",
    "experience": "...",
    "education": "...",
    "projects": "..."
}
```

Mapping:

- `skills`: skills plus certifications.
- `experience`: each experience entry with title, company, location, dates, description.
- `education`: each education entry with institution, degree, field, years, details.
- `projects`: each project entry with title, technologies, URL, description.

Use readable plain text, because this content is embedded and retrieved.

### Generated CV Save Service

Add a service function that saves profile data as the active CV intelligence source.

Suggested responsibility:

1. Normalize profile payload.
2. Convert profile to `parsed_data` sections.
3. Resolve active CV:
   - If `profiles.active_cv_id` exists, reuse that CV row.
   - If no active CV exists, create a synthetic `cvs` row with:
     - `file_name`: `CareerPilot Generated CV`
     - `file_url`: `null`
     - `parsed_at`: current timestamp
4. Delete old `cv_chunks` for the user before inserting regenerated chunks.
5. Chunk sections with `chunk_cv_sections`.
6. Embed chunk contents with `embed_documents`.
7. Insert fresh `cv_chunks`.
8. Upsert/update `profiles` with:
   - normalized profile data
   - `active_cv_id`
   - regenerated `raw_sections`
   - updated timestamps
9. Invalidate stale job scores for the user.
10. Return saved profile plus metadata such as `chunks_stored`.

Important:

- Delete stale chunks for the user before inserting regenerated chunks, because current hybrid search filters by `user_id` and section, not by active CV ID.
- Do not leave old embedded content around after profile edits.
- Do not call LLMs to invent profile content in this save flow.

### New Endpoint For Manual Creation

Add:

```text
POST /api/cv/profile?user_id={user_id}
```

Purpose:

- Create a profile when none exists.
- Create a synthetic active CV row if needed.
- Generate and store chunks.

Request body:

- Same `ProfilePayload` already used by `PATCH /api/cv/profile`.

Response:

```json
{
  "profile": "UserProfile",
  "cv_id": "uuid",
  "chunks_stored": 4,
  "message": "Profile built and embedded successfully"
}
```

### Update Existing PATCH Endpoint

Update:

```text
PATCH /api/cv/profile?user_id={user_id}
```

New behavior:

- Save edited profile.
- Regenerate `raw_sections`.
- Regenerate `cv_chunks`.
- Invalidate stale job scores.

This is critical because the user may add skills or edit experience, and fit scoring should reflect the latest version.

### Avoid Backend PDF In V1

Do not add Playwright, WeasyPrint, wkhtmltopdf, ReportLab, or other PDF generation dependencies for V1.

Reasons:

- Extra deployment complexity.
- More memory/runtime risk on free-tier hosting.
- Browser print is enough for hackathon V1.

## Frontend Plan

### Types

Extend `frontend/types/index.ts` with a response type for profile save/build:

```ts
export interface ProfileSaveResult {
  profile: UserProfile;
  cv_id: string;
  chunks_stored: number;
  message: string;
}
```

If the backend returns the raw `UserProfile` for PATCH for backward compatibility, frontend can support both temporarily. Prefer updating the backend response consistently for both POST and PATCH.

### Empty Manual Profile Draft

Add an `emptyUserProfile(userId: string): UserProfile` helper in the Profile page or a small profile helper module.

It should initialize:

- `user_id`
- `active_cv_id: null`
- empty strings
- empty arrays
- `raw_sections: {}`

When `Build manually` is clicked:

- Set `profile` to `null` or keep it absent.
- Set `draft` to empty profile.
- Set `isEditing` to true.
- Hide uploader.
- Show the existing edit form.

### Save Behavior

Change `saveProfile`:

- If profile already exists, call `PATCH /api/cv/profile`.
- If profile does not exist and draft exists, call `POST /api/cv/profile`.
- On success:
  - update `profile`
  - update `draft`
  - leave edit mode
  - show notice such as `Profile saved and CV intelligence updated.`
  - dispatch `careerpilot:cv-updated` with the returned `cv_id`
  - clear stale local job search cache, same as upload flow

This keeps Copilot and Jobs in sync.

### Resume Preview Component

Add:

```text
frontend/components/resume-preview.tsx
```

Props:

```ts
{
  profile: UserProfile;
  printMode?: boolean;
}
```

Design requirements:

- White resume page on dark app background.
- A4-like page width with responsive scaling.
- Dense but readable layout.
- No decorative gradients or app chrome inside the printed resume.
- Use semantic sections and simple typography.
- Preserve text wrapping for descriptions.
- Hide empty sections.
- Keep it ATS-friendly: simple headings, no icons required in the printed body.

Recommended visible sections:

- Header:
  - name
  - headline
  - contact line
  - links
- Summary
- Skills
- Experience
- Projects
- Education
- Certifications

### Resume Preview Placement

On Profile page:

- Add header actions:
  - `Preview Resume`
  - `Print / Download PDF` when preview is visible
- Show preview below profile form or after top header.
- Add a `resume-print-root` class or data attribute around the preview so print CSS can target it.

### Print CSS

Add print rules in `frontend/app/globals.css`.

V1 print behavior:

- Hide everything by default.
- Show only the resume preview root.
- Force white background and dark text.
- Remove shadows/borders that look like app UI.
- Use page size A4 and reasonable margins.

Example intent:

```css
@media print {
  body {
    background: white;
  }

  body * {
    visibility: hidden;
  }

  .resume-print-root,
  .resume-print-root * {
    visibility: visible;
  }

  .resume-print-root {
    position: absolute;
    inset: 0;
    width: 100%;
  }

  .no-print {
    display: none !important;
  }
}
```

The implementer should tune this carefully after testing.

### Copilot Integration

CareerPilot Copilot has already been partially implemented. Treat it as an existing subsystem.

Do **not**:

- Recreate the widget from scratch.
- Replace `copilot-widget.tsx`.
- Remove existing action types.
- Break existing `upload=1`, Jobs prefill, Tracker view, or confirmed goal/todo behavior.

Do:

- Extend `frontend/lib/copilot/app-map.ts`.
- Add only the new CV-builder/export route knowledge and allowed `/cv` query params.
- Add new Copilot actions only if truly needed.

Update `frontend/lib/copilot/app-map.ts` so CareerPilot knows Profile now supports:

- Upload CV
- Build profile manually
- Preview/export resume

Add safe routes/query params:

- `/cv?build=1`
- `/cv?preview=1`
- Keep existing `/cv?upload=1`

Update Profile page query param behavior:

- `upload=1`: show uploader.
- `build=1`: initialize manual builder if no profile exists; if profile exists, open edit mode.
- `preview=1`: show resume preview if profile exists.

Update Copilot prompt/app-map language:

- If no CV/profile exists, CareerPilot can offer:
  - Upload CV
  - Build profile manually
- After profile save/build, CareerPilot can suggest:
  - Preview resume
  - Search jobs

Do not make Copilot generate the full CV automatically in V1. It may guide the user to the manual builder.

Recommended Copilot action behavior:

- Use existing `open_route` for `/cv?build=1`.
- Use existing `open_route` for `/cv?preview=1`.
- Do not add a `create_resume` action in V1.
- Do not let Copilot silently create or overwrite profile data.
- If future chat-assisted CV intake is added, it should fill a visible draft that the user reviews before saving.

## Backend API Details

### `POST /api/cv/profile`

Request:

```json
{
  "full_name": "Araf Rahman",
  "headline": "Junior ML Engineer",
  "location": "Dhaka",
  "email": "araf@example.com",
  "phone": "",
  "links": [],
  "summary": "...",
  "skills": ["Python", "FastAPI"],
  "experience": [],
  "education": [],
  "projects": [],
  "certifications": []
}
```

Response:

```json
{
  "profile": {},
  "cv_id": "uuid",
  "chunks_stored": 4,
  "message": "Profile built and embedded successfully"
}
```

Validation:

- At least one meaningful section should be present before embedding:
  - summary
  - skills
  - experience
  - education
  - projects
  - certifications
- If the profile is fully empty, return `422`.

### `PATCH /api/cv/profile`

Request:

- Same `ProfilePayload`.

Response:

- Prefer same shape as POST.

Behavior:

- If no profile exists, either:
  - return `404`, or
  - call the same creation service.

Recommended: allow PATCH to create if missing, because it makes the frontend simpler and more forgiving.

## Data Consistency Rules

- `profiles` is the canonical editable resume/profile JSON.
- `profiles.raw_sections` is derived from `profiles`, not separately edited by the user in V1.
- `cv_chunks` is derived from `profiles.raw_sections`.
- `cvs` is metadata for the active intelligence source.
- If a user edits Profile, old chunks must be replaced.
- If chunks are replaced, old job fit scores must be invalidated.
- Do not store generated PDF files in V1.

## User-Facing Copy

Use concise product language:

- `Build profile manually`
- `Preview Resume`
- `Print / Download PDF`
- `Profile saved and CV intelligence updated.`
- `Your resume preview uses your latest saved profile.`

Avoid:

- `Chunks`
- `Embeddings`
- `Synthetic CV`
- `JSON`
- `Raw sections`

Those are implementation concepts, not user-facing product copy.

## Implementation Order

1. Add backend profile-to-sections helper.
2. Add backend save/build service for profile-driven CV intelligence.
3. Add `POST /api/cv/profile`.
4. Update `PATCH /api/cv/profile` to regenerate sections/chunks and invalidate scores.
5. Add frontend `ProfileSaveResult` type.
6. Add empty manual profile draft helper.
7. Add Profile empty state with `Upload CV` and `Build manually`.
8. Add manual builder flow using existing edit form.
9. Add `resume-preview.tsx`.
10. Add preview and print buttons to Profile page.
11. Add print CSS in `globals.css`.
12. Add `build=1` and `preview=1` query param support.
13. Extend the existing Copilot app map with CV builder/export route guidance.
14. Run lint.
15. Manually test upload, manual build, edit, preview, print, chat, and job scoring flows.

## Test Plan

### Manual Build

- User with no profile sees both `Upload CV` and `Build profile manually`.
- Clicking `Build profile manually` opens the existing editable form with empty fields.
- User fills minimum useful data and saves.
- Backend creates active CV metadata and stores chunks.
- Profile persists after refresh.
- Copilot profile status becomes `has_profile`.

### Existing Upload Flow

- PDF/DOCX upload still works.
- Upload still creates profile, active CV, chunks, and storage metadata.
- Upload still clears stale job search storage.
- Upload still invalidates stale job scores.

### Profile Edit Flow

- User edits skills/experience/projects.
- Save updates profile.
- Save regenerates `raw_sections`.
- Save regenerates `cv_chunks`.
- Save invalidates existing job scores.
- Chat and job scoring use the updated content.

### Resume Preview

- Preview renders from saved profile.
- Empty sections are hidden.
- Long descriptions wrap cleanly.
- Links and contact information display professionally.
- Preview works on desktop and mobile.

### Print / PDF

- Clicking `Print / Download PDF` opens print dialog.
- Printed output contains only resume content.
- App sidebar/nav/widget are hidden.
- Resume is readable on one or more pages.
- Background is white and text is dark.

### Copilot Integration

- `/cv?upload=1` still opens uploader.
- `/cv?build=1` opens manual builder or edit mode.
- `/cv?preview=1` opens resume preview.
- CareerPilot can recommend both upload and manual build for no-profile users.
- Existing Copilot widget still opens, streams, validates actions, and handles current actions.
- Existing Copilot actions for Jobs, Tracker views, goals, and todos still work.

## Risks And Mitigations

### Risk: Stale CV chunks after profile edits

Mitigation:

- Centralize profile save/build logic in backend service.
- Always regenerate chunks when profile content changes.
- Delete old user chunks before inserting updated chunks.

### Risk: Print output includes app UI

Mitigation:

- Use a dedicated print root class.
- Add print-only CSS in `globals.css`.
- Test browser print preview manually.

### Risk: Resume template becomes too visually heavy

Mitigation:

- Use an ATS-friendly white-page design.
- Avoid icons and app gradients inside printed resume.
- Keep one excellent template for V1.

### Risk: Backend profile save becomes slow due to embeddings

Mitigation:

- Store only one chunk per non-empty section, matching current chunker.
- Embed only the four derived sections.
- Show saving/loading state on frontend.

### Risk: Manual builder duplicates upload flow

Mitigation:

- Reuse the existing Profile form and shared backend profile save logic.
- Keep upload and manual build as two ways to produce the same canonical profile.

## V2 Ideas

After V1 is stable:

- Add Copilot-guided CV intake questions that fill the form draft.
- Add AI bullet rewriting suggestions per experience/project.
- Add multiple resume templates.
- Add server-side PDF generation if one-click file download becomes necessary.
- Add resume quality scoring.
- Add tailored resume generation for a selected job.
- Add cover letter + resume bundle export.

## Final Recommendation

Implement this feature now after Copilot V1 because it strengthens the whole product. It gives users without a CV a way into the system, and it lets users export the latest version of the profile CareerPilot already uses for chat and job matching.

The architecture should stay simple:

```text
Profile form -> profiles -> raw_sections -> cv_chunks -> chat/search/fit score
                         -> resume preview -> browser print PDF
```

That gives CareerPilot a real CV creation loop without adding fragile PDF infrastructure or a second profile data model.
