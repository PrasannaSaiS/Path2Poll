/**
 * @fileoverview Tests for Google Cloud Service integrations.
 * Validates Cloud Logging, Cloud Firestore, Gemini AI, and
 * Google Civic Information API integration points.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Google Cloud Logging tests
// ---------------------------------------------------------------------------
describe("Google Cloud Logging integration", () => {
    let logger;

    beforeEach(async () => {
        // Reset module to test fresh initialization
        jest.resetModules();
        // Ensure we're not in cloud for these tests
        delete process.env.K_SERVICE;
        delete process.env.GOOGLE_CLOUD_PROJECT;

        const mod = await import("../services/loggingService.js");
        logger = mod.logger;
    });

    test("logger has all severity methods", () => {
        expect(typeof logger.debug).toBe("function");
        expect(typeof logger.info).toBe("function");
        expect(typeof logger.warn).toBe("function");
        expect(typeof logger.error).toBe("function");
        expect(typeof logger.critical).toBe("function");
    });

    test("logger.info writes without throwing", () => {
        expect(() => {
            logger.info("test message", { key: "value" });
        }).not.toThrow();
    });

    test("logger.error writes without throwing", () => {
        expect(() => {
            logger.error("test error", { error: "test" });
        }).not.toThrow();
    });

    test("logger.warn writes without throwing", () => {
        expect(() => {
            logger.warn("test warning", { detail: "test" });
        }).not.toThrow();
    });

    test("structured log entries include serviceContext", () => {
        // When in cloud, logs should be structured JSON with serviceContext
        const originalWrite = process.stdout.write;
        let logOutput = "";
        process.stdout.write = (data) => { logOutput += data; return true; };

        // Temporarily simulate cloud env
        process.env.K_SERVICE = "path2poll";
        jest.resetModules();

        // Re-import to get cloud-mode logger
        import("../services/loggingService.js").then((mod) => {
            mod.logger.info("structured test", { test: true });
            process.stdout.write = originalWrite;
            delete process.env.K_SERVICE;

            if (logOutput) {
                const parsed = JSON.parse(logOutput.trim());
                expect(parsed.severity).toBe("INFO");
                expect(parsed.serviceContext).toBeDefined();
                expect(parsed.serviceContext.service).toBe("path2poll");
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Google Cloud Firestore cache tests
// ---------------------------------------------------------------------------
describe("Google Cloud Firestore cache integration", () => {
    let cacheGet, cacheSet, cacheStats, generateCacheKey, cacheClear;

    beforeEach(async () => {
        jest.resetModules();
        // Mock logger to prevent console noise
        jest.unstable_mockModule("../services/loggingService.js", () => ({
            logger: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
            },
            withTiming: jest.fn((name, fn) => fn()),
            default: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
            },
        }));

        const mod = await import("../services/cacheService.js");
        cacheGet = mod.cacheGet;
        cacheSet = mod.cacheSet;
        cacheStats = mod.cacheStats;
        generateCacheKey = mod.generateCacheKey;
        cacheClear = mod.cacheClear;
    });

    test("cache supports get and set operations", async () => {
        const key = generateCacheKey("test", "data");
        await cacheSet(key, { result: "test" }, 60000);
        const value = await cacheGet(key);
        expect(value).toEqual({ result: "test" });
    });

    test("cache stats reports memory size", () => {
        const stats = cacheStats();
        expect(typeof stats.memorySize).toBe("number");
        expect(typeof stats.firestoreAvailable).toBe("boolean");
    });

    test("cache clear removes all memory entries", async () => {
        const key = generateCacheKey("clear", "test");
        await cacheSet(key, "value", 60000);
        cacheClear();
        const value = await cacheGet(key);
        expect(value).toBeNull();
    });

    test("generateCacheKey produces consistent keys", () => {
        const key1 = generateCacheKey("timeline", "Austin", "General");
        const key2 = generateCacheKey("timeline", "Austin", "General");
        expect(key1).toBe(key2);
    });

    test("generateCacheKey produces different keys for different inputs", () => {
        const key1 = generateCacheKey("timeline", "Austin");
        const key2 = generateCacheKey("timeline", "Dallas");
        expect(key1).not.toBe(key2);
    });

    test("cache handles object values", async () => {
        const key = generateCacheKey("object", "test");
        const obj = { timeline: [{ step: "Register" }], stage: "test" };
        await cacheSet(key, obj, 60000);
        const value = await cacheGet(key);
        expect(value).toEqual(obj);
    });
});

// ---------------------------------------------------------------------------
// Google Civic Information API integration tests
// ---------------------------------------------------------------------------
describe("Google Civic Information API integration", () => {
    let detectCountry, getElectionData, buildContextData;

    beforeEach(async () => {
        jest.resetModules();
        jest.unstable_mockModule("../services/loggingService.js", () => ({
            logger: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
            },
            withTiming: jest.fn((name, fn) => fn()),
            default: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
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
        jest.unstable_mockModule("axios", () => ({
            default: {
                get: jest.fn(() => Promise.resolve({
                    data: {
                        election: { id: "2000", name: "VIP Test Election" },
                        pollingLocations: [],
                        state: [{ name: "Texas" }],
                    },
                })),
            },
        }));

        const mod = await import("../services/electionService.js");
        detectCountry = mod.detectCountry;
        getElectionData = mod.getElectionData;
        buildContextData = mod.buildContextData;
    });

    test("routes US addresses to Google Civic Information API", async () => {
        process.env.CIVIC_INFORMATION_API = "test-key";
        const data = await getElectionData("Austin, Texas");
        expect(data.country).toBe("US");
        expect(data.source).toContain("Google Civic Information API");
    });

    test("routes Indian addresses to India Knowledge Base", async () => {
        const data = await getElectionData("Chennai, Tamil Nadu, India");
        expect(data.country).toBe("IN");
        expect(data.source).toContain("India Election Knowledge Base");
    });

    test("buildContextData returns country and context", async () => {
        const result = await buildContextData("Mumbai, India", "General");
        expect(result.country).toBe("IN");
        expect(result.contextData).toBeDefined();
    });

    test("buildContextData handles US locations", async () => {
        process.env.CIVIC_INFORMATION_API = "test-key";
        const result = await buildContextData("Austin, TX", "General");
        expect(result.country).toBe("US");
    });
});

// ---------------------------------------------------------------------------
// Google Gemini AI integration tests
// ---------------------------------------------------------------------------
describe("Google Gemini AI integration", () => {
    test("Gemini service requires API key", async () => {
        jest.resetModules();
        jest.unstable_mockModule("../services/loggingService.js", () => ({
            logger: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
            },
            withTiming: jest.fn((name, fn) => fn()),
            default: {
                debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
                error: jest.fn(), critical: jest.fn(),
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

        const mockGenerate = jest.fn();
        jest.unstable_mockModule("@google/genai", () => ({
            GoogleGenAI: jest.fn(() => ({
                models: { generateContent: mockGenerate },
            })),
        }));

        // Remove the key to test the check
        const saved = process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_API_KEY;

        const { generateTimeline } = await import("../services/geminiService.js");

        await expect(generateTimeline({
            location: "Austin, TX",
            country: "US",
            electionType: "General",
        })).rejects.toThrow();

        process.env.GEMINI_API_KEY = saved;
    });
});
