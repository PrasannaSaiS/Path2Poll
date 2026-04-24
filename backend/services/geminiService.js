import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Prompt loader
// ---------------------------------------------------------------------------
const promptsDir = path.join(__dirname, "../../shared/prompts");

function loadPrompt(name) {
    return fs.readFileSync(path.join(promptsDir, `${name}.txt`), "utf8");
}

// ---------------------------------------------------------------------------
// Gemini client (new @google/genai SDK)
// ---------------------------------------------------------------------------
function getAI() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    return new GoogleGenAI({ apiKey });
}

const MODEL = "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// JSON Schemas (plain JSON Schema, not SchemaType enums)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Core generate helper using new SDK
// ---------------------------------------------------------------------------
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
// Retry helper
// ---------------------------------------------------------------------------
async function callWithRetry(fn, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            console.error(`[Gemini] Attempt ${attempt + 1} failed:`, err.message);
            if (attempt === retries) throw err;
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
}

// ---------------------------------------------------------------------------
// STAGE 1 — Planner: Generate raw timeline
// ---------------------------------------------------------------------------
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
        console.log(`[Gemini:Planner] Generating timeline for ${context.location} (${country})...`);
        const result = await generate(prompt, systemPrompt, timelineSchema);
        console.log("[Gemini:Planner] ✓ Raw timeline generated");
        return result;
    });
}

// ---------------------------------------------------------------------------
// STAGE 2 — Explainer: Enhance clarity
// ---------------------------------------------------------------------------
async function runExplainer(rawTimeline, country) {
    const systemPrompt = loadPrompt("system");
    const explainerTemplate = loadPrompt("explainer");

    const prompt = explainerTemplate
        .replace("{{roadmapJSON}}", JSON.stringify(rawTimeline))
        .replace("{{country}}", country === "IN" ? "India" : "United States");

    return callWithRetry(async () => {
        console.log("[Gemini:Explainer] Enhancing explanations...");
        const result = await generate(prompt, systemPrompt, timelineSchema);
        console.log("[Gemini:Explainer] ✓ Explanations enhanced");
        return result;
    });
}

// ---------------------------------------------------------------------------
// STAGE 3 — Verifier: Validate accuracy
// ---------------------------------------------------------------------------
async function runVerifier(enhancedTimeline, contextData, country) {
    const systemPrompt = loadPrompt("system");
    const verifierTemplate = loadPrompt("verifier");

    const prompt = verifierTemplate
        .replace("{{generatedContent}}", JSON.stringify(enhancedTimeline))
        .replace("{{civicData}}", contextData ? JSON.stringify(contextData) : "No election data available")
        .replace("{{country}}", country === "IN" ? "India" : "United States");

    return callWithRetry(async () => {
        console.log("[Gemini:Verifier] Validating accuracy...");
        const result = await generate(prompt, systemPrompt, timelineSchema);
        console.log("[Gemini:Verifier] ✓ Verification complete");
        return result;
    });
}

// ---------------------------------------------------------------------------
// PUBLIC: Full 3-stage pipeline
// ---------------------------------------------------------------------------
export async function generateTimeline(context) {
    const country = context.country || "US";

    try {
        // Stage 1 — Plan
        const rawTimeline = await runPlanner(context);

        // Stage 2 — Explain (enhance clarity)
        let enhanced;
        try {
            enhanced = await runExplainer(rawTimeline, country);
        } catch (err) {
            console.warn("[Gemini:Explainer] Failed, using raw timeline:", err.message);
            enhanced = rawTimeline;
        }

        // Stage 3 — Verify (validate facts)
        let verified;
        try {
            verified = await runVerifier(enhanced, context.contextData, country);
        } catch (err) {
            console.warn("[Gemini:Verifier] Failed, using enhanced timeline:", err.message);
            verified = enhanced;
        }

        console.log(`[Gemini] ✓ Full 3-stage pipeline complete (${country})`);
        return verified;
    } catch (error) {
        console.error("[Gemini] Pipeline error:", error.message);
        throw new Error(`Failed to generate election roadmap: ${error.message}`);
    }
}

// ---------------------------------------------------------------------------
// PUBLIC: Chat Q&A
// ---------------------------------------------------------------------------
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
        console.log(`[Gemini:Chat] Processing question: "${question.substring(0, 60)}..."`);
        const result = await generate(prompt, systemPrompt, chatSchema);
        console.log("[Gemini:Chat] ✓ Chat response generated");
        return result;
    });
}

// ---------------------------------------------------------------------------
// PUBLIC: Explain a single step (on-demand)
// ---------------------------------------------------------------------------
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

Respond as JSON with fields: "explanation" (string), "tips" (array of strings), "common_mistakes" (array of strings).`;

    const explainSchema = {
        type: "object",
        properties: {
            explanation: { type: "string" },
            tips: { type: "array", items: { type: "string" } },
            common_mistakes: { type: "array", items: { type: "string" } },
        },
        required: ["explanation", "tips", "common_mistakes"],
    };

    return callWithRetry(async () => {
        console.log(`[Gemini:Explain] Explaining step: ${stepData.step}`);
        const result = await generate(prompt, systemPrompt, explainSchema);
        return result;
    });
}
