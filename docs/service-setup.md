# External Service Setup — three-match-dots

Tracks 3rd-party integrations. Owner account: chris.pham124@gmail.com (GitHub: chrisph124).

> **Secret-handling rule:** client-embeddable keys (Sentry DSN, PostHog project key) may live in
> app config / `EXPO_PUBLIC_*` env. CI/server tokens (e.g. Sentry source-map auth token) go ONLY in
> GitHub Actions secrets or EAS secrets — **never committed**.
>
> **Code quality** is handled by `eslint-plugin-sonarjs` (SonarLint rules, local + CI) — no SonarCloud SaaS.

## Status

| Service | State | Wiring |
|---------|-------|--------|
| Sentry | Not started | at scaffold (SDK init needs app code) |
| PostHog | Not started | at scaffold (SDK init needs app code) |

> **SonarCloud removed (2026-06-17).** Decided redundant for a v1 game — `eslint-plugin-sonarjs` already
> gives the same SonarLint rules free. **External cleanup (owner):** delete the `three-match-dots` project
> in SonarCloud and revoke the exposed token.

## Sentry (deferred to scaffold)

- Create a **React Native** project in Sentry → copy the **DSN** (client-embeddable).
- Wiring: `@sentry/react-native` init in app entry; DSN via `EXPO_PUBLIC_SENTRY_DSN` env / `app.config`.
- Source maps upload via EAS / Sentry CLI (auth token = EAS secret, not committed).

## PostHog (deferred to scaffold)

- Create a project in PostHog → copy the **project API key** + note the **region** (US or EU — GDPR posture).
- Wiring: `posthog-react-native` init in app entry; key via `EXPO_PUBLIC_POSTHOG_KEY` + host env.
- Privacy: drives App Store Privacy Labels + Google Play Data Safety disclosures.
