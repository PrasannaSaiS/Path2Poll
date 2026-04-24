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
- Data fed directly into Gemini as grounding context for accuracy
- Official source verification with .gov trust indicators

### ♿ Accessibility & Inclusivity
- Accessibility options highlighted (early voting, mail-in, curbside)
- ARIA labels and keyboard navigation throughout
- High contrast dark theme with readable typography
- Screen reader compatible

---

## 🏗️ Architecture

```
Path2Poll/
├── frontend/                    # Next.js (App Router) + Tailwind CSS
│   ├── app/
│   │   ├── layout.js           # Root layout with SEO metadata
│   │   ├── page.js             # Main app orchestration (5 views)
│   │   └── globals.css         # Design system & utilities
│   ├── components/
│   │   ├── HeroSection.jsx     # Landing page with CTAs
│   │   ├── ChatPanel.jsx       # Multi-step guided input form
│   │   ├── ChatMode.jsx        # Conversational Q&A interface
│   │   ├── TimelineView.jsx    # Election roadmap display
│   │   ├── StepCard.jsx        # Expandable step cards
│   │   ├── SourcePanel.jsx     # Official source verification
│   │   └── LoadingSkeleton.jsx # Shimmer loading states
│   └── lib/
│       └── api.js              # API client functions
├── backend/
│   ├── index.js                # Express server + all API routes
│   └── services/
│       ├── geminiService.js    # 3-stage Gemini AI pipeline
│       └── electionService.js  # Google Civic Information API
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
            Gemini 1.5 Pro                          Civic API Data
```

1. **Planner**: Generates a raw election timeline based on user context
2. **Explainer**: Enhances language to 8th-grade reading level with tips and motivation
3. **Verifier**: Cross-references with civic data, adds confidence scores, flags uncertainties

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
| **Security** | Helmet.js | HTTP security headers |
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

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/timeline` | Generate a full election roadmap (3-stage pipeline) |
| `POST` | `/api/chat` | Conversational Q&A with structured responses |
| `POST` | `/api/election-data` | Fetch civic data for an address |
| `POST` | `/api/explain-step` | Get detailed explanation of a single step |
| `GET` | `/api/health` | Health check for deployment monitoring |

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

---

## 🔒 Security & Safety

- **Non-partisan**: The AI never endorses candidates or expresses political opinions
- **Anti-hallucination**: 3-stage pipeline with verification against civic data
- **Confidence scores**: Each step is rated high/medium/low confidence
- **Safe fallbacks**: Uncertain info is flagged with "verify with local election office"
- **No PII storage**: No personal voter information is stored
- **Security headers**: Helmet.js for HTTP security
- **Non-root Docker**: Container runs as unprivileged user

---

## 📊 Evaluation Criteria Alignment

| Criteria | How Path2Poll Addresses It |
|----------|---------------------------|
| **Code Quality** | Modular architecture, separation of concerns, consistent naming, clean component hierarchy |
| **Security** | Helmet.js, non-root Docker, input validation, CORS config, env-based secrets |
| **Efficiency** | 3-stage pipeline with graceful fallbacks, parallel civic data fetch, static frontend export |
| **Testing** | Health endpoint, structured error responses, retry logic with exponential backoff |
| **Accessibility** | ARIA labels, keyboard navigation, focus rings, semantic HTML, screen reader text |
| **Google Services** | Gemini 1.5 Pro (structured output), Google Civic Information API, Cloud Run deployment |

---

## 🎬 Demo Walkthrough

1. **Landing Page**: Animated hero with feature highlights and two mode options
2. **Guide Mode**: 4-step wizard collects location, election type, and voter status
3. **AI Processing**: Visual loading skeleton while the 3-stage pipeline runs
4. **Timeline View**: Expandable cards with deadlines, documents, tips, and confidence badges
5. **Chat Mode**: Ask follow-up questions with suggested prompts and source citations

---

## 📝 Assumptions

- Primary focus on U.S. elections (federal, state, and local)
- Election rules are based on well-known state-level regulations
- The Civic Information API may not have data for all addresses/elections at all times
- Gemini responses are enhanced and verified but should be confirmed with official sources
- The app is designed for English-speaking users

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

Built with ❤️ for the Google AI Hackathon
