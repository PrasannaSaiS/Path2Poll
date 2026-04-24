'use client';

import { motion } from 'framer-motion';
import StepCard from './StepCard';
import SourcePanel from './SourcePanel';
import { Calendar, AlertCircle, FileText, ArrowLeft, Zap, Shield, Accessibility } from 'lucide-react';

export default function TimelineView({ data, onBack }) {
    const totalSteps = data.timeline?.length || 0;

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
            {/* Summary Card */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 sm:p-8 relative overflow-hidden border-t-2 border-t-indigo-500/50"
            >
                <div className="absolute top-0 right-0 p-6 opacity-[0.04] pointer-events-none" aria-hidden="true">
                    <Calendar className="w-40 h-40 text-indigo-500" />
                </div>

                <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6 px-2 py-1 rounded-lg hover:bg-gray-800/50" id="timeline-back">
                    <ArrowLeft className="w-4 h-4" /> Start Over
                </button>

                <h2 className="text-3xl font-bold text-white mb-1">Your Election Roadmap</h2>
                <p className="text-sm text-gray-500 mb-6">{totalSteps} steps to election day</p>

                <div className="flex items-center gap-2 mb-6">
                    <span className="badge badge-accent">
                        <Zap className="w-3 h-3 mr-1" /> {data.stage}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-700/30">
                        <h4 className="flex items-center text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                            <AlertCircle className="w-3.5 h-3.5 mr-2 text-amber-400" /> Next Step
                        </h4>
                        <p className="text-sm text-white font-medium">{data.next_step}</p>
                    </div>
                    <div className="bg-gray-900/40 p-4 rounded-xl border border-gray-700/30">
                        <h4 className="flex items-center text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                            <Calendar className="w-3.5 h-3.5 mr-2 text-rose-400" /> Deadline
                        </h4>
                        <p className="text-sm text-white font-medium">{data.deadline}</p>
                    </div>
                </div>

                {/* Documents */}
                {data.documents_required?.length > 0 && (
                    <div className="mt-6 pt-5 border-t border-gray-700/20">
                        <h4 className="flex items-center text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                            <FileText className="w-3.5 h-3.5 mr-2 text-indigo-400" /> Required Documents
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.documents_required.map((doc, i) => (
                                <span key={i} className="text-xs bg-gray-800/60 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-700/40">{doc}</span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Accessibility */}
                {data.accessibility_options?.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-gray-700/20">
                        <h4 className="flex items-center text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">
                            <Accessibility className="w-3.5 h-3.5 mr-2 text-cyan-400" /> Accessibility Options
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {data.accessibility_options.map((opt, i) => (
                                <span key={i} className="text-xs bg-cyan-500/10 text-cyan-300 px-3 py-1.5 rounded-lg border border-cyan-500/20">{opt}</span>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Explanation */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="glass-panel p-6 border-l-2 border-l-indigo-500/40"
            >
                <h3 className="flex items-center text-sm font-semibold text-indigo-300 mb-3">
                    <Shield className="w-4 h-4 mr-2" /> Simply Put
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">{data.explanation}</p>
            </motion.div>

            {/* Timeline Steps */}
            <div className="space-y-4 pt-2">
                <h3 className="text-lg font-bold text-white px-2">Step-by-Step Guide</h3>
                {data.timeline?.map((step, i) => (
                    <StepCard key={i} step={step} index={i} total={totalSteps} />
                ))}
            </div>

            {/* Sources */}
            <SourcePanel source={data.official_source} additionalSources={data.additional_sources} />
        </div>
    );
}
