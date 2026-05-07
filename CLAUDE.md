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
```

No test suite is configured yet.

## Architecture

**Hercule** is a React Native fitness tracker built with Expo Router (file-based routing), Firebase (auth + Firestore), TanStack Query (server state), and NativeWind (Tailwind CSS for RN).

### Provider hierarchy (`app/_layout.tsx`)

```
AuthProvider            ← Firebase auth state + signOut/deleteAccount
  ConnectivityProvider  ← NetInfo online/offline detection
    QueryClientProvider ← TanStack Query cache
      Stack.Protected   ← Guards (tabs), (screens), offline behind isAuthenticated
```

### Route structure (`app/`)

| Route | Purpose |
|---|---|
| `index.tsx` | Splash / auth redirect |
| `signin.tsx` | Sign-in screen |
| `(tabs)/` | Main tab bar: Home, Calendar, Settings |
| `(screens)/logExercise/` | Log a new exercise |
| `(screens)/editExercise/` | Edit an existing exercise log |
| `(screens)/deleteAccount/` | Account deletion flow |
| `offline/` | Offline-mode equivalents of the main screens |

### Data layer (`lib/firebase/`)

All Firestore access lives in `lib/firebase/`. Each file maps to a Firestore subcollection under `users/{uid}/`:

| File | Subcollection | Responsibility |
|---|---|---|
| `exercise.ts` | `fitnessLogs`, `exerciseNames` | CRUD for exercise logs; streak tracking on add |
| `label.ts` | `labels` | Workout day labels (e.g. Push/Pull/Legs) |
| `program.ts` | `programs` | Workout program templates |
| `streaks.ts` | `users` root doc | Weekly streak read/write helpers |
| `user.ts` | `users` root doc | User settings (measure: kg/lbs) |
| `weight.ts` | `weightLogs` | Body weight tracking entries |

All returned documents are parsed through Zod schemas before use (defined in `types/types.ts`). Every schema has a `WithId` variant (e.g. `ExerciseLogWithIdSchema`) that appends the Firestore doc `id`.

### Offline support

`ConnectivityContext` monitors network state via NetInfo. When offline, the app routes to `offline/` screens. `lib/offlineStorage.ts` persists exercises via AsyncStorage. On reconnect, `syncOfflineExercises()` in `lib/firebase/exercise.ts` batches them to Firestore.

### Shared types (`types/types.ts`)

All domain types are Zod schemas — infer TypeScript types with `z.infer<typeof SomeSchema>`. Key schemas: `ExerciseLogSchema`, `SetSchema` (discriminated union on `measure`: kg/lbs/time/distance/steps), `LabelSchema`, `WeightSchema`, `UserSettingsSchema`.

### Components (`components/`)

Organized by domain: `exercise/`, `calendar/`, `cards/`, `display/`, `modals/`, `lists/`, `auth/`, `ui/`. Shared primitives: `ThemedView`, `ThemedText`, `ThemedTextInput` handle dark/light mode automatically.

### Styling

NativeWind (Tailwind) for styling. Use `ThemedView`/`ThemedText` for theme-aware containers and text. Color scheme via `useColorScheme` hook.
