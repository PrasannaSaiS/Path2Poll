/**
 * @module cacheService
 * @fileoverview Google Cloud Firestore + In-Memory LRU Cache Service.
 *
 * Provides a tiered caching strategy:
 *   1. In-memory LRU cache (fast, always available)
 *   2. Google Cloud Firestore (persistent, shared across Cloud Run instances)
 *
 * When running on Google Cloud Run, Firestore provides cross-instance cache
 * sharing. Locally or when Firestore is unavailable, falls back to in-memory.
 *
 * Google Services: Google Cloud Firestore (@google-cloud/firestore)
 */

import { logger } from "./loggingService.js";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// In-Memory LRU Cache
// ---------------------------------------------------------------------------

/** @type {Map<string, {value: any, expiresAt: number}>} */
const memoryCache = new Map();
const MAX_MEMORY_ENTRIES = 100;

/**
 * Evicts the oldest entry from the in-memory cache if it exceeds the max size.
 */
function evictOldest() {
    if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
    }
}

// ---------------------------------------------------------------------------
// Firestore Client (lazy-initialized)
// ---------------------------------------------------------------------------
let firestoreDb = null;
let firestoreAvailable = false;
let firestoreChecked = false;

/**
 * Lazily initializes the Firestore client. Only attempts once.
 * @returns {Object|null} Firestore instance or null
 */
async function getFirestore() {
    if (firestoreChecked) return firestoreDb;
    firestoreChecked = true;

    // Only attempt Firestore in Cloud environments or when explicitly configured
    if (!process.env.K_SERVICE && !process.env.GOOGLE_CLOUD_PROJECT && !process.env.FIRESTORE_PROJECT_ID) {
        logger.info("Cache: Firestore skipped (not in Cloud environment), using in-memory cache only");
        return null;
    }

    try {
        const { Firestore } = await import("@google-cloud/firestore");
        firestoreDb = new Firestore({
            projectId: process.env.FIRESTORE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
        });
        firestoreAvailable = true;
        logger.info("Cache: Firestore initialized successfully");
        return firestoreDb;
    } catch (err) {
        logger.warn("Cache: Firestore unavailable, using in-memory cache only", {
            error: err.message,
        });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Cache Key Generation
// ---------------------------------------------------------------------------

const COLLECTION_NAME = "path2poll_cache";

/**
 * Generates a deterministic cache key from arbitrary input parameters.
 *
 * @param {...any} parts - Values to include in the cache key
 * @returns {string} A hex-encoded SHA-256 hash
 */
export function generateCacheKey(...parts) {
    const raw = parts.map((p) => (typeof p === "object" ? JSON.stringify(p) : String(p))).join("|");
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieves a value from the cache (memory first, then Firestore).
 *
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} Cached value or null if not found / expired
 */
export async function cacheGet(key) {
    // 1. Check in-memory cache first (fastest)
    const memEntry = memoryCache.get(key);
    if (memEntry) {
        if (Date.now() < memEntry.expiresAt) {
            logger.debug("Cache HIT (memory)", { key: key.slice(0, 8) });
            return memEntry.value;
        }
        memoryCache.delete(key); // Expired
    }

    // 2. Check Firestore (if available)
    const db = await getFirestore();
    if (db) {
        try {
            const doc = await db.collection(COLLECTION_NAME).doc(key).get();
            if (doc.exists) {
                const data = doc.data();
                if (Date.now() < data.expiresAt) {
                    // Populate memory cache for next access
                    evictOldest();
                    memoryCache.set(key, { value: data.value, expiresAt: data.expiresAt });
                    logger.debug("Cache HIT (Firestore)", { key: key.slice(0, 8) });
                    return data.value;
                }
                // Expired in Firestore — delete asynchronously
                db.collection(COLLECTION_NAME).doc(key).delete().catch(() => {});
            }
        } catch (err) {
            logger.warn("Cache: Firestore read error", { error: err.message });
        }
    }

    logger.debug("Cache MISS", { key: key.slice(0, 8) });
    return null;
}

/**
 * Stores a value in the cache (both memory and Firestore).
 *
 * @param {string} key   - Cache key
 * @param {any}    value - Value to cache (must be JSON-serializable)
 * @param {number} ttlMs - Time-to-live in milliseconds
 * @returns {Promise<void>}
 */
export async function cacheSet(key, value, ttlMs) {
    const expiresAt = Date.now() + ttlMs;

    // 1. Always set in memory
    evictOldest();
    memoryCache.set(key, { value, expiresAt });

    // 2. Persist to Firestore (non-blocking)
    const db = await getFirestore();
    if (db) {
        try {
            await db.collection(COLLECTION_NAME).doc(key).set({
                value,
                expiresAt,
                createdAt: Date.now(),
            });
            logger.debug("Cache SET (memory + Firestore)", { key: key.slice(0, 8), ttlMs });
        } catch (err) {
            logger.warn("Cache: Firestore write error", { error: err.message });
        }
    } else {
        logger.debug("Cache SET (memory only)", { key: key.slice(0, 8), ttlMs });
    }
}

/**
 * Clears all entries from the in-memory cache.
 * Firestore entries are left to expire via TTL.
 */
export function cacheClear() {
    memoryCache.clear();
    logger.info("Cache: Memory cache cleared");
}

/**
 * Returns cache statistics for monitoring.
 *
 * @returns {{memorySize: number, firestoreAvailable: boolean}}
 */
export function cacheStats() {
    return {
        memorySize: memoryCache.size,
        firestoreAvailable,
    };
}

// Cache TTL constants (exported for consumers)
export const CACHE_TTL = {
    /** 24 hours — for AI-generated timeline responses */
    TIMELINE: 24 * 60 * 60 * 1000,
    /** 1 hour — for Civic API election data */
    ELECTION_DATA: 60 * 60 * 1000,
    /** 10 minutes — for Civic API voter info */
    CIVIC_API: 10 * 60 * 1000,
};
