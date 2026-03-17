---
name: safe-refactoring
description: General methodology for safe, incremental refactoring. Pre-checks, finding all usages before API changes, build/test/verify workflow, rollback plans. Use before any structural change.
user-invocable: false
---

# Safe Refactoring Protocol

## When to Use
Before making any structural change to the codebase — renaming exports, moving files, splitting classes, changing interfaces, or modifying public APIs.

## Prerequisites
1. Working tree is clean (`git status` — no uncommitted changes)
2. Build passes: `npm run build`
3. Tests pass: `npm run test`
4. Lint clean: `npm run lint`

If any pre-check fails, fix it first. Never refactor on a broken baseline.

## Step-by-Step

### 1. Understand the Change Scope
Before touching code, map out what will be affected:

```bash
# Find all imports of the target module
grep -r "from '.*/<module>'" src/ --include="*.ts"

# Find all usages of a symbol
grep -r "SymbolName" src/ --include="*.ts"

# Count affected files
grep -rl "SymbolName" src/ --include="*.ts" | wc -l
```

Document the list of affected files before proceeding.

### 2. Plan Incremental Steps
Break the refactoring into the smallest possible independent changes:
- **One structural change per commit** — move a file, rename a symbol, extract a method
- Each intermediate state must compile and pass tests
- If a step would break >10 files simultaneously, find a smaller decomposition

### 3. Execute Each Step

For each incremental step:

**a) Make the change:**
- If renaming: use `replace_all` in Edit tool for consistency
- If moving: update all import paths (use Grep to find them all first)
- If extracting: create the new target, then update references one-by-one

**b) Verify immediately:**
```bash
npm run build   # TypeScript compilation
npm run lint    # No new violations
npm run test    # All tests pass
```

**c) Visual verify (if rendering affected):**
- Navigate to `http://localhost:5173` via Chrome DevTools MCP
- Take screenshot to verify 3D scene renders correctly
- Check console for runtime errors

**d) Commit the step:**
Only after all checks pass. Descriptive message explaining the structural change.

### 4. Rollback Plan
If a step breaks something unexpected:
- `git diff` to see what changed
- `git stash` or `git checkout -- .` to revert
- Re-analyze the change scope — you likely missed a reference

## Project-Specific Constraints

### TypeScript Config
- `erasableSyntaxOnly: true` — cannot use `enum`, must use `const object + type alias` pattern:
  ```typescript
  export const MyType = { A: 'a', B: 'b' } as const;
  export type MyType = (typeof MyType)[keyof typeof MyType];
  ```
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `strict: true` — no implicit any, strict null checks
- `noUnusedLocals: true` / `noUnusedParameters: true` — remove unused code, don't prefix with `_`

### Common Refactoring Gotchas in This Codebase
1. **Manager `_getState()` / `_loadState()`** — If you change a manager's internal state shape, you must update SaveLoad.ts serialization AND add backward-compat patching
2. **Game.ts wiring** — If you change a manager's constructor signature, update Game.ts constructor (and possibly AIPlayer if it shares the dependency)
3. **Callback properties** — Many managers expose `onX` callback properties wired in Game.ts constructor. If you rename or remove one, trace the wiring
4. **Re-exports** — If a module re-exports from another (e.g., `BuildingType` from `BuildingType.ts`), changing the source affects all downstream consumers
5. **`Record<SomeType, ...>` completeness** — TypeScript enforces that all keys are present. Adding a new enum value requires updating every Record that uses it as a key

### Files with High Fan-Out (change carefully)
| File | Importers |
|------|-----------|
| `src/game/BuildingType.ts` | 20+ files |
| `src/game/ResourceType.ts` | 15+ files |
| `src/game/UnitType.ts` | 10+ files |
| `src/game/GameState.ts` | 15+ files |
| `src/engine/Game.ts` | 5+ files (but orchestrates everything) |

## Verification Checklist
- [ ] All affected files identified before starting
- [ ] Each step compiles (`npm run build`)
- [ ] Each step passes lint (`npm run lint`)
- [ ] Each step passes tests (`npm run test`)
- [ ] Visual verification if rendering changed
- [ ] No console errors in browser
- [ ] Commit after each verified step
