# Cleanup Checklist

- [ ] New files are in a feature folder (or intentionally shared).
- [ ] API route logic is thin and delegates to feature services.
- [ ] Auth/ownership checks use shared access guards.
- [ ] API errors return a consistent `{ error }` payload.
- [ ] No local or sensitive files are tracked.
- [ ] `npm run check` passes locally.
- [ ] CI is green (lint, typecheck, tests, build).
