---
name: code-quality-audit
description: Systematic audit for code duplication, dead code, type safety gaps, and naming inconsistencies. Use periodically or before major refactoring.
disable-model-invocation: true
---

# Code Quality Audit

## When to Use
Run manually (`/code-quality-audit`) before major refactoring, after a large feature addition, or periodically to maintain code health. This is a diagnostic skill — it identifies issues but does not fix them.

## Prerequisites
- Build must pass: `npm run build`
- Tests must pass: `npm run test`

## Audit Checklist

### 1. Code Duplication Search

Look for repeated patterns across the codebase:

```
# Near-identical functions
Grep for similar function signatures across files:
- "update(deltaTime" — are any manager update loops duplicated?
- "addToScene(scene" — are any renderer setup patterns copy-pasted?
- "_getState()" / "_loadState(" — any serialization boilerplate that could be shared?

# Repeated data transformations
- Building iteration: "getAllBuildings().filter(" — same filter patterns?
- Hex coordinate math: duplicated distance/neighbor calculations?
- Resource lookups: repeated BUILDING_DEFINITIONS[type] patterns?
```

**Report format:** List each duplication with file locations, line ranges, and potential extraction target.

### 2. Dead Code Detection

```
# Unused exports
For each file in src/:
  - List all exports
  - Grep for imports of each export across the codebase
  - Flag exports with zero importers (except entry points: main.ts)

# Unused private methods
For each class:
  - List private/protected methods
  - Check if they're called within the class
  - Flag uncalled private methods

# Unused type definitions
Search for interfaces/types that are defined but never referenced:
  - "interface " patterns in src/game/ and src/engine/
  - Check each for usage beyond its definition file
```

### 3. Type Safety Gaps

```
# Explicit 'any' types
Grep: ":\s*any" and ": any" across all .ts files
Target: zero 'any' types (currently strict mode)

# Type assertions
Grep: " as " across all .ts files
Review each for safety — especially:
  - "as unknown as" — double assertions (red flag)
  - "as any" — type escape hatches
  - "!" — non-null assertions

# Optional chaining overuse
Grep: "?\." across all .ts files
Check if any optional chains mask bugs (accessing something that should never be null)

# Record completeness
Verify all Record<SomeType, ...> cover all keys:
  - BUILDING_DEFINITIONS covers all BuildingType values
  - UNIT_DEFINITIONS covers all UnitType values
  - RESOURCE_PROPERTIES covers all ResourceType values
  - BUILDING_SCALE covers all BuildingType values
```

### 4. Naming Consistency

```
# Method naming conventions
- Managers: update(), _getState(), _loadState(), dispose()
- Renderers: addToScene(), update(), dispose()
- Getters: get<Thing>(), is<Condition>(), has<Thing>()
- Event callbacks: on<Event>

# File naming
- Game managers: PascalCase.ts in src/game/
- Renderers: PascalCase.ts in src/engine/
- UI modules: camelCase.ts in src/ui/
- Tests: __tests__/<ClassName>.test.ts

# Variable naming
- Private fields: no prefix (not _field, just field) — except _getState/_loadState convention
- Constants: UPPER_SNAKE_CASE
- Types/interfaces: PascalCase
- Boolean variables: is/has/can/should prefix
```

### 5. Architecture Smells

```
# God classes (>500 lines)
Check line counts:
  - src/engine/Game.ts — target for decomposition
  - src/game/AIPlayer.ts — target for decomposition
  - src/game/BuildingType.ts — data extraction target
  - src/main.ts — UI coupling target

# Circular dependencies
Trace import chains for cycles:
  - GameState ↔ managers
  - Renderers ↔ Game

# Callback hell
Count callback properties across all managers:
  - "on[A-Z].*:" pattern in class definitions
  - Each callback is a potential EventBus migration

# Mixed concerns
- Files that import from both src/game/ AND src/engine/ (besides Game.ts)
- UI modules that directly access game internals
- Renderers that modify game state
```

### 6. Test Coverage Gaps

```
# Files without corresponding tests
For each .ts in src/game/:
  - Check if src/game/__tests__/<name>.test.ts exists
  - Flag untested files

# Engine layer coverage
List all files in src/engine/ — these currently have minimal tests

# UI layer coverage
List all files in src/ui/ — currently zero tests
```

## Audit Report Template

After completing the audit, produce a report:

```markdown
# Code Quality Audit — [Date]

## Summary
- Files scanned: X
- Issues found: Y (Z critical, W minor)

## Critical Issues
1. [Issue description, file, line, recommended fix]

## Duplication
- [Pattern, files, lines, extraction suggestion]

## Dead Code
- [Symbol, file, evidence it's unused]

## Type Safety
- [Issue, file, line, risk level]

## Naming Inconsistencies
- [Pattern, files, suggested convention]

## Architecture Smells
- [Smell, files, recommended refactoring skill to use]

## Test Gaps
- [Untested file, priority, suggested test type]

## Recommended Next Steps
1. [Highest-priority fix]
2. [Second priority]
3. ...
```

## Key Files
- `src/game/` — All game logic managers (39 test files exist)
- `src/engine/` — All renderers and visual systems (2 test files)
- `src/ui/` — UI modules (0 test files)
- `tsconfig.json` — TypeScript strict mode configuration

## Verification
The audit itself doesn't change code. Verify the report is actionable by checking that each issue includes:
- Exact file path and line range
- Clear description of the problem
- Recommended fix or skill to use
