# Unit and integration test audit

Reviewed on 2026-10-05 against branch `test/cover`. Scope: app data/business logic, existing hooks and providers, server orchestration, Firebase access rules, and emulator-backed integration. Component interaction tests, native device behavior, and end-to-end journeys remain separate work.

## Assessment

The app's data-layer coverage was already broad. The main gaps were server success paths, asynchronous identity changes, multi-write failures, and sequences of subscription events. This audit added executable checks for those gaps and repaired seven production defects. The test infrastructure now matches the installed Expo SDK and preserves Firestore read-time snapshots.

The suites provide a strong foundation, but a green run does **not** mean every edge case is resolved: five tests currently assert still-broken behavior using `test.failing`. The body-weight migration regression has since been fixed; concurrent label assignment is the next repair.

## Verified results

| Suite | Before audit | After audit | Verification boundary |
| --- | ---: | ---: | --- |
| App unit | 653 / 31 suites | 672 / 34 suites | Real app logic; native services replaced |
| App integration | 92 / 6 suites | 136 / 7 suites | Real app helpers, Firebase SDK shims, emulator Auth/Firestore/Functions |
| Server unit | 98 / 7 suites | 232 / 15 suites | Pure logic, actual Genkit flow/tool validation, callable and trigger orchestration with external dependencies replaced |
| Server integration | 49 / 7 suites | 60 / 8 suites | Real callables/triggers and direct server readers/quota helpers against emulators |

The original audit totals included five expected-failing regressions; app integration included one. Server suites have no expected failures. The date suite also passed in UTC, Europe/London, Europe/Istanbul, America/New_York, America/Los_Angeles, Pacific/Auckland, and Asia/Kolkata (7 tests per zone).

App coverage of `lib/`, `hooks/`, `context/`, `constants/`, and `types/`: **97.97% lines, 95.19% statements, 89.40% branches, 98.33% functions**. These figures exclude test helpers and do not measure screens/components, server code, native modules, or correctness. Expected-failing tests also contribute coverage. No arbitrary coverage threshold was introduced.

App and server TypeScript checks passed. Lint passed with two pre-existing warnings in `components/ErrorBoundary.tsx` and `components/cards/LabelCard.tsx`. Server build and both emulator suites passed. Local verification used Node 24; committed CI selects the server's Node 22 target and Java 21. The new workflow itself has not been executed on GitHub.

## Coverage reviewed and strengthened

| Area | Evidence | Practical limit |
| --- | --- | --- |
| Exercise, label, program, weight, settings/profile CRUD | Existing unit and app integration suites cover absent documents, corrupt data, timestamps, exact date boundaries, merges, cascades, large histories, and ownership | Many operations span separate writes; happy-path coverage cannot make them atomic |
| Dates, streaks, program-day arithmetic | Existing boundary tests and seven-zone date runs | Mobile/Hermes locale and clock behavior still need native tests |
| Firestore authorization | New access matrix checks every known user subcollection: owner CRUD/list control, cross-user read/list/create/update/delete denial, signed-out write denial, mixed-owner batch rollback, and server-only collection list/update/delete denial | Rules enforce identity, not domain validation |
| Coach callable | Real `onCall.run` tests authenticate and validate before quota, prevent model calls on refusals/storage errors, charge successful total tokens, omit private content from telemetry, and compare chat/usage contracts | The success-path model boundary is deterministic; it does not call a deployed model |
| Coach flow and tools | Real Genkit registration/schema/context handling with generation mocked: recent history, message placement, UID spoofing, absent auth/preferences, inclusive ranges, impossible dates, proposal revisions, empty-text fallback, usage breakdown, provider/read failures | Prompt quality, provider/tool protocol changes, and actual SDK-reported usage remain outside these tests |
| Program drafts and formatting | New tests cover all measure suffixes, missing/zero values, multi-code-point glyphs, label pairing, training/rest days, malformed reps, picker overlap boundaries, preferred units, and stripping model-supplied weights | Glyph validation is permissive; program constraints remain those currently defined in code |
| Server training-data reads | New emulator checks cover newest 200 vs 201 rows, truncation, ascending output, corrupt-document skipping, absent ordering fields, newest-first labels/programs, empty collections, and user isolation | Label/program readers still fetch whole collections |
| Quota metering | Existing bucket/period/headroom/grace tests plus new emulator tests for atomic concurrent increments, missing documents, exact headroom cutoff, and concurrent period rollover followed by metering | Quota checking does not reserve tokens for an in-flight turn |
| Subscription sync | Existing first purchase, renewal, replay, expiry, sandbox, and invalid-customer checks plus an older/current purchase sequence in unit and emulator tests | Firebase customer-document tests do not verify the external RevenueCat extension or store purchases |
| Account and consent triggers | New tests verify signup race/error policies, deletion batching and retry, explicit consent transitions, absence/deletion/non-boolean values, and append failure behavior | Real trigger redelivery is not guaranteed to happen during any one emulator run |
| Analytics consent | New delayed-read tests exercise sign-out, account switch, unmount, and newer explicit choices | Native SDK collection timing is outside Node tests |
| Account query caches | New tests cover separate account/backend/signed-out keys, late results, owner-only persistence restoration, and refusal to restore legacy unscoped data | Native routing and account-switch rendering need later frontend/E2E checks |
| Test harness | Immutable document/query snapshot tests, nested data-copy isolation, batch rollback, SDK 54 Jest preset, app CI | The fake remains a small subset of Firestore; emulators remain necessary for query/transaction semantics |

## Defects repaired

1. **Shared account cache:** `app/_layout.tsx` reused one QueryClient and persistence key for every user. It now waits for auth initialization and remounts an account-specific query-provider subtree. `lib/queryCache.ts` scopes memory and persistence by UID and backend, including signed-out state. Old unscoped snapshots are no longer restored.
2. **Late consent reads:** a read started before sign-out or an account switch could re-enable collection afterward; a read could also overwrite a newer explicit choice. Hook cleanup and a consent revision check now suppress obsolete results.
3. **Subscription payment watermark:** an older purchase could move `lastPurchaseAt` backwards, making a replay of an already-counted payment look new. The watermark is now monotonic.
4. **Impossible server dates:** `Date.parse` normalized February 30 and non-leap February 29. Calendar-date round trips now validate the callable's date and tool ranges before reads.
5. **Missing reps in coach formatting:** a kg/lbs set without a `reps` property lost the unknown-reps marker. Formatting now selects reps by measure and consistently renders the missing value.
6. **Incomplete label deletion:** assignments absent from a label's denormalized `dates` array survived deletion. Cleanup now queries references by `labelId` and batches their deletion with the label.
7. **Orphan assignment deletion:** removing an assignment whose label was gone deleted the assignment and then threw. Cleanup now checks the label and batches any existing label update with assignment deletion.

8. **Interrupted body-weight conversion (follow-up):** weight entries now store `measure` alongside the numeric value. Chunk transactions read current documents and write each value/unit together, so retries cannot double-convert an entry. Both readers normalize mixed-unit history to the selected user unit; new entries capture their unit transactionally. Legacy entries without a unit use the current user setting until migrated. Unit regressions cover final-setting failure, a failed second chunk, retries, mixed/legacy histories, and opposing concurrent changes; emulator tests cover final-setting failure/retry and concurrent logging. The UI-facing weight shape is unchanged. Older app builds that ignore per-entry units cannot safely read a partially migrated history; release this reader/writer change together.

## Remaining regressions

| Priority | Reproduced condition | Test | Required direction |
| --- | --- | --- | --- |
| Medium | Two writers assign different labels to the same date after both read an empty assignment query. Random IDs create two owners; both labels retain the date | `lib/firebase/__tests__/label.test.ts`, `integration/labels.integration.test.ts` | Stable per-date identity and transactional ownership changes, with a compatibility/migration plan for existing random-ID assignments |
| Medium, previously deferred | Overlapping offline saves lose one exercise | `lib/__tests__/offlineStorage.test.ts` | Serialize read-modify-write storage operations before enabling offline mode |
| Low, previously deferred | `firestore/unavailable` is not recognized as the offline network error | `hooks/__tests__/useServerErrorHandler.test.tsx` | Normalize the native SDK's namespaced codes |
| Low, previously deferred | Opening the app with no signal reports an offline transition | `context/__tests__/ConnectivityContext.test.tsx` | Distinguish initial network state from entering offline mode |

The label integration regression gates both reads so it reproduces the race deterministically; writes and rule evaluation still use the real emulator. A `test.failing` passing in Jest means the defect was reproduced, not fixed. Remove the marker and its `FIXME:` together when implementing a repair.

## Other limits identified by code review

- **History cost:** `CoachRequestSchema` limits the new message but not each history text. Keeping only the newest 20 messages bounds their count, not their size. Add a history-text budget that accommodates legitimate model replies, and client trimming compatible with that budget.
- **Multiple-write recovery:** exercise logging commits the log before streak/name updates; label assignment commits its document before updating both labels. A later failure can return an error after part of the operation succeeded. Retries and error recovery need tests alongside an atomic/idempotent design.
- **Deletion consistency:** the repaired label deletion batches are atomic, but a query of references does not prevent a concurrent assignment from being created afterward. Account deletion covers the six known flat subcollections; arbitrary/deeper subcollections allowed by the rules are not recursively erased.
- **Quota concurrency:** simultaneous turns can pass using the same allowance balance. The token bucket bounds arrival rate, not a fixed number of in-flight requests as its comment currently claims. Delayed completions, a period boundary, or subscription changes during generation need a reservation/reconciliation policy. A successful chat response calculates percentage from its pre-turn snapshot, so concurrent replies can temporarily show stale usage.
- **Server document corruption:** quota reads cast timestamp fields and trust numeric counters. Malformed Admin-written state can still throw or produce invalid percentages. Finite/nonnegative counter handling and timestamp validation need an explicit fail-closed policy.
- **Native and local data:** account-scoped query snapshots remain persisted for returning users; account deletion currently does not explicitly erase those local snapshots. Native Firestore caches and AsyncStorage exercise/settings data require separate device tests and a local-erasure policy.
- **External integrations:** no real Gemini calls, RevenueCat store purchases, native Google/Apple prompts, App Check attestations, Crashlytics collection, or production deployment were tested.

These are limitations of the current implementation or test boundary, not claims that the suites fail today. Frontend/E2E work should start with sign-in/sign-out/account switching, cache restoration, consent timing, program acceptance, unit changes, and account deletion.

## Security-rules audit

The emulator access matrix verifies ownership and server-only protection. The existing rules still permit arbitrary fields, malformed own-account documents, and unknown own-account subcollections. No rules were tightened as part of this test audit.

```json
{
  "score": 4,
  "summary": "Verified ownership isolation and denial of client access to server-only collections; own-account domain validation and resource bounds remain permissive.",
  "findings": [
    {
      "check": "Type Safety / The Update Bypass",
      "severity": "minor",
      "issue": "Own-account creates and updates accept malformed values and arbitrary fields.",
      "recommendation": "Validate domain shapes for both create and update while preserving the client write paths."
    },
    {
      "check": "Storage Abuse",
      "severity": "minor",
      "issue": "Rules do not bound string or array sizes; server label/program reads also have no collection cap.",
      "recommendation": "Add appropriate field bounds and bounded server reads."
    },
    {
      "check": "Business Logic vs. Rules",
      "severity": "minor",
      "issue": "Unknown or nested own-account subcollections are writable and survive the app's fixed deletion list.",
      "recommendation": "Allow only modeled paths or use server-side recursive account cleanup."
    }
  ]
}
```

## Reproduction

```bash
npm test -- --runInBand
npm run test:tz
npm run test:integration -- --watchman=false
npx tsc --noEmit
npm run lint
npm --prefix functions run typecheck
npm --prefix functions test
```

Install root and `functions/` dependencies separately. Stop development emulators before integration runs. Emulator commands use `demo-hercule`; server-only integration requires a build first when run alone. Use Java 21+. The app integration script selects an installed macOS JDK when available; select the same JDK for the backend's direct emulator command if necessary.

App CI now runs unit, timezone, and integration checks. Backend CI also reacts to `firestore.rules` and `firebase.json` changes. Keep `jest-expo` on the SDK-compatible version recorded in Expo's bundled package recommendations. Generated coverage belongs outside Git.
