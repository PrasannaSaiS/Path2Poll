/**
 * @module loggingService
 * @fileoverview Google Cloud Logging integration for Path2Poll.
 *
 * Uses the official `@google-cloud/logging` client library in Cloud Run
 * environments for direct, structured log ingestion into Google Cloud
 * Operations Suite. Falls back to structured JSON on stdout (also
 * auto-ingested by Cloud Logging) and readable console output locally.
 *
 * Features:
 * - Severity levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
 * - Cloud Trace correlation via `logging.googleapis.com/trace`
 * - Service context metadata for Error Reporting integration
 * - Child loggers with preset fields for request-scoped context
 * - Performance timing utility (withTiming)
 */

// ---------------------------------------------------------------------------
// Cloud Logging client (lazy-initialized)
// ---------------------------------------------------------------------------

let cloudLogging = null;
let cloudLog = null;
let cloudInitialized = false;

/**
 * Lazily initializes the Google Cloud Logging client.
 * Only succeeds in Cloud Run or when GOOGLE_CLOUD_PROJECT is set.
 *
 * @returns {Object|null} The Cloud Logging Log instance, or null
 */
async function getCloudLog() {
    if (cloudInitialized) return cloudLog;
    cloudInitialized = true;

    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
    if (!projectId && !process.env.K_SERVICE) {
        return null;
    }

    try {
        const { Logging } = await import("@google-cloud/logging");
        cloudLogging = new Logging({ projectId });
        cloudLog = cloudLogging.log("path2poll-app");
        // Write init confirmation to stdout (always works)
        process.stdout.write(JSON.stringify({
            severity: "INFO",
            message: "Google Cloud Logging client initialized",
            "logging.googleapis.com/labels": { service: "path2poll" },
        }) + "\n");
        return cloudLog;
    } catch (err) {
        // Fall back to stdout-based logging silently
        return null;
    }
}

// Trigger lazy init on module load (non-blocking)
getCloudLog();

// ---------------------------------------------------------------------------
// Severity type
// ---------------------------------------------------------------------------

/**
 * @typedef {'DEBUG'|'INFO'|'WARNING'|'ERROR'|'CRITICAL'} Severity
 */

// ---------------------------------------------------------------------------
// Core log writer
// ---------------------------------------------------------------------------

/**
 * Determines whether the app is running inside Google Cloud (Cloud Run).
 * Cloud Run sets the K_SERVICE environment variable automatically.
 * @returns {boolean}
 */
function isCloudEnvironment() {
    return !!(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
}

/**
 * Writes a structured log entry using Google Cloud Logging client library
 * when available, or falls back to structured JSON on stdout/stderr.
 *
 * In Cloud Run, structured JSON to stdout is automatically picked up
 * by Google Cloud Logging. The client library provides richer metadata.
 *
 * @param {Severity} severity  - Log severity level
 * @param {string}   message   - Human-readable log message
 * @param {Object}   [fields]  - Additional structured data fields
 */
function writeStructuredLog(severity, message, fields = {}) {
    const entry = {
        severity,
        message,
        timestamp: new Date().toISOString(),
        serviceContext: {
            service: "path2poll",
            version: process.env.K_REVISION || "local",
        },
        ...fields,
    };

    // Add Cloud Trace correlation if available
    if (fields.traceId || process.env.X_CLOUD_TRACE_CONTEXT) {
        const traceContext = fields.traceId || process.env.X_CLOUD_TRACE_CONTEXT;
        const projectId = process.env.GOOGLE_CLOUD_PROJECT;
        if (projectId && traceContext) {
            const traceId = traceContext.split("/")[0];
            entry["logging.googleapis.com/trace"] =
                `projects/${projectId}/traces/${traceId}`;
        }
    }

    // Write using Cloud Logging client if available (fire-and-forget)
    if (cloudLog) {
        const metadata = {
            severity,
            resource: {
                type: "cloud_run_revision",
                labels: {
                    service_name: process.env.K_SERVICE || "path2poll",
                    revision_name: process.env.K_REVISION || "local",
                    location: process.env.CLOUD_RUN_LOCATION || "us-central1",
                },
            },
        };
        const logEntry = cloudLog.entry(metadata, entry);
        cloudLog.write(logEntry).catch(() => {});
    }

    // Always write structured JSON to stdout/stderr as well
    // (Cloud Run auto-ingests this even without the client library)
    if (isCloudEnvironment()) {
        const output = JSON.stringify(entry);
        if (severity === "ERROR" || severity === "CRITICAL") {
            process.stderr.write(output + "\n");
        } else {
            process.stdout.write(output + "\n");
        }
    } else {
        // Development: human-readable output
        const prefix = {
            DEBUG: "🔍",
            INFO: "ℹ️ ",
            WARNING: "⚠️ ",
            ERROR: "❌",
            CRITICAL: "🔥",
        }[severity] || "📝";

        const extra = Object.keys(fields).length > 0
            ? ` | ${JSON.stringify(fields)}`
            : "";

        if (severity === "ERROR" || severity === "CRITICAL") {
            console.error(`${prefix} [${severity}] ${message}${extra}`);
        } else if (severity === "WARNING") {
            console.warn(`${prefix} [${severity}] ${message}${extra}`);
        } else {
            console.log(`${prefix} [${severity}] ${message}${extra}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Logger instance
// ---------------------------------------------------------------------------

/**
 * Logger instance with methods for each severity level.
 * Outputs structured JSON via Google Cloud Logging client in production,
 * and readable text locally.
 *
 * @example
 * logger.info("Timeline generated", { location: "Austin, TX", latencyMs: 1200 });
 * logger.error("Gemini API failed", { error: err.message, attempt: 2 });
 */
export const logger = {
    /**
     * Log a debug-level message.
     * @param {string} message
     * @param {Object} [fields]
     */
    debug(message, fields) {
        writeStructuredLog("DEBUG", message, fields);
    },

    /**
     * Log an info-level message.
     * @param {string} message
     * @param {Object} [fields]
     */
    info(message, fields) {
        writeStructuredLog("INFO", message, fields);
    },

    /**
     * Log a warning-level message.
     * @param {string} message
     * @param {Object} [fields]
     */
    warn(message, fields) {
        writeStructuredLog("WARNING", message, fields);
    },

    /**
     * Log an error-level message.
     * @param {string} message
     * @param {Object} [fields]
     */
    error(message, fields) {
        writeStructuredLog("ERROR", message, fields);
    },

    /**
     * Log a critical-level message.
     * @param {string} message
     * @param {Object} [fields]
     */
    critical(message, fields) {
        writeStructuredLog("CRITICAL", message, fields);
    },
};

// ---------------------------------------------------------------------------
// Child logger factory
// ---------------------------------------------------------------------------

/**
 * Creates a child logger with preset fields that are included in every log entry.
 * Useful for adding request-scoped context (requestId, route, etc.).
 *
 * @param {Object} defaultFields - Fields to include in every log entry
 * @returns {typeof logger} A logger instance with preset fields
 *
 * @example
 * const reqLogger = createChildLogger({ requestId: "abc-123", route: "/api/timeline" });
 * reqLogger.info("Processing request"); // includes requestId and route automatically
 */
export function createChildLogger(defaultFields) {
    return {
        debug: (msg, fields) => logger.debug(msg, { ...defaultFields, ...fields }),
        info: (msg, fields) => logger.info(msg, { ...defaultFields, ...fields }),
        warn: (msg, fields) => logger.warn(msg, { ...defaultFields, ...fields }),
        error: (msg, fields) => logger.error(msg, { ...defaultFields, ...fields }),
        critical: (msg, fields) => logger.critical(msg, { ...defaultFields, ...fields }),
    };
}

// ---------------------------------------------------------------------------
// Timing utility
// ---------------------------------------------------------------------------

/**
 * Measures and logs the execution time of an async operation.
 *
 * @param {string} operationName - Name of the operation being timed
 * @param {Function} fn - Async function to execute and measure
 * @param {Object} [fields] - Additional fields to log
 * @returns {Promise<*>} The result of the async function
 */
export async function withTiming(operationName, fn, fields = {}) {
    const start = performance.now();
    try {
        const result = await fn();
        const latencyMs = Math.round(performance.now() - start);
        logger.info(`${operationName} completed`, { ...fields, latencyMs });
        return result;
    } catch (err) {
        const latencyMs = Math.round(performance.now() - start);
        logger.error(`${operationName} failed`, { ...fields, latencyMs, error: err.message });
        throw err;
    }
}

export default logger;
