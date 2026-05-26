# CareerPilot Deployment Guide

## Deployment Platform: Render

CareerPilot uses **Render** for backend deployment instead of Railway.

### Why Render?

- ✅ **Truly free** — No credit card required
- ✅ **750 hours/month** — More than enough for a 14-day hackathon + demos
- ✅ **Simple deployment** — Git push to deploy
- ✅ **Good for demos** — Cold starts (30-60s) are acceptable for hackathon presentations

### Deployment Architecture

```
Frontend (Next.js)  →  Vercel (free tier)
Backend (FastAPI)   →  Render (free tier)
Database            →  Supabase (free tier)
Cache               →  Upstash Redis (free tier)
```

## Backend Deployment Steps

### 1. Prepare Your Repository

Ensure you have a `Dockerfile` in your `backend/` directory:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]
```

### 2. Deploy to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) and sign up (free, no credit card)
3. Click **New** → **Web Service**
4. Connect your GitHub repository
5. Configure the service:
   - **Name**: `careerpilot-backend`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: `backend` (if using monorepo)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables (see below)
7. Click **Create Web Service**

### 3. Environment Variables

Add these in the Render dashboard (Environment tab):

```
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_api_key
VOYAGE_API_KEY=your_voyage_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
JSEARCH_API_KEY=your_jsearch_api_key
TAVILY_API_KEY=your_tavily_api_key
```

### 4. Get Your Backend URL

After deployment completes, Render will provide a URL like:

```
https://careerpilot-backend.onrender.com
```

Copy this URL — you'll need it for the frontend configuration.

## Frontend Deployment Steps

### 1. Update Environment Variables

In your `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=https://careerpilot-backend.onrender.com
```

### 2. Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign up
3. Click **New Project**
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend` (if using monorepo)
6. Add environment variables (the three from above)
7. Click **Deploy**

## Infrastructure as Code (Optional)

You can use the included `render.yaml` file for automated deployment:

```yaml
services:
  - type: web
    name: careerpilot-backend
    env: python
    region: oregon
    plan: free
    buildCommand: pip install -r backend/requirements.txt
    startCommand: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: GROQ_API_KEY
        sync: false
      # ... (add all other env vars)
    healthCheckPath: /health
```

Place this file in your repository root and Render will auto-detect it.

## Important Notes

### Cold Starts

Render free tier services spin down after 15 minutes of inactivity. The first request after inactivity will take 30-60 seconds to wake up.

**For demos**: Ping your backend URL 1-2 minutes before presenting to ensure it's warm.

```bash
curl https://careerpilot-backend.onrender.com/health
```

### Memory Limits

Render free tier provides 512MB RAM. This is why we use:

- ✅ Gemini API for PDF parsing (server-side processing)
- ✅ Voyage AI for embeddings (API-based)
- ❌ NOT docling (requires 1.5-2GB RAM)

### Logs and Monitoring

Access logs in the Render dashboard:

1. Go to your service
2. Click **Logs** tab
3. View real-time logs and errors

## Troubleshooting

### Service Won't Start

Check the logs for:

- Missing environment variables
- Python dependency errors
- Port binding issues (ensure you use `$PORT` not hardcoded `8000`)

### Cold Start Too Slow

Upgrade to Render's paid tier ($7/month) for always-on instances with no cold starts.

### Out of Memory

If you see OOM errors:

- Verify you're not using docling or other heavy libraries
- Check that all ML processing is API-based (Gemini, Voyage, Groq)
- Consider upgrading to a paid tier with more RAM

## Cost Comparison

| Platform   | Free Tier       | Cold Starts | Credit Card Required  |
| ---------- | --------------- | ----------- | --------------------- |
| **Render** | 750 hrs/month   | 30-60s      | ❌ No                 |
| Railway    | $5 credit/month | 5-10s       | ✅ Yes                |
| Fly.io     | 3 VMs           | Fast        | ✅ Yes (verification) |

For a 14-day hackathon with no credit card, **Render is the best choice**.

## Next Steps

1. Deploy backend to Render (Day 7 morning)
2. Deploy frontend to Vercel (Day 7 morning)
3. Test all endpoints with the deployed URLs
4. Update your README with live demo links
5. Keep the service warm before demo presentations

---

**Questions?** Check the [Render documentation](https://render.com/docs) or the main [README.md](./README.md).
