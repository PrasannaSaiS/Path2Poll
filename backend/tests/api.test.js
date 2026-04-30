/**
 * @fileoverview HTTP integration tests for all API endpoints.
 * Uses supertest to make real HTTP requests against the Express app.
 * Covers health check, timeline, chat, election-data, explain-step,
 * input validation, error handling, and edge cases.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mock external dependencies before importing the app
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
    cacheClear: jest.fn(),
    cacheStats: jest.fn(() => ({ memorySize: 0, firestoreAvailable: false })),
    CACHE_TTL: { TIMELINE: 86400000, ELECTION_DATA: 3600000, CIVIC_API: 600000 },
}));

const mockGenerateContent = jest.fn();
jest.unstable_mockModule("@google/genai", () => ({
    GoogleGenAI: jest.fn(() => ({
        models: {
            generateContent: mockGenerateContent,
        },
    })),
}));

jest.unstable_mockModule("axios", () => ({
    default: { get: jest.fn(() => Promise.resolve({ data: {} })) },
}));

// Set required env vars
process.env.GEMINI_API_KEY = "test-key";
process.env.CIVIC_INFORMATION_API = "test-civic-key";
process.env.NODE_ENV = "test";

const supertest = (await import("supertest")).default;
const { default: app } = await import("../index.js");

const request = supertest(app);

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const mockTimeline = {
    stage: "Registration",
    next_step: "Register to vote",
    deadline: "October 7, 2024",
    documents_required: ["ID"],
    timeline: [{ step: "Register", action: "Go online", time: "5 min", why: "Required" }],
    explanation: "Your voting journey starts here!",
    official_source: "https://vote.gov",
};

const mockChatResp = {
    answer: "You can vote at your local polling station.",
    follow_up_questions: ["What ID do I need?"],
    needs_info: "",
};

const mockExplainResp = {
    explanation: "This step is about registration.",
    tips: ["Bring your ID"],
    common_mistakes: ["Missing the deadline"],
};

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------
describe("GET /api/health", () => {
    test("returns healthy status", async () => {
        const res = await request.get("/api/health");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("healthy");
        expect(res.body.service).toBe("Path2Poll");
        expect(res.body.timestamp).toBeDefined();
        expect(res.body.geminiConfigured).toBe(true);
        expect(res.body.civicConfigured).toBe(true);
        expect(typeof res.body.uptime).toBe("number");
        expect(res.body.googleCloud).toBeDefined();
    });

    test("includes cache stats", async () => {
        const res = await request.get("/api/health");
        expect(res.body.cache).toBeDefined();
        expect(typeof res.body.cache.memorySize).toBe("number");
    });

    test("has correct content-type", async () => {
        const res = await request.get("/api/health");
        expect(res.headers["content-type"]).toContain("application/json");
    });
});

// ---------------------------------------------------------------------------
// POST /api/timeline
// ---------------------------------------------------------------------------
describe("POST /api/timeline", () => {
    beforeEach(() => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockTimeline) });
    });

    test("generates timeline for valid request", async () => {
        const res = await request.post("/api/timeline").send({
            location: "Austin, Texas",
            electionType: "General",
            firstTimeVoter: true,
        });

        expect(res.status).toBe(200);
        expect(res.body.stage).toBeDefined();
        expect(res.body.timeline).toBeInstanceOf(Array);
    });

    test("returns 400 when location is missing", async () => {
        const res = await request.post("/api/timeline").send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Location");
    });

    test("returns 400 when location is too short", async () => {
        const res = await request.post("/api/timeline").send({ location: "a" });
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    test("returns 400 when location is not a string", async () => {
        const res = await request.post("/api/timeline").send({ location: 123 });
        expect(res.status).toBe(400);
    });

    test("handles empty electionType with default", async () => {
        const res = await request.post("/api/timeline").send({
            location: "Austin, Texas",
        });
        expect(res.status).toBe(200);
    });

    test("sanitizes HTML in location input", async () => {
        const res = await request.post("/api/timeline").send({
            location: '<script>alert("xss")</script>Austin, Texas',
        });
        // Should either succeed with sanitized input or return 400
        expect([200, 400]).toContain(res.status);
    });

    test("returns 500 on Gemini API failure", async () => {
        mockGenerateContent
            .mockRejectedValueOnce(new Error("API failed"))
            .mockRejectedValueOnce(new Error("API failed"))
            .mockRejectedValueOnce(new Error("API failed"));

        const res = await request.post("/api/timeline").send({
            location: "Austin, Texas",
            electionType: "General",
        });

        expect(res.status).toBe(500);
        expect(res.body.error).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------
describe("POST /api/chat", () => {
    beforeEach(() => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockChatResp) });
    });

    test("returns chat response for valid message", async () => {
        const res = await request.post("/api/chat").send({
            message: "How do I register to vote?",
        });

        expect(res.status).toBe(200);
        expect(res.body.answer).toBeDefined();
        expect(res.body.follow_up_questions).toBeInstanceOf(Array);
    });

    test("returns 400 when message is missing", async () => {
        const res = await request.post("/api/chat").send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Message");
    });

    test("returns 400 when message is empty string", async () => {
        const res = await request.post("/api/chat").send({ message: "   " });
        expect(res.status).toBe(400);
    });

    test("accepts conversation history", async () => {
        const res = await request.post("/api/chat").send({
            message: "What ID do I need?",
            conversationHistory: [
                { role: "user", content: "How do I vote?" },
                { role: "assistant", content: "You need to register first." },
            ],
        });

        expect(res.status).toBe(200);
    });

    test("accepts user context", async () => {
        const res = await request.post("/api/chat").send({
            message: "When is the deadline?",
            userContext: { location: "Austin, TX", electionType: "General" },
        });

        expect(res.status).toBe(200);
    });
});

// ---------------------------------------------------------------------------
// POST /api/election-data
// ---------------------------------------------------------------------------
describe("POST /api/election-data", () => {
    test("returns election data for Indian address", async () => {
        const res = await request.post("/api/election-data").send({
            address: "Chennai, Tamil Nadu, India",
        });

        expect(res.status).toBe(200);
        expect(res.body.country).toBe("IN");
        expect(res.body.indiaContext).toBeDefined();
    });

    test("returns election data for US address", async () => {
        const res = await request.post("/api/election-data").send({
            address: "Austin, Texas",
        });

        expect(res.status).toBe(200);
        expect(res.body.country).toBe("US");
    });

    test("returns 400 when address is missing", async () => {
        const res = await request.post("/api/election-data").send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Address");
    });

    test("returns 400 when address is too short", async () => {
        const res = await request.post("/api/election-data").send({ address: "x" });
        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// POST /api/explain-step
// ---------------------------------------------------------------------------
describe("POST /api/explain-step", () => {
    beforeEach(() => {
        mockGenerateContent.mockResolvedValue({ text: JSON.stringify(mockExplainResp) });
    });

    test("returns step explanation for valid request", async () => {
        const res = await request.post("/api/explain-step").send({
            step: { step: "Register to Vote", action: "Go online", time: "5 min" },
        });

        expect(res.status).toBe(200);
        expect(res.body.explanation).toBeDefined();
        expect(res.body.tips).toBeInstanceOf(Array);
        expect(res.body.common_mistakes).toBeInstanceOf(Array);
    });

    test("returns 400 when step is missing", async () => {
        const res = await request.post("/api/explain-step").send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Step");
    });

    test("returns 400 when step has no step field", async () => {
        const res = await request.post("/api/explain-step").send({
            step: { action: "something" },
        });
        expect(res.status).toBe(400);
    });
});

// ---------------------------------------------------------------------------
// Security & headers
// ---------------------------------------------------------------------------
describe("Security headers", () => {
    test("includes X-Request-Id header", async () => {
        const res = await request.get("/api/health");
        expect(res.headers["x-request-id"]).toBeDefined();
    });

    test("includes security headers from Helmet", async () => {
        const res = await request.get("/api/health");
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
        expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    });
});

// ---------------------------------------------------------------------------
// Error response format consistency
// ---------------------------------------------------------------------------
describe("Error response format", () => {
    test("all 400 errors have error and details fields", async () => {
        const responses = await Promise.all([
            request.post("/api/timeline").send({}),
            request.post("/api/chat").send({}),
            request.post("/api/election-data").send({}),
            request.post("/api/explain-step").send({}),
        ]);

        for (const res of responses) {
            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty("error");
            expect(res.body).toHaveProperty("details");
            expect(typeof res.body.error).toBe("string");
            expect(typeof res.body.details).toBe("string");
        }
    });
});
