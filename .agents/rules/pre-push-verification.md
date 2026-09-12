# Pre-Push Verification & Git Quality Rules

## 1. Mandatory Pre-Push Verification
Before staging, committing, or pushing any changes to Git:
1. **TypeScript Verification (`npx tsc --noEmit`)**:
   - Always run `npx tsc --noEmit` from the project root (`uspl-tracking`).
   - Must complete with exit code 0 and **zero TypeScript errors**.
   - If any errors exist, fix them before committing.
2. **Build Verification (`npm run build`)**:
   - For any UI, routing, or significant logic changes, verify that `npm run build` succeeds without build or bundling failures.
3. **Never Push Broken Builds**:
   - Under no circumstances should broken code or unverified type changes be pushed to remote branches.

## 2. Git Identity & Authorship
- All commits and pushes must be made strictly under the authorized team identity:
  - Name: `unitglo-team`
  - Email: `dev.unitglo@gmail.com`
- When committing, always ensure:
  `git commit --author="unitglo-team <dev.unitglo@gmail.com>" -m "..."`
