import axios from "axios";
import { isIndianLocation, getIndiaElectionContext } from "./indiaElectionData.js";

// ---------------------------------------------------------------------------
// Country detection
// ---------------------------------------------------------------------------
/**
 * Detects whether a location is in the US, India, or unknown.
 * Returns "IN" | "US" | "UNKNOWN".
 */
export function detectCountry(location) {
    if (!location || typeof location !== "string") return "UNKNOWN";

    // Check India first (since this is the primary use case)
    if (isIndianLocation(location)) return "IN";

    // US indicators
    const normalized = location.toLowerCase().trim();
    if (/\bunited states\b|\busa\b|\bu\.s\.a?\b|\bamerica\b/.test(normalized)) return "US";

    // US state abbreviations (at end of string or before ZIP)
    const usStateAbbrevs = [
        "al","ak","az","ar","ca","co","ct","de","fl","ga","hi","id","il","in",
        "ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv",
        "nh","nj","nm","ny","nc","nd","oh","ok","or","pa","ri","sc","sd","tn",
        "tx","ut","vt","va","wa","wv","wi","wy","dc",
    ];
    const usStateNames = [
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

    for (const state of usStateNames) {
        if (normalized.includes(state)) return "US";
    }

    // Check for US state abbreviations with comma pattern: "city, XX"
    const commaMatch = normalized.match(/,\s*([a-z]{2})\s*(\d{5})?$/);
    if (commaMatch && usStateAbbrevs.includes(commaMatch[1])) return "US";

    // US ZIP code
    if (/\b\d{5}(-\d{4})?\b/.test(normalized)) return "US";

    return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Voter Info (US Only)
// ---------------------------------------------------------------------------
export async function getVoterInfo(address) {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        console.warn("[Civic] API key missing — skipping voter info lookup");
        return null;
    }

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/voterinfo",
            {
                params: { address, key: apiKey },
                timeout: 8000,
            }
        );
        console.log("[Civic] ✓ Voter info retrieved");
        return sanitizeCivicResponse(response.data, "voterinfo");
    } catch (error) {
        const status = error.response?.status;
        if (status === 400) {
            console.warn("[Civic] No election info available for this address");
        } else {
            console.error("[Civic] Voter info error:", error.response?.data?.error?.message || error.message);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Representatives (US Only)
// ---------------------------------------------------------------------------
export async function getRepresentatives(address) {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        console.warn("[Civic] API key missing — skipping representatives lookup");
        return null;
    }

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/representatives",
            {
                params: { address, key: apiKey },
                timeout: 8000,
            }
        );
        console.log("[Civic] ✓ Representatives retrieved");
        return sanitizeCivicResponse(response.data, "representatives");
    } catch (error) {
        console.error("[Civic] Representatives error:", error.response?.data?.error?.message || error.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Google Civic Information API — Elections list (US Only)
// ---------------------------------------------------------------------------
export async function getElections() {
    const apiKey = process.env.CIVIC_INFORMATION_API;

    if (!apiKey) {
        console.warn("[Civic] API key missing — skipping elections lookup");
        return null;
    }

    try {
        const response = await axios.get(
            "https://www.googleapis.com/civicinfo/v2/elections",
            {
                params: { key: apiKey },
                timeout: 8000,
            }
        );
        console.log("[Civic] ✓ Elections list retrieved");
        return response.data;
    } catch (error) {
        console.error("[Civic] Elections error:", error.response?.data?.error?.message || error.message);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Aggregate election data — routes by country
// ---------------------------------------------------------------------------
export async function getElectionData(address) {
    const country = detectCountry(address);

    if (country === "IN") {
        console.log(`[ElectionData] 🇮🇳 Indian location detected: "${address}"`);
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
    console.log(`[ElectionData] 🇺🇸 US location detected: "${address}"`);
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
export async function buildContextData(location, electionType) {
    const country = detectCountry(location);

    if (country === "IN") {
        console.log(`[Context] 🇮🇳 Building India context for: "${location}"`);
        return {
            country: "IN",
            contextData: getIndiaElectionContext(location, electionType),
        };
    }

    // US — use Civic API
    console.log(`[Context] 🇺🇸 Building US context for: "${location}"`);
    let civicData = null;
    try {
        civicData = await getVoterInfo(location);
    } catch (err) {
        console.warn("[Context] Civic data fetch failed:", err.message);
    }

    return {
        country: "US",
        contextData: civicData,
    };
}

// ---------------------------------------------------------------------------
// Sanitize civic API responses to reduce payload size for Gemini context
// ---------------------------------------------------------------------------
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
