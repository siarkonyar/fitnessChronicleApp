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

**CRITICAL — prefer `className` over `style` at all times.**

- Always use NativeWind `className` for layout, spacing, colors, typography, borders, and shadows.
- Only use the `style` prop when the value **cannot** be expressed as a Tailwind class — for example: dynamic numeric values computed at runtime (e.g. `paddingTop: topPadding`), shadow objects requiring JS values, or platform-specific values with no Tailwind equivalent.
- Never use `style` to set colors, font sizes, font weights, padding, margin, border radius, or flex properties that have a direct Tailwind class.
- **Never set `fontSize` or `lineHeight` manually via `style` on `ThemedText` (or any text).** Always use a Tailwind font-size class (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`) and `leading-*` for line height. The font-size scale is defined in `tailwind.config.js`.
- Only reach for `StyleSheet.create()` when there is a concrete reason it cannot be done with `className` or an inline `style`. Do not use it as a default pattern for new components.

**CRITICAL — always use colors from `constants/Colors.ts`.**

- Never hardcode hex values, RGB, or Tailwind color classes (e.g. `text-red-500`, `bg-blue-600`) for app colors.
- Always read the current theme with `const theme = useColorScheme() ?? "light"` and reference `Colors[theme].<token>` (e.g. `Colors[theme].highlight`, `Colors[theme].danger`).
- Available tokens: `text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`, `calendarMarker`, `secondary`, `tabBackGround`, `cardBackground`, `cardBorderColor`, `inputBackground`, `input`, `separator`, `mutedText`, `highlight`, `accentBlue`, `success`, `warning`, `danger`, `elevation`, `transparent`.
- Tailwind color classes are only acceptable for structural grays with no semantic meaning (e.g. `border-gray-200/50`) when no `Colors` token applies.
