'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HeroSection from '../components/HeroSection';
import ChatPanel from '../components/ChatPanel';
import ChatMode from '../components/ChatMode';
import TimelineView from '../components/TimelineView';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { generateTimeline } from '../lib/api';
import { Vote } from 'lucide-react';

const VIEW = { HERO: 'hero', GUIDE: 'guide', CHAT: 'chat', LOADING: 'loading', TIMELINE: 'timeline' };

export default function Home() {
    const [view, setView] = useState(VIEW.HERO);
    const [timelineData, setTimelineData] = useState(null);
    const [error, setError] = useState(null);

    const handleGenerate = async (context) => {
        setError(null);
        setView(VIEW.LOADING);
        try {
            const data = await generateTimeline(context);
            setTimelineData(data);
            setView(VIEW.TIMELINE);
        } catch (err) {
            setError(err.message || 'Failed to generate your roadmap. Please try again.');
            setView(VIEW.GUIDE);
        }
    };

    return (
        <main className="min-h-screen relative overflow-hidden" id="app-root">
            {/* Persistent header for non-hero views */}
            {view !== VIEW.HERO && (
                <motion.header
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky top-0 z-50 px-4 py-3 backdrop-blur-xl bg-[#06080f]/80 border-b border-gray-800/50"
                >
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <button
                            onClick={() => { setView(VIEW.HERO); setTimelineData(null); setError(null); }}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            id="header-logo"
                        >
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                <Vote className="w-4 h-4 text-indigo-400" />
                            </div>
                            <span className="text-lg font-bold text-white">
                                Path<span className="gradient-text">2</span>Poll
                            </span>
                        </button>
                        <div className="flex items-center gap-2">
                            {view !== VIEW.CHAT && view !== VIEW.LOADING && (
                                <button
                                    onClick={() => setView(VIEW.CHAT)}
                                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800/50 transition-all"
                                    id="header-chat"
                                >
                                    Ask a Question
                                </button>
                            )}
                            {view !== VIEW.GUIDE && view !== VIEW.LOADING && (
                                <button
                                    onClick={() => setView(VIEW.GUIDE)}
                                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-gray-800/50 transition-all"
                                    id="header-guide"
                                >
                                    Get Roadmap
                                </button>
                            )}
                        </div>
                    </div>
                </motion.header>
            )}

            <div className={`${view === VIEW.HERO ? '' : 'max-w-4xl mx-auto px-4 py-8'}`}>
                <AnimatePresence mode="wait">
                    {view === VIEW.HERO && (
                        <motion.div key="hero" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
                            <HeroSection
                                onStartGuide={() => setView(VIEW.GUIDE)}
                                onStartChat={() => setView(VIEW.CHAT)}
                            />
                        </motion.div>
                    )}

                    {view === VIEW.GUIDE && (
                        <motion.div key="guide" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center justify-center min-h-[70vh]">
                            {error && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg mx-auto mb-4 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-center text-sm">
                                    {error}
                                </motion.div>
                            )}
                            <ChatPanel onGenerate={handleGenerate} onBack={() => setView(VIEW.HERO)} />
                        </motion.div>
                    )}

                    {view === VIEW.CHAT && (
                        <motion.div key="chat" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                            <ChatMode onBack={() => setView(VIEW.HERO)} />
                        </motion.div>
                    )}

                    {view === VIEW.LOADING && (
                        <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="pt-8">
                            <div className="text-center mb-8">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} className="w-10 h-10 mx-auto mb-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full" />
                                <h3 className="text-lg font-semibold text-white mb-1">Generating your election roadmap</h3>
                                <p className="text-sm text-gray-500">Our AI is analyzing election rules for your location...</p>
                            </div>
                            <LoadingSkeleton />
                        </motion.div>
                    )}

                    {view === VIEW.TIMELINE && timelineData && (
                        <motion.div key="timeline" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                            <TimelineView data={timelineData} onBack={() => { setTimelineData(null); setView(VIEW.GUIDE); }} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
