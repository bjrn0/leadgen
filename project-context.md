---
project_name: 'leadgen'
user_name: 'Developer'
date: '2026-05-29'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
existing_patterns_found: 6
status: 'complete'
rule_count: 21
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Next.js 15.3.8 (App Router), React 19.2.3, TypeScript 5.9.3 — pin majors; React 19 + Next 15 are tightly coupled.
- Tailwind CSS v4.1 (NOT v3): configured via `@tailwindcss/postcss` in postcss.config.mjs and CSS-first config in globals.css. There is NO tailwind.config.js — do not add v3-style config files.
- UI: shadcn/ui primitives in `app/src/components/ui/` over Radix; icons via lucide-react; toasts via sonner.
- Auth: @clerk/nextjs 6.29, optional (see rules below).
- Package manager: npm workspaces (root `workspaces: ["app"]`). Use `npm`, not pnpm/yarn.

## Critical Implementation Rules

### Project reality (read before writing any code)
- The repo today is a FRONTEND PROTOTYPE only: no backend, no database, no API layer, no ingestion pipeline. The AWS/Go engine in `specs/` and README is the TARGET, not current state.
- Folders `database/` and `services/` referenced by README/`db:init` DO NOT EXIST. Do not assume they are present; the `npm run db:init` script will fail until `database/` is created.
- All displayed data is hardcoded mock arrays (`leads[]`, `accounts[]`) inside the view files. There is no data fetching. Do not wire fake data to look "real" without a real source.
- Canonical product contract: `_bmad-output/specs/spec-leadgen/SPEC.md`. Project docs: `docs/index.md`.

### Language-Specific (TypeScript)
- Path alias `@/*` → `app/src/*` (app/tsconfig.json). Always import via `@/...`, never long relative chains.
- Strict TS; prefer explicit prop types via inline `type`/`interface`. Keep type-only exports co-located (e.g. `ViewType` in `app/src/app/types.ts`, `NavBarItem` in nav-main.tsx).

### Framework-Specific (Next.js App Router + React)
- Single route only (`app/src/app/page.tsx` = `/`). "Views" switch via `useState<ViewType>`, NOT routing. If adding real routes (`/monitoring`, etc.) per `specs/ui-mapping.md`, treat it as a deliberate refactor, not an assumed convention.
- Every component is a Client Component (`"use client"`). No server components/actions/route handlers exist yet. Add `app/api/*` or server code only as an intentional new layer.
- State is local React only (`useState`/`useMemo`/`useEffect`) plus shadcn `SidebarProvider`. No global store (Redux/Zustand/Context) — don't introduce one casually.
- Auth gate lives in `app/src/lib/auth-mode.ts`: `NEXT_PUBLIC_AUTH_MODE` (default `dev-bypass` = no Clerk). `layout.tsx` conditionally mounts `ClerkProvider`. Don't hard-require Clerk.

### Code Quality & Style
- File naming: kebab-case (`app-sidebar.tsx`, `lead-generation-view.tsx`). Components: PascalCase. Match this.
- Compose classNames with `cn()` from `@/lib/utils` (clsx + tailwind-merge) — never string-concatenate Tailwind classes.
- Theme via CSS variables `--brand`, `--brand-light`, `--brand-border` (globals.css), referenced inline. Use these, not hardcoded hex.
- Use shadcn primitives + CVA `variant` props (e.g. Badge variants: brand/danger/warning/secondary/outline) instead of bespoke styled elements.
- Known duplication to consolidate (don't copy further): `NotificationIcon` and `urgencyVariant` exist in BOTH views; modals are hand-rolled fixed overlays rather than a shared Radix Dialog.

### Development Workflow
- Run: `npm install` then `npm run dev` (root). NOTE: README's `npm run dev:web` is wrong — there is no such script.
- For the UI, only `NEXT_PUBLIC_AUTH_MODE` / `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` matter at runtime; all other `.env.example` vars belong to the unbuilt backend.
- No test framework configured — there are no tests. Adding one is a greenfield decision.

### Critical Don't-Miss / Gotchas
- Notifications channel is UNSETTLED: `specs/` say Resend+webhook, `.env.example` says Slack+Telegram, UI shows generic email+webhook icons. Confirm before implementing any notification code.
- Don't duplicate the "lead queue" concept inside Monitoring (per product rules); keep discovery vs monitoring contexts distinct.
- Actions currently only fire `toast.*`; replacing a toast with a real call requires a backend that doesn't exist yet — flag, don't fake.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when the technology stack changes or the backend (`database/`, `services/`) is introduced.
- Review periodically and remove rules that become obvious over time.

Last Updated: 2026-05-29
