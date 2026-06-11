# Original User Request

## Initial Request — 2026-06-08T11:48:36Z

LearnFlow is a local-first, AI-driven personal learning workflow system. The objective is to clean up Eazo SDK dependencies, support 100% offline local IndexedDB operations with custom API keys, and build the review planning page (/review), dashboard calendar integration, AI note organization side-by-side comparison, direct child directory lists, and Notion increment sync.

Working directory: e:/ProgrameSkill/DocumentRecord/VibeCoding/LearnFlow
Integrity mode: development

## Requirements

### R1. Eazo SDK Removal & Local Profile
- Completely remove Eazo account login and EazoProvider.
- Store user profile details (userName, userAvatar) directly in IndexedDB `config` store and make them configurable on the `/token` page.
- Remove all `memory.reportAction` references.

### R2. Review Planning (/review)
- Build a new page at `/review` with a navigation entry.
- Implement IndexedDB stores and Zustand states for `reviewTemplates` and `reviewSessions` (upgrade DB version to v2).
- Add support for three views: "今日待复习", "全部计划", "日历视图" (with orange/red/green/gray status color coding).
- Implement review templates management with a default 6-round Ebbinghaus template and an editor to add/edit custom intervals.
- Add an "添加复习计划" popup to choose "done"/"in_progress" nodes, apply a template, and calculate review dates.

### R3. Dashboard Integration & Auto-Scheduler
- Dynamically build today's study plan in `/dashboard` combining: today's scheduled nodes, overdue nodes, and today's review tasks.
- Allow writing/caching today's tasks to `dailyPlans` IndexedDB store.
- Add an "自动排期" (Auto-Schedule) button in `/planning` to schedule all nodes in the active domain sequentially starting from a date (default: today), using DFS order (`Parent -> Child 1 -> Child 2`) and respecting the domain's `dailyHours` and `weekendPolicy` (none/reduced/full).

### R4. AI Note Organization Comparative Dialog
- In the Markdown editor toolbar, add an "AI 整理" button.
- Call a new route `/api/ai/organize-note` to organize the note.
- Open a side-by-side comparative dialog showing the original note on the left and the AI organized results on the right. Give the user an "Accept" button to overwrite the current editor content.

### R5. Dynamic Child Directory Rendering
- In `NoteEditor` markdown preview, automatically render a clickable list of direct child nodes (and their status) at the top of a parent node's notes, without editing the underlying raw markdown text.

### R6. Notion Incremental Sync
- Upgrade `/api/notion/sync` to convert markdown content into nested Notion Blocks (headings, lists, code, etc.) and use paginated appending for large documents.

## Acceptance Criteria

### Eazo SDK & Local Profile
- [ ] No `@eazo/sdk` imports remain in the user-facing codebase.
- [ ] The app boots without any login overlays and correctly displays the username/avatar from `/token` config at the sidebar bottom.

### Review Page (/review)
- [ ] The `/review` navigation item exists and displays a list of today's pending reviews.
- [ ] Clicking to complete a review updates its session status and schedules the next review.
- [ ] The review templates manager allows adding custom intervals and saving them.

### Dashboard & Auto-Scheduler
- [ ] The dashboard integrates today's scheduled, overdue, and review tasks, and allows checking them off.
- [ ] In `/planning`, clicking "自动排期" calculates and writes `startDate` to nodes according to DFS sequence, daily hours, and weekend policy.

### Note Editor & AI
- [ ] Parent notes preview shows dynamic links to direct child nodes.
- [ ] "AI 整理" opens a comparative dialog showing the original note and the organized note, and clicking "Accept" replaces the markdown text.

### Notion Sync
- [ ] Synced pages correctly render markdown lists, headings, and code blocks as native Notion Blocks.
