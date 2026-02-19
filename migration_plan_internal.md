
# Data Migration Script (migrate_data.ts)

## Purpose
Convert legacy `schoolId` (String Name) to valid `schoolId` (Convex ID) in:
- `teachers`
- `users`
- `skDocuments`
- `headmasterTenures`

## Logic
1. Fetch all `schools` and build a Map: `Name -> ID`.
2. Iterate through target tables.
3. If `schoolId` is a 32-char ID, skip.
4. If `schoolId` matches a School Name in Map:
    - Update `schoolId` to the ID.
    - Log success.
5. If `schoolId` does NOT match (typo or missing school):
    - Log failure (Orphan).
    - Optional: Create a "Legacy/Unknown" placeholder school? No, just leave it or set to null? Better to leave it for manual fix if small number.

## Execution
Run via `npx convex run migrate_data:run`.
