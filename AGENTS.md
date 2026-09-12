<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Quality & Git Rules

## 1. Mandatory Pre-Push Verification
Before staging, committing, or pushing any changes to Git:
1. **TypeScript Verification (`npx tsc --noEmit`)**:
   - Always run `npx tsc --noEmit` from the project directory (`uspl-tracking`).
   - Must complete with exit code 0 and **zero TypeScript errors**.
   - If any syntax or type errors exist, resolve them completely before staging or pushing.
2. **Build Verification (`npm run build`)**:
   - For UI, routing, or major logic changes, verify that `npm run build` runs and finishes successfully.
3. **Never Push Broken Builds**:
   - Under no circumstances should unverified or failing code be pushed to remote branches.

## 2. Git Identity & Authorship
- All commits and pushes must be made strictly under the authorized team identity:
  - Name: `unitglo-team`
  - Email: `dev.unitglo@gmail.com`
- When committing, always specify:
  `git commit --author="unitglo-team <dev.unitglo@gmail.com>" -m "..."`
