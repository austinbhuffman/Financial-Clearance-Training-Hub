# Backend Auth + Invite Service

This backend now supports the supervisor invite flow required by the training app:

- Supervisor registers users
- User receives temporary password
- User signs in with email + temporary password
- User is forced to set a permanent password on first login

## Modes

- `AUTH_MODE=mock` (default): no cloud dependency, temp passwords are logged in server console
- `AUTH_MODE=cognito`: uses AWS Cognito for real email delivery and password policy

## Endpoints

- `GET /health`
- `POST /auth/login`
- `POST /auth/challenge/new-password`
- `GET /auth/me`
- `POST /admin/users/invite` (supervisor only)

## Run

1. Copy `.env.example` to `.env` and adjust values.
2. Start server:

```bash
node src/server.js
```

In mock mode, bootstrap accounts are:

- `supervisor@financialclearance.local` / `TempPass123!`
- `trainee@financialclearance.local` / `TempPass123!`

Both users must set a new password at first sign-in.

## Cognito notes

Set `AUTH_MODE=cognito` and configure:

- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`

If you want to persist team/role in Cognito custom attributes, set:

- `COGNITO_USE_CUSTOM_ATTRS=true`

and create custom attributes in your User Pool first:

- `custom:team`
- `custom:role`

## Frontend wiring

`index.html` now sets:

```html
<script>
  window.FC_AUTH_MODE = "api";
  window.FC_AUTH_API_BASE = "http://localhost:8080";
</script>
```

Update `FC_AUTH_API_BASE` to your deployed backend URL when hosting.

