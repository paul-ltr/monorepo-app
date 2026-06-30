# Web Push — end-of-cycle notifications

**Status:** `planned`. PWA push so client-app users get a "your cycle is done"
notification (M3). Uses the standard Web Push protocol + VAPID (no vendor lock-in;
works on Chrome/Firefox/Edge and iOS 16.4+ for installed PWAs).

## Manual actions still required

- [ ] Generate a **VAPID key pair** (`npx web-push generate-vapid-keys`).
- [ ] Put the **private key** in Secrets Manager `pilotage/<env>/webpush`; the
      **public key** is shipped to the client as `VITE_VAPID_PUBLIC_KEY`.
- [ ] Set a contact `mailto:` for the VAPID `sub` claim.

## How it works

1. The client app's service worker (already scaffolded by `vite-plugin-pwa`)
   calls `pushManager.subscribe({ applicationServerKey: <public VAPID> })`.
2. The subscription (endpoint + keys) is stored server-side (tenant-scoped).
3. A cycle-end event (from the data repo via SQS) triggers a push from a Lambda
   using the private VAPID key (`web-push` npm lib) → the browser push service.

## Credentials / where they go

`pilotage/<env>/webpush` → `{ "vapid_private_key": "...", "vapid_subject":
"mailto:ops@…" }`. Public key is non-secret (client env var).

## Limits / notes

- Payloads ≤ ~4 KB; keep them small (title + body + deep link).
- No central rate limit, but respect user preferences (`core` notification prefs)
  and quiet hours. iOS requires the PWA to be **installed** to receive push.

## Contact

No vendor — it's an open standard. Browser push services (FCM/Mozilla/Apple) are
transparent to VAPID. MDN: <https://developer.mozilla.org/docs/Web/API/Push_API>.
