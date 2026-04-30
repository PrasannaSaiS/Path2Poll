/**
 * @module GoogleAnalytics
 * @fileoverview Google Analytics 4 (GA4) integration component.
 * Loads the gtag.js script and sends pageview and custom events
 * to Google Analytics for usage tracking and insights.
 *
 * The Measurement ID is configured via the NEXT_PUBLIC_GA_ID
 * environment variable. If not set, no tracking occurs.
 */

'use client';

import { useEffect } from 'react';
import Script from 'next/script';

/** @type {string|undefined} GA4 Measurement ID from environment */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

/**
 * Sends a custom event to Google Analytics.
 *
 * @param {string} action   - Event action name (e.g., "generate_timeline")
 * @param {Object} [params] - Additional event parameters
 */
export function trackEvent(action, params = {}) {
    if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
        window.gtag('event', action, {
            ...params,
            send_to: GA_MEASUREMENT_ID,
        });
    }
}

/**
 * Sends a pageview event to Google Analytics.
 *
 * @param {string} url - The URL of the page being viewed
 */
export function trackPageView(url) {
    if (typeof window !== 'undefined' && window.gtag && GA_MEASUREMENT_ID) {
        window.gtag('config', GA_MEASUREMENT_ID, {
            page_path: url,
        });
    }
}

/**
 * Google Analytics Script component.
 * Renders the gtag.js script tags required for GA4 tracking.
 * Only renders if GA_MEASUREMENT_ID is configured.
 *
 * @returns {JSX.Element|null}
 */
export default function GoogleAnalytics() {
    useEffect(() => {
        if (GA_MEASUREMENT_ID && typeof window !== 'undefined') {
            trackPageView(window.location.pathname);
        }
    }, []);

    if (!GA_MEASUREMENT_ID) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
                id="ga-script"
            />
            <Script id="ga-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
                        page_path: window.location.pathname,
                        anonymize_ip: true,
                        cookie_flags: 'SameSite=None;Secure',
                    });
                `}
            </Script>
        </>
    );
}
