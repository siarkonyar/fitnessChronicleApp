// Firebase integration tests must not send telemetry to a live PostHog project.
export default class PostHog {
  constructor() {
    throw new Error("PostHog must stay disabled in emulator integration tests.");
  }
}
