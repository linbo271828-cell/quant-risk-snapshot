# Architecture

## Route Structure

- Frontend routes remain under `app/(frontend)` (URLs unchanged).
- API routes remain under `app/api` and are now transport-layer focused.

## Feature-Oriented Backend

- Feature slices live under `features/`:
  - `features/portfolio`
  - `features/snapshot`
  - `features/events`
  - `features/detective`
  - `features/backtest`
  - `features/alerts`
- Shared access and error conventions are in `features/shared`.

## Layering

1. Route handler validates/reads request and path params.
2. Shared guards enforce auth/ownership.
3. Feature service performs orchestration and persistence.
4. Domain compute helpers in `lib/*` provide reusable analytics logic.

## API Response Conventions

- `401`: unauthenticated.
- `404`: resource does not exist or not owned by user.
- `400`: invalid request payload.
- `500`: unexpected server error.
- Error payload shape: `{ "error": "message" }`.
