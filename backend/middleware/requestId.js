/**
 * @module requestId
 * @fileoverview Request ID and Response Timing Middleware.
 * Generates a unique request ID for every incoming request for end-to-end
 * tracing across logs and Google Cloud services. Also tracks response latency.
 *
 * Supports Google Cloud Trace correlation via X-Cloud-Trace-Context header.
 */

import crypto from "crypto";

/**
 * Middleware that assigns a unique request ID to each incoming request.
 * - Checks for an existing `X-Request-Id` header (e.g., from a load balancer)
 * - Falls back to generating a new UUID
 * - Attaches the ID to `req.requestId` and the `X-Request-Id` response header
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requestIdMiddleware(req, res, next) {
    const requestId = req.headers["x-request-id"]
        || req.headers["x-cloud-trace-context"]?.split("/")[0]
        || crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    next();
}

/**
 * Middleware that records the start time and adds response latency
 * via the `X-Response-Time` header. Uses a workaround to set the
 * header before the response is finalized.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function responseTimeMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    // Intercept writeHead to add response time header before sending
    const originalWriteHead = res.writeHead.bind(res);
    res.writeHead = function (statusCode, ...args) {
        const durationNs = process.hrtime.bigint() - start;
        const durationMs = Number(durationNs / 1_000_000n);
        if (!res.headersSent) {
            res.setHeader("X-Response-Time", `${durationMs}ms`);
        }
        return originalWriteHead(statusCode, ...args);
    };

    next();
}
