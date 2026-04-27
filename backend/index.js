import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { generateTimeline, generateChat, explainStep } from "./services/geminiService.js";
import { getElectionData, buildContextData } from "./services/electionService.js";
import { logger } from "./services/loggingService.js";
import { cacheStats } from "./services/cacheService.js";
import { requestIdMiddleware, responseTimeMiddleware } from "./middleware/requestId.js";
import {
    validateTimeline,
    validateChat,
    validateElectionData,
    validateExplainStep,
} from "./middleware/validate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Load environment variables
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

logger.info("Path2Poll Backend Starting", {
    environment: process.env.NODE_ENV || "development",
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    civicConfigured: !!process.env.CIVIC_INFORMATION_API,
});

const app = express();

// ---------------------------------------------------------------------------
// Middleware Stack
// ---------------------------------------------------------------------------

// Request ID for log correlation (Cloud Trace compatible)
app.use(requestIdMiddleware);

// Response time tracking
app.use(responseTimeMiddleware);

// Security headers (Helmet)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
                "'self'",
                "http://localhost:*",
                "http://127.0.0.1:*",
                "https://www.googleapis.com",
                "https://generativelanguage.googleapis.com",
            ],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === "production" ? false : "*",
    methods: ["GET", "POST"],
}));

// Gzip compression for all responses
app.use(compression());

// JSON body parsing with size limit
app.use(express.json({ limit: "1mb" }));

// Rate limiting — prevents abuse
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15-minute window
    max: 100,                   // 100 requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "Too many requests",
        details: "Please wait a few minutes before trying again.",
    },
    validate: { xForwardedForHeader: false },
});
app.use("/api/", apiLimiter);

// Structured request logger
app.use((req, _res, next) => {
    if (req.path.startsWith("/api")) {
        logger.info(`${req.method} ${req.path}`, {
            requestId: req.requestId,
            userAgent: req.headers["user-agent"]?.slice(0, 80),
        });
    }
    next();
});

// ---------------------------------------------------------------------------
// GET /api/health — Health check
// ---------------------------------------------------------------------------
/**
 * Health check endpoint for Cloud Run and monitoring.
 * Returns service status, API configuration, and cache statistics.
 */
app.get("/api/health", (_req, res) => {
    const cache = cacheStats();
    res.json({
        status: "healthy",
        service: "Path2Poll",
        version: process.env.K_REVISION || "local",
        timestamp: new Date().toISOString(),
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        civicConfigured: !!process.env.CIVIC_INFORMATION_API,
        cache: {
            memorySize: cache.memorySize,
            firestoreAvailable: cache.firestoreAvailable,
        },
    });
});

// ---------------------------------------------------------------------------
// POST /api/timeline — Full 3-stage pipeline
// ---------------------------------------------------------------------------
/**
 * Generates a personalized election roadmap via the 3-stage AI pipeline.
 * Validates and sanitizes input, detects country, builds context, and
 * returns a structured JSON timeline.
 *
 * @body {string} location - User's address or city+state
 * @body {string} [electionType="General"] - Type of election
 * @body {boolean} [firstTimeVoter=false] - Whether user is a first-time voter
 */
app.post("/api/timeline", validateTimeline, async (req, res) => {
    const startTime = Date.now();
    try {
        const { location, electionType, firstTimeVoter } = req.body;

        // Detect country and build appropriate context
        const { country, contextData } = await buildContextData(
            location,
            electionType
        );

        const context = {
            location,
            country,
            electionType,
            firstTimeVoter,
            contextData,
        };

        logger.info(`Timeline: ${country === "IN" ? "India" : "US"} | ${location}`, {
            requestId: req.requestId,
            country,
            electionType,
        });

        const timeline = await generateTimeline(context);
        const latencyMs = Date.now() - startTime;

        logger.info("Timeline generated successfully", {
            requestId: req.requestId,
            latencyMs,
            stepsCount: timeline.timeline?.length || 0,
        });

        res.json(timeline);
    } catch (error) {
        logger.error("Timeline generation failed", {
            requestId: req.requestId,
            error: error.message,
            latencyMs: Date.now() - startTime,
        });
        res.status(500).json({
            error: "Failed to generate election roadmap",
            details: process.env.NODE_ENV === "production"
                ? "An internal error occurred. Please try again."
                : error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/chat — Conversational Q&A
// ---------------------------------------------------------------------------
/**
 * Handles conversational Q&A about elections.
 * Returns structured answers with sources and follow-up suggestions.
 *
 * @body {string} message - User's question
 * @body {Object} [userContext] - User's location and election context
 * @body {Array} [conversationHistory] - Previous messages in the conversation
 */
app.post("/api/chat", validateChat, async (req, res) => {
    const startTime = Date.now();
    try {
        const { message, userContext, conversationHistory } = req.body;

        const response = await generateChat(
            message,
            userContext,
            conversationHistory
        );

        logger.info("Chat response generated", {
            requestId: req.requestId,
            latencyMs: Date.now() - startTime,
        });

        res.json(response);
    } catch (error) {
        logger.error("Chat processing failed", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({
            error: "Failed to process your question",
            details: process.env.NODE_ENV === "production"
                ? "An internal error occurred. Please try again."
                : error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/election-data — Civic API data
// ---------------------------------------------------------------------------
/**
 * Fetches election data for a given address.
 * Routes to Google Civic Information API (US) or India Knowledge Base.
 *
 * @body {string} address - User's address to look up
 */
app.post("/api/election-data", validateElectionData, async (req, res) => {
    try {
        const { address } = req.body;
        const data = await getElectionData(address);

        logger.info("Election data retrieved", {
            requestId: req.requestId,
            country: data.country,
        });

        res.json(data);
    } catch (error) {
        logger.error("Election data fetch failed", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({
            error: "Failed to fetch election data",
            details: process.env.NODE_ENV === "production"
                ? "An internal error occurred. Please try again."
                : error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// POST /api/explain-step — On-demand step explanation
// ---------------------------------------------------------------------------
/**
 * Provides a detailed explanation of a single timeline step.
 *
 * @body {Object} step - Step data with at least a `step` field
 * @body {Object} [userContext] - User's location and election context
 */
app.post("/api/explain-step", validateExplainStep, async (req, res) => {
    try {
        const { step, userContext } = req.body;
        const explanation = await explainStep(step, userContext);

        logger.info("Step explanation generated", {
            requestId: req.requestId,
            step: step.step,
        });

        res.json(explanation);
    } catch (error) {
        logger.error("Step explanation failed", {
            requestId: req.requestId,
            error: error.message,
        });
        res.status(500).json({
            error: "Failed to explain step",
            details: process.env.NODE_ENV === "production"
                ? "An internal error occurred. Please try again."
                : error.message,
        });
    }
});

// ---------------------------------------------------------------------------
// Serve frontend static files (production)
// ---------------------------------------------------------------------------
const frontendOutPath = path.join(__dirname, "../frontend/out");
app.use(express.static(frontendOutPath, {
    maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
    etag: true,
}));

// SPA fallback
app.get("/{*splat}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendOutPath, "index.html"), (err) => {
        if (err) {
            res.status(200).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="utf-8"><title>Path2Poll</title></head>
                <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;background:#0f172a;color:#f8fafc;">
                <div style="text-align:center"><h1>Path2Poll</h1><p>Frontend not built yet. Run <code>cd frontend && npm run build</code></p></div>
                </body></html>
            `);
        }
    });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
/**
 * Express global error handler. Catches unhandled errors from middleware/routes.
 */
app.use((err, req, res, _next) => {
    logger.error("Unhandled server error", {
        requestId: req.requestId,
        error: err.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    });
    res.status(500).json({
        error: "Internal server error",
        details: process.env.NODE_ENV === "production"
            ? "An unexpected error occurred."
            : err.message,
    });
});

// ---------------------------------------------------------------------------
// Graceful shutdown handler
// ---------------------------------------------------------------------------
let server;

/**
 * Handles graceful shutdown on SIGTERM/SIGINT.
 * Closes the HTTP server and allows in-flight requests to complete.
 */
function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    if (server) {
        server.close(() => {
            logger.info("Server closed. Process exiting.");
            process.exit(0);
        });
        // Force exit after 10s if server hasn't closed
        setTimeout(() => {
            logger.warn("Forced shutdown after timeout");
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, () => {
    logger.info(`Path2Poll server running on http://localhost:${PORT}`, {
        port: PORT,
        nodeVersion: process.version,
    });
});

export default app;