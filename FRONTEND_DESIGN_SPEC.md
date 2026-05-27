# CareerPilot — Frontend Design Specification

> **Complete UI/UX Documentation for AI-Powered Design Generation**
> Last Updated: May 27, 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Design System](#design-system)
3. [Navigation & Layout](#navigation--layout)
4. [Authentication Pages](#authentication-pages)
5. [Dashboard Pages](#dashboard-pages)
6. [Components Library](#components-library)
7. [Interactions & Animations](#interactions--animations)
8. [Responsive Behavior](#responsive-behavior)
9. [Color Palette & Typography](#color-palette--typography)
10. [Icons & Illustrations](#icons--illustrations)

---

## Overview

### Application Purpose

CareerPilot is an AI-powered career co-pilot that helps users:

- Search and discover job opportunities with personalized fit scores
- Upload and analyze CVs using AI
- Chat with an AI assistant that understands their career profile
- Track job applications through a Kanban board
- Manage goals, tasks, and monitor progress

### Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Drag & Drop**: dnd-kit (for Kanban)
- **Charts**: Recharts (for dashboard)

### Design Philosophy

- **Clean & Modern**: Minimalist interface with focus on content
- **Dark Mode First**: Primary design uses dark theme (#111110 background)
- **Accessible**: WCAG compliant with proper contrast ratios
- **Responsive**: Mobile-first approach with tablet and desktop breakpoints
- **Smooth Interactions**: Subtle animations and transitions (200-300ms duration)

---

## Design System

### Color Palette

#### Primary Colors

```css
--primary: #534ab7 (Purple - Brand color) --primary-hover: #6b63c5
  --primary-light: #afa9ec (Light purple for active states)
  --primary-bg: #1e1b38 (Dark purple background for active items);
```

#### Background Colors

```css
--background: #ffffff (Light mode) / #111110 (Dark mode)
  --muted: rgba(255, 255, 255, 0.06) (Dark mode overlay)
  --muted-foreground: rgba(255, 255, 255, 0.5) --card: #ffffff (Light) / #1a1a1a
  (Dark);
```

#### Semantic Colors

```css
--destructive: #ef4444 (Red for errors/delete) --success: #10b981
  (Emerald for success states) --warning: #f59e0b (Amber for warnings)
  --info: #3b82f6 (Blue for information);
```

#### Fit Score Colors

- **High (70-100)**: Emerald (#10B981)
- **Medium (40-69)**: Amber (#F59E0B)
- **Low (0-39)**: Red (#EF4444)

### Typography

#### Font Family

```css
font-family:
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  sans-serif;
```

#### Font Sizes

- **Heading 1**: 30px (text-3xl) - Page titles
- **Heading 2**: 24px (text-2xl) - Section headers
- **Heading 3**: 20px (text-xl) - Card titles
- **Body**: 14px (text-sm) - Default text
- **Small**: 12px (text-xs) - Labels, metadata
- **Tiny**: 10px (text-[10px]) - Badges, tags

#### Font Weights

- **Bold**: 700 (font-bold) - Headings, emphasis
- **Semibold**: 600 (font-semibold) - Subheadings
- **Medium**: 500 (font-medium) - Body text emphasis
- **Normal**: 400 (font-normal) - Body text

### Spacing System

Following Tailwind's spacing scale (4px base unit):

- **xs**: 4px (gap-1, p-1)
- **sm**: 8px (gap-2, p-2)
- **md**: 12px (gap-3, p-3)
- **lg**: 16px (gap-4, p-4)
- **xl**: 20px (gap-5, p-5)
- **2xl**: 24px (gap-6, p-6)
- **3xl**: 32px (gap-8, p-8)

### Border Radius

- **sm**: 6px (rounded-md) - Buttons, inputs
- **md**: 8px (rounded-lg) - Cards, containers
- **lg**: 12px (rounded-xl) - Modals, large cards
- **full**: 9999px (rounded-full) - Circular elements

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05) --shadow-md: 0 4px 6px -1px
  rgb(0 0 0 / 0.1) --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)
  --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
```

---

## Navigation & Layout

### Desktop Sidebar (≥768px)

**Dimensions**:

- Width: 256px (w-64)
- Full height: 100vh
- Background: #111110
- Border: 1px solid rgba(255, 255, 255, 0.06)

**Logo Section** (Top):

- Padding: 20px (px-5 py-6)
- Logo icon: 32x32px purple square (#534AB7) with white briefcase icon
- Text: "CareerPilot" - 18px, bold, white

**Navigation Items**:

- Padding: 12px (px-3 py-2.5)
- Gap: 12px between icon and text
- Border radius: 8px (rounded-lg)
- Icon size: 16x16px (h-4 w-4)
- Font: 14px, medium weight

**States**:

- **Default**: Text white/50, no background
- **Hover**: Background rgba(255, 255, 255, 0.06), text white/80
- **Active**: Background #1e1b38, text #AFA9EC (light purple)

**Navigation Items List**:

1. Home (LayoutDashboard icon) - /
2. Jobs (Briefcase icon) - /jobs
3. My Journey (Map icon) - /journey
4. AI Assistant (MessageCircle icon) - /ai
5. Profile (UserCircle icon) - /profile

**Footer Section** (Bottom):

- Border top: 1px solid rgba(255, 255, 255, 0.06)
- Logout button: Ghost variant, white/40 text, LogOut icon

### Mobile Bottom Navigation (<768px)

**Dimensions**:

- Fixed position at bottom
- Full width
- Height: ~60px
- Background: #111110
- Border top: 1px solid rgba(255, 255, 255, 0.06)
- z-index: 50

**Tab Items**:

- Display: Flex column (icon + label)
- Icon size: 20x20px (h-5 w-5)
- Font: 12px (text-xs)
- Gap: 4px between icon and label
- Padding: 6px 12px (px-3 py-1.5)

**States**:

- **Default**: Text white/40
- **Active**: Text #AFA9EC (light purple)

### Main Content Area

**Desktop**:

- Flex: 1 (takes remaining space after sidebar)
- Padding: 32px (p-8)
- Bottom padding: 32px (pb-8)

**Mobile**:

- Padding: 24px (p-6)
- Bottom padding: 80px (pb-20) - to account for bottom nav

---

## Authentication Pages

### Login Page (`/login`)

**Layout**:

- Full screen centered (min-h-screen flex items-center justify-center)
- Background: Muted/40 (light gray overlay)
- Card: Max width 448px (max-w-md), centered

**Card Structure**:

1. **Header Section**:
   - Logo: Circular background (primary/10), 48x48px container
   - Briefcase icon: 24x24px, primary color
   - Title: "Welcome back" - 24px, bold
   - Subtitle: "Enter your email below to login to your account" - muted text

2. **Form Section**:
   - Email input:
     - Label: "Email" - 14px, medium
     - Placeholder: "m@example.com"
     - Type: email, required
   - Password input:
     - Label: "Password" - 14px, medium
     - Type: password, required
   - Error message (if any):
     - Background: destructive/15
     - Text: destructive color
     - Padding: 12px
     - Border radius: 6px

3. **Footer Section**:
   - Submit button:
     - Full width
     - Primary variant
     - Text: "Sign in" (or "Signing in..." with loading state)
   - Sign up link:
     - Text: "Don't have an account? Sign up"
     - Underline on hover
     - Primary color on hover

### Signup Page (`/signup`)

**Layout**: Identical to Login page

**Card Structure**:

1. **Header Section**:
   - Logo: Same as login
   - Title: "Create an account" - 24px, bold
   - Subtitle: "Enter your email below to create your account"

2. **Form Section**:
   - Email input (same as login)
   - Password input (same as login)
   - Error message (same as login)

3. **Footer Section**:
   - Submit button:
     - Text: "Sign up" (or "Creating account..." with loading state)
   - Login link:
     - Text: "Already have an account? Sign in"

---

## Dashboard Pages

### 1. Home Page (`/`)

**Status**: Placeholder (Coming Day 10)

- Simple text: "Home dashboard — coming Day 10"
- Muted foreground color
- Padding: 24px

**Future Design** (Not yet implemented):

- Overview cards with key metrics
- Recent activity feed
- Quick actions panel

### 2. Jobs Page (`/jobs`)

**Page Header**:

- Title: "Job Hunter" - 30px, bold
- Subtitle: "Search for jobs and get personalized fit scores based on your CV" - muted text
- Spacing: 24px gap (space-y-6)

**Search Form**:

- Layout: Flex row on desktop, column on mobile
- Gap: 12px (gap-3)
- Components:
  1. Job query input:
     - Placeholder: "Job title, keywords, or company"
     - Flex: 1 (takes available space)
  2. Location input:
     - Placeholder: "City, country, or Remote"
     - Flex: 1
  3. Search button:
     - Icon: Search (16x16px) with 8px margin-right
     - Text: "Search"
     - Loading state: Loader2 icon with spin animation
     - Width: Auto on desktop, full on mobile

**Results Grid**:

- Layout: CSS Grid
- Columns: 1 (mobile), 2 (tablet), 3 (desktop xl)
- Gap: 20px (gap-5)
- Each item: JobCard component (see Components section)

**Empty States**:

1. **Before Search**:
   - Container: 300px height, dashed border, rounded
   - Icon: Search (40x40px), muted foreground
   - Title: "Start searching" - semibold
   - Text: "Enter a job title and location to find matching opportunities"

2. **No Results**:
   - Same layout as before search
   - Title: "No jobs found"
   - Text: "Try different keywords or broaden your location"

**Error State**:

- Background: destructive/10
- Text: destructive color
- Padding: 16px
- Border radius: 6px
- Font: 14px

### 3. My Journey Page (`/journey`)

**AI Nudge Banner** (Top):

- Component: NudgeBanner (see Components section)
- Gradient border: indigo → purple → pink
- Message example: "You've got 2 new job matches based on your updated skills"

**Page Header**:

- Title: "My Journey" - 30px, bold
- Subtitle: "Manage your job applications, goals, and track your daily progress"

**View Switcher** (Top Right):

- Container: Muted background, 4px padding, rounded-lg
- Buttons: 4 toggle buttons with icons
  1. Kanban (LayoutGrid icon)
  2. Stats (BarChart3 icon)
  3. Calendar (Calendar icon)
  4. Tasks (ListTodo icon)
- Active state: Secondary variant
- Inactive state: Ghost variant
- Icon size: 16x16px
- Gap: 6px between icon and text

**View Content**:

- Kanban View: KanbanBoard component
- Stats View: ProgressDashboard component
- Calendar View: CalendarView component
- Tasks View: TodoList component

### 4. AI Assistant Page (`/ai`)

**Page Header**:

- Title: "AI Assistant" - 30px, bold
- Subtitle: "Chat with an AI that knows your CV inside out"

**Chat Interface**:

- Component: ChatInterface (see Components section)
- Height: calc(100vh - 100px) - full height minus header
- Layout: Flex column with flex-1 for messages area

### 5. Profile Page (`/profile`)

**Page Header**:

- Title: "Profile" - 30px, bold
- Subtitle: "Upload your CV to enable AI-powered job matching and chat features"

**Initial State** (No CV uploaded):

- Component: CvUpload (see Components section)

**Success State** (CV uploaded):

1. **Success Banner**:
   - Background: emerald-500/10
   - Text: emerald-700 (light) / emerald-400 (dark)
   - Icon: CheckCircle2 (20x20px)
   - Padding: 16px
   - Border radius: 8px
   - Content:
     - Title: "{filename} — parsed successfully!"
     - Subtitle: "{X} chunks embedded and stored for semantic search"

2. **Parsed Sections Grid**:
   - Layout: CSS Grid
   - Columns: 1 (mobile), 2 (desktop)
   - Gap: 20px (gap-5)
   - Cards for each section:
     - Skills (Code2 icon)
     - Experience (Briefcase icon)
     - Education (GraduationCap icon)
     - Projects (FolderKanban icon)
   - Each card:
     - Header: Icon + section name (16px, base)
     - Content: Parsed text (14px, muted, pre-wrap)
     - Max height: 240px with scroll
     - Fallback: "No {section} extracted" if empty

3. **Upload Different CV Button**:
   - Centered
   - Ghost variant
   - Text: "Upload a different CV"

---

## Components Library

### JobCard Component

**Container**:

- Card with full height (h-full)
- Hover effects:
  - Border: primary/50
  - Shadow: md
  - Glow: Gradient overlay (primary/5) with opacity transition
- Transition: 300ms duration

**Header Section**:

- Padding bottom: 12px (pb-3)
- Layout: Flex row, space-between
- Left side:
  - Job title: 18px, bold, line-clamp-2
  - Hover: Text color → primary
  - Company: 14px, medium, with Building icon (14px)
  - Location: 12px, muted, with MapPin icon (14px)
- Right side:
  - FitScoreBadge component (if score > 0)

**Content Section**:

- Flex: 1 (takes available space)
- Salary & Deadline row:
  - Background: muted/30
  - Padding: 8px
  - Border radius: 6px
  - Font: 12px
  - Icons: DollarSign, Calendar (14px)
  - Layout: Flex row with gap
- Description:
  - Font: 14px, muted
  - Line clamp: 3 lines
  - Leading: relaxed

**Footer Section**:

- Border top: 1px
- Padding top: 16px
- Layout: Flex row, space-between
- Left: Source badge (10px, uppercase, mono font, muted background)
- Right: Action buttons
  - "View Details" button: Outline variant, sm size
  - "Apply" button: Default variant, sm size, ExternalLink icon

**Detail Modal** (When "View Details" clicked):

- Overlay: Black/60 with backdrop blur
- Modal container:
  - Max width: 672px (max-w-2xl)
  - Max height: 85vh
  - Background: Card background
  - Border: border/80
  - Shadow: 2xl
  - Border radius: 12px (rounded-xl)
  - Animation: Fade in + zoom in (200ms)

**Modal Structure**:

1. **Header**:
   - Padding: 20px
   - Border bottom: 1px
   - Background: muted/10
   - Source badge: 10px, uppercase, mono
   - Job title: 20px, bold
   - Company & location: 14px, muted, with icons
   - Close button: Ghost variant, icon size, rounded-full, top-right

2. **Content** (Scrollable):
   - Padding: 24px
   - Spacing: 24px gap (space-y-6)

   a. **Fit Score Spotlight** (if score > 0):
   - Background: primary/5
   - Border: primary/10
   - Border radius: 12px
   - Padding: 16px
   - Layout: Flex row (desktop), column (mobile)
   - FitScoreBadge on left
   - Explanation text: 12px, italic, medium weight

   b. **Quick Info Grid**:
   - Grid: 2 columns
   - Background: muted/20
   - Border: border/40
   - Padding: 14px
   - Border radius: 8px
   - Font: 12px
   - Salary & Deadline with icons

   c. **Job Description**:
   - Title: 11px, bold, uppercase, with Briefcase icon
   - Content: 14px, muted, pre-wrap
   - Max height: 256px with scroll
   - Background: muted/10
   - Padding: 16px
   - Border: 1px
   - Border radius: 6px

3. **Footer**:
   - Padding: 16px
   - Border top: 1px
   - Background: muted/10
   - Buttons: Close (outline) + Apply Now (default)

### FitScoreBadge Component

**Container**:

- Display: Inline flex
- Padding: 6px 12px (px-3 py-1.5)
- Border: 1px, border/60
- Border radius: Full (rounded-full)
- Background: Score-based (emerald/amber/red with /50 opacity)
- Hover: Border color changes to score color
- Transition: 300ms

**SVG Circular Progress**:

- Size: 36x36px (w-9 h-9)
- Radius: 18px
- Stroke width: 3px
- Background circle: muted/40
- Foreground circle: Score-based color (emerald/amber/red)
- Stroke linecap: round
- Animation: Stroke dashoffset transition (500ms ease-out)
- Rotation: -90deg (starts from top)

**Score Number** (Center of circle):

- Font: 12px, bold
- Color: Score-based (emerald/amber/red)
- Position: Absolute center

**"Fit" Label**:

- Font: 12px, semibold
- Color: Score-based
- Margin left: 8px

**Tooltip** (On hover, if explanation exists):

- Position: Absolute, bottom-full, centered
- Width: 256px (w-64)
- Padding: 12px
- Background: Popover background
- Border: 1px
- Border radius: 8px
- Shadow: lg
- Opacity: 0 (default), 100 (on hover)
- Transition: 300ms with 100ms delay
- Transform: translateY(4px) → translateY(0) on hover
- Arrow: 8px triangle pointing down

**Tooltip Content**:

- Header: "AI Fit Explanation ({score}%)" - 12px, semibold
- Animated dot: 8px, primary color, pulse animation
- Border bottom: 1px
- Explanation text: 12px, medium, muted

### KanbanBoard Component

**Layout**:

- Grid: 1 column (mobile), 3 (tablet), 5 (desktop)
- Gap: 16px (gap-4)
- Columns: Saved, Applied, Interviewing, Offer, Rejected

**Column Header**:

- Layout: Flex row, items-center
- Gap: 8px
- Padding: 4px
- Components:
  - Status dot: 10px circle, status color
  - Title: 14px, semibold
  - Count badge: Secondary variant, 12px, auto margin-left

**Column Container**:

- Min height: 120px
- Padding: 8px
- Border radius: 8px
- Background: muted/30
- Border: 1px dashed
- Spacing: 8px gap (space-y-2)

**Empty State**:

- Text: "No applications" - 12px, muted, centered
- Padding: 24px vertical

**Application Card**:

- Padding: 12px
- Font: 14px
- Border radius: 6px
- Header:
  - GripVertical icon (14px, muted) + Job ID (truncated)
  - Delete button: Ghost variant, icon size (24x24px), Trash2 icon
- Move buttons:
  - Layout: Flex wrap
  - Gap: 4px
  - Height: 24px
  - Font: 10px
  - Padding: 6px
  - Shows all statuses except current
  - Loading state: Loader2 icon with spin

### CvUpload Component

**Drag & Drop Zone**:

- Border: 2px dashed, muted-foreground/25
- Border radius: 12px (rounded-xl)
- Padding: 48px (p-12)
- Layout: Flex column, centered
- Cursor: pointer
- Transition: 200ms

**Hover/Drag State**:

- Border color: primary
- Background: primary/5
- Scale: 1.01

**Default State Content**:

- Icon: UploadCloud (40x40px, muted)
- Title: "Drag & drop your CV here" - 18px, semibold
- Subtitle: "Supports PDF and DOCX — max 5 MB" - 14px, muted
- Button: "Browse Files" - Outline variant, sm size, FileUp icon

**Uploading State**:

- Icon: Loader2 (40x40px, primary, spin animation)
- Title: "Parsing {filename}..." - 14px, medium
- Subtitle: "Extracting skills, experience, education, and projects" - 12px, muted

**Error State**:

- Margin top: 16px
- Background: destructive/10
- Text: destructive color
- Padding: 12px
- Border radius: 6px
- Font: 14px

**Hidden File Input**:

- Display: none
- Accept: .pdf, .docx

### ChatInterface Component

**Container**:

- Layout: Flex column
- Height: Full (h-full)

**Messages Area**:

- Flex: 1 (takes available space)
- Overflow: Auto (vertical scroll)
- Spacing: 16px gap (space-y-4)
- Padding right: 8px (for scrollbar)
- Padding bottom: 16px

**Empty State**:

- Layout: Flex column, centered, full height
- Icon: Bot (48x48px, opacity 40%)
- Title: "CareerPilot AI" - 18px, medium
- Subtitle: "Ask me anything about your career..." - 14px, muted, max-width 448px

**Message Bubble**:

- Layout: Flex row with gap (12px)
- Alignment: End (user) or Start (assistant)
- Max width: 75%

**User Message**:

- Background: Primary
- Text: Primary foreground (white)
- Padding: 12px 16px
- Border radius: 6px
- Font: 14px
- White-space: pre-wrap
- Avatar: 32x32px circle, muted background, User icon (16px)

**Assistant Message**:

- Background: Muted
- Text: Foreground
- Padding: 12px 16px
- Border radius: 6px
- Font: 14px
- White-space: pre-wrap
- Avatar: 32x32px circle, primary/10 background, Bot icon (16px, primary)
- Loading state: Loader2 icon (16px, spin, muted)

**Input Area**:

- Border top: 1px
- Padding top: 16px
- Margin top: 8px
- Layout: Flex row
- Gap: 8px

**Textarea**:

- Resize: none
- Min height: 44px
- Rows: 1
- Placeholder: "Ask CareerPilot anything..."
- Disabled when streaming

**Send Button**:

- Size: Icon (44x44px)
- Shrink: 0
- Icon: Send (16px) or Loader2 (16px, spin when streaming)
- Disabled when: empty input or streaming

### ProgressDashboard Component

**AI Nudges Section** (Top):

- Spacing: 8px gap (space-y-2)
- Each nudge:
  - Layout: Flex row, items-start
  - Gap: 12px
  - Padding: 16px
  - Border radius: 8px
  - Background: primary/5
  - Border: primary/20
  - Bell icon: 16px, primary
  - Message: 14px, flex-1
  - Dismiss button: 12px, muted, underline on hover

**Stats Cards Grid**:

- Grid: 1 column (mobile), 3 (desktop)
- Gap: 16px (gap-4)

**Stat Card**:

- Card component
- Header:
  - Layout: Flex row, space-between
  - Padding bottom: 8px
  - Title: 14px, medium
  - Icon: 16x16px, muted
- Content:
  - Value: 24px, bold
  - Label: 12px, muted

**Card Types**:

1. **Applications Sent**:
   - Icon: TrendingUp
   - Label: "This week"

2. **Daily Streak**:
   - Icon: Flame (orange-500)
   - Value: "{X} days"
   - Label: "Keep it going!"

3. **Roadmap Progress**:
   - Icon: Target
   - Value: "{X}%"
   - Progress bar:
     - Height: 8px
     - Border radius: full
     - Background: muted
     - Fill: primary, width based on percentage
     - Transition: all

**Pipeline Overview Card**:

- Card component
- Header: "Application Pipeline" - 16px, base
- Content:
  - Grid: 2 columns (mobile), 5 (desktop)
  - Gap: 16px
  - Each status:
    - Layout: Flex column, centered
    - Padding: 12px
    - Border radius: 8px
    - Background: muted/40
    - Icon: 20x20px, status color
    - Count: 24px, bold
    - Label: 12px, muted

### CalendarView Component

**Card Container**:

- Full width card

**Header**:

- Layout: Flex row, space-between
- Padding bottom: 8px
- Title: 20px, bold, with Calendar icon (20px, primary)
- Navigation buttons:
  - Outline variant, icon size
  - ChevronLeft / ChevronRight icons (16px)
  - Gap: 8px

**Weekday Headers**:

- Grid: 7 columns
- Gap: 8px
- Text: 14px, medium, muted, centered
- Margin bottom: 16px
- Days: Sun, Mon, Tue, Wed, Thu, Fri, Sat

**Calendar Grid**:

- Grid: 7 columns
- Gap: 8px

**Day Cell**:

- Height: 96px (h-24)
- Border radius: 6px
- Padding: 8px
- Layout: Flex column, space-between
- Border: 1px, muted/30
- Hover: Border muted-foreground/50
- Transition: colors

**Today Cell**:

- Border: primary
- Background: primary/5
- Day number: primary color

**Day Number**:

- Font: 14px, semibold
- Color: Foreground (or primary if today)

**Event Badge** (Example on every 5th day):

- Font: 12px
- Background: amber-500/10
- Text: amber-600
- Border radius: 2px
- Padding: 2px 4px
- Truncate: true
- Layout: Flex row, items-center
- Icon: Clock (12px)
- Text: "Interview"

### TodoList Component

**Card Container**:

- Full width card

**Header**:

- Title: 20px, bold, with ListTodo icon (20px, primary)

**Add Todo Form**:

- Layout: Flex row
- Gap: 8px
- Input:
  - Placeholder: "Add a new task..."
  - Flex: 1
- Button:
  - Type: submit
  - Size: icon
  - Icon: Plus (16px)

**Todo Items List**:

- Spacing: 8px gap (space-y-2)
- Margin top: 16px

**Empty State**:

- Text: "All caught up! No pending tasks."
- Font: 14px, muted, centered
- Padding: 16px vertical

**Todo Item**:

- Layout: Flex row, items-center
- Gap: 12px
- Padding: 12px
- Border radius: 8px
- Border: 1px
- Transition: all

**Completed State**:

- Background: muted/30
- Border: muted
- Opacity: 60%

**Active State**:

- Background: card
- Border: border
- Hover: Border primary/40

**Components**:

- Checkbox: 16x16px
- Label:
  - Flex: 1
  - Font: 14px
  - Cursor: pointer
  - Completed: Line-through, muted
  - Active: No decoration, medium weight
- Delete button:
  - Ghost variant
  - Size: 32x32px (h-8 w-8)
  - Icon: Trash2 (16px)
  - Color: Muted (hover: destructive)

### NudgeBanner Component

**Outer Container**:

- Border radius: 12px (rounded-xl)
- Background: Gradient (indigo-500 → purple-500 → pink-500)
- Padding: 1px (for gradient border effect)
- Overflow: hidden

**Inner Container**:

- Layout: Flex row, space-between, items-center
- Gap: 16px
- Border radius: 8px
- Background: background/90 with backdrop blur
- Padding: 12px 16px

**Left Section**:

- Layout: Flex row, items-center
- Gap: 12px
- Icon container:
  - Size: 32x32px
  - Border radius: full
  - Background: primary/20
  - Text: primary
  - Icon: Sparkles (16px)
- Message:
  - Font: 14px, medium
  - Prefix: "AI Nudge:" - bold, gradient text (indigo → pink)
  - Margin right: 4px

**Dismiss Button**:

- Color: Muted (hover: foreground)
- Transition: colors
- Icon: X (16px)
- Shrink: 0
- Screen reader text: "Dismiss"

---

## Interactions & Animations

### Hover Effects

**Buttons**:

- Transition: 150ms ease
- Scale: 0.98 on active (active:scale-95)
- Opacity: 90% on hover (for ghost variants)
- Background: Darker shade on hover

**Cards**:

- Transition: 300ms ease
- Border color: primary/50 on hover
- Shadow: Elevation increase (none → sm → md)
- Transform: translateY(-2px) subtle lift

**Links**:

- Transition: 200ms ease
- Color: primary on hover
- Underline: Appears on hover (underline-offset-4)

### Loading States

**Spinner Animation**:

- Icon: Loader2 from lucide-react
- Animation: Spin (animate-spin)
- Duration: 1s linear infinite
- Color: Muted foreground or primary

**Skeleton Loaders** (Not implemented yet):

- Background: Gradient animation (muted → muted-foreground/20 → muted)
- Duration: 1.5s ease-in-out infinite

### Transitions

**Page Transitions**:

- Duration: 200ms
- Easing: ease-in-out
- Opacity: 0 → 1

**Modal Animations**:

- Fade in: Opacity 0 → 1 (200ms)
- Zoom in: Scale 0.95 → 1 (200ms)
- Backdrop: Blur 0 → sm (200ms)

**Tooltip Animations**:

- Opacity: 0 → 1 (300ms)
- Transform: translateY(4px) → translateY(0)
- Delay: 100ms

**Progress Bar**:

- Width transition: 500ms ease-out
- Background transition: 300ms

### Micro-interactions

**Checkbox**:

- Scale: 0.95 → 1 on check
- Checkmark: Stroke dasharray animation

**Input Focus**:

- Border color: muted → primary (200ms)
- Ring: 2px primary/20 shadow

**Button Click**:

- Scale: 1 → 0.98 → 1 (150ms)
- Ripple effect: Not implemented (could add)

---

## Responsive Behavior

### Breakpoints

```css
sm: 640px   /* Small tablets */
md: 768px   /* Tablets */
lg: 1024px  /* Small laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large desktops */
```

### Layout Adaptations

**Navigation**:

- **Mobile (<768px)**: Bottom tab bar, icons + labels
- **Desktop (≥768px)**: Left sidebar, full navigation

**Content Padding**:

- **Mobile**: 24px (p-6)
- **Desktop**: 32px (p-8)

**Grid Layouts**:

**Jobs Grid**:

- **Mobile**: 1 column
- **Tablet (md)**: 2 columns
- **Desktop (xl)**: 3 columns

**Kanban Board**:

- **Mobile**: 1 column (vertical scroll)
- **Tablet (md)**: 3 columns
- **Desktop (lg)**: 5 columns

**Stats Cards**:

- **Mobile**: 1 column
- **Desktop (sm)**: 3 columns

**Pipeline Overview**:

- **Mobile**: 2 columns
- **Desktop (sm)**: 5 columns

**CV Sections Grid**:

- **Mobile**: 1 column
- **Desktop (md)**: 2 columns

### Typography Scaling

**Headings**:

- **Mobile**: Slightly smaller (text-2xl → text-3xl)
- **Desktop**: Full size (text-3xl)

**Body Text**:

- Consistent across breakpoints (text-sm)

### Component Adaptations

**Search Form**:

- **Mobile**: Flex column (stack inputs)
- **Desktop**: Flex row (side by side)

**Modal**:

- **Mobile**: Full width with padding (p-4)
- **Desktop**: Max width 672px, centered

**Job Card Modal Content**:

- **Mobile**: Flex column (fit score above explanation)
- **Desktop**: Flex row (fit score beside explanation)

**Chat Interface**:

- **Mobile**: Message bubbles max-width 85%
- **Desktop**: Message bubbles max-width 75%

**Calendar**:

- **Mobile**: Smaller day cells (h-20)
- **Desktop**: Standard day cells (h-24)

### Touch Targets

**Minimum Size**: 44x44px for all interactive elements

- Buttons: Minimum 44px height
- Icons: Minimum 44px touch area (even if icon is 16px)
- Checkboxes: 44px touch area

---

## Color Palette & Typography

### Complete Color System

#### Light Mode

```css
--background: hsl(0 0% 100%) --foreground: hsl(222.2 84% 4.9%)
  --card: hsl(0 0% 100%) --card-foreground: hsl(222.2 84% 4.9%)
  --popover: hsl(0 0% 100%) --popover-foreground: hsl(222.2 84% 4.9%)
  --primary: hsl(245 58% 51%) --primary-foreground: hsl(210 40% 98%)
  --secondary: hsl(210 40% 96.1%) --secondary-foreground: hsl(222.2 47.4% 11.2%)
  --muted: hsl(210 40% 96.1%) --muted-foreground: hsl(215.4 16.3% 46.9%)
  --accent: hsl(210 40% 96.1%) --accent-foreground: hsl(222.2 47.4% 11.2%)
  --destructive: hsl(0 84.2% 60.2%) --destructive-foreground: hsl(210 40% 98%)
  --border: hsl(214.3 31.8% 91.4%) --input: hsl(214.3 31.8% 91.4%)
  --ring: hsl(245 58% 51%);
```

#### Dark Mode

```css
--background: hsl(0 0% 6.7%) --foreground: hsl(210 40% 98%)
  --card: hsl(0 0% 10%) --card-foreground: hsl(210 40% 98%)
  --popover: hsl(0 0% 10%) --popover-foreground: hsl(210 40% 98%)
  --primary: hsl(245 58% 51%) --primary-foreground: hsl(210 40% 98%)
  --secondary: hsl(217.2 32.6% 17.5%) --secondary-foreground: hsl(210 40% 98%)
  --muted: hsla(0 0% 100% / 0.06) --muted-foreground: hsla(0 0% 100% / 0.5)
  --accent: hsl(217.2 32.6% 17.5%) --accent-foreground: hsl(210 40% 98%)
  --destructive: hsl(0 62.8% 30.6%) --destructive-foreground: hsl(210 40% 98%)
  --border: hsla(0 0% 100% / 0.06) --input: hsla(0 0% 100% / 0.06)
  --ring: hsl(245 58% 51%);
```

### Status Colors

```css
/* Application Statuses */
--status-saved: hsl(215 20% 50%) /* Slate */ --status-applied: hsl(217 91% 60%)
  /* Blue */ --status-interviewing: hsl(38 92% 50%) /* Amber */
  --status-offer: hsl(142 71% 45%) /* Emerald */
  --status-rejected: hsl(0 72% 51%) /* Red */ /* Fit Score Ranges */
  --fit-high: hsl(142 71% 45%) /* Emerald (70-100) */
  --fit-medium: hsl(38 92% 50%) /* Amber (40-69) */ --fit-low: hsl(0 72% 51%)
  /* Red (0-39) */;
```

### Typography Scale

```css
/* Font Sizes */
--text-xs: 0.75rem /* 12px */ --text-sm: 0.875rem /* 14px */ --text-base: 1rem
  /* 16px */ --text-lg: 1.125rem /* 18px */ --text-xl: 1.25rem /* 20px */
  --text-2xl: 1.5rem /* 24px */ --text-3xl: 1.875rem /* 30px */
  /* Line Heights */ --leading-none: 1 --leading-tight: 1.25
  --leading-snug: 1.375 --leading-normal: 1.5 --leading-relaxed: 1.625
  --leading-loose: 2 /* Letter Spacing */ --tracking-tighter: -0.05em
  --tracking-tight: -0.025em --tracking-normal: 0em --tracking-wide: 0.025em
  --tracking-wider: 0.05em --tracking-widest: 0.1em;
```

---

## Icons & Illustrations

### Icon Library: Lucide React

All icons are from `lucide-react` package.

### Icon Sizes

- **Tiny**: 12px (h-3 w-3) - Inline badges
- **Small**: 14px (h-3.5 w-3.5) - Labels, metadata
- **Default**: 16px (h-4 w-4) - Buttons, navigation
- **Medium**: 20px (h-5 w-5) - Card headers, tabs
- **Large**: 24px (h-6 w-6) - Page headers, logos
- **XLarge**: 40px (h-10 w-10) - Empty states, loading
- **2XLarge**: 48px (h-12 w-12) - Hero sections

### Icon Usage Map

**Navigation**:

- Home: `LayoutDashboard`
- Jobs: `Briefcase`
- My Journey: `Map`
- AI Assistant: `MessageCircle`
- Profile: `UserCircle`
- Logout: `LogOut`

**Job Card**:

- Company: `Building`
- Location: `MapPin`
- Salary: `DollarSign`
- Deadline: `Calendar`
- External link: `ExternalLink`
- Job type: `Briefcase`

**Actions**:

- Search: `Search`
- Upload: `UploadCloud`, `FileUp`
- Send: `Send`
- Delete: `Trash2`
- Edit: `Pencil`
- Close: `X`
- Add: `Plus`
- Loading: `Loader2`
- Drag: `GripVertical`

**Status Icons**:

- Saved: `Briefcase`
- Applied: `Send`
- Interviewing: `Users`
- Offer: `Trophy`
- Rejected: `XCircle`

**Dashboard**:

- Trending: `TrendingUp`
- Streak: `Flame`
- Target: `Target`
- Stats: `BarChart3`
- Calendar: `Calendar`
- Tasks: `ListTodo`
- Kanban: `LayoutGrid`
- Notification: `Bell`
- AI: `Bot`, `Sparkles`
- User: `User`

**CV Sections**:

- Skills: `Code2`
- Experience: `Briefcase`
- Education: `GraduationCap`
- Projects: `FolderKanban`

**Feedback**:

- Success: `CheckCircle2`
- Error: `AlertCircle`
- Warning: `AlertTriangle`
- Info: `Info`

### Empty State Illustrations

**Pattern**: Icon + Text

- Large icon (40-48px)
- Muted foreground color
- Centered layout
- Descriptive text below

**Examples**:

- No jobs: Search icon
- No applications: Briefcase icon
- No messages: MessageCircle icon
- No CV: FileUp icon

---

## Accessibility Features

### Keyboard Navigation

- All interactive elements are keyboard accessible
- Tab order follows visual flow
- Focus indicators: 2px ring with primary/20 color
- Escape key closes modals

### Screen Reader Support

- Semantic HTML elements (nav, main, header, footer)
- ARIA labels on icon-only buttons
- ARIA live regions for dynamic content
- Alt text on images (when implemented)

### Color Contrast

- Text on background: Minimum 4.5:1 ratio
- Large text: Minimum 3:1 ratio
- Interactive elements: Minimum 3:1 ratio
- Focus indicators: Minimum 3:1 ratio

### Motion Preferences

- Respects `prefers-reduced-motion` media query
- Animations can be disabled system-wide
- Essential animations only (loading states)

---

## Implementation Notes

### Component Library

All UI components use shadcn/ui:

- Button
- Input
- Textarea
- Card
- Badge
- Checkbox
- Calendar
- Progress
- Label

**Location**: `frontend/components/ui/`
**Note**: These are auto-generated and should not be edited directly

### Custom Components

**Location**: `frontend/components/`

- job-card.tsx
- fit-score-badge.tsx
- kanban-board.tsx
- cv-upload.tsx
- chat-interface.tsx
- progress-dashboard.tsx
- calendar-view.tsx
- todo-list.tsx
- nudge-banner.tsx

### State Management

- React hooks (useState, useEffect)
- No global state library (Redux, Zustand)
- Supabase for data fetching
- TanStack Query for client-side caching (planned)

### API Integration

- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- Fallback: `http://localhost:8000`
- All endpoints use fetch API
- Error handling with try-catch
- Loading states for all async operations

---

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **Home Dashboard** (Day 10)
   - Overview cards
   - Recent activity feed
   - Quick actions

2. **Skeleton Loaders**
   - Replace loading spinners with skeleton screens
   - Better perceived performance

3. **Toast Notifications**
   - Success/error messages
   - Action confirmations
   - System notifications

4. **Advanced Filters** (Jobs page)
   - Salary range slider
   - Job type (remote, hybrid, onsite)
   - Experience level
   - Date posted

5. **Drag & Drop Kanban**
   - Currently uses buttons to move cards
   - Implement dnd-kit for drag functionality

6. **Real-time Updates**
   - Supabase Realtime subscriptions
   - Live application status changes
   - Live chat updates

7. **Dark/Light Mode Toggle**
   - Currently dark mode only
   - Add theme switcher

8. **Export Features**
   - Export applications to CSV
   - Export calendar to ICS
   - Print-friendly views

---

## Design Tokens Summary

For AI design tools, use these exact values:

**Primary Brand Color**: #534AB7 (Purple)
**Background (Dark)**: #111110
**Text (Light)**: #FFFFFF with varying opacity (100%, 80%, 50%, 40%)
**Border**: rgba(255, 255, 255, 0.06)
**Card Background**: #1A1A1A
**Hover Background**: rgba(255, 255, 255, 0.06)
**Active Background**: #1e1b38
**Active Text**: #AFA9EC

**Border Radius**: 6px (small), 8px (medium), 12px (large)
**Spacing Unit**: 4px (use multiples: 8px, 12px, 16px, 20px, 24px, 32px)
**Font**: System UI stack
**Icon Library**: Lucide React
**Animation Duration**: 200-300ms
**Easing**: ease, ease-in-out

---

**End of Frontend Design Specification**

_This document provides complete UI/UX details for AI-powered design generation tools like v0, Galileo AI, or similar platforms._
