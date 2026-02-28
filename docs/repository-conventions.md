# Repository Conventions

## Where New Code Goes

- API handlers: `app/api/**/route.ts`
- Feature orchestration: `features/<feature>/service.ts`
- Shared backend guards/error helpers: `features/shared/*`
- Quant/math engines and common utilities: `lib/*`
- Reusable UI primitives: `components/*`
- Route-specific UI/hooks: colocated under each route folder in `app/(frontend)/*`

## Git Hygiene Rules

- Never commit `.env*` files except `.env.example`.
- Never commit build/cache folders (`.next`, `coverage`, `.turbo`, `.cache`, `.vercel`).
- Keep local-only IDE/agent artifacts out of git (`.cursor`, local transcripts).

## Quality Gate

Before opening a PR, run:

```bash
npm run check
```

And ensure formatting is clean:

```bash
npm run format:check
```
