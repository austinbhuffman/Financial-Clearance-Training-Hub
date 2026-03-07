# Financial Clearance Training Hub

A standalone training app for Financial Clearance Department workflows. It runs in-browser with no build tools or external dependencies.

## Features

- Role-based access (`trainee` and `supervisor`)
- Process-specific training modules:
  - Insurance verification
  - Prior authorization
  - Patient estimate and counseling
  - Denial prevention and appeals
- Scenario drills and graded quizzes
- Automatic certification issuance on passing scores
- Assignment tracking with overdue detection
- Supervisor console:
  - User progress monitoring
  - Module performance analytics
  - Assignment creation
  - CSV export of training records
- Persistent app state using `localStorage`

## Run

1. Open `index.html` in any modern browser.
2. Sign in with a seeded user or create a new profile.
3. Complete modules and quizzes to generate certifications.

## Seeded Accounts

- `Alex Rivera` (Supervisor)
- `Taylor Brooks` (Trainee)

## Customize

- Training content and seed users: `js/seeds.js`
- Data logic and persistence: `js/dataStore.js`
- UI behavior: `js/app.js`
- Styling: `styles.css`

## Notes

- Data is stored under localStorage key `fc_training_app_v1`.
- Supervisors can reset demo data from the Admin tab.
