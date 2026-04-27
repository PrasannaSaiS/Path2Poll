'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, ArrowLeft, Bot, User, ExternalLink, ChevronRight } from 'lucide-react';
import { sendChatMessage } from '../lib/api';

export default function ChatMode({ onBack }) {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: { answer: "Hi! I'm your Path2Poll election assistant. Ask me anything about the voting process — registration, deadlines, what to bring, or how elections work in your area.", follow_up_questions: ["How do I register to vote?", "What ID do I need to vote?", "When is the next election?"], needs_info: "" } }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [userCtx, setUserCtx] = useState({});
    const endRef = useRef(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const send = async (text) => {
        const q = text || input.trim();
        if (!q || loading) return;
        setInput('');
        const userMsg = { role: 'user', content: q };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);
        try {
            const history = messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : m.content.answer }));
            const res = await sendChatMessage(q, userCtx, history);
            setMessages(prev => [...prev, { role: 'assistant', content: res }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', content: { answer: "Sorry, I had trouble processing that. Please try again.", follow_up_questions: [], needs_info: "" } }]);
        }
        setLoading(false);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto flex flex-col h-[75vh]">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800/50" id="chat-back">
                    <ArrowLeft className="w-4 h-4"/>Home
                </button>
                <div className="flex-1"/>
                <span className="badge badge-accent text-xs">Chat Mode</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4 min-h-0" role="log" aria-live="polite" aria-label="Chat messages">
                <AnimatePresence initial={false}>
                    {messages.map((msg, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-1">
                                    <Bot className="w-4 h-4 text-indigo-400"/>
                                </div>
                            )}
                            <div className={`max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600/20 border border-indigo-500/30' : 'glass-panel'} rounded-2xl p-4`}>
                                {msg.role === 'user' ? (
                                    <p className="text-sm text-white">{msg.content}</p>
                                ) : (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.content.answer}</p>
                                        {msg.content.details?.length > 0 && (
                                            <div className="space-y-2 pt-2 border-t border-gray-700/30">
                                                {msg.content.details.map((d, j) => (
                                                    <div key={j} className="bg-gray-900/40 rounded-lg p-3">
                                                        <h4 className="text-xs font-semibold text-indigo-300 mb-1">{d.title}</h4>
                                                        <p className="text-xs text-gray-400">{d.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {msg.content.sources?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {msg.content.sources.map((s, j) => (
                                                    <a key={j} href={s.startsWith('http') ? s : `https://${s}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md">
                                                        <ExternalLink className="w-3 h-3"/> Source
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                        {msg.content.follow_up_questions?.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {msg.content.follow_up_questions.map((q, j) => (
                                                    <button key={j} onClick={() => send(q)} className="text-xs bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700/40 hover:border-indigo-500/30 transition-all flex items-center gap-1">
                                                        <ChevronRight className="w-3 h-3"/>{q}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1">
                                    <User className="w-4 h-4 text-emerald-400"/>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-indigo-400"/>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin"/>
                            <span className="text-sm text-gray-400">Thinking...</span>
                        </div>
                    </motion.div>
                )}
                <div ref={endRef}/>
            </div>

            {/* Input */}
            <div className="glass-panel p-3 flex gap-3 items-center mt-2">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about voting, registration, deadlines..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none px-2" id="chat-input" aria-label="Chat message input"/>
                <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary p-3 rounded-xl disabled:opacity-40" id="chat-send" aria-label="Send message">
                    <Send className="w-4 h-4"/>
                </button>
            </div>
        </motion.div>
    );
}
