/**
 * @fileoverview Comprehensive tests for the Election Service module.
 * Covers country detection, Indian location detection, state data lookup,
 * India election context, Civic API integration, and context building.
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mock dependencies before importing the module under test
// ---------------------------------------------------------------------------

// Mock loggingService
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
}));

// Mock cacheService
jest.unstable_mockModule("../services/cacheService.js", () => ({
    cacheGet: jest.fn(() => Promise.resolve(null)),
    cacheSet: jest.fn(() => Promise.resolve()),
    generateCacheKey: jest.fn((...args) => args.join("-")),
    CACHE_TTL: { TIMELINE: 86400000, ELECTION_DATA: 3600000, CIVIC_API: 600000 },
}));

// Mock axios
jest.unstable_mockModule("axios", () => ({
    default: { get: jest.fn() },
}));

// Import after mocks are set up
const { detectCountry, getVoterInfo, getRepresentatives, getElections, getElectionData, buildContextData } = await import("../services/electionService.js");
const { isIndianLocation, findStateData, getIndiaElectionContext } = await import("../services/indiaElectionData.js");
const axios = (await import("axios")).default;
const { cacheGet } = await import("../services/cacheService.js");

// ---------------------------------------------------------------------------
// detectCountry()
// ---------------------------------------------------------------------------
describe("detectCountry", () => {
    describe("Indian locations", () => {
        test("detects 'India' keyword", () => {
            expect(detectCountry("New Delhi, India")).toBe("IN");
        });

        test("detects 'Bharat' keyword", () => {
            expect(detectCountry("Bharat")).toBe("IN");
        });

        test("detects Indian city names", () => {
            expect(detectCountry("Mumbai")).toBe("IN");
            expect(detectCountry("Chennai, Tamil Nadu")).toBe("IN");
            expect(detectCountry("Bangalore")).toBe("IN");
            expect(detectCountry("Hyderabad")).toBe("IN");
        });

        test("detects Indian states", () => {
            expect(detectCountry("Kerala")).toBe("IN");
            expect(detectCountry("Madhya Pradesh")).toBe("IN");
            expect(detectCountry("West Bengal")).toBe("IN");
        });

        test("detects Indian PIN codes (6 digits)", () => {
            expect(detectCountry("600001")).toBe("IN");
            expect(detectCountry("Anna Nagar, 600040")).toBe("IN");
        });
    });

    describe("US locations", () => {
        test("detects 'United States' keyword", () => {
            expect(detectCountry("New York, United States")).toBe("US");
        });

        test("detects 'USA' keyword", () => {
            expect(detectCountry("USA")).toBe("US");
        });

        test("detects US state names", () => {
            expect(detectCountry("California")).toBe("US");
            expect(detectCountry("Austin, Texas")).toBe("US");
            expect(detectCountry("Portland, Oregon")).toBe("US");
        });

        test("detects 'City, ST' abbreviation pattern", () => {
            expect(detectCountry("Austin, TX")).toBe("US");
            expect(detectCountry("San Francisco, CA")).toBe("US");
        });

        test("detects US ZIP codes (5 digits)", () => {
            expect(detectCountry("78701")).toBe("US");
            expect(detectCountry("123 Main St, 90210")).toBe("US");
        });

        test("detects US ZIP+4 codes", () => {
            expect(detectCountry("78701-1234")).toBe("US");
        });
    });

    describe("Edge cases", () => {
        test("returns UNKNOWN for null/undefined", () => {
            expect(detectCountry(null)).toBe("UNKNOWN");
            expect(detectCountry(undefined)).toBe("UNKNOWN");
        });

        test("returns UNKNOWN for empty string", () => {
            expect(detectCountry("")).toBe("UNKNOWN");
        });

        test("returns UNKNOWN for non-string", () => {
            expect(detectCountry(123)).toBe("UNKNOWN");
            expect(detectCountry({})).toBe("UNKNOWN");
        });

        test("returns UNKNOWN for unrecognized location", () => {
            expect(detectCountry("xyz abc")).toBe("UNKNOWN");
            expect(detectCountry("some random place")).toBe("UNKNOWN");
        });

        test("is case-insensitive", () => {
            expect(detectCountry("CALIFORNIA")).toBe("US");
            expect(detectCountry("MUMBAI")).toBe("IN");
            expect(detectCountry("united states")).toBe("US");
        });
    });
});

// ---------------------------------------------------------------------------
// isIndianLocation()
// ---------------------------------------------------------------------------
describe("isIndianLocation", () => {
    test("returns true for Indian cities", () => {
        expect(isIndianLocation("Mumbai")).toBe(true);
        expect(isIndianLocation("Kolkata")).toBe(true);
        expect(isIndianLocation("Kochi")).toBe(true);
    });

    test("returns true for Indian states", () => {
        expect(isIndianLocation("Tamil Nadu")).toBe(true);
        expect(isIndianLocation("Uttar Pradesh")).toBe(true);
    });

    test("returns true for 'India' and 'Bharat'", () => {
        expect(isIndianLocation("India")).toBe(true);
        expect(isIndianLocation("Bharat")).toBe(true);
    });

    test("returns true for Indian PIN codes", () => {
        expect(isIndianLocation("110001")).toBe(true);
        expect(isIndianLocation("Address, 600040")).toBe(true);
    });

    test("returns false for null/undefined/non-string", () => {
        expect(isIndianLocation(null)).toBe(false);
        expect(isIndianLocation(undefined)).toBe(false);
        expect(isIndianLocation(123)).toBe(false);
    });

    test("returns false for US locations", () => {
        expect(isIndianLocation("Austin, Texas")).toBe(false);
        expect(isIndianLocation("New York, NY")).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// findStateData()
// ---------------------------------------------------------------------------
describe("findStateData", () => {
    test("finds state data for known states", () => {
        const result = findStateData("Kerala");
        expect(result).not.toBeNull();
        expect(result.state).toBe("Kerala");
        expect(result.ceo).toContain("kerala");
    });

    test("finds state data via city-to-state mapping", () => {
        const result = findStateData("Mumbai");
        expect(result).not.toBeNull();
        expect(result.state).toBe("Maharashtra");
    });

    test("finds state data for Delhi", () => {
        const result = findStateData("New Delhi");
        expect(result).not.toBeNull();
        expect(result.state).toBe("Delhi");
    });

    test("returns null for unknown location", () => {
        expect(findStateData("xyz")).toBeNull();
    });

    test("returns null for null input", () => {
        expect(findStateData(null)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// getIndiaElectionContext()
// ---------------------------------------------------------------------------
describe("getIndiaElectionContext", () => {
    test("returns complete context for known Indian location", () => {
        const ctx = getIndiaElectionContext("Chennai, Tamil Nadu", "Lok Sabha");
        expect(ctx).toBeDefined();
        expect(ctx.country).toBe("India");
        expect(ctx.detectedState).toBeDefined();
        expect(ctx.detectedState.state).toBe("Tamil Nadu");
        expect(ctx.electionType).toBeDefined();
        expect(ctx.electionType.fullName).toContain("Lok Sabha");
        expect(ctx.voterRegistration).toBeDefined();
        expect(ctx.votingProcess).toBeDefined();
        expect(ctx.officialBodies).toBeDefined();
        expect(ctx.keyConcepts).toBeDefined();
        expect(ctx.officialSources).toBeInstanceOf(Array);
        expect(ctx.officialSources.length).toBeGreaterThan(0);
        expect(ctx.helpline).toBe("1950 (Voter Helpline — Toll Free)");
    });

    test("returns Vidhan Sabha election type", () => {
        const ctx = getIndiaElectionContext("Bangalore", "Vidhan Sabha");
        expect(ctx.electionType.level).toBe("State");
    });

    test("defaults to Lok Sabha for unknown election type", () => {
        const ctx = getIndiaElectionContext("Mumbai", "UnknownType");
        expect(ctx.electionType.fullName).toContain("Lok Sabha");
    });

    test("handles unknown location gracefully", () => {
        const ctx = getIndiaElectionContext("Unknown Place, India");
        expect(ctx.detectedState.state).toContain("Unknown");
    });
});

// ---------------------------------------------------------------------------
// getVoterInfo() — with mocked Civic API
// ---------------------------------------------------------------------------
describe("getVoterInfo", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, CIVIC_INFORMATION_API: "test-key" };
        jest.clearAllMocks();
        cacheGet.mockResolvedValue(null);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("returns null when API key is missing", async () => {
        delete process.env.CIVIC_INFORMATION_API;
        const result = await getVoterInfo("123 Main St");
        expect(result).toBeNull();
    });

    test("returns sanitized data on success", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                election: { id: "2000", name: "VIP Election" },
                pollingLocations: [
                    {
                        address: {
                            locationName: "City Hall",
                            line1: "100 Main St",
                            city: "Austin",
                            state: "TX",
                            zip: "78701",
                        },
                        pollingHours: "7am-7pm",
                        notes: "Bring ID",
                    },
                ],
                earlyVoteSites: [],
                state: [
                    {
                        name: "Texas",
                        electionAdministrationBody: {
                            electionInfoUrl: "https://texas.gov/elections",
                            electionRegistrationUrl: "https://texas.gov/register",
                            absenteeVotingInfoUrl: "https://texas.gov/absentee",
                        },
                    },
                ],
            },
        });

        const result = await getVoterInfo("Austin, TX");
        expect(result).toBeDefined();
        expect(result.election.name).toBe("VIP Election");
        expect(result.pollingLocations).toHaveLength(1);
        expect(result.pollingLocations[0].name).toBe("City Hall");
        expect(result.state.name).toBe("Texas");
    });

    test("returns null on 400 error", async () => {
        axios.get.mockRejectedValueOnce({ response: { status: 400 } });
        const result = await getVoterInfo("invalid address");
        expect(result).toBeNull();
    });

    test("returns null on network error", async () => {
        axios.get.mockRejectedValueOnce(new Error("Network timeout"));
        const result = await getVoterInfo("Austin, TX");
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// getRepresentatives() — with mocked Civic API
// ---------------------------------------------------------------------------
describe("getRepresentatives", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, CIVIC_INFORMATION_API: "test-key" };
        jest.clearAllMocks();
        cacheGet.mockResolvedValue(null);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("returns null when API key is missing", async () => {
        delete process.env.CIVIC_INFORMATION_API;
        const result = await getRepresentatives("123 Main St");
        expect(result).toBeNull();
    });

    test("returns sanitized data on success", async () => {
        axios.get.mockResolvedValueOnce({
            data: {
                officials: [
                    { name: "John Doe", party: "Independent", phones: ["555-0100"], urls: ["https://doe.gov"] },
                ],
                offices: [
                    { name: "Mayor", levels: ["locality"], officialIndices: [0] },
                ],
                normalizedInput: { line1: "123 Main St", city: "Austin", state: "TX", zip: "78701" },
            },
        });

        const result = await getRepresentatives("Austin, TX");
        expect(result).toBeDefined();
        expect(result.officials).toHaveLength(1);
        expect(result.officials[0].name).toBe("John Doe");
        expect(result.offices).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// getElections()
// ---------------------------------------------------------------------------
describe("getElections", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, CIVIC_INFORMATION_API: "test-key" };
        jest.clearAllMocks();
        cacheGet.mockResolvedValue(null);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("returns null when API key is missing", async () => {
        delete process.env.CIVIC_INFORMATION_API;
        const result = await getElections();
        expect(result).toBeNull();
    });

    test("returns election data on success", async () => {
        const mockElections = { elections: [{ id: "2000", name: "General Election" }] };
        axios.get.mockResolvedValueOnce({ data: mockElections });
        const result = await getElections();
        expect(result).toEqual(mockElections);
    });
});

// ---------------------------------------------------------------------------
// getElectionData() — integration-level tests
// ---------------------------------------------------------------------------
describe("getElectionData", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, CIVIC_INFORMATION_API: "test-key" };
        jest.clearAllMocks();
        cacheGet.mockResolvedValue(null);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("routes Indian addresses to India Knowledge Base", async () => {
        const result = await getElectionData("Chennai, Tamil Nadu, India");
        expect(result.country).toBe("IN");
        expect(result.indiaContext).toBeDefined();
        expect(result.source).toContain("India");
    });

    test("routes US addresses to Civic API", async () => {
        // Mock all three API calls
        axios.get.mockResolvedValue({ data: {} });

        const result = await getElectionData("Austin, Texas");
        expect(result.country).toBe("US");
        expect(result.source).toContain("Civic");
        expect(result.fetchedAt).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// buildContextData() — integration-level tests
// ---------------------------------------------------------------------------
describe("buildContextData", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv, CIVIC_INFORMATION_API: "test-key" };
        jest.clearAllMocks();
        cacheGet.mockResolvedValue(null);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    test("returns IN context for Indian location", async () => {
        const result = await buildContextData("Mumbai, Maharashtra", "Lok Sabha");
        expect(result.country).toBe("IN");
        expect(result.contextData).toBeDefined();
        expect(result.contextData.country).toBe("India");
    });

    test("returns US context for US location", async () => {
        axios.get.mockResolvedValueOnce({ data: {} });
        const result = await buildContextData("Austin, TX", "General");
        expect(result.country).toBe("US");
    });

    test("handles Civic API failure gracefully", async () => {
        axios.get.mockRejectedValueOnce(new Error("Network error"));
        const result = await buildContextData("Austin, TX", "General");
        expect(result.country).toBe("US");
        expect(result.contextData).toBeNull();
    });
});
