# cognito module

User pool (email sign-in, strong password policy, optional TOTP MFA), a public
PKCE app client for the SPA, the six role groups (owner/manager/accountant/
technician/viewer/network_admin), and an optional hosted-UI domain. Groups are
coarse role hints; fine-grained permissions live in `core.user_role` + the RBAC
catalog in `@pilotage/shared`. Outputs `user_pool_id`, `user_pool_client_id`,
`user_pool_arn` (→ SSM for the API/web).
