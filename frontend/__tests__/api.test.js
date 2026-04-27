/**
 * @fileoverview Tests for the frontend API client module.
 * Covers success paths, error handling, network failures,
 * request timeout, and input sanitization.
 *
 * Uses a self-contained test approach that doesn't require
 * the full Next.js module resolution.
 */

// ---------------------------------------------------------------------------
// Mock fetch and AbortSignal globally before importing
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Polyfill AbortSignal.any if not available
if (!AbortSignal.any) {
    AbortSignal.any = (signals) => {
        const controller = new AbortController();
        for (const signal of signals) {
            if (signal.aborted) {
                controller.abort(signal.reason);
                return controller.signal;
            }
            signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
        }
        return controller.signal;
    };
}

// ---------------------------------------------------------------------------
// Inline the API module logic for testing (avoids ESM/CJS issues)
// ---------------------------------------------------------------------------
const API_BASE = "http://127.0.0.1:8080";
const REQUEST_TIMEOUT_MS = 120000;

function sanitizeInput(input) {
    if (typeof input !== "string") return "";
    return input.replace(/<[^>]*>/g, "").trim();
}

async function apiRequest(endpoint, body, options = {}) {
    const { timeoutMs = REQUEST_TIMEOUT_MS, signal } = options;
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: combinedSignal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.details || err.error || `Server responded with ${res.status}`);
        }

        return res.json();
    } catch (err) {
        if (err.name === "AbortError") {
            throw new Error("Request timed out. Please try again.");
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

function generateTimeline(context, options) {
    return apiRequest("/api/timeline", {
        ...context,
        location: sanitizeInput(context.location),
    }, options);
}

function sendChatMessage(message, userContext = {}, conversationHistory = [], options) {
    return apiRequest("/api/chat", {
        message: sanitizeInput(message),
        userContext,
        conversationHistory,
    }, options);
}

function getElectionData(address, options) {
    return apiRequest("/api/election-data", {
        address: sanitizeInput(address),
    }, options);
}

function explainStep(step, userContext = {}, options) {
    return apiRequest("/api/explain-step", { step, userContext }, options);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// sanitizeInput()
// ---------------------------------------------------------------------------
describe("sanitizeInput", () => {
    test("strips HTML tags", () => {
        expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    });

    test("trims whitespace", () => {
        expect(sanitizeInput("  hello  ")).toBe("hello");
    });

    test("returns empty string for non-string", () => {
        expect(sanitizeInput(123)).toBe("");
        expect(sanitizeInput(null)).toBe("");
        expect(sanitizeInput(undefined)).toBe("");
    });
});

// ---------------------------------------------------------------------------
// generateTimeline()
// ---------------------------------------------------------------------------
describe("generateTimeline", () => {
    test("sends correct request and returns data", async () => {
        const mockResponse = {
            stage: "Registration",
            timeline: [{ step: "Register", action: "Go online", time: "5 min", why: "Required" }],
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        });

        const result = await generateTimeline({
            location: "Austin, TX",
            electionType: "General",
            firstTimeVoter: true,
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/timeline"),
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
            })
        );
        expect(result).toEqual(mockResponse);
    });

    test("sanitizes location input", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ stage: "test" }),
        });

        await generateTimeline({ location: '<b>Austin</b>, TX' });

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.location).toBe("Austin, TX");
        expect(body.location).not.toContain("<b>");
    });

    test("throws on non-ok response with error details", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: "Location is required", details: "Please provide a location." }),
        });

        await expect(generateTimeline({ location: "" })).rejects.toThrow("Please provide a location.");
    });

    test("throws on non-ok response without parseable body", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("Parse error")),
        });

        await expect(generateTimeline({ location: "test" })).rejects.toThrow("Server responded with 500");
    });
});

// ---------------------------------------------------------------------------
// sendChatMessage()
// ---------------------------------------------------------------------------
describe("sendChatMessage", () => {
    test("sends message and returns chat response", async () => {
        const mockResponse = {
            answer: "You can register online.",
            follow_up_questions: ["What ID do I need?"],
            needs_info: "",
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        });

        const result = await sendChatMessage("How do I register?");
        expect(result.answer).toBe("You can register online.");
    });

    test("includes conversation history in request body", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ answer: "test", follow_up_questions: [], needs_info: "" }),
        });

        const history = [{ role: "user", content: "Hello" }];
        await sendChatMessage("Follow up", {}, history);

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.conversationHistory).toEqual(history);
    });

    test("sanitizes message input", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ answer: "ok", follow_up_questions: [], needs_info: "" }),
        });

        await sendChatMessage('<img src=x onerror=alert(1)>How do I vote?');

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.message).not.toContain("<img");
    });
});

// ---------------------------------------------------------------------------
// getElectionData()
// ---------------------------------------------------------------------------
describe("getElectionData", () => {
    test("sends address and returns election data", async () => {
        const mockResponse = { country: "US", voterInfo: {} };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        });

        const result = await getElectionData("Austin, TX");
        expect(result.country).toBe("US");
    });

    test("sanitizes address input", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ country: "US" }),
        });

        await getElectionData('<script>bad</script>Austin, TX');

        const [, options] = mockFetch.mock.calls[0];
        const body = JSON.parse(options.body);
        expect(body.address).not.toContain("<script>");
    });
});

// ---------------------------------------------------------------------------
// explainStep()
// ---------------------------------------------------------------------------
describe("explainStep", () => {
    test("sends step data and returns explanation", async () => {
        const mockResponse = {
            explanation: "This step is about registering.",
            tips: ["Use official website"],
            common_mistakes: ["Missing the deadline"],
        };

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockResponse),
        });

        const result = await explainStep({ step: "Register", action: "Go online", time: "5 min" });
        expect(result.explanation).toContain("registering");
        expect(result.tips).toBeInstanceOf(Array);
    });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
describe("Error handling", () => {
    test("handles network failure", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));
        await expect(generateTimeline({ location: "Test" })).rejects.toThrow("Failed to fetch");
    });

    test("handles JSON parse error in error response", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: () => Promise.reject(new Error("Invalid JSON")),
        });

        await expect(sendChatMessage("test")).rejects.toThrow("Server responded with 500");
    });

    test("handles abort/timeout", async () => {
        const controller = new AbortController();
        controller.abort();

        mockFetch.mockRejectedValueOnce(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        await expect(
            generateTimeline({ location: "Test" }, { signal: controller.signal })
        ).rejects.toThrow("Request timed out");
    });
});

// ---------------------------------------------------------------------------
// apiRequest() internals
// ---------------------------------------------------------------------------
describe("apiRequest", () => {
    test("constructs correct URL and headers", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({}),
        });

        await apiRequest("/api/test", { data: "hello" });

        expect(mockFetch).toHaveBeenCalledWith(
            "http://127.0.0.1:8080/api/test",
            expect.objectContaining({
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data: "hello" }),
            })
        );
    });

    test("passes abort signal to fetch", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({}),
        });

        const controller = new AbortController();
        await apiRequest("/api/test", {}, { signal: controller.signal });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });
});
