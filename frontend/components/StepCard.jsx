'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Clock, FileText, CheckCircle2, Lightbulb, AlertTriangle, Shield } from 'lucide-react';

const confidenceColors = {
    high: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Verified' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Likely Accurate' },
    low: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Verify Locally' },
};

export default function StepCard({ step, index, total }) {
    const [expanded, setExpanded] = useState(false);
    const [done, setDone] = useState(false);
    const conf = confidenceColors[step.confidence] || confidenceColors.medium;

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative"
        >
            {/* Timeline connector */}
            {index < total - 1 && (
                <div className="absolute left-[23px] top-[56px] bottom-[-16px] w-[2px] bg-gradient-to-b from-indigo-500/30 to-indigo-500/5 hidden md:block" aria-hidden="true" />
            )}

            <div className={`glass-panel-hover p-1 md:flex items-start group ${done ? 'opacity-60' : ''}`}>
                {/* Timeline node */}
                <div className="hidden md:flex flex-col items-center p-4" aria-hidden="true">
                    <motion.div
                        animate={{ scale: expanded ? 1.2 : 1 }}
                        className={`w-[18px] h-[18px] rounded-full z-10 transition-all ${done ? 'bg-emerald-500 border-4 border-emerald-500/30' : 'bg-gray-900 border-4 border-indigo-500 glow-dot'}`}
                    />
                </div>

                {/* Content */}
                <div className="p-5 flex-1 w-full">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex justify-between items-start w-full text-left"
                        aria-expanded={expanded}
                        aria-controls={`step-details-${index}`}
                    >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-indigo-400/60 font-mono font-bold text-sm mt-0.5 shrink-0">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                                <h3 className={`text-base font-semibold group-hover:text-indigo-300 transition-colors ${done ? 'line-through text-gray-500' : 'text-white'}`}>
                                    {step.step}
                                </h3>
                                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{step.action}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                            {step.confidence && (
                                <span className={`badge text-[10px] ${conf.bg} ${conf.text} ${conf.border} hidden sm:flex`}>
                                    <Shield className="w-3 h-3 mr-1" />{conf.label}
                                </span>
                            )}
                            <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-gray-500">
                                <ChevronDown className="w-5 h-5" />
                            </motion.div>
                        </div>
                    </button>

                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                id={`step-details-${index}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-4 mt-4 border-t border-gray-700/30 space-y-4">
                                    {/* Time */}
                                    <div className="flex items-start gap-3 text-sm">
                                        <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                        <div><span className="text-gray-400 font-medium">When: </span><span className="text-gray-300">{step.time}</span></div>
                                    </div>

                                    {/* Why it matters */}
                                    {step.why && (
                                        <div className="flex items-start gap-3 text-sm">
                                            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                            <div><span className="text-gray-400 font-medium">Why it matters: </span><span className="text-gray-300">{step.why}</span></div>
                                        </div>
                                    )}

                                    {/* Documents */}
                                    {step.documents?.length > 0 && (
                                        <div className="flex items-start gap-3 text-sm">
                                            <FileText className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-gray-400 font-medium">Documents needed:</span>
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {step.documents.map((doc, j) => (
                                                        <span key={j} className="text-xs bg-gray-800/60 text-gray-300 px-2.5 py-1 rounded-md border border-gray-700/40">{doc}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tip */}
                                    {step.tip && (
                                        <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-3 flex items-start gap-3">
                                            <AlertTriangle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                            <p className="text-xs text-gray-300"><span className="font-medium text-indigo-300">Tip: </span>{step.tip}</p>
                                        </div>
                                    )}

                                    {/* Mark done */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setDone(!done); }}
                                        className={`flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg transition-all ${done ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800/50 text-gray-400 border border-gray-700/30 hover:text-white'}`}
                                        id={`mark-done-${index}`}
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {done ? 'Completed' : 'Mark as done'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
}
