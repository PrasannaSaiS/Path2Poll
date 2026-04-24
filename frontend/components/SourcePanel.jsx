'use client';

import { motion } from 'framer-motion';
import { ExternalLink, Shield, Globe } from 'lucide-react';

export default function SourcePanel({ source, additionalSources }) {
    const allSources = [source, ...(additionalSources || [])].filter(Boolean);

    if (allSources.length === 0) return null;

    const formatUrl = (url) => {
        try {
            const u = new URL(url.startsWith('http') ? url : `https://${url}`);
            return u.hostname.replace('www.', '');
        } catch {
            return url;
        }
    };

    const getHref = (url) => url.startsWith('http') ? url : `https://${url}`;

    const isGov = (url) => {
        try {
            const u = new URL(url.startsWith('http') ? url : `https://${url}`);
            return u.hostname.endsWith('.gov');
        } catch {
            return false;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="glass-panel p-6"
        >
            <h3 className="flex items-center text-sm font-semibold text-gray-300 mb-4">
                <Globe className="w-4 h-4 mr-2 text-indigo-400" />
                Official Sources
            </h3>
            <div className="space-y-2">
                {allSources.map((src, i) => (
                    <a
                        key={i}
                        href={getHref(src)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-900/30 border border-gray-700/30 hover:border-indigo-500/30 transition-all group"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            {isGov(src) ? (
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <Shield className="w-4 h-4 text-emerald-400" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-700/30 flex items-center justify-center shrink-0">
                                    <Globe className="w-4 h-4 text-gray-400" />
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-sm text-gray-200 font-medium truncate group-hover:text-indigo-300 transition-colors">
                                    {formatUrl(src)}
                                </div>
                                {isGov(src) && (
                                    <span className="text-[10px] text-emerald-400 font-medium">Official Government Source</span>
                                )}
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </a>
                ))}
            </div>
            <p className="text-[11px] text-gray-600 mt-4 leading-relaxed">
                Always verify election information with your local election office. Dates and requirements may change.
            </p>
        </motion.div>
    );
}
