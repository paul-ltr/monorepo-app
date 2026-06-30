# Google Business Profile — reviews (Could)

**Status:** `planned` (Could, M8). Pull/respond to Google reviews per site and
surface ratings in the CRM. Lowest priority.

## Manual actions still required

- [ ] Own/verify each laundromat's Business Profile location in Google.
- [ ] Create a Google Cloud project; **request access to the Business Profile
      APIs** — access is gated and **approval can take weeks**. Start early.
- [ ] Configure the **OAuth consent screen** + credentials (OAuth client).
- [ ] Store the OAuth client secret + refresh token in Secrets Manager
      `pilotage/<env>/gbp`.

## What it's used for

- Read reviews + ratings per `core.site` (matched to a GBP `location`).
- (Optional) post replies to reviews from the console.

## Setup outline

1. Google Cloud Console → new project → enable the Business Profile API(s).
2. APIs & Services → **request access** (fill the access form; wait for approval).
3. OAuth consent screen (External, with the needed scopes) → create OAuth client.
4. Run the OAuth flow once to get a long-lived refresh token; store it.

## Credentials / where they go

`pilotage/<env>/gbp` → `{ "client_id": "...", "client_secret": "...",
"refresh_token": "..." }`.

## Limits / contact

- Quotas are low by default and require justification to raise.
- Docs: <https://developers.google.com/my-business> · access requests go through
  the Google API access form (no direct sales contact).
