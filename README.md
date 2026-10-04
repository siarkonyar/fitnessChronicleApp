<div align="center">

<h1><img src="assets/images/readme-header.svg" alt="Hercule" width="320"></h1>

**Log any exercise, build a streak you can see, and train with an AI coach that actually knows your history.**

![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020?logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20·%20Firestore%20·%20Functions-FFCA28?logo=firebase)
![Genkit](https://img.shields.io/badge/AI-Genkit%20%2B%20Gemini-4285F4?logo=googlegemini)
[![Version](https://img.shields.io/github/v/release/siarkonyar/fitnessChronicleApp?label=Version&color=success)](https://github.com/siarkonyar/fitnessChronicleApp/releases)
![License](https://img.shields.io/badge/License-Source--available-lightgrey)

[![Download on the App Store](https://img.shields.io/badge/Download-App%20Store-0D96F6?logo=appstore&logoColor=white)](https://apps.apple.com/app/id6755726344)
[![Get it on Google Play](https://img.shields.io/badge/Get%20it%20on-Google%20Play-414141?logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=com.siar.konyar.fitnessChronicle)

</div>

---

## What is Hercule?

Hercule is a workout tracker for people who are tired of apps that only understand barbells. **Every exercise is loggable** — a set can be weight × reps in kg or lbs, but it can equally be a duration, a distance, or a step count. The set schema is a discriminated union, so a plank, a 5 km run, and a bench press are all first-class entries rather than something you shoehorn into a "notes" field.

The second idea is **consistency you can see**. Days you train are marked on a calendar, tagged with your own labels (Push, Pull, Legs, whatever you use), and rolled into a weekly streak. Opening the app tells you where you are in the week before you've tapped anything.

The third is an **AI coach that isn't a generic chatbot**. It runs server-side on Cloud Functions with Genkit, and it reads your actual logs, labels, and programs through tool calls before it answers. It can draft a full workout program, which lands in the app as a proposal card you accept or reject — nothing is written to your account until you say yes. No model code runs on the phone.

It also has an **offline logging mode**. You can log exercises into a local AsyncStorage queue without a connection. A Firestore batch-sync helper exists, but automatic syncing of that queue on reconnect is not currently connected.

---

## Highlights

### Log anything, measured however it's actually measured

Sets are typed by their unit — `kg`, `lbs`, `time`, `distance`, or `steps` — and validated with Zod at the boundary. Pick your unit once in settings and the whole app follows it. Exercise names autocomplete from what you've logged before, so your history stays comparable instead of fragmenting into "Bench Press", "bench press", and "Bench".

### Programs, not just logs

Build reusable program templates with days, labels, exercises, and target rep ranges. Programs deliberately carry **no weights** — the numbers you're capable of change week to week, so a template that pins them goes stale immediately. Rep targets follow your rep-type preference. Start a program and the home screen knows which day is next.

### An AI coach with read access to your training

`lib/ai/coachServer.ts` calls a callable Cloud Function in `europe-west2`; everything else happens server-side in Genkit. The coach has tools for reading your exercise logs, labels, and programs, so "am I neglecting pull?" is answered from your data rather than guessed. When you accept a program proposal, its labels are reconciled against your existing labels by description. Usage is quota-gated per user and shown in-app with a usage bar. Coach messages and training data read by its tools are sent to Gemini; the current onboarding consent prompt covers analytics.

### Plan and allowance details

Settings shows your server-reported plan, AI usage percentage, allowance reset date, and paid access expiry when available. The server recognizes `free`, `pro`, and `max`, and includes code to sync RevenueCat customer documents into server-only usage records. The app does not yet include a RevenueCat purchase SDK or paywall, and paid allowance caps are provisional.

### A calendar that shows the shape of your training

Every logged day is marked. Tap a date to see exactly what you did, tag days with emoji labels that render right on the calendar grid, and share a day as an image straight from the app. Weekly streaks are tracked on write, so the number is correct the moment you save.

### Local logging while offline

`ConnectivityProvider` watches the network with NetInfo. Network error handling offers a dedicated offline stack — home plus logging — that writes to AsyncStorage. `syncOfflineExercises()` can batch queued exercises to Firestore, but currently has no caller. Server state uses TanStack Query with AsyncStorage persistence and refetches on reconnect; this does not flush the separate exercise queue.

### Privacy handled explicitly

Analytics ships **off** and follows your stored choice on both platforms. Consent changes are recorded server-side. Account deletion reauthenticates first, removes the known subcollections under your user document, then deletes the Auth account. An Auth deletion trigger removes the top-level AI usage and RevenueCat customer records. Consent audit records are retained separately; deleting the account does not cancel a store subscription.

---

## Releases

[![Latest release](https://img.shields.io/github/v/release/siarkonyar/fitnessChronicleApp?label=latest&color=success)](https://github.com/siarkonyar/fitnessChronicleApp/releases/latest)
![Release date](https://img.shields.io/github/release-date/siarkonyar/fitnessChronicleApp?label=released)

Every version and its notes live on the **[Releases page](https://github.com/siarkonyar/fitnessChronicleApp/releases)** — that is the changelog, and the badges above track it on their own.

The version that ships to the stores is `expo.version` in [`app.config.js`](app.config.js), and it is the single source of truth. Bumping it on `main` fires [`.github/workflows/release.yml`](.github/workflows/release.yml), which opens a **draft** release at `v<version>` pre-filled with generated notes. Editing and publishing that draft creates the tag and updates the badges here — so the README never needs a manual version edit.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| App | [Expo](https://expo.dev) SDK 54, React Native 0.81, React 19, TypeScript 5.9, New Architecture enabled |
| Routing | [Expo Router](https://docs.expo.dev/router/introduction/) — file-based, typed routes, `Stack.Protected` auth guards |
| Styling | [NativeWind 4](https://www.nativewind.dev/) (Tailwind CSS 3 for RN), theme tokens in `constants/Colors.ts`, automatic dark/light |
| Server state | [TanStack Query 5](https://tanstack.com/query) persisted to AsyncStorage |
| Validation | [Zod 4](https://zod.dev) — domain schemas and callable response validation |
| Backend | [Firebase](https://firebase.google.com) — Auth (Google + Apple Sign-In), Firestore, Cloud Functions, App Check, Crashlytics, Analytics |
| AI | [Genkit](https://genkit.dev) + Gemini on Cloud Functions (`europe-west2`), tool-calling over the user's own logs, per-user quota buckets |
| UI | [@gorhom/bottom-sheet](https://gorhom.dev/react-native-bottom-sheet/) 5, `react-native-reanimated` 4, `react-native-calendars`, `react-native-gifted-charts`, `expo-blur` |
| Offline | `@react-native-community/netinfo` + AsyncStorage exercise queue; Firestore sync helper exists, automatic flushing pending |
| Testing | `jest-expo` (app), `vitest` + Firebase Emulator Suite (functions: unit + integration) |
| Delivery | EAS Build & Submit, `expo-updates`, GitHub Actions for functions |

---

## Project layout

| Path | What lives there |
|---|---|
| `app/` | Expo Router routes — `(tabs)` (home, AI, calendar, profile), `(screens)` (logging, programs, settings, onboarding), `offline/` |
| `lib/firebase/` | Client data helpers, sign-in credentials, account deletion, emulator connections |
| `lib/ai/` | Client-side bridge to the coach Cloud Function |
| `functions/src/` | Genkit coach, data tools, quota/period rules, RevenueCat sync, account/consent triggers, telemetry |
| `types/types.ts` | App domain Zod schemas, with `WithId` variants for document-backed entities |
| `components/` | Organized by domain — `exercise/`, `calendar/`, `ai/`, `modals/`, `cards/`, `ui/` |
| `context/` | Auth, connectivity, chat, and active-program providers |
| `constants/` | Theme tokens, query keys, Firebase region, rep ranges, and tier display definitions |
| `scripts/` | Local emulator lifecycle and combined Expo/server development workflow |
| `.agents/skills/` | Reusable Firebase and Genkit agent skills and references |

Project-wide agent rules and architecture guidance live in [AGENTS.md](AGENTS.md); [CLAUDE.md](CLAUDE.md) imports that same file. All project contributions and agent communications must be in English; Turkish is prohibited throughout the project.

---

## Running it locally

Use Node 22 for the server, an Xcode or Android Studio toolchain for native builds, and Java 21+ plus a Firebase CLI on `PATH` for emulators. React Native Firebase requires a native development build; Expo Go cannot run these modules. The committed `GoogleService-Info.plist` and `google-services.json` target this project's backend; use your own Firebase configuration when developing independently.

```sh
git clone https://github.com/siarkonyar/fitnessChronicleApp.git
cd fitnessChronicleApp
npm ci
npm --prefix functions ci     # separate backend dependency tree
npx expo prebuild --clean     # native dirs; re-run after native dep changes
npx expo run:ios              # or: npx expo run:android
```

```sh
# Tests
npm test                      # app (jest-expo)
npm --prefix functions test   # build + Vitest unit and emulator integration tests

# Typechecks
npx tsc --noEmit
npm --prefix functions run typecheck

# Lint
npm run lint
```

Backend tests run separately from app Jest. Integration tests use the `demo-hercule` project via `npm --prefix functions run test:integration`; build the server first when running that command alone. Stop development emulators before starting integration tests to avoid port conflicts. Follow [the backend CI workflow](.github/workflows/functions.yml) for the throwaway `GEMINI_API_KEY` value in the gitignored `functions/.secret.local` used by guard-only tests. Real coach conversations require a real key.

### Running the dev build against fake Firebase (emulators)

You can run the whole app against the Firebase Emulator Suite instead of the live project. This lets you try backend changes without deploying, and test data never touches real accounts.

```sh
npm run dev:emu               # emulators + functions watcher + Expo, in one command
```

This command:

1. Builds `functions/` and starts the **Auth, Firestore and Functions** emulators ([`scripts/emulators.sh`](scripts/emulators.sh)). It picks an installed JDK 21+ automatically.
2. Waits until the log says `All emulators ready`, then starts `tsc --watch` in `functions/`, so server edits reload when you save.
3. Starts Expo in the foreground with `EXPO_PUBLIC_USE_EMULATORS=true`. Expo's keys (`r`, `j`, …) work as usual.

Emulator and watcher output goes to `.emulators.log`. Function logs also show in the Emulator UI at <http://localhost:4000>. Pressing **Ctrl+C** in Expo stops everything and saves the fake data to `emulator-data/`. The next start loads it again, so test accounts and logs survive restarts. Both paths are gitignored.

Plain `npm start` still talks to the **live** project. The flag is only set by `dev:emu`, never in `.env.local`.

**How the app switches over.** [`lib/firebase/emulators.ts`](lib/firebase/emulators.ts) is imported first in `app/_layout.tsx`, because the Firebase SDKs only accept an emulator before their first request. When the flag is on, it connects Auth (`9099`), Firestore (`8080`) and Functions (`5001`, the `europe-west2` instance) to the machine Metro is served from. That means it works in the simulator and on a physical phone on the same Wi-Fi. `firebase.json` binds the emulators to `0.0.0.0` for this reason. The switch is also gated on `__DEV__`, so a release build can never use it. Emulator mode gets its own TanStack Query cache key, so live and fake data never mix in the persisted cache.

**Giving a test user a paid plan.** With the emulators running, take the user's uid from Emulator UI → Authentication and run:

```sh
npm --prefix functions run seed:plan -- <uid> [pro|max] [monthly|yearly]
```

The script writes the same `revenuecatCustomers/{uid}` document the RevenueCat extension would write. The real `onRevenueCatCustomerWritten` trigger in the Functions emulator then applies the plan, so you are testing the same path a real purchase takes. The script refuses to run unless `FIRESTORE_EMULATOR_HOST` is set, so it can't write to production.

**Caveats**

- The AI coach still calls the real Gemini API. Put a key in `functions/.secret.local` as `GEMINI_API_KEY=...` (gitignored).
- Analytics and Crashlytics have no emulator.
- Reinstall the app when switching between live and emulators. The on-device Firestore cache is not separated by host.
- Google and Apple sign-in work against the Auth emulator. The accounts it creates are fake and live only in `emulator-data/`.

---

## Contributing

The source is public so you can read it, learn from it, and report what's broken. Given the license below, the most useful contributions are the ones that don't require me to relicense anything:

- **Bug reports** — open an [issue](https://github.com/siarkonyar/fitnessChronicleApp/issues) with your device, OS version, the app version from Settings, and steps to reproduce. Crash reports come in through Crashlytics, but they can't tell me what you were trying to do.
- **Feature ideas** — open an issue and describe the training problem, not just the UI you imagine. Hercule's scope is deliberately narrow.
- **Questions about the architecture** — issues are fine for these too.

**Pull requests** are welcome but please open an issue first so we can agree the change is wanted before you spend time on it. By opening a PR you agree your contribution is licensed to the project owner under the same terms as the rest of the repository.

If you do send code:

- Match the existing conventions in [AGENTS.md](AGENTS.md) — in particular, English only with no Turkish, NativeWind `className` over the `style` prop, and colors from `constants/Colors.ts` rather than hardcoded values.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, `chore:`).
- Add tests for behavior you change.

---

## License

**Source-available — all rights reserved.** Copyright © 2026 Siar Konyar. See [LICENSE](LICENSE).

The code is published for reading, reference, and learning. It is **not** open source: no permission is granted to use, copy, modify, or redistribute it, and in particular not to build or publish a derivative app. If you want to do something with it, ask.

The **Hercule name, logo, and other brand assets** are not covered by any grant at all and remain reserved.
