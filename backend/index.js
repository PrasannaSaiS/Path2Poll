import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { generateTimeline, generateChat, explainStep } from "./services/geminiService.js";
import { getElectionData, buildContextData, detectCountry } from "./services/electionService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load environment variables
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

console.log("┌─────────────────────────────────────────┐");
console.log("│       Path2Poll Backend Starting...      │");
console.log("├─────────────────────────────────────────┤");
console.log(`│  Environment : ${(process.env.NODE_ENV || "development").padEnd(24)}│`);
console.log(`│  Gemini Key  : ${(process.env.GEMINI_API_KEY ? "✓ Present" : "✗ MISSING").padEnd(24)}│`);
console.log(`│  Civic Key   : ${(process.env.CIVIC_INFORMATION_API ? "✓ Present" : "✗ MISSING").padEnd(24)}│`);
console.log("└─────────────────────────────────────────┘");

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
}));
app.use(express.json({ limit: "1mb" }));

// Request logger
app.use((req, _res, next) => {
    if (req.path.startsWith("/api")) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
    res.json({
        status: "healthy",
        service: "Path2Poll",
        timestamp: new Date().toISOString(),
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        civicConfigured: !!process.env.CIVIC_INFORMATION_API,
    });
});

// ---------------------------------------------------------------------------
// POST /api/timeline — Full 3-stage pipeline
// ---------------------------------------------------------------------------
app.post("/api/timeline", async (req, res) => {
    try {
        const { location, electionType, firstTimeVoter } = req.body;

        if (!location || typeof location !== "string" || location.trim().length < 2) {
            return res.status(400).json({
                error: "Location is required",
                details: "Please provide a valid address or location.",
            });
        }

        // Detect country and build appropriate context
        const { country, contextData } = await buildContextData(
            location.trim(),
            electionType || "General"
        );

        const context = {
            location: location.trim(),
            country,
            electionType: electionType || "General",
            firstTimeVoter: Boolean(firstTimeVoter),
            contextData,
        };

        console.log(`[Timeline] Country: ${country === "IN" ? "🇮🇳 India" : "🇺🇸 US"} | Location: ${context.location}`);

        const timeline = await generateTimeline(context);
        res.json(timeline);
    } catch (error) {
        console.error("[Timeline] Error:", error.message);
        res.status(500).json({
            error: "Failed to generate election roadmap",
            details: error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/chat — Conversational Q&A
// ---------------------------------------------------------------------------
app.post("/api/chat", async (req, res) => {
    try {
        const { message, userContext, conversationHistory } = req.body;

        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return res.status(400).json({
                error: "Message is required",
                details: "Please provide a question about the election process.",
            });
        }

        const response = await generateChat(
            message.trim(),
            userContext || {},
            conversationHistory || []
        );

        res.json(response);
    } catch (error) {
        console.error("[Chat] Error:", error.message);
        res.status(500).json({
            error: "Failed to process your question",
            details: error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/election-data — Civic API data
// ---------------------------------------------------------------------------
app.post("/api/election-data", async (req, res) => {
    try {
        const { address } = req.body;

        if (!address || typeof address !== "string" || address.trim().length < 2) {
            return res.status(400).json({
                error: "Address is required",
                details: "Please provide a valid address to look up election data.",
            });
        }

        const data = await getElectionData(address.trim());
        res.json(data);
    } catch (error) {
        console.error("[ElectionData] Error:", error.message);
        res.status(500).json({
            error: "Failed to fetch election data",
            details: error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/explain-step — On-demand step explanation
// ---------------------------------------------------------------------------
app.post("/api/explain-step", async (req, res) => {
    try {
        const { step, userContext } = req.body;

        if (!step || !step.step) {
            return res.status(400).json({
                error: "Step data is required",
                details: "Please provide the step to explain.",
            });
        }

        const explanation = await explainStep(step, userContext || {});
        res.json(explanation);
    } catch (error) {
        console.error("[ExplainStep] Error:", error.message);
        res.status(500).json({
            error: "Failed to explain step",
            details: error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// Serve frontend static files (production)
// ---------------------------------------------------------------------------
const frontendOutPath = path.join(__dirname, "../frontend/out");
app.use(express.static(frontendOutPath, {
    maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
}));

// SPA fallback
app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendOutPath, "index.html"), (err) => {
        if (err) {
            res.status(200).send(`
                <!DOCTYPE html>
                <html><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;background:#0f172a;color:#f8fafc;">
                <div style="text-align:center"><h1>Path2Poll</h1><p>Frontend not built yet. Run <code>cd frontend && npm run build</code></p></div>
                </body></html>
            `);
        }
    });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`\n🗳️  Path2Poll server running on http://localhost:${PORT}\n`);
});