'use client';

import { motion } from 'framer-motion';
import { Vote, MessageCircle, Map, Clock, Shield, Sparkles } from 'lucide-react';

const features = [
    {
        icon: Map,
        title: 'Location-Aware',
        description: 'Personalized guidance for Indian & US election rules',
        color: '#6366f1',
    },
    {
        icon: Clock,
        title: 'Timeline Driven',
        description: 'Never miss a deadline with step-by-step schedules and reminders',
        color: '#10b981',
    },
    {
        icon: Shield,
        title: 'Verified Info',
        description: 'AI-verified against ECI, NVSP, Civic API & official sources',
        color: '#f59e0b',
    },
];

const containerVariants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.08, delayChildren: 0.3 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export default function HeroSection({ onStartGuide, onStartChat }) {
    return (
        <section className="relative min-h-[85vh] flex items-center justify-center px-4" aria-label="Path2Poll Hero">
            {/* Background gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
                <div className="absolute top-[-30%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-900/20 blur-[140px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/15 blur-[120px]" />
                <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-cyan-900/10 blur-[100px]" />
                {/* Subtle grid */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '64px 64px',
                    }}
                />
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="relative z-10 max-w-4xl mx-auto text-center"
            >
                {/* Badge */}
                <motion.div variants={itemVariants} className="mb-6">
                    <span className="badge badge-accent inline-flex items-center gap-1.5 text-xs">
                        <Sparkles className="w-3.5 h-3.5" />
                        Powered by Google Gemini AI
                    </span>
                </motion.div>

                {/* Logo */}
                <motion.div variants={itemVariants} className="mb-4 flex items-center justify-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 glow-accent">
                        <Vote className="w-10 h-10 text-indigo-400" aria-hidden="true" />
                    </div>
                </motion.div>

                {/* Title */}
                <motion.h1
                    variants={itemVariants}
                    className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-4"
                >
                    Path<span className="gradient-text">2</span>Poll
                </motion.h1>

                {/* Tagline */}
                <motion.p
                    variants={itemVariants}
                    className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
                >
                    Your AI-powered election assistant for{' '}
                    <span className="text-indigo-300 font-medium">India 🇮🇳</span> and{' '}
                    <span className="text-indigo-300 font-medium">the US 🇺🇸</span>. Get a personalized roadmap to navigate
                    the voting process — from registration to election day.
                </motion.p>

                {/* CTA Buttons */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
                    <button
                        onClick={onStartGuide}
                        className="btn-primary flex items-center justify-center gap-2 text-base px-8 py-4"
                        id="hero-start-guide"
                    >
                        <Map className="w-5 h-5" />
                        Get My Election Roadmap
                    </button>
                    <button
                        onClick={onStartChat}
                        className="btn-secondary flex items-center justify-center gap-2 text-base px-8 py-4"
                        id="hero-start-chat"
                    >
                        <MessageCircle className="w-5 h-5" />
                        Ask a Question
                    </button>
                </motion.div>

                {/* Feature cards */}
                <motion.div
                    variants={itemVariants}
                    className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
                >
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 + index * 0.1 }}
                            className="glass-panel-hover p-5 text-left"
                        >
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                style={{ backgroundColor: `${feature.color}15`, border: `1px solid ${feature.color}30` }}
                            >
                                <feature.icon className="w-5 h-5" style={{ color: feature.color }} aria-hidden="true" />
                            </div>
                            <h3 className="text-sm font-semibold text-white mb-1">{feature.title}</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </motion.div>
        </section>
    );
}
