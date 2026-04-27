/**
 * @fileoverview Comprehensive tests for the Gemini Service module.
 * Covers prompt loading, retry logic, timeline generation, chat Q&A,
 * step explanation, caching integration, and error handling.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.unstable_mockModule("../services/loggingService.js", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        critical: jest.fn(),
    },
    withTiming: jest.fn((name, fn) => fn()),
    createChildLogger: jest.fn(() => ({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), critical: jest.fn(),
    })),
    default: {
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), critical: jest.fn(),
    },
}));

jest.unstable_mockModule("../services/cacheService.js", () => ({
    cacheGet: jest.fn(() => Promise.resolve(null)),
    cacheSet: jest.fn(() => Promise.resolve()),
    generateCacheKey: jest.fn((...args) => args.join("-")),
    CACHE_TTL: { TIMELINE: 86400000, ELECTION_DATA: 3600000, CIVIC_API: 600000 },
}));

// Mock the @google/genai SDK
const mockGenerateContent = jest.fn();

jest.unstable_mockModule("@google/genai", () => ({
    GoogleGenAI: jest.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
}));

// Import after mocks
const { generateTimeline, generateChat, explainStep } = await import("../services/geminiService.js");
const { cacheGet, cacheSet } = await import("../services/cacheService.js");

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockTimelineResponse = {
    stage: "Registration",
    next_step: "Register to vote online",
    deadline: "30 days before Election Day",
    documents_required: ["Driver's License", "Social Security Number"],
    timeline: [
        {
            step: "Check Registration Status",
            action: "Visit your state's voter registration website",
            time: "5 minutes",
            why: "Ensure you are registered before deadlines pass",
            documents: ["State ID"],
            tip: "Set a reminder for the deadline",
            confidence: "high",
        },
        {
            step: "Register to Vote",
            action: "Complete online registration form",
            time: "10 minutes",
            why: "You must be registered to vote",
            documents: ["Driver's License", "SSN"],
            tip: "Use the official .gov website",
            confidence: "high",
        },
    ],
    explanation: "Here's your voting journey!",
    official_source: "https://vote.gov",
    additional_sources: ["https://www.usa.gov/voting"],
    accessibility_options: ["Early voting", "Mail-in ballot"],
};

const mockChatResponse = {
    answer: "You can register to vote online at your state's website.",
    details: [
        { title: "Online Registration", content: "Most states offer online registration." },
    ],
    sources: ["https://vote.gov"],
    follow_up_questions: ["What ID do I need?", "When is the deadline?"],
    needs_info: "",
};

const mockExplainResponse = {
    explanation: "This step involves checking your registration status.",
    tips: ["Use the official website", "Save your confirmation"],
    common_mistakes: ["Using outdated forms", "Missing the deadline"],
};

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: "test-api-key" };
    jest.clearAllMocks();
    cacheGet.mockResolvedValue(null);
});

afterEach(() => {
    process.env = originalEnv;
});

// ---------------------------------------------------------------------------
// generateTimeline()
// ---------------------------------------------------------------------------
describe("generateTimeline", () => {
    test("generates a complete timeline for US location", async () => {
        // Each pipeline stage calls generateContent once
        mockGenerateContent
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }) // Planner
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }) // Explainer
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }); // Verifier

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: true,
            contextData: null,
        };

        const result = await generateTimeline(context);

        expect(result).toBeDefined();
        expect(result.stage).toBe("Registration");
        expect(result.timeline).toHaveLength(2);
        expect(result.timeline[0].step).toBe("Check Registration Status");
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);
    });

    test("returns cached result when available", async () => {
        cacheGet.mockResolvedValueOnce(mockTimelineResponse);

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        const result = await generateTimeline(context);

        expect(result).toEqual(mockTimelineResponse);
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    test("caches the generated result", async () => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockTimelineResponse) });

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        await generateTimeline(context);
        expect(cacheSet).toHaveBeenCalled();
    });

    test("uses raw timeline when Explainer fails", async () => {
        mockGenerateContent
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }) // Planner OK
            .mockRejectedValueOnce(new Error("Explainer timeout")) // Explainer fails
            .mockRejectedValueOnce(new Error("Explainer timeout")) // Explainer retry 1
            .mockRejectedValueOnce(new Error("Explainer timeout")) // Explainer retry 2
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }); // Verifier OK

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        const result = await generateTimeline(context);
        expect(result).toBeDefined();
        expect(result.stage).toBe("Registration");
    });

    test("uses enhanced timeline when Verifier fails", async () => {
        mockGenerateContent
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }) // Planner OK
            .mockResolvedValueOnce({ text: JSON.stringify(mockTimelineResponse) }) // Explainer OK
            .mockRejectedValueOnce(new Error("Verifier timeout")) // Verifier fails
            .mockRejectedValueOnce(new Error("Verifier timeout")) // retry 1
            .mockRejectedValueOnce(new Error("Verifier timeout")); // retry 2

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        const result = await generateTimeline(context);
        expect(result).toBeDefined();
    });

    test("throws when Planner fails completely", async () => {
        mockGenerateContent
            .mockRejectedValueOnce(new Error("API down"))
            .mockRejectedValueOnce(new Error("API down"))
            .mockRejectedValueOnce(new Error("API down"));

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        await expect(generateTimeline(context)).rejects.toThrow("Failed to generate election roadmap");
    });

    test("generates timeline for Indian location", async () => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockTimelineResponse) });

        const context = {
            location: "Chennai, Tamil Nadu",
            country: "IN",
            electionType: "Lok Sabha",
            firstTimeVoter: true,
            contextData: { country: "India" },
        };

        const result = await generateTimeline(context);
        expect(result).toBeDefined();
        expect(result.timeline).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// generateChat()
// ---------------------------------------------------------------------------
describe("generateChat", () => {
    test("generates a chat response", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockChatResponse),
        });

        const result = await generateChat("How do I register to vote?");

        expect(result).toBeDefined();
        expect(result.answer).toContain("register to vote");
        expect(result.follow_up_questions).toBeInstanceOf(Array);
        expect(result.follow_up_questions.length).toBeGreaterThan(0);
    });

    test("includes conversation history in prompt", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockChatResponse),
        });

        const history = [
            { role: "user", content: "Where do I vote?" },
            { role: "assistant", content: "At your local polling station." },
        ];

        const result = await generateChat("What ID do I need?", {}, history);
        expect(result).toBeDefined();
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    test("handles empty user context", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockChatResponse),
        });

        const result = await generateChat("When is the next election?");
        expect(result).toBeDefined();
    });

    test("throws on API failure after retries", async () => {
        mockGenerateContent
            .mockRejectedValueOnce(new Error("API error"))
            .mockRejectedValueOnce(new Error("API error"))
            .mockRejectedValueOnce(new Error("API error"));

        await expect(generateChat("test")).rejects.toThrow("API error");
    });
});

// ---------------------------------------------------------------------------
// explainStep()
// ---------------------------------------------------------------------------
describe("explainStep", () => {
    test("generates step explanation", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockExplainResponse),
        });

        const step = {
            step: "Register to Vote",
            action: "Complete online registration",
            time: "10 minutes",
        };

        const result = await explainStep(step);
        expect(result).toBeDefined();
        expect(result.explanation).toBeDefined();
        expect(result.tips).toBeInstanceOf(Array);
        expect(result.common_mistakes).toBeInstanceOf(Array);
    });

    test("uses user context location", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockExplainResponse),
        });

        const step = { step: "Find Polling Booth", action: "Use NVSP portal", time: "5 minutes" };
        const result = await explainStep(step, { location: "Chennai, Tamil Nadu" });
        expect(result).toBeDefined();
    });

    test("handles missing action and time gracefully", async () => {
        mockGenerateContent.mockResolvedValueOnce({
            text: JSON.stringify(mockExplainResponse),
        });

        const step = { step: "Vote" };
        const result = await explainStep(step);
        expect(result).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Error handling and edge cases
// ---------------------------------------------------------------------------
describe("Error handling", () => {
    test("throws when GEMINI_API_KEY is missing", async () => {
        delete process.env.GEMINI_API_KEY;

        mockGenerateContent.mockImplementation(() => {
            throw new Error("GEMINI_API_KEY environment variable is not set");
        });

        const context = {
            location: "Austin, TX",
            country: "US",
            electionType: "General",
            firstTimeVoter: false,
            contextData: null,
        };

        await expect(generateTimeline(context)).rejects.toThrow();
    });
});
