# CareerPilot 🚀

Your agentic career co-pilot. Built for Codesprint 2026.

**CareerPilot** is an AI-powered career assistant that helps you hunt jobs, analyze CV fit scores, get personalized career advice, and track your applications—all powered by free-tier AI services.

## 🎯 Features

- **Job Hunter Agent** — Searches jobs with AI-powered fit scoring
- **CV Intelligence** — RAG-based CV analysis using vector search
- **AI Assistant** — Conversational interface with full CV context
- **Productivity Tracker** — Kanban board, calendar, todos, and AI nudges

## 📁 Project Structure

```
careerpilot/
├── backend/          # FastAPI Python 3.11+ backend
├── frontend/         # Next.js 14 (App Router) frontend
├── supabase/         # Database migrations
├── AGENTS.md         # Architecture & coding conventions
└── README.md         # This file
```

## 🛠️ Tech Stack

| Component           | Technology                                    |
| ------------------- | --------------------------------------------- |
| **Backend**         | FastAPI, Python 3.11+                         |
| **Frontend**        | Next.js 14, React 19, Tailwind CSS, shadcn/ui |
| **Database**        | Supabase (PostgreSQL + pgvector)              |
| **LLMs**            | Groq (Llama 3.3 70B), Gemini 2.0 Flash        |
| **Embeddings**      | Voyage AI (voyage-3)                          |
| **Caching**         | Upstash Redis                                 |
| **Agent Framework** | LangGraph                                     |
| **Job Search**      | JSearch (RapidAPI), Remotive, Tavily          |

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** (3.12 or 3.13 recommended)
- **Node.js 18+** (v20+ recommended)
- **npm** or **yarn**
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/CareerPilot.git
cd CareerPilot
```

### 2. Backend Setup

#### Install Python Dependencies

```bash
cd backend

# Create virtual environment (optional but recommended)
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# LLM APIs
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# Embeddings
VOYAGE_API_KEY=your_voyage_api_key_here

# Database
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Cache
UPSTASH_REDIS_REST_URL=your_upstash_redis_url_here
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token_here

# Job Search APIs
JSEARCH_API_KEY=your_jsearch_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

**Where to get API keys (all free tier):**

- **Groq**: https://console.groq.com/
- **Google AI (Gemini)**: https://aistudio.google.com/apikey
- **Voyage AI**: https://www.voyageai.com/
- **Supabase**: https://supabase.com/ (create a new project)
- **Upstash Redis**: https://upstash.com/
- **JSearch**: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
- **Tavily**: https://tavily.com/

#### Run Backend Server

```bash
# Make sure you're in the backend directory
cd backend

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

### 3. Frontend Setup

Open a **new terminal** window/tab:

#### Install Node Dependencies

```bash
cd frontend

# Install dependencies
npm install
```

#### Configure Environment Variables

Create a `.env.local` file in the `frontend/` directory:

```bash
# Copy from example if available, or create new
touch .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Run Frontend Server

```bash
# Make sure you're in the frontend directory
cd frontend

# Start the development server
npm run dev
```

Frontend will be available at: **http://localhost:3000**

### 4. Database Setup

1. Create a Supabase project at https://supabase.com/
2. Run the migrations in `supabase/migrations/` through the Supabase SQL editor
3. Enable pgvector extension in your Supabase project
4. Update your `.env` files with Supabase credentials

## 📝 Development Workflow

### Running Both Servers

You need **two terminal windows**:

**Terminal 1 - Backend:**

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

### Common Commands

**Backend:**

```bash
# Run tests
python -m pytest

# Check code style
black .
flake8 .

# Run specific test file
python test_parser.py
```

**Frontend:**

```bash
# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## 🏗️ Architecture

See **[AGENTS.md](./AGENTS.md)** for detailed architecture, coding conventions, and tech stack decisions.

Key principles:

- **100% free tier** — No paid APIs, no credit card required
- **Monorepo structure** — Backend and frontend in one repo
- **Type-safe** — TypeScript frontend, Python type hints backend
- **RAG-powered** — Vector search with pgvector + Voyage embeddings
- **Agentic** — LangGraph for job hunting workflows

## 🐛 Troubleshooting

### Backend Issues

**Import Error: `cannot import name 'genai' from 'google'`**

```bash
pip install google-generativeai
```

**Module Not Found: `langgraph`**

```bash
pip install langgraph langchain langchain-groq
```

**Port 8000 already in use**

```bash
# Change port in uvicorn command
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend Issues

**Module not found errors**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Port 3000 already in use**

```bash
# Next.js will automatically try port 3001, 3002, etc.
# Or specify port manually:
PORT=3001 npm run dev
```

### Database Issues

**Connection refused to Supabase**

- Check your `SUPABASE_URL` and keys in `.env` files
- Verify your Supabase project is active
- Check if your IP is allowed in Supabase settings

## 📚 Documentation

- **[AGENTS.md](./AGENTS.md)** — Complete architecture guide and coding rules
- **[PRD.md](./PRD.md)** — Product requirements document
- **[Backend API Docs](http://localhost:8000/docs)** — Auto-generated FastAPI docs (when server is running)

## 🤝 Contributing

This is a hackathon project for Codesprint 2026. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is built for Codesprint 2026. See license details in the repository.

## 🙏 Acknowledgments

- Built with free-tier AI services
- Powered by Groq, Gemini, Voyage AI, Supabase, and Upstash
- UI components from shadcn/ui

---

**Happy job hunting! 🎯**
