'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Vote, UserCheck, ArrowRight, ArrowLeft, Loader2, CheckCircle, Globe, Calendar, FileText, Landmark, Building2, Users } from 'lucide-react';

const STEPS = [
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'election', label: 'Election', icon: Vote },
    { id: 'voter', label: 'Status', icon: UserCheck },
    { id: 'confirm', label: 'Confirm', icon: CheckCircle },
];

const US_ELECTION_TYPES = [
    { value: 'General', label: 'General Election', icon: Globe, desc: 'Federal, state, and local offices' },
    { value: 'Primary', label: 'Primary Election', icon: Calendar, desc: 'Party candidate selection' },
    { value: 'Local', label: 'Local / Municipal', icon: MapPin, desc: 'City council, mayor, local measures' },
    { value: 'Special', label: 'Special Election', icon: FileText, desc: 'Fill vacancies or special measures' },
];

const INDIA_ELECTION_TYPES = [
    { value: 'Lok Sabha', label: 'Lok Sabha (General)', icon: Landmark, desc: 'Parliamentary / National election for MPs' },
    { value: 'Vidhan Sabha', label: 'Vidhan Sabha (State)', icon: Building2, desc: 'State Legislative Assembly election for MLAs' },
    { value: 'Panchayat', label: 'Panchayat (Local Rural)', icon: Users, desc: 'Gram Panchayat / Zilla Parishad election' },
    { value: 'Municipal', label: 'Municipal (Local Urban)', icon: MapPin, desc: 'Corporation / Council / Nagar Panchayat election' },
    { value: 'By-Election', label: 'By-Election', icon: FileText, desc: 'Fill a vacant seat (Upchunaav)' },
];

// Detect if a location is Indian based on common Indian identifiers
function detectIndianLocation(location) {
    if (!location || typeof location !== 'string') return false;
    const n = location.toLowerCase().trim();

    if (/\bindia\b|\bbharat\b/.test(n)) return true;
    if (/\b\d{6}\b/.test(n)) return true; // Indian PIN codes

    const indianKeywords = [
        'mumbai','delhi','bangalore','bengaluru','hyderabad','ahmedabad','chennai',
        'kolkata','pune','jaipur','lucknow','kanpur','nagpur','indore','thane',
        'bhopal','visakhapatnam','vizag','patna','vadodara','ghaziabad','ludhiana',
        'agra','nashik','faridabad','meerut','rajkot','varanasi','srinagar',
        'aurangabad','dhanbad','amritsar','ranchi','howrah','coimbatore','gwalior',
        'vijayawada','jodhpur','madurai','raipur','kochi','cochin','chandigarh',
        'guwahati','solapur','thiruvananthapuram','trivandrum','noida','gurgaon',
        'gurugram','dehradun','mysore','mysuru','mangalore','mangaluru','shimla',
        'bhubaneswar','imphal','shillong','pondicherry','panaji','gangtok',
        'andhra pradesh','arunachal pradesh','assam','bihar','chhattisgarh','goa',
        'gujarat','haryana','himachal pradesh','jharkhand','karnataka','kerala',
        'madhya pradesh','maharashtra','manipur','meghalaya','mizoram','nagaland',
        'odisha','punjab','rajasthan','sikkim','tamil nadu','telangana','tripura',
        'uttar pradesh','uttarakhand','west bengal','jammu','kashmir','ladakh',
        'puducherry',
    ];
    return indianKeywords.some(k => n.includes(k));
}

export default function ChatPanel({ onGenerate, onBack }) {
    const [step, setStep] = useState(0);
    const [dir, setDir] = useState(1);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ location: '', electionType: '', firstTimeVoter: false });

    // Auto-detect country from location
    const isIndia = useMemo(() => detectIndianLocation(form.location), [form.location]);
    const electionTypes = isIndia ? INDIA_ELECTION_TYPES : US_ELECTION_TYPES;

    // Reset election type when country changes
    const handleLocationChange = (newLocation) => {
        const wasIndia = detectIndianLocation(form.location);
        const nowIndia = detectIndianLocation(newLocation);
        if (wasIndia !== nowIndia) {
            setForm({ ...form, location: newLocation, electionType: '' });
        } else {
            setForm({ ...form, location: newLocation });
        }
    };

    // Set default election type if not set yet
    const effectiveElectionType = form.electionType || electionTypes[0].value;

    const next = () => { if (step < 3) { setDir(1); setStep(s => s + 1); } };
    const back = () => { if (step > 0) { setDir(-1); setStep(s => s - 1); } };
    const canNext = () => step === 0 ? form.location.trim().length >= 2 : true;

    const submit = async () => {
        setLoading(true);
        await onGenerate({ ...form, electionType: effectiveElectionType });
        setLoading(false);
    };

    const slideV = {
        enter: (d) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (d) => ({ x: d < 0 ? 60 : -60, opacity: 0 }),
    };

    const renderStep = () => {
        if (step === 0) return (
            <motion.div key="s0" custom={dir} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-5">
                <div><h2 className="text-2xl font-bold text-white mb-1">Where are you located?</h2><p className="text-sm text-gray-500">Enter your address, city & state, or city & country.</p></div>
                <div>
                    <label htmlFor="loc" className="flex items-center text-sm font-medium text-gray-300 mb-2"><MapPin className="w-4 h-4 mr-2 text-indigo-400"/>Your location</label>
                    <input id="loc" type="text" placeholder="e.g., Chennai, Tamil Nadu or Austin, Texas" value={form.location} onChange={e => handleLocationChange(e.target.value)} className="glass-input w-full" autoFocus autoComplete="street-address" aria-required="true"/>
                </div>
                {form.location.trim().length >= 2 && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/30">
                        <span className="text-lg">{isIndia ? '🇮🇳' : '🇺🇸'}</span>
                        <span className="text-xs text-gray-400">
                            Detected: <span className="text-white font-medium">{isIndia ? 'India' : 'United States'}</span>
                            <span className="text-gray-500 ml-1">— election types will adjust accordingly</span>
                        </span>
                    </motion.div>
                )}
            </motion.div>
        );
        if (step === 1) return (
            <motion.div key="s1" custom={dir} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-5">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1">What type of election?</h2>
                    <p className="text-sm text-gray-500">
                        Choose the election you're preparing for.
                        <span className="ml-1 text-xs text-indigo-400/80">({isIndia ? '🇮🇳 India' : '🇺🇸 US'} elections)</span>
                    </p>
                </div>
                <div className="grid gap-3" role="radiogroup" aria-label="Election type">
                    {electionTypes.map(t => {
                        const sel = effectiveElectionType === t.value;
                        return (<button key={t.value} onClick={() => setForm({...form, electionType: t.value})} role="radio" aria-checked={sel}
                            className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${sel ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-gray-900/30 border-gray-700/40 hover:border-gray-600/60'}`}>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-500/20' : 'bg-gray-800/50'}`}>
                                <t.icon className={`w-5 h-5 ${sel ? 'text-indigo-400' : 'text-gray-500'}`}/>
                            </div>
                            <div><div className={`text-sm font-semibold ${sel ? 'text-white' : 'text-gray-300'}`}>{t.label}</div><div className="text-xs text-gray-500 mt-0.5">{t.desc}</div></div>
                            {sel && <CheckCircle className="w-5 h-5 text-indigo-400 ml-auto shrink-0"/>}
                        </button>);
                    })}
                </div>
            </motion.div>
        );
        if (step === 2) return (
            <motion.div key="s2" custom={dir} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-5">
                <div><h2 className="text-2xl font-bold text-white mb-1">First-time voter?</h2><p className="text-sm text-gray-500">First-timers get extra guidance on registration and ID.</p></div>
                <div className="grid gap-3" role="radiogroup" aria-label="Voter status">
                    {[{v:true,l:"Yes, I'm a first-time voter",d:"Extra registration & ID guidance",e:'🎉'},{v:false,l:"No, I've voted before",d:"Focus on what's new",e:'✅'}].map(o => {
                        const sel = form.firstTimeVoter === o.v;
                        return (<button key={String(o.v)} onClick={() => setForm({...form, firstTimeVoter: o.v})} role="radio" aria-checked={sel}
                            className={`flex items-center gap-4 p-5 rounded-xl border text-left transition-all ${sel ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-gray-900/30 border-gray-700/40 hover:border-gray-600/60'}`}>
                            <span className="text-2xl">{o.e}</span>
                            <div><div className={`text-sm font-semibold ${sel ? 'text-white' : 'text-gray-300'}`}>{o.l}</div><div className="text-xs text-gray-500 mt-0.5">{o.d}</div></div>
                            {sel && <CheckCircle className="w-5 h-5 text-indigo-400 ml-auto shrink-0"/>}
                        </button>);
                    })}
                </div>
            </motion.div>
        );
        return (
            <motion.div key="s3" custom={dir} variants={slideV} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-5">
                <div><h2 className="text-2xl font-bold text-white mb-1">Ready to generate</h2><p className="text-sm text-gray-500">Review your details below.</p></div>
                <div className="space-y-3">
                    {[
                        { icon: MapPin, label: 'Location', val: form.location, c: 'text-indigo-400' },
                        { icon: Globe, label: 'Country', val: isIndia ? '🇮🇳 India' : '🇺🇸 United States', c: 'text-cyan-400' },
                        { icon: Vote, label: 'Election', val: electionTypes.find(t => t.value === effectiveElectionType)?.label || effectiveElectionType, c: 'text-emerald-400' },
                        { icon: UserCheck, label: 'First-time', val: form.firstTimeVoter ? 'Yes' : 'No', c: 'text-amber-400' },
                    ].map(r => (
                        <div key={r.label} className="flex items-center justify-between p-4 rounded-xl bg-gray-900/40 border border-gray-700/30">
                            <div className="flex items-center gap-3"><r.icon className={`w-4 h-4 ${r.c}`}/><span className="text-sm text-gray-400">{r.label}</span></div>
                            <span className="text-sm font-medium text-white">{r.val}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        );
    };

    return (
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="w-full max-w-lg mx-auto">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-2 mb-8" role="progressbar">
                {STEPS.map((s,i) => {
                    const active=i===step, done=i<step;
                    return (<div key={s.id} className="flex items-center">
                        <motion.div animate={{scale:active?1:0.85,opacity:active||done?1:0.4}}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium ${active?'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30':done?'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20':'bg-gray-800/50 text-gray-500 border border-gray-700/30'}`}>
                            {done?<CheckCircle className="w-3.5 h-3.5"/>:<s.icon className="w-3.5 h-3.5"/>}
                            <span className="hidden sm:inline">{s.label}</span>
                        </motion.div>
                        {i<3&&<div className={`w-6 h-[2px] mx-1 rounded ${done?'bg-emerald-500/40':'bg-gray-700/30'}`}/>}
                    </div>);
                })}
            </div>
            {/* Card */}
            <div className="glass-panel p-8 glow-accent relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"/>
                <AnimatePresence mode="wait" custom={dir}>{renderStep()}</AnimatePresence>
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700/30">
                    <button onClick={step===0?onBack:back} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-800/50" id="form-back">
                        <ArrowLeft className="w-4 h-4"/>{step===0?'Home':'Back'}
                    </button>
                    {step<3?(<button onClick={next} disabled={!canNext()} className="btn-primary flex items-center gap-2 text-sm px-6 py-3" id="form-next">Continue<ArrowRight className="w-4 h-4"/></button>
                    ):(<button onClick={submit} disabled={loading} className="btn-primary flex items-center gap-2 text-sm px-6 py-3" id="form-submit">
                        {loading?<><Loader2 className="w-4 h-4 animate-spin"/>Generating...</>:<>✨ Generate Roadmap</>}
                    </button>)}
                </div>
            </div>
        </motion.div>
    );
}
