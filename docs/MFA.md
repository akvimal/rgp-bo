# Two-step sign-in (authenticator app)

Every login can be asked for a 6-digit code from an authenticator app (Google Authenticator, Microsoft Authenticator, Authy and similar) after the password.
There is no SMS code and no "trust this device": the code is asked at every sign-in.

## The setting

`MFA_MODE` in the API's environment (`.env`, `.env.beta`, the tenant env file):

| Value | What happens |
|---|---|
| `required` (default) | Everyone links an app at their next sign-in, then uses it every time. |
| `optional` | Only people who linked an app are asked for a code; the rest sign in with the password alone. |
| `off` | No second step. Local development and the QA suite use this. |

The development compose file (`docker-compose.dev.yml`) and `api-v2/.env` default to `off`; the beta, production and tenant compose files default to `required`.

## What people see

1. Password, as before.
2. **First time:** a QR code to scan (or a key to type), then the first code from the app. The app is linked, ten **recovery codes** are shown once, and they are signed in.
3. **After that:** the 6-digit code at every sign-in. A recovery code (each works once) can be typed in its place.

## Lost phone

A manager opens Settings > Users, finds the person (the **Two-step** column shows *On*) and clicks the shield icon. That unlinks the app and their recovery codes; the person signs in with the password and links a new app. Who may do this follows who may edit that user (a Business Head within the business, a Site Admin for heads). Nobody resets their own: ask another manager.

If the only head of a business has lost their phone and their recovery codes, reset it in the database:

```sql
update app_user set mfa_enabled = false, mfa_secret = null, mfa_pending_secret = null, mfa_last_step = null,
       mfa_enrolled_at = null, mfa_recovery = '[]'::jsonb, mfa_failed_count = 0, mfa_locked_until = null
 where email = 'the-login@example.com';
```

## Safeguards

- The password step returns a 5-minute token that works for the code step only. It is signed with a key of its own, so it can never be used as a sign-in token.
- Five wrong codes in a row pause that person's sign-in for 5 minutes. A code that was already used is refused (no replay), and one phone clock a little off (30 seconds either way) is tolerated.
- The secret is stored encrypted (AES-256-GCM). The key is `MFA_ENC_KEY` if set, else derived from `JWT_KEY`. **Changing that key makes every linked app stop working**, so set `MFA_ENC_KEY` once and keep it.
- Recovery codes are stored as hashes only.
- Linking, failed codes, pauses, recovery-code use and resets are written to the audit log (`auth.mfa_*`).
- Changing a password no longer returns a token: signing in always goes through the login and its second step.

## Rolling out

1. Apply `sql/migrations/144_mfa.sql` (adds columns to `app_user`; rollback `144_rollback.sql`).
2. Deploy the API and the frontend together.
3. Optionally set `MFA_ENC_KEY` in the environment first.
4. Everyone links an app at their next sign-in. To roll it out gently, start with `MFA_MODE=optional`, then switch to `required`.

Scripts that sign in over the API with a password (for example `control-plane/scripts/smoke.sh`, the QA seed) need `MFA_MODE=off` on the API they use.

## Tests

`api-v2/src/modules/auth/mfa.service.spec.ts` (the code maths against the RFC 6238 test vector, the encryption, the token) always runs.
`mfa.integration.spec.ts` runs the real SQL against a scratch PostgreSQL when `MFA_TEST_DB_URL` is set. The scratch database needs an `app_user` table with `id` and `email`, and migration 144 applied. Never point it at real data.
