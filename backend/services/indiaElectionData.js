// ---------------------------------------------------------------------------
// India Election Knowledge Base
// ---------------------------------------------------------------------------
// Since no equivalent of Google Civic API exists for India, this module
// provides a comprehensive, curated knowledge base sourced from the
// Election Commission of India (ECI) and the National Voters' Service
// Portal (NVSP). The data is injected into the Gemini context window so
// the AI can ground its responses in verified facts.
// ---------------------------------------------------------------------------

// ── State & UT meta (CEO websites, local languages) ──────────────────────
const STATE_DATA = {
    "andhra pradesh":   { ceo: "https://ceoandhra.nic.in",          lang: "Telugu" },
    "arunachal pradesh":{ ceo: "https://ceoarunachal.nic.in",       lang: "English" },
    "assam":            { ceo: "https://ceoassam.nic.in",            lang: "Assamese" },
    "bihar":            { ceo: "https://ceobihar.nic.in",            lang: "Hindi" },
    "chhattisgarh":     { ceo: "https://ceochhattisgarh.nic.in",     lang: "Hindi" },
    "goa":              { ceo: "https://ceogoa.nic.in",              lang: "Konkani" },
    "gujarat":          { ceo: "https://ceo.gujarat.gov.in",         lang: "Gujarati" },
    "haryana":          { ceo: "https://ceoharyana.gov.in",          lang: "Hindi" },
    "himachal pradesh": { ceo: "https://ceohimachal.nic.in",         lang: "Hindi" },
    "jharkhand":        { ceo: "https://ceojharkhand.nic.in",        lang: "Hindi" },
    "karnataka":        { ceo: "https://ceokarnataka.kar.nic.in",    lang: "Kannada" },
    "kerala":           { ceo: "https://ceo.kerala.gov.in",          lang: "Malayalam" },
    "madhya pradesh":   { ceo: "https://ceomadhyapradesh.nic.in",    lang: "Hindi" },
    "maharashtra":      { ceo: "https://ceo.maharashtra.gov.in",     lang: "Marathi" },
    "manipur":          { ceo: "https://ceomanipur.nic.in",          lang: "Manipuri" },
    "meghalaya":        { ceo: "https://ceomeghalaya.nic.in",        lang: "English/Khasi" },
    "mizoram":          { ceo: "https://ceomizoram.nic.in",          lang: "Mizo" },
    "nagaland":         { ceo: "https://ceonagaland.nic.in",         lang: "English" },
    "odisha":           { ceo: "https://ceoodisha.nic.in",           lang: "Odia" },
    "punjab":           { ceo: "https://ceopunjab.nic.in",           lang: "Punjabi" },
    "rajasthan":        { ceo: "https://ceorajasthan.nic.in",        lang: "Hindi" },
    "sikkim":           { ceo: "https://ceosikkim.nic.in",           lang: "Nepali" },
    "tamil nadu":       { ceo: "https://elections.tn.gov.in",        lang: "Tamil" },
    "telangana":        { ceo: "https://ceotelangana.nic.in",        lang: "Telugu" },
    "tripura":          { ceo: "https://ceotripura.nic.in",          lang: "Bengali" },
    "uttar pradesh":    { ceo: "https://ceouttarpradesh.nic.in",     lang: "Hindi" },
    "uttarakhand":      { ceo: "https://ceouttarakhand.nic.in",      lang: "Hindi" },
    "west bengal":      { ceo: "https://ceowestbengal.nic.in",       lang: "Bengali" },
    "delhi":            { ceo: "https://ceodelhi.gov.in",            lang: "Hindi" },
    "chandigarh":       { ceo: "https://ceochandigarh.gov.in",       lang: "Hindi/Punjabi" },
    "puducherry":       { ceo: "https://ceopuducherry.py.gov.in",    lang: "Tamil" },
    "jammu and kashmir":{ ceo: "https://ceojk.nic.in",              lang: "Urdu/Hindi" },
    "ladakh":           { ceo: "https://ceojk.nic.in",              lang: "Urdu/Hindi" },
};

// ── Election types in India ──────────────────────────────────────────────
const ELECTION_TYPES = {
    "Lok Sabha": {
        fullName: "Lok Sabha (Parliamentary / General) Election",
        level: "National",
        frequency: "Every 5 years",
        seats: 543,
        body: "Lower House of Parliament",
        description: "Citizens directly elect Members of Parliament (MPs) who represent their constituency in the Lok Sabha. The party/coalition with majority forms the central government.",
        lastHeld: "April–June 2024 (18th Lok Sabha)",
        conductedBy: "Election Commission of India (ECI)",
    },
    "Vidhan Sabha": {
        fullName: "Vidhan Sabha (State Legislative Assembly) Election",
        level: "State",
        frequency: "Every 5 years (staggered across states)",
        body: "State Legislative Assembly",
        description: "Citizens elect Members of Legislative Assembly (MLAs) for their state. The party/coalition with majority forms the state government headed by the Chief Minister.",
        conductedBy: "Election Commission of India (ECI) via State CEO",
    },
    "Panchayat": {
        fullName: "Panchayat (Local Rural Body) Election",
        level: "Local (Rural)",
        frequency: "Every 5 years",
        body: "Gram Panchayat / Block Panchayat / Zilla Parishad",
        description: "Three-tier local self-governance elections in rural areas. Citizens elect Sarpanch/Pradhan and ward members for village governance.",
        conductedBy: "State Election Commission (SEC) — separate from ECI",
    },
    "Municipal": {
        fullName: "Municipal Corporation / Municipal Council / Nagar Panchayat Election",
        level: "Local (Urban)",
        frequency: "Every 5 years",
        body: "Municipal Corporation / Council / Nagar Panchayat",
        description: "Urban local body elections for city/town governance. Citizens elect Corporators/Councillors and, in some states, the Mayor.",
        conductedBy: "State Election Commission (SEC)",
    },
    "By-Election": {
        fullName: "By-Election (Upchunaav)",
        level: "Varies (National/State/Local)",
        frequency: "As needed when a seat falls vacant",
        description: "Held when an elected seat becomes vacant due to death, resignation, or disqualification of the incumbent.",
        conductedBy: "Election Commission of India (ECI)",
    },
    "Rajya Sabha": {
        fullName: "Rajya Sabha (Upper House) Election",
        level: "National (Indirect)",
        frequency: "One-third members retire every 2 years",
        seats: 245,
        body: "Upper House of Parliament",
        description: "Members are elected by elected members of State Legislative Assemblies (MLAs). Not a direct public vote — citizens do not vote in Rajya Sabha elections.",
        conductedBy: "Election Commission of India (ECI)",
    },
};

// ── Voter registration process ───────────────────────────────────────────
const VOTER_REGISTRATION = {
    eligibility: {
        age: "Must be 18 years or older on the qualifying date (1st January of the year of revision of electoral roll)",
        citizenship: "Must be an Indian citizen",
        residency: "Must be an ordinary resident of the constituency where they wish to register",
        disqualifications: [
            "Non-resident Indians can register under Form 6A",
            "Persons of unsound mind (as declared by a competent court) cannot register",
            "Persons disqualified under any law relating to corrupt practices cannot register",
        ],
    },
    methods: [
        {
            method: "Online via NVSP Portal",
            url: "https://voters.eci.gov.in",
            description: "Fill Form 6 online, upload documents, track status — fastest method",
            steps: [
                "Visit https://voters.eci.gov.in",
                "Click 'Register as New Voter' (Form 6)",
                "Fill personal details (name, age, address, family member on roll)",
                "Upload passport-size photo and age proof document",
                "Submit and note the Reference ID",
                "BLO (Booth Level Officer) will visit for field verification",
                "Once approved, you receive your EPIC (Voter ID) card",
            ],
        },
        {
            method: "Voter Helpline App",
            url: "https://play.google.com/store/apps/details?id=com.eci.citizen",
            description: "Download from Google Play or App Store. Register, track, and find your polling booth.",
        },
        {
            method: "Offline via Form 6",
            description: "Download Form 6 from NVSP or collect from Electoral Registration Officer (ERO). Fill, attach documents, and submit at the ERO office.",
        },
        {
            method: "Through BLO (Booth Level Officer)",
            description: "Contact your local BLO who can assist with the registration process at your doorstep during electoral roll revision.",
        },
    ],
    requiredDocuments: [
        "Age proof: Birth certificate / 10th-class marksheet / Passport / Aadhaar card",
        "Address proof: Aadhaar card / Utility bill / Bank passbook / Passport / Ration card",
        "Passport-size photograph (for EPIC card)",
        "Self-declaration if address proof is unavailable (Form 6 has a declaration section)",
    ],
    timeline: "Processing typically takes 2-4 weeks after BLO verification",
    forms: {
        "Form 6": "New voter registration",
        "Form 6A": "Overseas (NRI) voter registration",
        "Form 7": "Objection to an existing entry in the electoral roll",
        "Form 8": "Correction of details in the electoral roll",
        "Form 8A": "Transposition of entry (shift within same constituency)",
    },
};

// ── Voting process on Election Day ───────────────────────────────────────
const VOTING_PROCESS = {
    pollingHours: "7:00 AM to 6:00 PM (may vary by state/region; extended in some areas)",
    identification: {
        primary: "EPIC (Electoral Photo Identity Card / Voter ID)",
        alternatives: [
            "Aadhaar Card",
            "MNREGA Job Card",
            "Passbook with photo (issued by bank/post office)",
            "Health Insurance Smart Card (RSBY)",
            "Driving License",
            "PAN Card",
            "Smart Card issued by RGI under NPR",
            "Indian Passport",
            "Photo ID issued by Central/State Government or PSU",
            "Official ID issued to MPs/MLAs/MLCs",
            "Pension document with photo",
        ],
        note: "Any ONE of these photo IDs is sufficient. Voter's name must be on the electoral roll.",
    },
    steps: [
        "Locate your polling booth using the Voter Helpline App or NVSP portal",
        "Arrive at the polling station with your photo ID",
        "Your name is verified against the electoral roll by the Presiding Officer",
        "Indelible ink is applied to your left index finger",
        "You are directed to the EVM (Electronic Voting Machine) in the voting compartment",
        "Press the button next to your chosen candidate's name and symbol on the EVM",
        "Verify your vote on the VVPAT (Voter Verified Paper Audit Trail) slip visible for 7 seconds",
        "Exit the polling station — you have exercised your democratic right!",
    ],
    specialProvisions: [
        "NOTA (None of the Above) — Available as the last option on the EVM",
        "Postal Ballot — Available for armed forces, government employees on election duty, senior citizens (80+), PwD voters, and essential service workers",
        "Absentee Voter — Service voters and those on election duty can vote by postal ballot",
        "PwD / Wheelchair access — Polling stations must be accessible; wheelchairs available",
        "Braille-enabled EVM — Available for visually impaired voters",
        "Companion voting — PwD voters can bring a companion to assist",
        "Home voting — Available for voters aged 85+ and PwD voters (introduced in 2024)",
    ],
};

// ── Important bodies & helplines ─────────────────────────────────────────
const OFFICIAL_BODIES = {
    eci: {
        name: "Election Commission of India (ECI)",
        website: "https://eci.gov.in",
        description: "Autonomous constitutional body that superintends, directs, and controls elections to Parliament, State Legislatures, and the offices of President and Vice-President.",
    },
    nvsp: {
        name: "National Voters' Service Portal (NVSP)",
        website: "https://voters.eci.gov.in",
        description: "One-stop portal for voter registration, corrections, electoral roll search, polling booth location, and application tracking.",
    },
    helpline: {
        number: "1950",
        name: "Voter Helpline",
        description: "Toll-free number for voter registration queries, complaints, and election information.",
    },
    app: {
        name: "Voter Helpline App",
        description: "Official mobile app by ECI for voter services — registration, booth search, grievance filing.",
    },
    cVigil: {
        name: "cVigil App",
        description: "Citizen vigilance app to report Model Code of Conduct violations during elections. Reports are geo-tagged and time-stamped.",
    },
};

// ── Key electoral concepts ───────────────────────────────────────────────
const KEY_CONCEPTS = {
    epic: "Electoral Photo Identity Card — also called Voter ID Card. Issued free by ECI. Contains your photo, name, and constituency details.",
    evm: "Electronic Voting Machine — Used for casting votes. Tamper-proof, standalone (no internet connectivity). Results are accurate to 100%.",
    vvpat: "Voter Verified Paper Audit Trail — Attached to EVM. Shows a printed slip of your vote for 7 seconds before it drops into a sealed box for audit.",
    modelCode: "Model Code of Conduct (MCC) — Rules for political parties and candidates that come into force from the announcement of elections until results. Ensures free and fair elections.",
    electoralRoll: "The official list of all eligible voters in a constituency. Updated periodically by the ERO. Your name MUST be on the roll to vote.",
    constituency: "A geographic area represented by one elected member. India has 543 Lok Sabha and varying numbers of Vidhan Sabha constituencies per state.",
    blo: "Booth Level Officer — A government official assigned to each polling booth area. Responsible for voter registration and roll updates at the grassroots level.",
    ero: "Electoral Registration Officer — Responsible for the preparation and revision of the electoral roll of a constituency.",
};

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Detect if a location string refers to an Indian location.
 * Uses a broad keyword/state-name check. Returns true for India-related locations.
 */
export function isIndianLocation(location) {
    if (!location || typeof location !== "string") return false;

    const normalized = location.toLowerCase().trim();

    // Explicit country mentions
    if (/\bindia\b|\bbharat\b|\bhindustan\b/.test(normalized)) return true;

    // Indian PIN code pattern (6 digits)
    if (/\b\d{6}\b/.test(normalized)) return true;

    // Check against known Indian states/UTs
    const stateNames = Object.keys(STATE_DATA);
    for (const state of stateNames) {
        if (normalized.includes(state)) return true;
    }

    // Common Indian city names (top 50+ cities)
    const indianCities = [
        "mumbai", "delhi", "bangalore", "bengaluru", "hyderabad", "ahmedabad",
        "chennai", "kolkata", "pune", "jaipur", "lucknow", "kanpur", "nagpur",
        "indore", "thane", "bhopal", "visakhapatnam", "vizag", "patna",
        "vadodara", "ghaziabad", "ludhiana", "agra", "nashik", "faridabad",
        "meerut", "rajkot", "varanasi", "srinagar", "aurangabad", "dhanbad",
        "amritsar", "navi mumbai", "allahabad", "prayagraj", "ranchi",
        "howrah", "coimbatore", "jabalpur", "gwalior", "vijayawada",
        "jodhpur", "madurai", "raipur", "kochi", "cochin", "chandigarh",
        "guwahati", "solapur", "thiruvananthapuram", "trivandrum", "tiruchirappalli",
        "trichy", "noida", "gurgaon", "gurugram", "dehradun", "mysore", "mysuru",
        "mangalore", "mangaluru", "pondicherry", "shimla", "bhubaneswar",
        "imphal", "shillong", "aizawl", "kohima", "agartala", "gangtok",
        "itanagar", "panaji", "daman", "silvassa", "kavaratti", "port blair",
    ];
    for (const city of indianCities) {
        if (normalized.includes(city)) return true;
    }

    return false;
}

/**
 * Find state data for a given Indian location.
 */
export function findStateData(location) {
    if (!location) return null;
    const normalized = location.toLowerCase().trim();

    for (const [state, data] of Object.entries(STATE_DATA)) {
        if (normalized.includes(state)) {
            return { state: state.replace(/\b\w/g, (c) => c.toUpperCase()), ...data };
        }
    }

    // City-to-state mapping for major cities
    const cityStateMap = {
        "mumbai": "maharashtra", "pune": "maharashtra", "nagpur": "maharashtra",
        "nashik": "maharashtra", "thane": "maharashtra", "navi mumbai": "maharashtra",
        "aurangabad": "maharashtra", "solapur": "maharashtra",
        "bangalore": "karnataka", "bengaluru": "karnataka", "mysore": "karnataka",
        "mysuru": "karnataka", "mangalore": "karnataka", "mangaluru": "karnataka",
        "chennai": "tamil nadu", "coimbatore": "tamil nadu", "madurai": "tamil nadu",
        "trichy": "tamil nadu", "tiruchirappalli": "tamil nadu",
        "hyderabad": "telangana", "vizag": "telangana", "visakhapatnam": "andhra pradesh",
        "vijayawada": "andhra pradesh",
        "kolkata": "west bengal", "howrah": "west bengal",
        "ahmedabad": "gujarat", "vadodara": "gujarat", "rajkot": "gujarat",
        "jaipur": "rajasthan", "jodhpur": "rajasthan",
        "lucknow": "uttar pradesh", "kanpur": "uttar pradesh", "agra": "uttar pradesh",
        "varanasi": "uttar pradesh", "allahabad": "uttar pradesh",
        "prayagraj": "uttar pradesh", "noida": "uttar pradesh", "meerut": "uttar pradesh",
        "ghaziabad": "uttar pradesh",
        "patna": "bihar",
        "bhopal": "madhya pradesh", "indore": "madhya pradesh", "jabalpur": "madhya pradesh",
        "gwalior": "madhya pradesh",
        "ranchi": "jharkhand", "dhanbad": "jharkhand",
        "raipur": "chhattisgarh",
        "bhubaneswar": "odisha",
        "guwahati": "assam",
        "kochi": "kerala", "cochin": "kerala", "thiruvananthapuram": "kerala",
        "trivandrum": "kerala",
        "amritsar": "punjab", "ludhiana": "punjab",
        "chandigarh": "chandigarh",
        "dehradun": "uttarakhand",
        "shimla": "himachal pradesh",
        "gurgaon": "haryana", "gurugram": "haryana", "faridabad": "haryana",
        "srinagar": "jammu and kashmir",
        "imphal": "manipur", "shillong": "meghalaya", "aizawl": "mizoram",
        "kohima": "nagaland", "agartala": "tripura", "gangtok": "sikkim",
        "itanagar": "arunachal pradesh", "panaji": "goa",
        "pondicherry": "puducherry", "port blair": "andaman and nicobar",
        "delhi": "delhi", "new delhi": "delhi",
    };

    for (const [city, state] of Object.entries(cityStateMap)) {
        if (normalized.includes(city)) {
            const stateData = STATE_DATA[state];
            return stateData
                ? { state: state.replace(/\b\w/g, (c) => c.toUpperCase()), ...stateData }
                : { state: state.replace(/\b\w/g, (c) => c.toUpperCase()) };
        }
    }

    return null;
}

/**
 * Build a comprehensive India election context object for Gemini injection.
 * This replaces the Civic API data for Indian locations.
 */
export function getIndiaElectionContext(location, electionType) {
    const stateInfo = findStateData(location);
    const electionInfo = ELECTION_TYPES[electionType] || ELECTION_TYPES["Lok Sabha"];

    return {
        country: "India",
        detectedState: stateInfo || { state: "Unknown — please verify with local CEO office" },
        electionType: electionInfo,
        voterRegistration: VOTER_REGISTRATION,
        votingProcess: VOTING_PROCESS,
        officialBodies: OFFICIAL_BODIES,
        keyConcepts: KEY_CONCEPTS,
        officialSources: [
            "https://eci.gov.in — Election Commission of India",
            "https://voters.eci.gov.in — National Voters' Service Portal (NVSP)",
            stateInfo?.ceo ? `${stateInfo.ceo} — ${stateInfo.state} Chief Electoral Officer` : null,
            "https://play.google.com/store/apps/details?id=com.eci.citizen — Voter Helpline App",
        ].filter(Boolean),
        helpline: "1950 (Voter Helpline — Toll Free)",
    };
}
