# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Codex, Cursor, and others) when working with code in this repository. `CLAUDE.md` only imports this file, so edit this one.

## Language — English only, no Turkish anywhere

- Use English for all agent responses, plans, explanations, code comments, documentation, identifiers, UI copy, error messages, logs, prompts, test descriptions, fixtures, commit messages, and PR text.
- Do not write Turkish anywhere in this project or in communications about it, even when the request or source material is in Turkish. Translate any Turkish prose encountered in files you edit into English.
- Apply this rule across the whole repository, including Markdown guidance and task-specific skill output.

## Guidance and source of truth

- Keep project-wide rules in `AGENTS.md`; keep `CLAUDE.md` as its import rather than maintaining a second copy.
- `README.md` describes the project and local setup. Keep its behavior claims aligned with the code.
- `.agents/skills/` contains reusable Firebase and Genkit skills and reference material. Use the relevant skill for its task; keep project-specific conventions here.
- Local `docs/superpowers/` and `.superpowers/sdd/` files are dated plans and execution records. Verify their claims against current code; they may describe superseded implementations.
- Inspect the current branch and working tree before editing, and preserve unrelated changes. Update this guidance when architecture or commands change.

## Project memory (MemPalace)

Decisions, findings, and open work for this project live in **MemPalace** (MCP server), wing `fitnesschronicleapp`. Rooms mirror code directories (`functions`, `app`, `lib`, `types`) plus `general`. Use it actively:

1. **At session start, pull context.** Search MemPalace for the topic of the first request and the current branch's work before answering.
2. **Look there first.** Search MemPalace before reading code or docs, and before saying something isn't recorded. Prefer curated drawers in wing `fitnesschronicleapp` over the `sessions` wing (raw transcripts, many duplicates). Drawers are point-in-time, so verify file:line claims against the current code.
3. **Write updates there as they happen.** Decisions, findings, finished to-dos, corrections: check for a duplicate first, then add a drawer or update the one that already covers it.

**RevenueCat to-do list:** drawer `drawer_fitnesschronicleapp_general_863cb973eee151f9b7885c9c`. Mention open items only when the user's question relates to one of them. When an item is done, move it to ALREADY DONE with its commit hash.

If MemPalace is unavailable, say so rather than silently skipping it, then investigate the current client's MCP registration and server health. A Claude Code plugin installation does not register the server in Codex: verify `mempalace` in `codex mcp list` and the user-level `~/.codex/config.toml`. Use the existing palace rather than initializing an empty replacement. Do not claim a memory search or update succeeded when it could not run.

When Claude Code and Codex use the same local palace concurrently, use one shared loopback hub (`mempalace serve --host 127.0.0.1 --port 8765`). Their stdio MCP connections automatically forward to a live registered hub. A direct server in another client can hold the palace's writer lock and block saves; check the owning process before restarting it. Do not bypass the single-writer protection or create a replacement palace to work around it.

## Commands

```bash
# Install app and server dependencies separately
npm ci
npm --prefix functions ci

# Start development server (live Firebase unless the emulator flag is set)
npm start

# Start Auth, Firestore, Functions, server compiler watcher, and Expo together
npm run dev:emu

# Start just the Firebase emulators
npm run emulators

# Run on specific platform
npx expo run:ios
npx expo run:android

# Lint
npm run lint

# App typecheck
npx tsc --noEmit

# Regenerate native code after native dependency changes (replaces native dirs)
npx expo prebuild --clean

# Production builds via EAS
eas build --platform ios --profile production
eas build --platform android --profile production

# Tests (jest-expo)
npm test
npm run test:watch

# Server checks (separate TypeScript project and Vitest runner)
npm --prefix functions run typecheck
npm --prefix functions run build
npm --prefix functions run test:unit
npm --prefix functions test

# Integration tests alone: build first; this command starts the emulators
npm --prefix functions run test:integration

# Seed a paid plan for an existing emulator Auth user while emulators are running
npm --prefix functions run seed:plan -- <uid> pro yearly
```

Use a native development build for React Native Firebase; Expo Go does not include these native modules. The server targets Node 22. Emulator scripts require the Firebase CLI on `PATH` and Java 21+; `scripts/emulators.sh` selects an installed macOS JDK 21+ when available.

`functions/.secret.local` supplies `GEMINI_API_KEY` to the local Functions emulator. Guard-only integration tests use a throwaway value (see `.github/workflows/functions.yml`); actual coach conversations need a real Gemini key. Keep this file and `.env*.local` out of Git.

Run checks appropriate to the files changed. Root Jest excludes `functions/`; backend checks must run separately. Integration tests use `demo-hercule` and must run through `test:integration`, which sets emulator hosts. Stop the development emulators first if their ports conflict. Keep Vitest test files sequential because they share emulator state.

## Architecture

**Hercule** is a React Native fitness tracker built with Expo SDK 54, React Native 0.81, React 19, Expo Router (file-based routing), React Native Firebase (auth + Firestore + Cloud Functions), TanStack Query (server state, persisted to AsyncStorage), NativeWind (Tailwind CSS for RN), and an AI coach backed by Genkit running on Cloud Functions.

The mobile app and `functions/` have separate package manifests, lockfiles, TypeScript configurations, and test runners. App imports use `@/`; server imports use relative paths with `.js` extensions for NodeNext resolution.

### Provider hierarchy (`app/_layout.tsx`)

```
AuthProvider                 ← Firebase auth state + signOut/deleteAccount
  ConnectivityProvider       ← NetInfo online/offline detection
    PersistQueryClientProvider ← TanStack Query cache, persisted to AsyncStorage
      BottomSheetModalProvider ← @gorhom/bottom-sheet portal host
        ThemeProvider         ← Navigation light/dark theme inside AppSetup
          Stack.Protected     ← Guards (tabs), (screens), offline behind isAuthenticated
```

Inside `(tabs)/_layout.tsx`, tab screens are additionally wrapped in `ChatProvider` → `ActiveProgramProvider` (AI chat state and the user's active program, both scoped to the authenticated tab bar).

### Route structure (`app/`)

| Route | Purpose |
|---|---|
| `index.tsx` | Splash / auth redirect |
| `signin.tsx` | Sign-in screen |
| `(tabs)/` | Main tab bar: Home (`index`), AI coach (`ai`), Calendar (`calendar`), Profile (`profile`) |
| `(screens)/onboarding/` | Profile setup (name, birthday, gender, measurement unit), minimum-age validation, analytics consent |
| `(screens)/logExercise/` | Log a new exercise |
| `(screens)/editExercise/` | Edit an existing exercise log |
| `(screens)/createProgram/` | Create a workout program template |
| `(screens)/editProgram/` | Edit an existing program |
| `(screens)/settings/` | Plan/AI usage card, profile, analytics consent, measurement and rep preferences |
| `(screens)/deleteAccount/` | Account deletion flow |
| `offline/` | Offline home screen + offline `logExercise`, queued via AsyncStorage |

### Data layer (`lib/firebase/`)

Client data helpers live in `lib/firebase/`; auth state is managed in `context/AuthContext.tsx`, and server Admin SDK access lives in `functions/src/data/`. Most client data files map to a Firestore subcollection under `users/{uid}/`:

| File | Subcollection | Responsibility |
|---|---|---|
| `exercise.ts` | `fitnessLogs`, `exerciseNames` | CRUD for exercise logs; streak tracking on add; `syncOfflineExercises()` |
| `label.ts` | `labels`, `dayAssignments` | Workout day labels (e.g. Push/Pull/Legs) and date assignments |
| `program.ts` | `programs` | Workout program templates |
| `streaks.ts` | `users` root doc | Weekly streak read/write helpers |
| `user.ts` | `users` root doc | User settings (measure: kg/lbs) + user profile |
| `weight.ts` | `weightLogs` | Body weight tracking entries |
| `account.ts` | — | Account deletion; walks and deletes every subcollection (Firestore doesn't cascade) |
| `credentials.ts` | — | Google/Apple sign-in credential helpers, shared by sign-in and reauthentication |
| `emulators.ts` | — | Development-only SDK connection setup, imported first by the root layout |

Validate domain documents with Zod schemas in `types/types.ts`. Document schemas have `WithId` variants where a Firestore document ID is needed (e.g. `ExerciseLogWithIdSchema`); scalar and settings schemas do not all have one. Server equivalents live in `functions/src/data/schemas.ts` and request/response schemas in `functions/src/types.ts`; keep shared shapes aligned when changing them.

Reuse query keys from `constants/QueryKeys.ts` and invalidate affected queries after mutations. AI usage query options are shared in `lib/ai/aiUsageQuery.ts` so chat, badges, and the settings plan card observe the same cache entry.

### AI coach (`lib/ai/`, `components/ai/`)

`lib/ai/coachServer.ts` calls a Cloud Function (`httpsCallable`, `europe-west2`) that runs the coach logic in Genkit server-side — no AI/model code runs on-device. It can return a chat `reply` and/or a proposed `program` (a draft `ProgramSchema`). `lib/programLabels.ts` reconciles an AI-proposed program's day labels against the user's existing labels (matching by `description`) before it's accepted. Chat state lives in `hooks/useChatBox.ts`, exposed app-wide via `ChatContext`. UI pieces (`ChatBubble`, `ChatComposer`, `ProgramProposalCard`, `SuggestionPills`, `UsageBar`, `TypingIndicator`, `CoachDisclaimer`) live in `components/ai/`.

### Cloud Functions (`functions/src/`)

- `index.ts` exports deployed callables (`ping`, `chatWithCoach`, `getUsagePercentage`) and background triggers. New deployed functions must be exported here.
- `ai/` holds Genkit setup, the coach flow, system prompt, user-data tools, formatting, and program draft conversion. Model configuration lives in `ai/genkit.ts`; the system instruction lives in `ai/prompt.ts`.
- Authenticate and validate callable input before checking quota and calling Gemini. Tools take the Firebase UID from verified server context, never request data or model-selected arguments; the Admin SDK bypasses Firestore rules.
- `quota/` enforces total-token allowances, headroom, a burst/refill bucket, usage periods, and entitlement expiry. `recordUsage` charges successful turns; rate-limit and allowance refusals share `resource-exhausted` and are distinguished by `details.reason`.
- `account/` initializes free usage on Auth creation and deletes server-only usage/customer documents on Auth deletion. `consent/` records analytics consent changes. `telemetry/` logs AI-turn metadata without message text.
- Keep `europe-west2` aligned with `constants/firebase.ts`, function/trigger region declarations, and `firebase.json`.

### Subscription and usage state

The shared tier vocabulary is `free | pro | max` in `types/types.ts` and `functions/src/quota/caps.ts`. `functions/src/revenuecat/` validates customer documents from the RevenueCat extension and transactionally syncs the current plan to `aiUsage/{uid}`. Customer documents belong in the top-level `revenuecatCustomers` collection.

`aiUsage`, `revenuecatCustomers`, and `consentEvents` are server-only top-level collections, denied to clients by `firestore.rules`. Never move them under the client-writable `users/{uid}` tree. Adding a user subcollection requires updating the deletion list in `lib/firebase/account.ts`.

`getUsagePercentage` and coach replies share the usage contract: `percentUsed`, `resetsAt`, `tier`, `activeUntil`, and `billingPeriod`. Expose percentages and dates to the app, not token counts, caps, or cost. Keep client fallback behavior for older responses and unknown tiers/periods. `useSubscriptionTier`, `constants/subscriptionTiers.ts`, `lib/planSummary.ts`, and `components/cards/PlanUsageCard.tsx` handle display.

Keep allowance refill (`periodEnd`) separate from paid access expiry (`entitlementExpiresAt`). Period arithmetic is UTC; a timer must never extend an entitlement. Billing-period display reads `_monthly`/`_yearly` or `:monthly`/`:yearly` at the end of product IDs.

The repository has server sync and plan UI, but no RevenueCat purchase SDK or paywall integration. Paid caps are marked provisional in `quota/caps.ts`; code presence does not prove subscriptions or the extension are live. Verify external configuration before making such claims.

### Analytics (`lib/analytics/`)

`client.ts` wraps Firebase Analytics (`logEvent`, `setCollectionEnabled`); `consent.ts` / `consentPrompt.ts` handle the opt-in consent flow during onboarding; `pendingSignUp.ts` flushes a queued sign-up event once consent is granted; `events.ts` centralizes event name/param constants.

Collection starts off in `firebase.json` (Android) and `app.config.js` (iOS), then follows the stored `users/{uid}.analyticsConsent` choice. Route tracking uses `hooks/useScreenTracking.ts`. Send app analytics through `lib/analytics/client.ts`, and keep event parameters free of message text and personal data. The current onboarding prompt is for analytics; do not infer a separate AI-consent gate from old comments or documentation.

### Offline support

`ConnectivityContext` monitors network state via NetInfo. `hooks/useServerErrorHandler.ts` offers navigation to `offline/` after network failures while offline; the splash's automatic offline redirect is currently commented out. Offline screens (home + `logExercise` only) persist exercises via AsyncStorage in `lib/offlineStorage.ts`. `syncOfflineExercises()` exists in `lib/firebase/exercise.ts`, but currently has no caller; automatic queue syncing on reconnect is not wired up. TanStack Query refetching on reconnect does not flush this separate queue.

### Local emulator workflow

`npm run dev:emu` runs `scripts/dev-emulators.sh`: it builds the server, starts Auth/Firestore/Functions, waits for readiness, starts the server compiler watcher, then starts Expo with `EXPO_PUBLIC_USE_EMULATORS=true`. Emulator/watcher output goes to `.emulators.log`; the Emulator UI is at `http://localhost:4000`. Shutdown exports data to `emulator-data/`, imported on the next start.

`lib/firebase/emulators.ts` must remain the first import in `app/_layout.tsx` so SDK connections happen before requests. It gates on `__DEV__` and the flag, discovers the host from Metro, and connects Auth `9099`, Firestore `8080`, and Functions `5001` in `europe-west2`. The old `EXPO_PUBLIC_USE_FUNCTIONS_EMULATOR` switch is superseded. Keep the current flag command-scoped rather than in `.env.local` so plain `npm start` stays live.

The persisted query cache has separate live/emulator keys; the native Firestore cache does not. Reinstall the dev app when switching hosts. Analytics and Crashlytics have no emulator, and the coach still calls Gemini. `seed:plan` writes a fake customer document for an existing emulator Auth UID so the real sync trigger applies the plan.

### Configuration and delivery

`app.config.js` holds the store-facing app version, plugins, Firebase config paths, and production/dev app identifiers selected by `APP_ENV`. `eas.json` defines build profiles and remote build numbering. Generated `ios/` and `android/` directories are ignored; persist native configuration through Expo config/plugins.

`.github/workflows/functions.yml` typechecks, builds, and tests the backend with Node 22 and Java 21; successful pushes to `main` deploy functions. `.github/workflows/release.yml` creates a draft GitHub release from `app.config.js`'s version. Mobile builds/submission use EAS separately. Keep documentation-only work local unless publishing is part of the user's request.


### Shared types (`types/types.ts`)

Infer domain types from Zod schemas with `z.infer<typeof SomeSchema>`. Key schemas: `ExerciseLogSchema`, `SetSchema` (discriminated union on `measure`: kg/lbs/time/distance/steps), `LabelSchema`, `DaySchema`, `ProgramSchema`/`ProgramDaySchema`, `WeightSchema`, `UserSettingsSchema`, `UserProfileSchema`, `SubscriptionTierSchema`, `ChatMessageSchema`. Prefer existing helpers in `lib/dateUtils.ts` for local workout dates and week calculations; keep server billing dates in UTC.

### Components (`components/`)

Organized by domain: `exercise/`, `calendar/`, `cards/`, `display/`, `modals/`, `lists/`, `auth/`, `ai/`, `ui/`. Shared primitives: `ThemedView`, `ThemedText`, `ThemedTextInput`, `ThemedBottomSheetTextInput` handle dark/light mode automatically. `ThemedBottomSheetModal` supplies `InsideBottomSheetContext`; consumers such as `AddLabelCard` and `LabelCard` select the appropriate input. `ThemedBottomSheetTextInput` itself always wraps Gorhom's `BottomSheetTextInput`.

### Styling

NativeWind (Tailwind) for styling. Use `ThemedView`/`ThemedText` for theme-aware containers and text. Color scheme via `useColorScheme` hook.

**CRITICAL — prefer `className` over `style` at all times.**

- Always use NativeWind `className` for layout, spacing, colors, typography, borders, and shadows.
- Only use the `style` prop when the value **cannot** be expressed as a Tailwind class — for example: dynamic numeric values computed at runtime (e.g. `paddingTop: topPadding`), runtime theme tokens from `Colors[theme]`, animated styles, shadow objects requiring JS values, or platform-specific values with no Tailwind equivalent.
- Never use `style` to set colors, font sizes, font weights, padding, margin, border radius, or flex properties that have a direct Tailwind class.
- **Never set `fontSize` or `lineHeight` manually via `style` on `ThemedText` (or any text).** Always use a Tailwind font-size class (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`) and `leading-*` for line height. The font-size scale is defined in `tailwind.config.js`.
- Only reach for `StyleSheet.create()` when there is a concrete reason it cannot be done with `className` or an inline `style`. Do not use it as a default pattern for new components.

**CRITICAL — always use colors from `constants/Colors.ts`.**

- Never hardcode hex values, RGB, or Tailwind color classes (e.g. `text-red-500`, `bg-blue-600`) for app colors.
- Always read the current theme with `const theme = useColorScheme() ?? "light"` and reference `Colors[theme].<token>` (e.g. `Colors[theme].highlight`, `Colors[theme].danger`).
- Available tokens: `text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`, `calendarMarker`, `secondary`, `tabBackGround`, `cardBackground`, `cardBorderColor`, `inputBackground`, `input`, `separator`, `mutedText`, `highlight`, `accentBlue`, `accentPurple`, `accentTeal`, `success`, `warning`, `danger`, `elevation`, `transparent`.
- Tailwind color classes are only acceptable for structural grays with no semantic meaning (e.g. `border-gray-200/50`) when no `Colors` token applies.
