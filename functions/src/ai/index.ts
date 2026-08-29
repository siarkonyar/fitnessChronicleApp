// Entry point for the Genkit dev UI (`npm run genkit:ui`).
//
// Every flow and tool must be imported here or the dev UI cannot see it.
// This file is NOT the Cloud Functions entry point — that is src/index.ts.

import "./genkit.js";
import "./flows/joke.js";
import "./flows/coach.js";
