# Financial Clearance Training Hub

A standalone training app for Financial Clearance Department workflows. It runs in-browser without build tools.

## Current capabilities

- Role-based access (`trainee` and `supervisor`)
- Module lessons, scenario drills, graded quizzes, and certifications
- Assignment tracking and overdue visibility
- Supervisor console:
  - Assignment creation
  - Progress analytics
  - CSV export
  - Training authoring (create, edit, and delete custom modules)
- Persistent browser storage via `localStorage`
- Auth abstraction scaffold (`LocalProfileAuth` active, `SsoStubAuth` placeholder)

## Run locally

1. Open `index.html` in a modern browser.
2. Sign in with a seeded profile or create a new one.

Seeded users:
- `Alex Rivera` (Supervisor)
- `Taylor Brooks` (Trainee)

## Training authoring format

In Admin -> `Training Authoring`:

- Lessons textarea: one per line
  - `Heading || Content`
- Quiz textarea: one per line
  - `Prompt || Option1 || Option2 || Option3 || Option4 || Correct Option Number || Rationale`
- Scenario options: one option per line
- Scenario correct option: 1-based index

## GitHub Pages deployment

1. Push to GitHub (already done for your repo).
2. Repo -> `Settings` -> `Pages`.
3. Source: `Deploy from a branch`.
4. Branch: `main`, folder: `/ (root)`.

This repo includes `.nojekyll` and `404.html` for GitHub Pages compatibility.

Expected URL pattern:
- `https://<your-username>.github.io/Financial-Clearance-Training-Hub/`

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
