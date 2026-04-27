// ---------------------------------------------------------------------------
// Google Cloud Structured Logging Service
// ---------------------------------------------------------------------------
// In Cloud Run, structured JSON written to stdout is automatically ingested
// by Google Cloud Logging. This module provides a consistent logging interface
// that outputs structured JSON in production (for Cloud Logging) and
// human-readable console output in development.
// ---------------------------------------------------------------------------

/**
 * @typedef {'DEBUG'|'INFO'|'WARNING'|'ERROR'|'CRITICAL'} Severity
 */

/**
 * Determines whether the app is running inside Google Cloud (Cloud Run).
 * Cloud Run sets the K_SERVICE environment variable automatically.
 * @returns {boolean}
 */
function isCloudEnvironment() {
    return !!(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
}

/**
 * Retrieves the Google Cloud project ID from environment.
 * Cloud Run auto-injects GOOGLE_CLOUD_PROJECT.
 * @returns {string|null}
 */
function getProjectId() {
    return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null;
}

/**
 * Writes a structured log entry. In Cloud Run, JSON to stdout is
 * automatically picked up by Google Cloud Logging.
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

    // In Cloud environment, write JSON to stdout/stderr for Cloud Logging
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

/**
 * Logger instance with methods for each severity level.
 * Outputs structured JSON in Google Cloud, readable text locally.
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
