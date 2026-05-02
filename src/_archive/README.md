# Archived Components

This folder contains experimental or deprecated components that are **not in active use**.

## Why Archive Instead of Delete?

- Preserves code history and design decisions
- Allows easy reference if similar patterns are needed
- Prevents accidental usage (not in import paths)

## Contents

### `/layouts`

| File | Original Purpose | Why Archived |
|------|------------------|--------------|
| `WorkspaceLayout.tsx` | Experimental 3-pane layout with JS breakpoint detection | Archived in favor of `PageStack` / fixed header patterns; the JS breakpoint approach caused hydration drift. Historical references to `ResponsiveLayoutShell` are obsolete—that component was removed when `/feed` was unified into `HomePage`. |

## Rules

1. **Do NOT import from this folder** in active code
2. Keep files for reference only
3. Document why each file was archived
4. Consider deleting after 6 months if not referenced

---

*Last updated: December 2025*







