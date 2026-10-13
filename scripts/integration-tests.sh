#!/bin/bash
# Runs the app's integration suite (integration/*.integration.test.ts) against
# fresh Auth, Firestore and Functions emulators under the demo-hercule project.
#
# Unlike `npm run emulators`, nothing is imported or exported: every run starts
# from empty emulators and throws the data away. Stop any running dev
# emulators first — they hold the same ports.
#
# Extra arguments go to Jest, e.g.  npm run test:integration -- -t "labels"
set -euo pipefail
cd "$(dirname "$0")/.."

# firebase-tools needs Java 21+, and runs whichever `java` is first on PATH.
if JDK_21_HOME=$(/usr/libexec/java_home -v 21+ 2>/dev/null); then
  export JAVA_HOME="$JDK_21_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

# The functions emulator serves the compiled output, and the suite imports the
# server's firebase-admin copy, so both need the functions install and build.
npm --prefix functions run build

# chatWithCoach declares a Gemini secret, and the emulator will not load the
# functions without some value. The suite never reaches Gemini, so a
# throwaway value is enough; a developer's real key file is left alone.
SECRET_FILE=functions/.secret.local
if [ ! -f "$SECRET_FILE" ]; then
  echo "GEMINI_API_KEY=not-a-real-key-tests-never-reach-gemini" >"$SECRET_FILE"
  trap 'rm -f "$SECRET_FILE"' EXIT
fi

FIREBASE=./functions/node_modules/.bin/firebase
[ -x "$FIREBASE" ] || FIREBASE=firebase

"$FIREBASE" emulators:exec \
  --only auth,firestore,functions \
  --project demo-hercule \
  "npx jest --config jest.integration.config.js $*"
