# TitanClip — agent context (repository)

This file is **Cursor/project guidance for this repo**. It is **not** the same as onboarding copies shipped to users under `server/src/onboarding-assets/**/AGENTS.md`.

## Quick facts

- **Monorepo**: pnpm workspace — `server/`, `ui/`, `packages/*` (`@titanclip/*`).
- **Tooling**: `pnpm run typecheck` before finishing TypeScript-affecting work; `pnpm run build:all` for full build from root.
- **Rules**: Prefer scoped edits in the owning package; follow `.cursor/rules/*.mdc` for monorepo, security, server, UI, packages, and cursor-adapter specifics.

## Do not conflate

When improving **developer onboarding rules** for **end users**, edit the templates under `server/src/onboarding-assets/`. When improving **how the AI works in this codebase**, edit `.cursor/rules/` and this root `AGENTS.md`.
