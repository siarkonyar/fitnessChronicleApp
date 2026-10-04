#!/bin/sh
# Starts the Auth, Firestore and Functions emulators the dev build connects to
# when EXPO_PUBLIC_USE_EMULATORS=true (see lib/firebase/emulators.ts).
#
# Fake data is saved to emulator-data/ on exit (Ctrl+C) and loaded again on the
# next start, so test accounts and logs survive restarts.
set -e
cd "$(dirname "$0")/.."

# firebase-tools needs Java 21+, and it runs whichever `java` is first on PATH,
# which may be older. Ask macOS for any installed JDK 21+ and put it first.
if JDK_21_HOME=$(/usr/libexec/java_home -v 21+ 2>/dev/null); then
  export JAVA_HOME="$JDK_21_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

DATA_DIR=./emulator-data

# The first run has nothing to import, and --import fails on a missing export.
IMPORT_FLAG=""
if [ -f "$DATA_DIR/firebase-export-metadata.json" ]; then
  IMPORT_FLAG="--import=$DATA_DIR"
fi

npm --prefix functions run build

exec firebase emulators:start \
  --only auth,firestore,functions \
  --export-on-exit="$DATA_DIR" \
  $IMPORT_FLAG
