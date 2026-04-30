/**
 * @fileoverview Tests for the centralized configuration and custom error classes.
 * Validates config structure, error class hierarchy, and error serialization.
 */

import { jest } from "@jest/globals";

// Mock loggingService for cacheService (imported transitively)
jest.unstable_mockModule("../services/loggingService.js", () => ({
    logger: {
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
        error: jest.fn(), critical: jest.fn(),
    },
    withTiming: jest.fn((name, fn) => fn()),
    createChildLogger: jest.fn(() => ({
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
        error: jest.fn(), critical: jest.fn(),
    })),
    default: {
        debug: jest.fn(), info: jest.fn(), warn: jest.fn(),
        error: jest.fn(), critical: jest.fn(),
    },
}));

const { AppError, ValidationError, NotFoundError, ExternalServiceError, RateLimitError } =
    await import("../errors/index.js");

const config = (await import("../config/index.js")).default;

// ---------------------------------------------------------------------------
// Config module
// ---------------------------------------------------------------------------
describe("Config module", () => {
    test("exports a frozen object", () => {
        expect(Object.isFrozen(config)).toBe(true);
    });

    test("has server section with port", () => {
        expect(config.server).toBeDefined();
        expect(typeof config.server.port).toBe("number");
        expect(config.server.port).toBeGreaterThan(0);
    });

    test("has gemini section with model", () => {
        expect(config.gemini).toBeDefined();
        expect(config.gemini.model).toBe("gemini-2.5-flash-lite");
        expect(config.gemini.temperature).toBe(0.4);
        expect(config.gemini.maxRetries).toBe(2);
    });

    test("has civic section with baseUrl", () => {
        expect(config.civic).toBeDefined();
        expect(config.civic.baseUrl).toContain("googleapis.com/civicinfo");
        expect(config.civic.timeoutMs).toBe(8000);
    });

    test("has cache section with TTLs", () => {
        expect(config.cache).toBeDefined();
        expect(config.cache.maxMemoryEntries).toBe(100);
        expect(config.cache.ttl.timeline).toBe(86400000);
        expect(config.cache.ttl.electionData).toBe(3600000);
        expect(config.cache.ttl.civicApi).toBe(600000);
    });

    test("has rateLimit section", () => {
        expect(config.rateLimit).toBeDefined();
        expect(config.rateLimit.windowMs).toBe(900000);
        expect(config.rateLimit.maxRequests).toBe(100);
    });

    test("has paths section with valid paths", () => {
        expect(config.paths).toBeDefined();
        expect(typeof config.paths.root).toBe("string");
        expect(typeof config.paths.prompts).toBe("string");
        expect(typeof config.paths.frontend).toBe("string");
    });

    test("has security section", () => {
        expect(config.security).toBeDefined();
        expect(config.security.maxBodySize).toBe("1mb");
    });

    test("has google section", () => {
        expect(config.google).toBeDefined();
        expect(typeof config.google.isCloudRun).toBe("boolean");
    });

    test("config is immutable (cannot modify)", () => {
        expect(() => { config.newProp = "test"; }).toThrow();
        expect(() => { config.server.newProp = "test"; }).toThrow();
    });
});

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------
describe("AppError", () => {
    test("creates error with default values", () => {
        const err = new AppError("test error");
        expect(err.message).toBe("test error");
        expect(err.statusCode).toBe(500);
        expect(err.isOperational).toBe(true);
        expect(err.name).toBe("AppError");
        expect(err instanceof Error).toBe(true);
    });

    test("creates error with custom status code", () => {
        const err = new AppError("not found", 404);
        expect(err.statusCode).toBe(404);
    });

    test("creates non-operational error", () => {
        const err = new AppError("bug", 500, false);
        expect(err.isOperational).toBe(false);
    });

    test("toJSON returns safe response for production", () => {
        const err = new AppError("internal bug", 500, false);
        const json = err.toJSON(true);
        expect(json.error).toBe("AppError");
        expect(json.details).toBe("An internal error occurred. Please try again.");
    });

    test("toJSON returns full details in development", () => {
        const err = new AppError("visible error", 400, true);
        const json = err.toJSON(false);
        expect(json.details).toBe("visible error");
    });
});

describe("ValidationError", () => {
    test("has status code 400", () => {
        const err = new ValidationError("location required");
        expect(err.statusCode).toBe(400);
        expect(err.isOperational).toBe(true);
        expect(err.name).toBe("ValidationError");
        expect(err instanceof AppError).toBe(true);
        expect(err instanceof Error).toBe(true);
    });
});

describe("NotFoundError", () => {
    test("has status code 404", () => {
        const err = new NotFoundError("User");
        expect(err.statusCode).toBe(404);
        expect(err.message).toBe("User not found");
        expect(err.name).toBe("NotFoundError");
    });
});

describe("ExternalServiceError", () => {
    test("has status code 502", () => {
        const err = new ExternalServiceError("Gemini", "rate limited");
        expect(err.statusCode).toBe(502);
        expect(err.message).toContain("Gemini");
        expect(err.message).toContain("rate limited");
        expect(err.serviceName).toBe("Gemini");
    });

    test("works without detail", () => {
        const err = new ExternalServiceError("Civic API");
        expect(err.message).toBe("Civic API service error");
    });
});

describe("RateLimitError", () => {
    test("has status code 429", () => {
        const err = new RateLimitError();
        expect(err.statusCode).toBe(429);
        expect(err.isOperational).toBe(true);
        expect(err.message).toContain("Too many requests");
    });
});

// ---------------------------------------------------------------------------
// Error hierarchy
// ---------------------------------------------------------------------------
describe("Error hierarchy", () => {
    test("all custom errors inherit from AppError", () => {
        expect(new ValidationError("x") instanceof AppError).toBe(true);
        expect(new NotFoundError("x") instanceof AppError).toBe(true);
        expect(new ExternalServiceError("x") instanceof AppError).toBe(true);
        expect(new RateLimitError() instanceof AppError).toBe(true);
    });

    test("all custom errors inherit from Error", () => {
        expect(new ValidationError("x") instanceof Error).toBe(true);
        expect(new NotFoundError("x") instanceof Error).toBe(true);
        expect(new ExternalServiceError("x") instanceof Error).toBe(true);
        expect(new RateLimitError() instanceof Error).toBe(true);
    });

    test("errors can be caught by type", () => {
        try {
            throw new ValidationError("bad input");
        } catch (err) {
            expect(err instanceof ValidationError).toBe(true);
            expect(err instanceof AppError).toBe(true);
            expect(err.statusCode).toBe(400);
        }
    });
});
