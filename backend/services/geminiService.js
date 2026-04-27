import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger, withTiming } from "./loggingService.js";
import { cacheGet, cacheSet, generateCacheKey, CACHE_TTL } from "./cacheService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** @type {string} Gemini model identifier */
const MODEL = "gemini-2.5-flash-lite";

/** @type {{ retries: number, baseDelayMs: number }} Retry configuration */
const RETRY_CONFIG = { retries: 2, baseDelayMs: 1000 };

// ---------------------------------------------------------------------------
// Prompt loader — prompts are loaded once at startup for efficiency
// ---------------------------------------------------------------------------
const promptsDir = path.join(__dirname, "../../shared/prompts");

/** @type {Map<string, string>} Cached prompt templates */
const promptCache = new Map();

/**
 * Loads a prompt template from disk. Results are cached in memory so that
 * subsequent calls return instantly without filesystem I/O.
 *
 * @param {string} name - Prompt filename without extension (e.g. "planner")
 * @returns {string} The prompt template contents
 * @throws {Error} If the prompt file does not exist
 */
function loadPrompt(name) {
    if (promptCache.has(name)) {
        return promptCache.get(name);
    }
    const content = fs.readFileSync(path.join(promptsDir, `${name}.txt`), "utf8");
    promptCache.set(name, content);
    logger.debug(`Prompt loaded and cached: ${name}`);
    return content;
}

// Pre-load all prompts at module initialization for maximum efficiency
try {
    ["system", "planner", "explainer", "verifier", "chat"].forEach(loadPrompt);
    logger.info("All prompt templates pre-loaded and cached");
} catch (err) {
    logger.warn("Some prompts could not be pre-loaded", { error: err.message });
}

// ---------------------------------------------------------------------------
// Gemini client (new @google/genai SDK)
// ---------------------------------------------------------------------------

/**
 * Creates and returns a GoogleGenAI client instance.
 *
 * @returns {GoogleGenAI} Configured AI client
 * @throws {Error} If GEMINI_API_KEY is not set
 */
function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// JSON Schemas (plain JSON Schema, not SchemaType enums)
// ---------------------------------------------------------------------------

/** @type {Object} Schema for timeline API responses */
const timelineSchema = {
    type: "object",
    properties: {
        stage: { type: "string", description: "Current stage in the election process" },
        next_step: { type: "string", description: "The immediate next action the user should take" },
        deadline: { type: "string", description: "Next important deadline" },
        documents_required: {
            type: "array",
            items: { type: "string" },
            description: "List of required documents across the whole process",
        },
        timeline: {
            type: "array",
            description: "Ordered step-by-step timeline of actions",
            items: {
                type: "object",
                properties: {
                    step: { type: "string", description: "Step title" },
                    action: { type: "string", description: "Detailed description of what to do" },
                    time: { type: "string", description: "Deadline or time estimate" },
                    why: { type: "string", description: "Why this step matters" },
                    documents: {
                        type: "array",
                        items: { type: "string" },
                        description: "Documents needed for this step",
                    },
                    tip: { type: "string", description: "Helpful tip for this step" },
                    confidence: { type: "string", description: "high, medium, or low confidence" },
                },
                required: ["step", "action", "time", "why"],
            },
        },
        explanation: {
            type: "string",
            description: "A warm, friendly summary of the voter's journey",
        },
        official_source: { type: "string", description: "Primary official source URL" },
        additional_sources: {
            type: "array",
            items: { type: "string" },
            description: "Additional official source URLs",
        },
        accessibility_options: {
            type: "array",
            items: { type: "string" },
            description: "Available accessibility options (early voting, mail-in, curbside, etc.)",
        },
    },
    required: [
        "stage",
        "next_step",
        "deadline",
        "documents_required",
        "timeline",
        "explanation",
        "official_source",
    ],
};

/** @type {Object} Schema for chat API responses */
const chatSchema = {
    type: "object",
    properties: {
        answer: { type: "string", description: "Direct answer to the user's question" },
        details: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    title: { type: "string" },
                    content: { type: "string" },
                },
                required: ["title", "content"],
            },
            description: "Optional structured breakdown of the answer",
        },
        sources: {
            type: "array",
            items: { type: "string" },
            description: "Official sources referenced",
        },
        follow_up_questions: {
            type: "array",
            items: { type: "string" },
            description: "Suggested follow-up questions",
        },
        needs_info: {
            type: "string",
            description: "If more info is needed from the user, describe what. Empty string if not.",
        },
    },
    required: ["answer", "follow_up_questions", "needs_info"],
};

/** @type {Object} Schema for step explanation responses */
const explainSchema = {
    type: "object",
    properties: {
        explanation: { type: "string" },
        tips: { type: "array", items: { type: "string" } },
        common_mistakes: { type: "array", items: { type: "string" } },
    },
    required: ["explanation", "tips", "common_mistakes"],
};

// ---------------------------------------------------------------------------
// Core generate helper using new SDK
// ---------------------------------------------------------------------------

/**
 * Sends a prompt to the Gemini API and returns a parsed JSON response.
 *
 * @param {string} prompt            - The user prompt / content
 * @param {string} systemInstruction - System-level instruction for the model
 * @param {Object} schema            - JSON schema for structured output
 * @returns {Promise<Object>} Parsed JSON response from the model
 * @throws {Error} If the API call fails or response is not valid JSON
 */
async function generate(prompt, systemInstruction, schema) {
    const ai = getAI();

    const config = {
        systemInstruction,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.4,
    };

    const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config,
    });

    return JSON.parse(response.text);
}

// ---------------------------------------------------------------------------
// Retry helper with exponential backoff
// ---------------------------------------------------------------------------

/**
 * Wraps an async function with automatic retry logic and exponential backoff.
 *
 * @param {Function} fn                  - Async function to execute
 * @param {number}   [retries]          - Max number of retries (default from config)
 * @param {number}   [baseDelayMs]      - Base delay between retries in ms
 * @returns {Promise<*>} Result of the successful function call
 * @throws {Error} If all retry attempts are exhausted
 */
async function callWithRetry(fn, retries = RETRY_CONFIG.retries, baseDelayMs = RETRY_CONFIG.baseDelayMs) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            logger.warn(`Gemini attempt ${attempt + 1} failed`, {
                error: err.message,
                retriesLeft: retries - attempt,
            });
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, baseDelayMs * (attempt + 1)));
        }
    }
}

// ---------------------------------------------------------------------------
// STAGE 1 — Planner: Generate raw timeline
// ---------------------------------------------------------------------------

/**
 * Stage 1 of the AI pipeline. Generates a raw election timeline based on
 * user context and any available civic/election data.
 *
 * @param {Object} context - User context with location, country, electionType, etc.
 * @returns {Promise<Object>} Raw timeline data
 */
async function runPlanner(context) {
    const systemPrompt = loadPrompt("system");
    const plannerTemplate = loadPrompt("planner");

    const country = context.country || "US";

    let prompt = plannerTemplate
        .replace("{{location}}", context.location || "Unknown")
        .replace("{{country}}", country === "IN" ? "India (IN)" : "United States (US)")
        .replace("{{electionType}}", context.electionType || "General")
        .replace("{{firstTimeVoter}}", context.firstTimeVoter ? "Yes" : "No");

    if (context.contextData) {
        const label = country === "IN"
            ? "INDIA ELECTION KNOWLEDGE BASE CONTEXT (use as primary source)"
            : "OFFICIAL CIVIC DATA CONTEXT (use as primary source)";
        prompt += `\n\n${label}:\n${JSON.stringify(context.contextData, null, 2)}`;
    }

    return callWithRetry(async () => {
        return withTiming("Planner", async () => {
            const result = await generate(prompt, systemPrompt, timelineSchema);
            logger.info("Planner: Raw timeline generated", {
                country,
                location: context.location,
                stepsCount: result.timeline?.length || 0,
            });
            return result;
        });
    });
}

// ---------------------------------------------------------------------------
// STAGE 2 — Explainer: Enhance clarity
// ---------------------------------------------------------------------------

/**
 * Stage 2 of the AI pipeline. Takes the raw timeline and enhances it with
 * simpler language, better tips, and more encouraging explanations.
 *
 * @param {Object} rawTimeline - Raw timeline from the Planner stage
 * @param {string} country     - Country code ("IN" or "US")
 * @returns {Promise<Object>} Enhanced timeline data
 */
async function runExplainer(rawTimeline, country) {
    const systemPrompt = loadPrompt("system");
    const explainerTemplate = loadPrompt("explainer");

    const prompt = explainerTemplate
        .replace("{{roadmapJSON}}", JSON.stringify(rawTimeline))
        .replace("{{country}}", country === "IN" ? "India" : "United States");

    return callWithRetry(async () => {
        return withTiming("Explainer", async () => {
            const result = await generate(prompt, systemPrompt, timelineSchema);
            logger.info("Explainer: Explanations enhanced");
            return result;
        });
    });
}

// ---------------------------------------------------------------------------
// STAGE 3 — Verifier: Validate accuracy
// ---------------------------------------------------------------------------

/**
 * Stage 3 of the AI pipeline. Cross-references the enhanced timeline against
 * civic data, assigns confidence scores, and flags uncertainties.
 *
 * @param {Object} enhancedTimeline - Enhanced timeline from the Explainer stage
 * @param {Object|null} contextData - Civic/election data for verification
 * @param {string} country          - Country code ("IN" or "US")
 * @returns {Promise<Object>} Verified timeline data
 */
async function runVerifier(enhancedTimeline, contextData, country) {
    const systemPrompt = loadPrompt("system");
    const verifierTemplate = loadPrompt("verifier");

    const prompt = verifierTemplate
        .replace("{{generatedContent}}", JSON.stringify(enhancedTimeline))
        .replace("{{civicData}}", contextData ? JSON.stringify(contextData) : "No election data available")
        .replace("{{country}}", country === "IN" ? "India" : "United States");

    return callWithRetry(async () => {
        return withTiming("Verifier", async () => {
            const result = await generate(prompt, systemPrompt, timelineSchema);
            logger.info("Verifier: Verification complete");
            return result;
        });
    });
}

// ---------------------------------------------------------------------------
// PUBLIC: Full 3-stage pipeline
// ---------------------------------------------------------------------------

/**
 * Runs the full 3-stage AI pipeline (Planner → Explainer → Verifier) to
 * generate a verified, user-friendly election timeline.
 *
 * Results are cached in Firestore/memory to avoid redundant API calls for
 * identical requests.
 *
 * @param {Object} context - Full user context
 * @param {string} context.location      - User's location
 * @param {string} context.country       - Detected country code
 * @param {string} context.electionType  - Type of election
 * @param {boolean} context.firstTimeVoter - First-time voter flag
 * @param {Object|null} context.contextData - Civic/election data
 * @returns {Promise<Object>} Final verified timeline
 * @throws {Error} If the pipeline fails entirely
 */
export async function generateTimeline(context) {
    const country = context.country || "US";

    // Check cache first
    const cacheKey = generateCacheKey(
        "timeline",
        context.location,
        context.electionType,
        context.firstTimeVoter,
        country
    );
    const cached = await cacheGet(cacheKey);
    if (cached) {
        logger.info("Timeline served from cache", { location: context.location });
        return cached;
    }

    try {
        // Stage 1 — Plan
        const rawTimeline = await runPlanner(context);

        // Stage 2 — Explain (enhance clarity)
        let enhanced;
        try {
            enhanced = await runExplainer(rawTimeline, country);
        } catch (err) {
            logger.warn("Explainer failed, using raw timeline", { error: err.message });
            enhanced = rawTimeline;
        }

        // Stage 3 — Verify (validate facts)
        let verified;
        try {
            verified = await runVerifier(enhanced, context.contextData, country);
        } catch (err) {
            logger.warn("Verifier failed, using enhanced timeline", { error: err.message });
            verified = enhanced;
        }

        logger.info(`Full 3-stage pipeline complete (${country})`, {
            stepsCount: verified.timeline?.length || 0,
        });

        // Cache the result
        await cacheSet(cacheKey, verified, CACHE_TTL.TIMELINE);

        return verified;
    } catch (error) {
        logger.error("Pipeline error", { error: error.message });
        throw new Error(`Failed to generate election roadmap: ${error.message}`);
    }
}

// ---------------------------------------------------------------------------
// PUBLIC: Chat Q&A
// ---------------------------------------------------------------------------

/**
 * Handles a conversational election Q&A query. Generates a structured
 * response with answer, details, sources, and follow-up suggestions.
 *
 * @param {string} question            - User's question text
 * @param {Object} [userContext={}]     - Optional user context (location, etc.)
 * @param {Array}  [conversationHistory=[]] - Previous conversation messages
 * @returns {Promise<Object>} Structured chat response
 * @throws {Error} If the Gemini API call fails
 */
export async function generateChat(question, userContext = {}, conversationHistory = []) {
    const systemPrompt = loadPrompt("system");
    const chatTemplate = loadPrompt("chat");

    const historyText = conversationHistory
        .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
        .join("\n");

    const prompt = chatTemplate
        .replace("{{location}}", userContext.location || "Not specified")
        .replace("{{electionType}}", userContext.electionType || "Not specified")
        .replace("{{firstTimeVoter}}", userContext.firstTimeVoter ? "Yes" : "Not specified")
        .replace("{{conversationHistory}}", historyText || "No previous conversation")
        .replace("{{question}}", question);

    return callWithRetry(async () => {
        return withTiming("Chat", async () => {
            const result = await generate(prompt, systemPrompt, chatSchema);
            logger.info("Chat response generated", {
                questionLength: question.length,
                hasDetails: !!(result.details?.length),
            });
            return result;
        });
    });
}

// ---------------------------------------------------------------------------
// PUBLIC: Explain a single step (on-demand)
// ---------------------------------------------------------------------------

/**
 * Generates a detailed, friendly explanation of a single timeline step.
 * Covers what to do, why it matters, common mistakes, and tips.
 *
 * @param {Object} stepData              - Step data with step, action, time fields
 * @param {string} stepData.step         - Step title
 * @param {string} [stepData.action]     - Step action description
 * @param {string} [stepData.time]       - Step deadline or time estimate
 * @param {Object} [userContext={}]      - Optional user context
 * @returns {Promise<Object>} Explanation with tips and common mistakes
 */
export async function explainStep(stepData, userContext = {}) {
    const systemPrompt = loadPrompt("system");

    const prompt = `Explain the following election step in simple, friendly language for a voter in ${userContext.location || "the United States"}.

Step: ${stepData.step}
Action: ${stepData.action}
Time: ${stepData.time}

Provide a detailed, encouraging explanation that covers:
1. What exactly to do (step by step)
2. Why it matters
3. Common mistakes to avoid
4. Helpful tips

Respond with valid JSON matching the required schema exactly.`;

    return callWithRetry(async () => {
        return withTiming("ExplainStep", async () => {
            const result = await generate(prompt, systemPrompt, explainSchema);
            logger.info("Step explanation generated", { step: stepData.step });
            return result;
        });
    });
}
