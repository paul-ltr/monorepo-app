# Amazon Cognito — auth

**Status:** `implemented` (the API's `AuthMiddleware` verifies Cognito access
tokens via `aws-jwt-verify`; a dev bypass exists for local work).

## Manual actions still required

- [ ] Create a Cognito **User Pool** per env (`infra/terraform` module `cognito`
      provisions it once applied).
- [ ] Create an **app client** (no secret for SPA; PKCE).
- [ ] Create the **groups** `owner`, `manager`, `accountant`, `technician`,
      `viewer`, `network_admin`.
- [ ] Put `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` / `COGNITO_REGION` in SSM
      (or env) for the API and `VITE_COGNITO_*` for the web.
- [ ] Decide MFA policy (optional TOTP recommended for owner/manager).

## What it's used for

Authentication for the operator console (M12). The web obtains tokens (Amplify
Auth or `oidc-client-ts`), sends the **access token** as `Authorization: Bearer`.
The API verifies it, then maps the Cognito `sub` → `core.app_user.cognito_sub`
→ tenant + roles + permissions (RBAC catalog in `@pilotage/shared`).

## Setup (console)

1. Cognito → User pools → Create. Sign-in = email. Region **eu-west-3**.
2. App integration → app client (public, PKCE; callback = the web origin).
3. Groups → create the six role groups above. On user signup/invite, add the
   user to the matching group; the app's `user_role` is the source of truth for
   fine-grained permissions, Cognito groups are coarse.
4. (Optional) Hosted UI for password reset flows.

## Credentials / where they go

No long-lived secret for a public SPA client. Store the **pool id** and **client
id** in SSM Parameter Store (`/pilotage/<env>/cognito/*`) — not secrets, but keep
them out of the repo. Local dev uses `AUTH_DEV_BYPASS=true` and needs neither.

## Dev bypass

With `AUTH_DEV_BYPASS=true` the API trusts header `x-dev-user` (a `cognito_sub`,
default `dev-sophie-diallo`, the seeded owner). **Never enable outside dev.**

## Contact / limits

- Support: AWS Support / <https://docs.aws.amazon.com/cognito/>.
- Limits: default 50 RPS on most user-pool APIs (raise via quota request). Token
  verification is local (JWKS cached), so it doesn't count against those.
