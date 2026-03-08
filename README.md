# Financial Clearance Training Hub

A standalone training app for Financial Clearance Department workflows. It runs in-browser without build tools.

## Current capabilities

- Role-based access (`trainee` and `supervisor`)
- Base44-style lesson step player:
  - Locked/unlocked step progression
  - Evidence requirements (`none`, `note`, `upload`, `trainer_signoff`)
  - Trainer verification queue for signoff-required steps
- Scenario drills and graded quizzes
- Assignment lifecycle statuses:
  - `not_started`, `in_progress`, `steps_complete`, `completed`, `failed`
- Supervisor console:
  - Assignment creation
  - Progress analytics and CSV export
  - Training authoring (create/edit modules; delete custom modules)
- Auth abstraction scaffold (`LocalProfileAuth` active, `SsoStubAuth` placeholder)
- Persistent browser storage via `localStorage`

## Run locally

1. Open `index.html` in a modern browser.
2. Sign in with a seeded profile or create a new one.

Seeded users:
- `Alex Rivera` (Supervisor)
- `Taylor Brooks` (Trainee)

## Training authoring format

In Admin -> `Training Authoring`:

- Steps textarea: one per line
  - `Title || Instructions || EvidenceType`
  - `EvidenceType` options: `none`, `note`, `upload`, `trainer_signoff`
- Quiz textarea: one per line
  - `Prompt || Option1 || Option2 || Option3 || Option4 || Correct Option Number || Rationale`
- Scenario options: one option per line
- Scenario correct option: 1-based index

## GitHub Pages deployment

1. Repo -> `Settings` -> `Pages`.
2. Source: `Deploy from a branch`.
3. Branch: `main`, folder: `/ (root)`.

This repo includes `.nojekyll` and `404.html` for Pages compatibility.

## SSO and backend starter

See `backend/` for scaffolding:
- `backend/openapi.yaml` API contract draft
- `backend/src/server.js` minimal server skeleton
- `backend/.env.example` config template
- `backend/README.md` implementation path

## Key files

- `index.html`
- `styles.css`
- `js/seeds.js`
- `js/dataStore.js`
- `js/authProvider.js`
- `js/app.js`

## Notes

- App data key: `fc_training_app_v1`
- Admin reset restores seeded defaults and clears custom data.
