/**
 * @fileoverview Frontend API client for Path2Poll backend.
 * Provides functions for all API endpoints with built-in error handling,
 * request timeouts, and input sanitization.
 */

/** @type {string} Base URL for API requests — auto-detects local vs production */
const API_BASE = typeof window !== 'undefined'
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8080'
        : ''
    : '';

/** @type {number} Default request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes (Gemini pipeline can take time)

/**
 * Sanitizes a string input by stripping HTML tags and trimming whitespace.
 *
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Makes a POST request to the API with JSON body, timeout support,
 * and standardized error handling.
 *
 * @param {string} endpoint - API endpoint path (e.g., "/api/timeline")
 * @param {Object} body     - Request body to send as JSON
 * @param {Object} [options] - Additional options
 * @param {number} [options.timeoutMs] - Custom timeout in milliseconds
 * @param {AbortSignal} [options.signal] - AbortController signal for cancellation
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} On network failure, timeout, or non-ok HTTP response
 */
async function apiRequest(endpoint, body, options = {}) {
    const { timeoutMs = REQUEST_TIMEOUT_MS, signal } = options;

    // Create timeout abort controller
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    // Combine external signal with timeout signal
    const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: combinedSignal,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.details || err.error || `Server responded with ${res.status}`);
        }

        return res.json();
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error('Request timed out. Please try again.');
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Generates a personalized election timeline/roadmap.
 *
 * @param {Object} context - User context for timeline generation
 * @param {string} context.location - User's location (city, state/country)
 * @param {string} [context.electionType="General"] - Type of election
 * @param {boolean} [context.firstTimeVoter=false] - Whether user is first-time voter
 * @param {Object} [options] - Request options (timeoutMs, signal)
 * @returns {Promise<Object>} Generated timeline data
 */
export async function generateTimeline(context, options) {
    return apiRequest('/api/timeline', {
        ...context,
        location: sanitizeInput(context.location),
    }, options);
}

/**
 * Sends a chat message and receives a structured AI response.
 *
 * @param {string} message - User's question about elections
 * @param {Object} [userContext={}] - User context (location, electionType)
 * @param {Array} [conversationHistory=[]] - Previous messages for context
 * @param {Object} [options] - Request options (timeoutMs, signal)
 * @returns {Promise<Object>} Chat response with answer, sources, follow-ups
 */
export async function sendChatMessage(message, userContext = {}, conversationHistory = [], options) {
    return apiRequest('/api/chat', {
        message: sanitizeInput(message),
        userContext,
        conversationHistory,
    }, options);
}

/**
 * Fetches election data for a given address.
 *
 * @param {string} address - Address to look up
 * @param {Object} [options] - Request options (timeoutMs, signal)
 * @returns {Promise<Object>} Election data (voter info, representatives, etc.)
 */
export async function getElectionData(address, options) {
    return apiRequest('/api/election-data', {
        address: sanitizeInput(address),
    }, options);
}

/**
 * Gets a detailed explanation of a single timeline step.
 *
 * @param {Object} step - Step data to explain
 * @param {Object} [userContext={}] - User context for personalization
 * @param {Object} [options] - Request options (timeoutMs, signal)
 * @returns {Promise<Object>} Detailed explanation with tips and common mistakes
 */
export async function explainStep(step, userContext = {}, options) {
    return apiRequest('/api/explain-step', { step, userContext }, options);
}
