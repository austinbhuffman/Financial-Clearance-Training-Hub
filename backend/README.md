# Backend Starter (SSO + Data API)

This folder is a scaffold for moving the app from browser-only localStorage to a managed backend.

## Goals

- Enterprise authentication via OAuth/OIDC (Microsoft Entra ID, Okta, etc.)
- Server-side storage for users, modules, assignments, attempts, and certifications
- Auditable training records and role-based authorization

## Suggested stack

- Runtime: Node.js 20+
- Framework: Express or Fastify
- DB: PostgreSQL
- Auth: OAuth 2.0 / OIDC with provider SDK or Passport strategy

## Included files

- `openapi.yaml`: API contract draft for auth, modules, assignments, and records
- `src/server.js`: minimal Node HTTP server skeleton with health endpoint
- `.env.example`: configuration template

## Next implementation steps

1. Implement OAuth login and callback (`/auth/sso/start`, `/auth/sso/callback`).
2. Add JWT/session middleware and role checks (`supervisor` vs `trainee`).
3. Build CRUD endpoints from `openapi.yaml`.
4. Add database migrations for audit-ready schema.
5. Switch frontend `LocalProfileAuth` to an API-backed auth provider.
