import axios from "axios";
import { isIndianLocation, getIndiaElectionContext } from "./indiaElectionData.js";
import { logger } from "./loggingService.js";
import { cacheGet, cacheSet, generateCacheKey, CACHE_TTL } from "./cacheService.js";

// ---------------------------------------------------------------------------
// Pre-compiled regex patterns for efficiency
// ---------------------------------------------------------------------------

/** @type {RegExp} Matches common US country references */
const US_COUNTRY_REGEX = /\bunited states\b|\busa\b|\bu\.s\.a?\b|\bamerica\b/;

/** @type {RegExp} Matches US "City, ST" or "City, ST ZIP" pattern */
const US_STATE_ABBREV_REGEX = /,\s*([a-z]{2})\s*(\d{5})?$/;

/** @type {RegExp} Matches US ZIP codes (5 or 5+4 format) */
const US_ZIP_REGEX = /\b\d{5}(-\d{4})?\b/;

/** @type {string[]} Two-letter US state abbreviations */
const US_STATE_ABBREVS = [
    "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
    "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
    "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
    "tx","ut","vt","va","wa","wv","wi","wy","dc",
];

/** @type {string[]} Full US state names (lowercased) */
const US_STATE_NAMES = [
    "alabama","alaska","arizona","arkansas","california","colorado",
    "connecticut","delaware","florida","georgia","hawaii","idaho",
    "illinois","indiana","iowa","kansas","kentucky","louisiana","maine",
    "maryland","massachusetts","michigan","minnesota","mississippi",
    "missouri","montana","nebraska","nevada","new hampshire","new jersey",
    "new mexico","new york","north carolina","north dakota","ohio",
    "oklahoma","oregon","pennsylvania","rhode island","south carolina",
    "south dakota","tennessee","texas","utah","vermont","virginia",
    "washington","west virginia","wisconsin","wyoming","district of columbia",
];

// ---------------------------------------------------------------------------
// Country detection
// ---------------------------------------------------------------------------

/**
 * Detects whether a location is in the US, India, or unknown.
 * Uses keyword matching, state/city recognition, and postal code patterns.
 *
 * @param {string} location - A location string (address, city, state, etc.)
 * @returns {"IN"|"US"|"UNKNOWN"} Detected country code
 *
 * @example
 * detectCountry("Chennai, Tamil Nadu")  // "IN"
 * detectCountry("Austin, TX 78701")     // "US"
 * detectCountry("xyz")                  // "UNKNOWN"
 */
export function detectCountry(location) {
    if (!location || typeof location !== "string") return "UNKNOWN";

    // Check India first (since this is the primary use case)
    if (isIndianLocation(location)) return "IN";

    // US indicators
    const normalized = location.toLowerCase().trim();
    if (US_COUNTRY_REGEX.test(normalized)) return "US";

    // US state names
    for (const state of US_STATE_NAMES) {
        if (normalized.includes(state)) return "US";
    }

    // Check for US state abbreviations with comma pattern: "city, XX"
    const commaMatch = normalized.match(US_STATE_ABBREV_REGEX);
    if (commaMatch && US_STATE_ABBREVS.includes(commaMatch[1])) return "US";

    // US ZIP code
    if (US_ZIP_REGEX.test(normalized)) return "US";

    return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Voter Info (US Only)
// ---------------------------------------------------------------------------

/**
 * Fetches voter information from the Google Civic Information API.
 * Returns polling locations, early vote sites, and state election info.
 *
 * @param {string} address - US address to look up
 * @returns {Promise<Object|null>} Sanitized voter info or null on failure
 */
export async function getVoterInfo(address) {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        logger.warn("Civic API key missing — skipping voter info lookup");
        return null;
    }

    // Check cache first
    const cacheKey = generateCacheKey("voterinfo", address);
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/voterinfo",
            {
                params: { address, key: apiKey },
                timeout: 8000,
            }
        );
        logger.info("Civic: Voter info retrieved", { address: address.slice(0, 30) });
        const result = sanitizeCivicResponse(response.data, "voterinfo");

        // Cache the result
        await cacheSet(cacheKey, result, CACHE_TTL.CIVIC_API);
        return result;
    } catch (error) {
        const status = error.response?.status;
        if (status === 400) {
            logger.warn("Civic: No election info available for this address");
        } else {
            logger.error("Civic: Voter info error", {
                error: error.response?.data?.error?.message || error.message,
            });
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Representatives (US Only)
// ---------------------------------------------------------------------------

/**
 * Fetches representative information from the Google Civic Information API.
 * Returns elected officials and their offices for a given address.
 *
 * @param {string} address - US address to look up
 * @returns {Promise<Object|null>} Sanitized representative info or null on failure
 */
export async function getRepresentatives(address) {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        logger.warn("Civic API key missing — skipping representatives lookup");
        return null;
    }

    // Check cache first
    const cacheKey = generateCacheKey("representatives", address);
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/representatives",
            {
                params: { address, key: apiKey },
                timeout: 8000,
            }
        );
        logger.info("Civic: Representatives retrieved", { address: address.slice(0, 30) });
        const result = sanitizeCivicResponse(response.data, "representatives");

        await cacheSet(cacheKey, result, CACHE_TTL.CIVIC_API);
        return result;
    } catch (error) {
        logger.error("Civic: Representatives error", {
            error: error.response?.data?.error?.message || error.message,
        });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Elections list (US Only)
// ---------------------------------------------------------------------------

/**
 * Fetches the list of upcoming elections from the Google Civic Information API.
 *
 * @returns {Promise<Object|null>} Elections list or null on failure
 */
export async function getElections() {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        logger.warn("Civic API key missing — skipping elections lookup");
        return null;
    }

    // Check cache first
    const cacheKey = generateCacheKey("elections-list");
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/elections",
            {
                params: { key: apiKey },
                timeout: 8000,
            }
        );
        logger.info("Civic: Elections list retrieved");
        const result = response.data;

        await cacheSet(cacheKey, result, CACHE_TTL.ELECTION_DATA);
        return result;
    } catch (error) {
        logger.error("Civic: Elections error", {
            error: error.response?.data?.error?.message || error.message,
        });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Aggregate election data — routes by country
// ---------------------------------------------------------------------------

/**
 * Aggregates election data for a given address, routing to the appropriate
 * data source based on detected country (Google Civic API for US, India
 * Knowledge Base for India).
 *
 * @param {string} address - User's address
 * @returns {Promise<Object>} Election data with country, sources, and timestamp
 */
export async function getElectionData(address) {
    const country = detectCountry(address);

    if (country === "IN") {
        logger.info(`ElectionData: Indian location detected: "${address}"`);
        const indiaContext = getIndiaElectionContext(address);
        return {
            country: "IN",
            indiaContext,
            address,
            fetchedAt: new Date().toISOString(),
            source: "India Election Knowledge Base (ECI/NVSP)",
        };
    }

    // Default to US Civic API
    logger.info(`ElectionData: US location detected: "${address}"`);
    const [voterInfo, representatives, elections] = await Promise.allSettled([
        getVoterInfo(address),
        getRepresentatives(address),
        getElections(),
    ]);

    return {
        country: "US",
        voterInfo: voterInfo.status === "fulfilled" ? voterInfo.value : null,
        representatives: representatives.status === "fulfilled" ? representatives.value : null,
        elections: elections.status === "fulfilled" ? elections.value : null,
        address,
        fetchedAt: new Date().toISOString(),
        source: "Google Civic Information API",
    };
}

// ---------------------------------------------------------------------------
// Build context data for the AI pipeline (called from index.js)
// ---------------------------------------------------------------------------

/**
 * Builds the context data object for the AI pipeline. Detects country and
 * fetches appropriate election data to inject into Gemini's context window.
 *
 * @param {string} location     - User's location string
 * @param {string} electionType - Type of election
 * @returns {Promise<{country: string, contextData: Object|null}>}
 */
export async function buildContextData(location, electionType) {
    const country = detectCountry(location);

    if (country === "IN") {
        logger.info(`Context: Building India context for: "${location}"`);
        return {
            country: "IN",
            contextData: getIndiaElectionContext(location, electionType),
        };
    }

    // US — use Civic API
    logger.info(`Context: Building US context for: "${location}"`);
    let civicData = null;
    try {
        civicData = await getVoterInfo(location);
    } catch (err) {
        logger.warn("Context: Civic data fetch failed", { error: err.message });
    }

    return {
        country: "US",
        contextData: civicData,
    };
}

// ---------------------------------------------------------------------------
// Sanitize civic API responses to reduce payload size for Gemini context
// ---------------------------------------------------------------------------

/**
 * Sanitizes and reduces Civic API responses to keep only essential data.
 * This minimizes the token usage when injecting into Gemini's context window.
 *
 * @param {Object} data - Raw Civic API response
 * @param {"voterinfo"|"representatives"} type - Response type
 * @returns {Object|null} Sanitized response or null
 */
function sanitizeCivicResponse(data, type) {
    if (!data) return null;

    if (type === "voterinfo") {
        return {
            election: data.election || null,
            pollingLocations: (data.pollingLocations || []).slice(0, 3).map((loc) => ({
                name: loc.address?.locationName,
                address: loc.address ? `${loc.address.line1}, ${loc.address.city}, ${loc.address.state} ${loc.address.zip}` : null,
                hours: loc.pollingHours,
                notes: loc.notes,
            })),
            earlyVoteSites: (data.earlyVoteSites || []).slice(0, 3).map((site) => ({
                name: site.address?.locationName,
                address: site.address ? `${site.address.line1}, ${site.address.city}, ${site.address.state} ${site.address.zip}` : null,
                startDate: site.startDate,
                endDate: site.endDate,
            })),
            state: data.state?.[0] ? {
                name: data.state[0].name,
                electionInfoUrl: data.state[0].electionAdministrationBody?.electionInfoUrl,
                registrationUrl: data.state[0].electionAdministrationBody?.electionRegistrationUrl,
                absenteeUrl: data.state[0].electionAdministrationBody?.absenteeVotingInfoUrl,
            } : null,
        };
    }

    if (type === "representatives") {
        const officials = (data.officials || []).slice(0, 10).map((o) => ({
            name: o.name,
            party: o.party,
            phones: o.phones,
            urls: o.urls,
        }));
        const offices = (data.offices || []).slice(0, 10).map((o) => ({
            name: o.name,
            levels: o.levels,
            officialIndices: o.officialIndices,
        }));
        return { officials, offices, normalizedAddress: data.normalizedInput };
    }

    return data;
}
