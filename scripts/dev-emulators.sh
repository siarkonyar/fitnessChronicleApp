#!/bin/bash
# One command to run the dev build against fake Firebase:
#   1. Auth, Firestore and Functions emulators (scripts/emulators.sh)
#   2. the functions compiler in watch mode, so server edits reload on save
#   3. Expo, with the app switched to the emulators
#
# 1 and 2 run in the background and write to .emulators.log; function logs are
# also in the Emulator UI (http://localhost:4000 → Logs). Expo stays in the
# foreground, so its keys (r, j, …) work as usual. Quitting Expo with Ctrl+C
# stops everything and saves the fake data.
set -euo pipefail
cd "$(dirname "$0")/.."

LOG_FILE=.emulators.log
READY_MARKER="All emulators ready"
READY_TIMEOUT_SECONDS=180

# Gives each background job its own process group, so Ctrl+C in Expo reaches
# only Expo. That matters: the emulators must get exactly ONE stop signal — a
# second one makes firebase-tools quit without saving the fake data.
set -m

: >"$LOG_FILE"
sh ./scripts/emulators.sh >>"$LOG_FILE" 2>&1 &
EMULATORS_PID=$!
WATCHER_PID=""

stop_background() {
  trap - EXIT INT TERM

  if [ -n "$WATCHER_PID" ]; then
    kill -TERM -- "-$WATCHER_PID" 2>/dev/null || true
  fi

  if kill -0 "$EMULATORS_PID" 2>/dev/null; then
    echo "Stopping the emulators and saving the fake data…"
    kill -TERM "$EMULATORS_PID"
    wait "$EMULATORS_PID" 2>/dev/null || true
  fi
}
trap stop_background EXIT
trap 'stop_background; exit 130' INT TERM

wait_for_emulators() {
  echo "Starting fake Firebase (log: $LOG_FILE)…"

  for ((second = 0; second < READY_TIMEOUT_SECONDS; second++)); do
    if grep -q "$READY_MARKER" "$LOG_FILE"; then
      return 0
    fi
    if ! kill -0 "$EMULATORS_PID" 2>/dev/null; then
      echo "The emulators failed to start. Last lines of $LOG_FILE:" >&2
      tail -n 15 "$LOG_FILE" >&2
      return 1
    fi
    sleep 1
  done

  echo "The emulators were not ready after ${READY_TIMEOUT_SECONDS}s, see $LOG_FILE." >&2
  return 1
}

wait_for_emulators

# Started only now: emulators.sh has just done a full build, and a watcher
# running alongside it would compile the same files twice.
npm --prefix functions run build:watch -- --preserveWatchOutput >>"$LOG_FILE" 2>&1 &
WATCHER_PID=$!

echo "Fake Firebase is up. Emulator UI: http://localhost:4000"

# Set here rather than in .env.local, so plain `npm start` stays on the live
# project. A variable already in the environment wins over the .env files.
EXPO_PUBLIC_USE_EMULATORS=true npx expo start -c "$@"
