# Project: LearnFlow Offline and AI Expansion

## Architecture
- LearnFlow is a Bun-first local-first React/Next.js SPA/App using IndexedDB (`idb` npm library) and Zustand for local state management.
- Backend APIs run locally, integrating with AI and Notion.
- Removing Eazo SDK to support 100% offline local operation.

## Code Layout
- `src/app/` — Pages and layout structure
- `src/components/` — UI components (planning, note-editor, dashboard, review)
- `src/lib/` — Database (`db.ts`), global state (`store.ts`), i18n, etc.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Eazo SDK Removal & Local Profile | Remove Eazo SDK dependencies, login overlay, memory, and configure local profiles in IndexedDB + /token page. | None | DONE |
| 2 | Review Planning (/review) | Implement review page (/review), IndexedDB stores/Zustand updates, three views (today, all, calendar), Ebbinghaus template, editor, and review planner popup. | M1 | PLANNED |
| 3 | Dashboard Integration & Auto-Scheduler | Dynamically render study plans/tasks on dashboard, support `dailyPlans` IndexedDB cache, and implement the DFS auto-scheduling algorithm in `/planning`. | M2 | PLANNED |
| 4 | AI Note Organization comparative dialog | Implement the "AI 整理" button in Markdown toolbar, the API route, and the side-by-side comparative dialog with "Accept" replacement. | M1 | PLANNED |
| 5 | Dynamic Child Directory Rendering | Automatically render clickable child nodes with their statuses at the top of a parent note's preview in `NoteEditor` without modifying markdown. | M2 | PLANNED |
| 6 | Notion Incremental Sync | Upgrade Notion sync `/api/notion/sync` to convert markdown into nested Notion Blocks and use paginated block appending. | M1 | PLANNED |

## Interface Contracts
### Local Configuration Config Store
- Config includes: `userName`, `userAvatar`, `aiProvider`, `apiKey`, `modelName`, `baseUrl`, `notionToken`, `notionDatabaseId`
- Accessible via Zustand store or direct DB `getConfig()` / `putConfig(c)`.
