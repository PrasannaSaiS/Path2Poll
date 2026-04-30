/**
 * @module errors
 * @fileoverview Custom error classes for Path2Poll backend.
 * Provides structured, typed errors with HTTP status codes and
 * operational metadata for consistent error handling across the app.
 */

/**
 * Base application error class.
 * Extends the native Error with an HTTP status code and a flag
 * indicating whether the error is operational (expected) or a bug.
 */
export class AppError extends Error {
    /**
     * @param {string}  message       - Human-readable error message
     * @param {number}  [statusCode=500] - HTTP status code
     * @param {boolean} [isOperational=true] - true = expected error, false = bug
     */
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Converts the error to a safe JSON response object.
     * In production, stack traces and internal details are hidden.
     *
     * @param {boolean} [isProduction=false] - Whether to hide internal details
     * @returns {{ error: string, details: string }}
     */
    toJSON(isProduction = false) {
        return {
            error: this.name,
            details: isProduction && !this.isOperational
                ? "An internal error occurred. Please try again."
                : this.message,
        };
    }
}

/**
 * Validation error — thrown when user input fails validation.
 * Always returns HTTP 400.
 */
export class ValidationError extends AppError {
    /**
     * @param {string} message - Description of the validation failure
     */
    constructor(message) {
        super(message, 400, true);
    }
}

/**
 * Not found error — thrown when a requested resource does not exist.
 * Always returns HTTP 404.
 */
export class NotFoundError extends AppError {
    /**
     * @param {string} resource - Name of the missing resource
     */
    constructor(resource) {
        super(`${resource} not found`, 404, true);
    }
}

/**
 * External service error — thrown when a third-party API call fails.
 * Returns HTTP 502 (Bad Gateway).
 */
export class ExternalServiceError extends AppError {
    /**
     * @param {string} serviceName - Name of the external service
     * @param {string} [detail]    - Additional detail about the failure
     */
    constructor(serviceName, detail) {
        super(
            `${serviceName} service error${detail ? `: ${detail}` : ""}`,
            502,
            true
        );
        this.serviceName = serviceName;
    }
}

/**
 * Rate limit error — thrown when a client exceeds the rate limit.
 * Returns HTTP 429.
 */
export class RateLimitError extends AppError {
    constructor() {
        super("Too many requests. Please wait and try again.", 429, true);
    }
}
