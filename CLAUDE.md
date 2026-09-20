# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server
npx expo start

# Run on specific platform
npx expo run:ios
npx expo run:android

# Lint
npx expo lint

# Rebuild native code (after native dependency changes)
npx expo prebuild --clean

# Production builds via EAS
eas build --platform ios --profile production
eas build --platform android --profile production

# Tests (jest-expo)
npm test
npm run test:watch
```

## Architecture

**Hercule** is a React Native fitness tracker built with Expo Router (file-based routing), Firebase (auth + Firestore + Cloud Functions), TanStack Query (server state, persisted to AsyncStorage), NativeWind (Tailwind CSS for RN), and an AI coach backed by Genkit running on Cloud Functions.

### Provider hierarchy (`app/_layout.tsx`)

```
AuthProvider                 ← Firebase auth state + signOut/deleteAccount
  ConnectivityProvider       ← NetInfo online/offline detection
    PersistQueryClientProvider ← TanStack Query cache, persisted to AsyncStorage
      BottomSheetModalProvider ← @gorhom/bottom-sheet portal host
        Stack.Protected       ← Guards (tabs), (screens), offline behind isAuthenticated
```

Inside `(tabs)/_layout.tsx`, tab screens are additionally wrapped in `ChatProvider` → `ActiveProgramProvider` (AI chat state and the user's active program, both scoped to the authenticated tab bar).

### Route structure (`app/`)

| Route | Purpose |
|---|---|
| `index.tsx` | Splash / auth redirect |
| `signin.tsx` | Sign-in screen |
| `(tabs)/` | Main tab bar: Home (`index`), AI coach (`ai`), Calendar (`calendar`), Profile (`profile`) |
| `(screens)/onboarding/` | Post-signup profile setup (birthday, gender, measurement unit) |
| `(screens)/logExercise/` | Log a new exercise |
| `(screens)/editExercise/` | Edit an existing exercise log |
| `(screens)/createProgram/` | Create a workout program template |
| `(screens)/editProgram/` | Edit an existing program |
| `(screens)/settings/` | Account settings, analytics consent, measurement unit |
| `(screens)/deleteAccount/` | Account deletion flow |
| `offline/` | Offline home screen + offline `logExercise`, queued via AsyncStorage |

### Data layer (`lib/firebase/`)

All Firestore/Auth access lives in `lib/firebase/`. Most files map to a Firestore subcollection under `users/{uid}/`:

| File | Subcollection | Responsibility |
|---|---|---|
| `exercise.ts` | `fitnessLogs`, `exerciseNames` | CRUD for exercise logs; streak tracking on add; `syncOfflineExercises()` |
| `label.ts` | `labels` | Workout day labels (e.g. Push/Pull/Legs) |
| `program.ts` | `programs` | Workout program templates |
| `streaks.ts` | `users` root doc | Weekly streak read/write helpers |
| `user.ts` | `users` root doc | User settings (measure: kg/lbs) + user profile |
| `weight.ts` | `weightLogs` | Body weight tracking entries |
| `account.ts` | — | Account deletion; walks and deletes every subcollection (Firestore doesn't cascade) |
| `credentials.ts` | — | Google/Apple sign-in credential helpers, shared by sign-in and reauthentication |

All returned documents are parsed through Zod schemas before use (defined in `types/types.ts`). Every schema has a `WithId` variant (e.g. `ExerciseLogWithIdSchema`) that appends the Firestore doc `id`.

### AI coach (`lib/ai/`, `components/ai/`)

`lib/ai/coachServer.ts` calls a Cloud Function (`httpsCallable`, `europe-west2`) that runs the coach logic in Genkit server-side — no AI/model code runs on-device. It can return a chat `reply` and/or a proposed `program` (a draft `ProgramSchema`). `lib/programLabels.ts` reconciles an AI-proposed program's day labels against the user's existing labels (matching by `description`) before it's accepted. Chat state lives in `hooks/useChatBox.ts`, exposed app-wide via `ChatContext`. UI pieces (`ChatBubble`, `ChatComposer`, `ProgramProposalCard`, `SuggestionPills`, `UsageBar`, `TypingIndicator`, `CoachDisclaimer`) live in `components/ai/`.

### Analytics (`lib/analytics/`)

`client.ts` wraps Firebase Analytics (`logEvent`, `setCollectionEnabled`); `consent.ts` / `consentPrompt.ts` handle the opt-in consent flow (asked once, post-onboarding); `pendingSignUp.ts` flushes a queued sign-up event once consent is granted; `events.ts` centralizes event name/param constants.

### Offline support

`ConnectivityContext` monitors network state via NetInfo. When offline, the app routes to `offline/` screens (home + `logExercise` only). `lib/offlineStorage.ts` persists exercises via AsyncStorage. On reconnect, `syncOfflineExercises()` in `lib/firebase/exercise.ts` batches them to Firestore.

### Shared types (`types/types.ts`)

All domain types are Zod schemas — infer TypeScript types with `z.infer<typeof SomeSchema>`. Key schemas: `ExerciseLogSchema`, `SetSchema` (discriminated union on `measure`: kg/lbs/time/distance/steps), `LabelSchema`, `ProgramSchema`/`ProgramDaySchema`, `WeightSchema`, `UserSettingsSchema`, `UserProfileSchema`, `ChatMessageSchema`.

### Components (`components/`)

Organized by domain: `exercise/`, `calendar/`, `cards/`, `display/`, `modals/`, `lists/`, `auth/`, `ai/`, `ui/`. Shared primitives: `ThemedView`, `ThemedText`, `ThemedTextInput`, `ThemedBottomSheetTextInput` handle dark/light mode automatically. `InsideBottomSheetContext` lets shared form primitives (like `ThemedBottomSheetTextInput`) detect when they're rendered inside a `@gorhom/bottom-sheet` modal and switch to its `BottomSheetTextInput` internally.

### Styling

NativeWind (Tailwind) for styling. Use `ThemedView`/`ThemedText` for theme-aware containers and text. Color scheme via `useColorScheme` hook.

**CRITICAL — prefer `className` over `style` at all times.**

- Always use NativeWind `className` for layout, spacing, colors, typography, borders, and shadows.
- Only use the `style` prop when the value **cannot** be expressed as a Tailwind class — for example: dynamic numeric values computed at runtime (e.g. `paddingTop: topPadding`), shadow objects requiring JS values, or platform-specific values with no Tailwind equivalent.
- Never use `style` to set colors, font sizes, font weights, padding, margin, border radius, or flex properties that have a direct Tailwind class.
- **Never set `fontSize` or `lineHeight` manually via `style` on `ThemedText` (or any text).** Always use a Tailwind font-size class (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`) and `leading-*` for line height. The font-size scale is defined in `tailwind.config.js`.
- Only reach for `StyleSheet.create()` when there is a concrete reason it cannot be done with `className` or an inline `style`. Do not use it as a default pattern for new components.

**CRITICAL — always use colors from `constants/Colors.ts`.**

- Never hardcode hex values, RGB, or Tailwind color classes (e.g. `text-red-500`, `bg-blue-600`) for app colors.
- Always read the current theme with `const theme = useColorScheme() ?? "light"` and reference `Colors[theme].<token>` (e.g. `Colors[theme].highlight`, `Colors[theme].danger`).
- Available tokens: `text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`, `calendarMarker`, `secondary`, `tabBackGround`, `cardBackground`, `cardBorderColor`, `inputBackground`, `input`, `separator`, `mutedText`, `highlight`, `accentBlue`, `accentPurple`, `accentTeal`, `success`, `warning`, `danger`, `elevation`, `transparent`.
- Tailwind color classes are only acceptable for structural grays with no semantic meaning (e.g. `border-gray-200/50`) when no `Colors` token applies.
