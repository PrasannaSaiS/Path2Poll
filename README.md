# 🗳️ Path2Poll — AI-Powered Election Assistant

> **Challenge Vertical:** Election Process Assistant  
> *"Create an assistant that helps users understand the election process, timelines, and steps in an interactive and easy-to-follow way."*

Path2Poll is an intelligent, guided election assistant powered by **Google Gemini AI** that transforms the complex voting process into a clear, personalized roadmap. Unlike simple chatbots, Path2Poll collects user context, generates structured election timelines, and provides actionable step-by-step guidance — all verified against official civic data.

---

## ✨ Key Features

### 🎯 Guided Election Roadmap (Not Just a Chatbot)
- **Multi-step context collection**: Location → Election Type → Voter Status → Personalized results
- **Structured AI output**: Every response follows a strict JSON schema — no free-form text
- **3-stage AI pipeline**: Planner → Explainer → Verifier for accuracy and clarity

### 📅 Interactive Timeline Visualization
- Visual step-by-step timeline with expandable cards
- Each step includes: what to do, why it matters, documents needed, time estimates
- Confidence indicators (Verified / Likely Accurate / Verify Locally)
- Mark steps as completed to track your progress

### 💬 Conversational Chat Mode
- Ask any election-related question in natural language
- Contextual follow-up suggestions
- Structured responses with official source citations

### 🔍 Official Data Integration
- **Google Civic Information API** for real-time voter info, polling locations, and election data
- **India Election Knowledge Base** sourced from ECI, NVSP, and state CEO websites
- Data fed directly into Gemini as grounding context for accuracy
- Official source verification with .gov trust indicators

### ♿ Accessibility & Inclusivity
- **Skip navigation** link for keyboard users
- **ARIA live regions** for screen reader announcements on dynamic content changes
- **Semantic landmarks** (`role="log"`, `role="list"`, `role="progressbar"`) throughout
- **`prefers-reduced-motion`** support — disables animations for users who prefer it
- **High contrast mode** support via `forced-colors` media query
- ARIA labels and keyboard navigation throughout
- High contrast dark theme with readable typography (Inter font)
- Screen reader compatible with `sr-only` utility class

### 🔒 Security
- **Helmet.js** with full Content Security Policy (CSP) directives
- **Rate limiting** (100 requests/15min per IP) to prevent abuse
- **Input sanitization** — HTML stripping and length limits on all inputs
- **Non-root Docker** container for production security
- **Graceful shutdown** handler for clean process termination
- **Error sanitization** in production (no stack traces leaked)
- **Request ID tracking** for end-to-end log correlation

---

## 🏗️ Architecture

```
Path2Poll/
├── frontend/                    # Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.js           # Root layout with SEO metadata & skip nav
│   │   ├── page.js             # Main app orchestration (5 views)
│   │   └── globals.css         # Design system, utilities & a11y
│   ├── components/
│   │   ├── HeroSection.jsx     # Landing page with CTAs
│   │   ├── ChatPanel.jsx       # Multi-step guided input form
│   │   ├── ChatMode.jsx        # Conversational Q&A interface
│   │   ├── TimelineView.jsx    # Election roadmap display
│   │   ├── StepCard.jsx        # Expandable step cards
│   │   ├── SourcePanel.jsx     # Official source verification
│   │   └── LoadingSkeleton.jsx # Shimmer loading states
│   ├── lib/
│   │   └── api.js              # API client (timeout, abort, sanitize)
│   └── __tests__/
│       └── api.test.js         # Frontend API client tests
├── backend/
│   ├── index.js                # Express server + all API routes
│   ├── services/
│   │   ├── geminiService.js    # 3-stage Gemini AI pipeline
│   │   ├── electionService.js  # Google Civic Information API
│   │   ├── indiaElectionData.js # India election knowledge base
│   │   ├── loggingService.js   # Google Cloud Logging integration
│   │   └── cacheService.js     # Firestore + in-memory LRU cache
│   ├── middleware/
│   │   ├── validate.js         # Input validation & sanitization
│   │   └── requestId.js        # Request ID & response time tracking
│   └── tests/
│       ├── electionService.test.js  # 40+ unit & integration tests
│       ├── geminiService.test.js    # Pipeline & retry logic tests
│       └── api.test.js              # HTTP endpoint integration tests
├── shared/
│   └── prompts/
│       ├── system.txt          # System prompt (persona + guardrails)
│       ├── planner.txt         # Timeline generation prompt
│       ├── explainer.txt       # Simplification prompt
│       ├── verifier.txt        # Fact-checking prompt
│       └── chat.txt            # Conversational Q&A prompt
├── Dockerfile                  # Multi-stage Cloud Run deployment
├── .env.example                # Environment variable template
└── README.md
```

### AI Pipeline Architecture

```
User Input → [Planner Agent] → [Explainer Agent] → [Verifier Agent] → Structured Response
                  ↑                                       ↑
            Gemini 2.5 Flash                        Civic API Data
                  ↑                                       ↑
        Prompt Templates                          Cache (Firestore)
```

1. **Planner**: Generates a raw election timeline based on user context
2. **Explainer**: Enhances language to 8th-grade reading level with tips and motivation
3. **Verifier**: Cross-references with civic data, adds confidence scores, flags uncertainties
4. **Caching**: Results are cached in Firestore (24h TTL) to avoid redundant API calls

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js (App Router) | React framework with static export |
| **Styling** | Tailwind CSS v4 | Utility-first CSS with custom design system |
| **Animations** | Framer Motion | Smooth transitions and micro-interactions |
| **Icons** | Lucide React | Consistent icon system |
| **Backend** | Express.js (Node) | RESTful API server |
| **AI** | Google Gemini 2.5 Flash | Structured JSON generation with schema enforcement |
| **Civic Data** | Google Civic Information API | Real-time election & voter data |
| **Caching** | Google Cloud Firestore | Persistent response caching across instances |
| **Logging** | Google Cloud Logging | Structured logging with severity levels |
| **Security** | Helmet.js + express-rate-limit | HTTP security headers + rate limiting |
| **Compression** | compression | Gzip response compression |
| **Testing** | Jest + Supertest | Unit, integration, and API testing |
| **Deployment** | Google Cloud Run | Serverless container deployment |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ installed
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))
- (Optional) Google Civic Information API key

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/Path2Poll.git
cd Path2Poll

# 2. Create environment file
cp .env.example .env
# Edit .env and add your API keys

# 3. Install backend dependencies
cd backend
npm install

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Build the frontend
npm run build

# 6. Start the backend (serves both API + frontend)
cd ../backend
npm start
```

The app will be available at **http://localhost:8080**

### Development Mode

```bash
# Terminal 1: Backend with auto-reload
cd backend
npm run dev

# Terminal 2: Frontend dev server
cd frontend
npm run dev
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
```

Runs the full test suite with code coverage:
- **`tests/electionService.test.js`** — 40+ tests for country detection, Indian location matching, state data lookup, India election context, Civic API mocking, and integration flows
- **`tests/geminiService.test.js`** — 15+ tests for the 3-stage AI pipeline, retry logic with exponential backoff, caching integration, error handling, and chat/step explanation
- **`tests/api.test.js`** — 25+ HTTP integration tests using Supertest for all API endpoints, input validation, security headers, error response format consistency, and XSS prevention

### Frontend Tests

```bash
cd frontend
npm test
```

- **`__tests__/api.test.js`** — Tests for the API client module covering success paths, error handling, network failures, conversation history, and response parsing

### Test Coverage

| Module | Coverage Areas |
|--------|---------------|
| **electionService** | Country detection (US/IN/unknown), regex patterns, city-state mappings, Civic API integration, India Knowledge Base |
| **geminiService** | Full pipeline (Planner→Explainer→Verifier), retry with backoff, cache hit/miss, schema validation, error fallbacks |
| **API endpoints** | All 5 routes, input validation (missing/short/XSS), error format consistency, security headers, rate limiting |
| **Frontend API** | Request construction, error parsing, timeout handling, abort controller, input sanitization |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/timeline` | Generate a full election roadmap (3-stage pipeline) |
| `POST` | `/api/chat` | Conversational Q&A with structured responses |
| `POST` | `/api/election-data` | Fetch civic data for an address |
| `POST` | `/api/explain-step` | Get detailed explanation of a single step |
| `GET` | `/api/health` | Health check with cache stats for monitoring |

### Example: Generate Timeline
```json
POST /api/timeline
{
  "location": "Austin, Texas",
  "electionType": "General",
  "firstTimeVoter": true
}
```

---

## ☁️ Deployment (Google Cloud Run)

```bash
# Build and deploy
gcloud run deploy path2poll \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,CIVIC_INFORMATION_API=your_key \
  --port 8080
```

The Dockerfile uses a multi-stage build optimized for Cloud Run:
- Stage 1: Build Next.js static export
- Stage 2: Install backend production dependencies
- Stage 3: Minimal runtime with non-root user and health checks

### Cloud Run Features Used
- **Auto-scaling** with configurable min/max instances
- **Health checks** via `/api/health` endpoint with HEALTHCHECK directive
- **Structured logging** — JSON to stdout is auto-ingested by Cloud Logging
- **Firestore** — Response caching across instances
- **Request tracing** — Cloud Trace header propagation via `X-Cloud-Trace-Context`

---

## 🔒 Security & Safety

- **Non-partisan**: The AI never endorses candidates or expresses political opinions
- **Anti-hallucination**: 3-stage pipeline with verification against civic data
- **Confidence scores**: Each step is rated high/medium/low confidence
- **Safe fallbacks**: Uncertain info is flagged with "verify with local election office"
- **No PII storage**: No personal voter information is stored
- **Security headers**: Full Helmet.js CSP, HSTS, X-Content-Type-Options, X-Frame-Options
- **Rate limiting**: 100 requests per 15 minutes per IP via express-rate-limit
- **Input sanitization**: HTML tag stripping, length limits on all user inputs
- **Non-root Docker**: Container runs as unprivileged user (uid 1001)
- **Graceful shutdown**: Clean process termination on SIGTERM/SIGINT
- **Error sanitization**: Stack traces are never exposed in production responses

---

## 📊 Evaluation Criteria Alignment

| Criteria | How Path2Poll Addresses It |
|----------|---------------------------|
| **Code Quality** | Modular architecture with separation of concerns, comprehensive JSDoc documentation, centralized validation middleware, consistent error response format, request ID tracking, graceful shutdown |
| **Security** | Helmet.js with full CSP, express-rate-limit, input sanitization (HTML stripping), non-root Docker, production error sanitization, request body size limits |
| **Efficiency** | 3-stage pipeline with graceful fallbacks, prompt template caching at startup, Firestore + in-memory LRU response caching, gzip compression, parallel Civic API fetching, static frontend export with 7-day cache |
| **Testing** | 80+ tests across 4 test files: unit tests (country detection, state mapping), integration tests (mocked APIs, full pipeline), HTTP tests (Supertest), frontend API client tests. Jest with code coverage reporting |
| **Accessibility** | Skip navigation link, ARIA live regions for screen readers, semantic landmarks (log, list, progressbar), `prefers-reduced-motion` support, `forced-colors` high contrast support, keyboard navigation, focus rings, sr-only utility |
| **Google Services** | Gemini 2.5 Flash (structured JSON output), Google Civic Information API, Google Cloud Logging (structured JSON to stdout), Google Cloud Firestore (response caching), Google Cloud Run deployment |
| **Problem Statement** | Guided multi-step wizard (not just a chatbot), interactive timeline visualization, conversational Q&A mode, India + US election support, official source verification, step-by-step progress tracking |

---

## 🎬 Demo Walkthrough

1. **Landing Page**: Animated hero with feature highlights and two mode options
2. **Guide Mode**: 4-step wizard collects location, election type, and voter status
3. **AI Processing**: Visual loading skeleton while the 3-stage pipeline runs
4. **Timeline View**: Expandable cards with deadlines, documents, tips, and confidence badges
5. **Chat Mode**: Ask follow-up questions with suggested prompts and source citations

---

## 📝 Assumptions

- Primary focus on U.S. and India elections
- Election rules are based on well-known state-level regulations
- The Civic Information API may not have data for all addresses/elections at all times
- Gemini responses are enhanced and verified but should be confirmed with official sources
- The app is designed for English-speaking users

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the Google AI Hackathon
