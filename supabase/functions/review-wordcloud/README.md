# review-wordcloud (local preparation)

Authenticated POST accepts exactly `{propertyId: UUID}`. JWT gateway verification stays enabled. The handler verifies `/auth/v1/user`, rejects anonymous sessions, and calls `get_published_rental_reviews` in property mode with the caller JWT plus the Supabase anon key. No service role, raw review table or client-supplied review text is used.

The complete authorized corpus is scanned twice before Python and once after processing. Duplicate IDs, changed counts/revisions/text, incomplete pages, denied reads or a changed session fail closed. Python responses are validated and restricted to corpus-bound terms/matches. Nothing is persisted or cached; responses use `Cache-Control: no-store`.

## Deployment dependencies (not executed)

1. Features branch: publish `main.py`, `wordcloud_api.py`, existing `review-wordcloud/src/processor.py` and `stopwords.json` together through the existing Python service. No requirements/model changes. Confirm Render uses this repository's `main:app` entry point; no Render start configuration is tracked here.
2. Configure a newly generated server-only `NLP_SHARED_SECRET` on Python and this Edge Function, different from `ML_SHARED_SECRET`. Preserve all existing ML secrets. Configure Edge `NLP_API_URL=https://rentlease-ml.onrender.com`; built-in `SUPABASE_URL` and `SUPABASE_ANON_KEY` are reused. No secret values in source or mobile environment.
3. After separate authorization, deploy only `review-wordcloud` with JWT verification enabled. No SQL migration, history repair, existing prediction Edge deployment or new paid service is needed.
4. Verify Python missing/wrong-secret denial, caller-JWT property authorization, complete approved corpus, mid-request moderation rejection, and `/health`/`/predict` regressions with authorized existing test scope. Release frontend only after the complete path passes hosted acceptance.

Python route: protected `POST /wordcloud`. Single NLP computation per process; request-local index reuse only. Limits: 10,020 rows (RPC offset ceiling), 500,000 text characters/UTF-16 units at Edge, 4 MiB processor input, 8 MiB processor response, 55-second Edge timeout. Limit breaches reject the whole request, never truncate frequencies. Per-instance Edge concurrency guards are not distributed rate limiting. Shared-host CPU/load acceptance remains required before release.

No transactional corpus snapshot or instant cross-device revocation is supplied by T7A. Post-processing revalidation closes ordinary mid-request changes, but a change immediately after the final scan can remain visible until foreground/selection/refresh or the 60-second active refresh. The app clears cloud state during refresh/background and rejects mismatched corpus versions. Original text is unchanged; lexical contact filtering is not PII redaction.
