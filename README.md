# three-match-dots

A **Two Dots**-style mobile puzzle game — link adjacent same-color dots, close a
2x2 loop to clear a color, chase a high score. iOS first, built with React
Native + Expo.

## Prerequisites

- Node.js + npm
- Xcode (iOS simulator/device builds), Android Studio (Android, later)
- This app uses [Skia](https://shopify.github.io/react-native-skia/), which
  needs native code, so it runs in an **Expo dev client**, not Expo Go.
  Expo Go will NOT work — build and install the dev client first.

## Commands

- `npm install` — install dependencies
- `npm start` — start Metro for the dev client (`expo start --dev-client`)
- `npm run ios` — build + run the dev client on iOS (`expo run:ios`)
- `npm run android` — build + run the dev client on Android
- `npm run lint` — ESLint (incl. sonarjs, no-any)
- `npm run typecheck` — `tsc --noEmit` (strict)
- `npm test` — Vitest (pure-TS core in `src/core/`)
- `npm run test:watch` — Vitest watch mode

## Learn more

Start at **[`docs/project-bible.md`](docs/project-bible.md)** — the docs index that routes to every
concern (design, creative, technical, security, levels, compliance, process). See `CLAUDE.md` for
architecture, tech stack, and team workflow.
