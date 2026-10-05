import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { QueryClient } from "@tanstack/react-query";
import { useChatBox } from "../useChatBox";
import { createTestQueryClient, queryWrapper } from "./queryWrapper";

const mockCallCoach = jest.fn();
const mockCallAiUsage = jest.fn();
const mockLogEvent = jest.fn();
const mockHandleMutationError = jest.fn();
const mockHandleQueryError = jest.fn();
let mockRepTypeFixed = false;
let mockMeasure: "kg" | "lbs" = "kg";

jest.mock("@/lib/ai/coachServer", () => ({
  callCoach: (...args: unknown[]) => mockCallCoach(...args),
  callAiUsage: () => mockCallAiUsage(),
}));

jest.mock("@/lib/offlineStorage", () => ({
  getDefaultRepType: async () => mockRepTypeFixed,
  getDefaultMeasurement: async () => mockMeasure,
}));

jest.mock("@/lib/analytics/client", () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

jest.mock("../useServerErrorHandler", () => ({
  useServerErrorHandler: () => ({
    handleMutationError: mockHandleMutationError,
    handleQueryError: mockHandleQueryError,
  }),
}));

const USAGE = {
  percentUsed: 10,
  resetsAt: "2026-07-01T00:00:00.000Z",
  tier: "free",
  activeUntil: null,
  billingPeriod: null,
};

const reply = (text: string, overrides: Record<string, unknown> = {}) => ({
  ...USAGE,
  percentUsed: 12,
  reply: text,
  ...overrides,
});

const refusal = (code: string, reason?: string) =>
  Object.assign(new Error("refused"), { code, details: reason ? { reason } : undefined });

let client: QueryClient;

const renderChat = () =>
  renderHook(() => useChatBox(), { wrapper: queryWrapper(client) });

const send = async (
  result: { current: ReturnType<typeof useChatBox> },
  text: string,
  source: "composer" | "pill" | "regenerate" = "composer",
) => {
  act(() => result.current.sendMessage({ text, source }));
  await waitFor(() => expect(result.current.isSending).toBe(false));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepTypeFixed = false;
  mockMeasure = "kg";
  mockCallAiUsage.mockResolvedValue(USAGE);
  mockHandleMutationError.mockReturnValue(false);
  client = createTestQueryClient();
  jest.useFakeTimers({ now: new Date(2026, 5, 10, 12), doNotFake: ["nextTick", "setImmediate"] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("sending a message", () => {
  test("shows the message at once, then the coach's reply", async () => {
    let resolveCoach: (value: unknown) => void = () => undefined;
    mockCallCoach.mockReturnValue(new Promise((resolve) => (resolveCoach = resolve)));
    const { result } = renderChat();

    act(() => result.current.sendMessage({ text: "Plan my week", source: "composer" }));

    await waitFor(() => expect(result.current.isSending).toBe(true));
    expect(result.current.messages).toEqual([{ role: "user", text: "Plan my week" }]);

    await act(async () => resolveCoach(reply("Here is a plan")));

    await waitFor(() =>
      expect(result.current.messages).toEqual([
        { role: "user", text: "Plan my week" },
        { role: "model", text: "Here is a plan" },
      ]),
    );
  });

  test("sends today's date and the user's rep and unit preferences", async () => {
    mockRepTypeFixed = true;
    mockMeasure = "lbs";
    mockCallCoach.mockResolvedValue(reply("ok"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(mockCallCoach).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "hi",
        today: "2026-06-10",
        prefs: { repType: "fixed", measure: "lbs" },
      }),
    );
  });

  test("defaults to rep ranges in kg", async () => {
    mockCallCoach.mockResolvedValue(reply("ok"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(mockCallCoach.mock.calls[0][0].prefs).toEqual({ repType: "range", measure: "kg" });
  });

  test("includes the earlier exchange in the history of the next message", async () => {
    mockCallCoach.mockResolvedValueOnce(reply("first answer")).mockResolvedValueOnce(reply("second"));
    const { result } = renderChat();

    await send(result, "first question");
    await send(result, "second question");

    expect(mockCallCoach.mock.calls[1][0].history.slice(0, 2)).toEqual([
      { role: "user", text: "first question" },
      { role: "model", text: "first answer" },
    ]);
  });

  // KNOWN RACE: mutationFn reads `messages` from whichever render is current
  // when TanStack invokes it, and onMutate has already appended the new
  // message. If React re-renders in between (it always does under act), the
  // message is sent twice: once as `message`, once as the last history item.
  // Building history from the variables passed to mutate() would remove it.
  test.failing("never sends the new message as part of its own history", async () => {
    mockCallCoach.mockResolvedValueOnce(reply("first answer")).mockResolvedValueOnce(reply("second"));
    const { result } = renderChat();

    await send(result, "first question");
    await send(result, "second question");

    expect(mockCallCoach.mock.calls[1][0].history).toEqual([
      { role: "user", text: "first question" },
      { role: "model", text: "first answer" },
    ]);
  });

  test("attaches a proposed program to the coach's message", async () => {
    const program = { name: "PPL", days: [{ isRestDay: true }] };
    mockCallCoach.mockResolvedValue(reply("Try this", { program }));
    const { result } = renderChat();

    await send(result, "make me a program");

    expect(result.current.messages[1]).toEqual({ role: "model", text: "Try this", program });
  });

  test("does not add a program key to a plain answer", async () => {
    mockCallCoach.mockResolvedValue(reply("Just text"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.messages[1]).not.toHaveProperty("program");
  });

  test("replaces the cached usage with the figures from the reply", async () => {
    mockCallCoach.mockResolvedValue(reply("ok", { percentUsed: 37 }));
    const { result } = renderChat();
    await waitFor(() => expect(result.current.percentUsed).toBe(10));

    await send(result, "hi");

    expect(result.current.percentUsed).toBe(37);
    expect(client.getQueryData(["aiUsage"])).toEqual({ ...USAGE, percentUsed: 37 });
  });

  test("never reports what the user typed to analytics", async () => {
    const secret = "my knee hurts after the accident";
    mockCallCoach.mockResolvedValue(reply("Sorry to hear that"));
    const { result } = renderChat();

    await send(result, secret, "pill");

    expect(JSON.stringify(mockLogEvent.mock.calls)).not.toContain("knee");
    expect(mockLogEvent).toHaveBeenCalledWith("ai_message_sent", {
      source: "pill",
      message_length: secret.length,
      history_length: 0,
    });
    expect(mockLogEvent).toHaveBeenCalledWith(
      "ai_response_received",
      expect.objectContaining({ has_program: false, percent_used: 12 }),
    );
  });
});

describe("refusals and failures", () => {
  test("a quota refusal removes the unsent message and locks the composer", async () => {
    mockCallCoach.mockRejectedValue(refusal("functions/resource-exhausted", "quota"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.messages).toEqual([]);
    expect(result.current.isQuotaExhausted).toBe(true);
    expect(result.current.sendError).toBe("You've used your AI coach allowance for this month.");
    expect(mockLogEvent).toHaveBeenCalledWith("ai_response_failed", expect.objectContaining({ reason: "quota" }));
  });

  test("a refusal with no reason is treated as quota, the safe reading", async () => {
    mockCallCoach.mockRejectedValue(refusal("functions/resource-exhausted"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.isQuotaExhausted).toBe(true);
  });

  test("a rate limit explains itself without locking the composer", async () => {
    mockCallCoach.mockRejectedValue(refusal("functions/resource-exhausted", "rate_limit"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.isQuotaExhausted).toBe(false);
    expect(result.current.sendError).toBe("You're sending messages too quickly. Give it a moment.");
  });

  // KNOWN BUG: on device, React Native Firebase reports callable errors
  // without the "functions/" prefix ("resource-exhausted"), so quota and
  // rate-limit refusals fall through to the generic "Couldn't reach" banner.
  test.failing("recognises the unprefixed code React Native Firebase sends", async () => {
    mockCallCoach.mockRejectedValue(refusal("resource-exhausted", "quota"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.isQuotaExhausted).toBe(true);
  });

  test("an offline failure leaves the banner to the offline alert", async () => {
    mockHandleMutationError.mockReturnValue(true);
    mockCallCoach.mockRejectedValue(new Error("Network request failed"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.sendError).toBeNull();
    expect(mockLogEvent).toHaveBeenCalledWith("ai_response_failed", expect.objectContaining({ reason: "offline" }));
  });

  test("any other failure shows the generic retry banner", async () => {
    mockCallCoach.mockRejectedValue(new Error("internal"));
    const { result } = renderChat();

    await send(result, "hi");

    expect(result.current.sendError).toBe("Couldn't reach your coach. Please try again.");
    expect(mockLogEvent).toHaveBeenCalledWith("ai_response_failed", expect.objectContaining({ reason: "unknown" }));
  });

  test("a failed reply keeps the earlier conversation intact", async () => {
    mockCallCoach.mockResolvedValueOnce(reply("first answer")).mockRejectedValueOnce(new Error("x"));
    const { result } = renderChat();

    await send(result, "first");
    await send(result, "second");

    expect(result.current.messages.map((m) => m.text)).toEqual(["first", "first answer"]);
  });

  test("sending again clears the previous error", async () => {
    mockCallCoach.mockRejectedValueOnce(new Error("x"));
    let resolveCoach: (value: unknown) => void = () => undefined;
    mockCallCoach.mockReturnValueOnce(new Promise((resolve) => (resolveCoach = resolve)));
    const { result } = renderChat();

    await send(result, "first");
    act(() => result.current.sendMessage({ text: "retry", source: "regenerate" }));

    await waitFor(() => expect(result.current.sendError).toBeNull());
    await act(async () => resolveCoach(reply("ok")));
  });
});

describe("the allowance from the usage query", () => {
  test("locks the composer for someone who opens the chat at 100%", async () => {
    mockCallAiUsage.mockResolvedValue({ ...USAGE, percentUsed: 100 });
    const { result } = renderChat();

    await waitFor(() => expect(result.current.isQuotaExhausted).toBe(true));
    expect(result.current.sendError).toBe("You've used your AI coach allowance for this month.");
  });

  test("stays open at 99%", async () => {
    mockCallAiUsage.mockResolvedValue({ ...USAGE, percentUsed: 99 });
    const { result } = renderChat();

    await waitFor(() => expect(result.current.percentUsed).toBe(99));
    expect(result.current.isQuotaExhausted).toBe(false);
  });

  test("survives a bare number left in the persisted cache by an old build", async () => {
    client.setQueryData(["aiUsage"], 42);
    mockCallAiUsage.mockReturnValue(new Promise(() => undefined));
    const { result } = renderChat();

    expect(result.current.percentUsed).toBeNull();
    expect(result.current.isQuotaExhausted).toBe(false);
  });

  test("hands a failed usage fetch to the error handler", async () => {
    const error = new Error("Network request failed");
    mockCallAiUsage.mockRejectedValue(error);
    renderChat();

    await waitFor(() => expect(mockHandleQueryError).toHaveBeenCalledWith(error));
  });
});

describe("clearChat", () => {
  test("empties the conversation and any banner, and reports the count", async () => {
    mockCallCoach.mockResolvedValueOnce(reply("a")).mockRejectedValueOnce(new Error("x"));
    const { result } = renderChat();
    await send(result, "one");
    await send(result, "two");

    act(() => result.current.clearChat());

    expect(result.current.messages).toEqual([]);
    expect(result.current.sendError).toBeNull();
    expect(mockLogEvent).toHaveBeenCalledWith("ai_chat_cleared", { message_count: 2 });
  });

  test("does not clear a quota lock that comes from the server's figure", async () => {
    mockCallAiUsage.mockResolvedValue({ ...USAGE, percentUsed: 100 });
    const { result } = renderChat();
    await waitFor(() => expect(result.current.isQuotaExhausted).toBe(true));

    act(() => result.current.clearChat());

    expect(result.current.isQuotaExhausted).toBe(true);
  });
});
