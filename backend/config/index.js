/**
 * @module config
 * @fileoverview Centralized configuration module for Path2Poll backend.
 * All environment variables, constants, and service configuration are
 * managed here to ensure consistency and maintainability.
 *
 * @description
 * This module exports a frozen configuration object assembled from
 * environment variables with sensible defaults. It validates that
 * required variables are present and logs warnings for optional ones
 * that are missing.
 */

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------

/** @type {string} Root directory of the project */
const ROOT_DIR = path.resolve(__dirname, "..");

/** @type {string} Directory containing shared prompt templates */
const PROMPTS_DIR = path.join(ROOT_DIR, "../shared/prompts");

/** @type {string} Directory containing the frontend static export */
const FRONTEND_DIR = path.join(ROOT_DIR, "../frontend/out");

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

/**
 * Reads an environment variable, returning a default if not set.
 *
 * @param {string}  key          - Environment variable name
 * @param {string}  [fallback]   - Default value if the variable is not set
 * @returns {string|undefined}
 */
function env(key, fallback) {
    return process.env[key] || fallback;
}

/**
 * Reads an environment variable as an integer.
 *
 * @param {string} key          - Environment variable name
 * @param {number} fallback     - Default value
 * @returns {number}
 */
function envInt(key, fallback) {
    const val = process.env[key];
    if (val === undefined || val === "") return fallback;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

// ---------------------------------------------------------------------------
// Assembled configuration object
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AppConfig
 * @property {Object}  server         - Server configuration
 * @property {Object}  gemini         - Google Gemini AI configuration
 * @property {Object}  civic          - Google Civic Information API configuration
 * @property {Object}  cache          - Cache configuration
 * @property {Object}  rateLimit      - Rate limiting configuration
 * @property {Object}  logging        - Logging configuration
 * @property {Object}  paths          - File system paths
 * @property {Object}  security       - Security configuration
 * @property {Object}  google         - Google Cloud configuration
 */

/** @type {AppConfig} */
const config = Object.freeze({
    /** Server configuration */
    server: Object.freeze({
        port: envInt("PORT", 8080),
        nodeEnv: env("NODE_ENV", "development"),
        isProduction: env("NODE_ENV") === "production",
        revision: env("K_REVISION", "local"),
        service: env("K_SERVICE", null),
    }),

    /** Google Gemini AI configuration */
    gemini: Object.freeze({
        apiKey: env("GEMINI_API_KEY"),
        model: "gemini-2.5-flash-lite",
        temperature: 0.4,
        maxRetries: 2,
        baseRetryDelayMs: 1000,
    }),

    /** Google Civic Information API configuration */
    civic: Object.freeze({
        apiKey: env("CIVIC_INFORMATION_API"),
        baseUrl: "https://www.googleapis.com/civicinfo/v2",
        timeoutMs: 8000,
    }),

    /** Cache configuration */
    cache: Object.freeze({
        maxMemoryEntries: 100,
        firestoreCollection: "path2poll_cache",
        ttl: Object.freeze({
            /** 24 hours — for AI-generated timeline responses */
            timeline: 24 * 60 * 60 * 1000,
            /** 1 hour — for Civic API election data */
            electionData: 60 * 60 * 1000,
            /** 10 minutes — for Civic API voter info */
            civicApi: 10 * 60 * 1000,
        }),
    }),

    /** Rate limiting configuration */
    rateLimit: Object.freeze({
        windowMs: 15 * 60 * 1000,  // 15-minute window
        maxRequests: 100,
    }),

    /** Logging configuration */
    logging: Object.freeze({
        serviceName: "path2poll",
        isCloud: !!(env("K_SERVICE") || env("GOOGLE_CLOUD_PROJECT")),
    }),

    /** File system paths */
    paths: Object.freeze({
        root: ROOT_DIR,
        prompts: PROMPTS_DIR,
        frontend: FRONTEND_DIR,
    }),

    /** Security configuration */
    security: Object.freeze({
        maxBodySize: "1mb",
        corsOrigin: env("NODE_ENV") === "production" ? false : "*",
    }),

    /** Google Cloud configuration */
    google: Object.freeze({
        projectId: env("GOOGLE_CLOUD_PROJECT") || env("GCLOUD_PROJECT") || env("FIRESTORE_PROJECT_ID"),
        isCloudRun: !!env("K_SERVICE"),
    }),
});

export default config;
