'use client';

import { motion } from 'framer-motion';

export default function LoadingSkeleton() {
    return (
        <div className="w-full max-w-3xl mx-auto space-y-6" role="status" aria-label="Loading election roadmap">
            {/* Summary skeleton */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel p-8 space-y-6"
            >
                <div className="shimmer h-5 w-32 rounded" />
                <div className="shimmer h-8 w-64 rounded" />
                <div className="shimmer h-4 w-48 rounded" />
                <div className="grid grid-cols-2 gap-4">
                    <div className="shimmer h-20 rounded-xl" />
                    <div className="shimmer h-20 rounded-xl" />
                </div>
                <div className="flex gap-2">
                    <div className="shimmer h-7 w-24 rounded-lg" />
                    <div className="shimmer h-7 w-28 rounded-lg" />
                    <div className="shimmer h-7 w-20 rounded-lg" />
                </div>
            </motion.div>

            {/* Explanation skeleton */}
            <div className="glass-panel p-6 space-y-3">
                <div className="shimmer h-4 w-24 rounded" />
                <div className="shimmer h-3 w-full rounded" />
                <div className="shimmer h-3 w-[90%] rounded" />
                <div className="shimmer h-3 w-[75%] rounded" />
            </div>

            {/* Step skeletons */}
            {[0, 1, 2, 3].map(i => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-panel p-5 flex items-start gap-4"
                >
                    <div className="shimmer w-[18px] h-[18px] rounded-full shrink-0 mt-1" />
                    <div className="flex-1 space-y-3">
                        <div className="shimmer h-5 w-48 rounded" />
                        <div className="shimmer h-3 w-full rounded" />
                        <div className="shimmer h-3 w-[60%] rounded" />
                    </div>
                </motion.div>
            ))}

            <span className="sr-only">Loading your personalized election roadmap...</span>
        </div>
    );
}
