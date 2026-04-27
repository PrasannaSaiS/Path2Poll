// ---------------------------------------------------------------------------
// Input Validation Middleware
// ---------------------------------------------------------------------------
// Centralized request validation for all API endpoints.
// Provides consistent error response format and reusable validators.
// ---------------------------------------------------------------------------

import { logger } from "../services/loggingService.js";

/**
 * Standard error response shape for validation failures.
 *
 * @param {import('express').Response} res
 * @param {string} error   - Short error description
 * @param {string} details - Detailed guidance for the user
 * @param {number} [status=400] - HTTP status code
 */
function validationError(res, error, details, status = 400) {
    return res.status(status).json({ error, details });
}

/**
 * Sanitizes a string by trimming and removing potentially dangerous characters.
 * Strips HTML tags and limits length.
 *
 * @param {string} input - Raw input string
 * @param {number} [maxLength=500] - Maximum allowed length
 * @returns {string} Sanitized string
 */
export function sanitizeString(input, maxLength = 500) {
    if (typeof input !== "string") return "";
    return input
        .trim()
        .replace(/<[^>]*>/g, "") // Strip HTML tags
        .replace(/[<>]/g, "")    // Remove remaining angle brackets
        .slice(0, maxLength);
}

/**
 * Validates the POST /api/timeline request body.
 * Requires a valid `location` string (≥2 chars).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateTimeline(req, res, next) {
    const { location, electionType, firstTimeVoter } = req.body;

    if (!location || typeof location !== "string") {
        return validationError(res, "Location is required", "Please provide a valid address or location.");
    }

    const sanitized = sanitizeString(location);
    if (sanitized.length < 2) {
        return validationError(res, "Location is too short", "Please provide at least a city and state/country.");
    }

    // Sanitize and normalize the request body
    req.body.location = sanitized;
    req.body.electionType = sanitizeString(electionType || "General", 100);
    req.body.firstTimeVoter = Boolean(firstTimeVoter);

    next();
}

/**
 * Validates the POST /api/chat request body.
 * Requires a non-empty `message` string.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateChat(req, res, next) {
    const { message, userContext, conversationHistory } = req.body;

    if (!message || typeof message !== "string") {
        return validationError(res, "Message is required", "Please provide a question about the election process.");
    }

    const sanitized = sanitizeString(message, 2000);
    if (sanitized.length === 0) {
        return validationError(res, "Message is empty", "Please provide a valid question.");
    }

    req.body.message = sanitized;
    req.body.userContext = userContext && typeof userContext === "object" ? userContext : {};
    req.body.conversationHistory = Array.isArray(conversationHistory) ? conversationHistory : [];

    next();
}

/**
 * Validates the POST /api/election-data request body.
 * Requires a valid `address` string (≥2 chars).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateElectionData(req, res, next) {
    const { address } = req.body;

    if (!address || typeof address !== "string") {
        return validationError(res, "Address is required", "Please provide a valid address to look up election data.");
    }

    const sanitized = sanitizeString(address);
    if (sanitized.length < 2) {
        return validationError(res, "Address is too short", "Please provide a more specific address.");
    }

    req.body.address = sanitized;
    next();
}

/**
 * Validates the POST /api/explain-step request body.
 * Requires a `step` object with at least a `step` field.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateExplainStep(req, res, next) {
    const { step, userContext } = req.body;

    if (!step || typeof step !== "object" || !step.step) {
        return validationError(res, "Step data is required", "Please provide the step to explain.");
    }

    req.body.userContext = userContext && typeof userContext === "object" ? userContext : {};
    next();
}
