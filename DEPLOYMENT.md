# Free Deployment Guide

This guide deploys all three parts for free:
- Backend (FastAPI) on Render
- Frontend (React) on Netlify
- Chatbot (Rasa + Actions) on Railway using Docker

## 1) Backend on Render
- Create a Render Web Service from this repo.
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port 10000`
- Environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY` (if required)
  - Any SMTP/email creds if mailing is enabled
- After deploy, note your backend URL: `https://<service>.onrender.com`

## 2) Frontend on Netlify
- Connect repo and select site from Git.
- Base directory: `frontend/c`
- Build command: `npm install` then `npm run build`
- Publish directory: `build`
- Environment variables:
  - `REACT_APP_BACKEND_URL` → Render backend URL
  - `REACT_APP_RASA_URL` → Railway Rasa URL
- Optionally create `.env` locally following `frontend/c/.env.example`.

## 3) Rasa Chatbot on Railway (Docker)
Create two services in one Railway project.

### Rasa server
- Source: `chatbot/` with `Dockerfile` provided.
- Exposes port `8080`.
- Start: `rasa run --enable-api --cors "*" --port 8080`.

### Actions server
- Source: `chatbot/actions/` with `Dockerfile` provided.
- Exposes port `5055`.
- Start: `rasa run actions --port 5055`.

### Configure endpoints
- In `chatbot/endpoints.yml`, set the actions endpoint to the public URL from Railway:

```yaml
action_endpoint:
  url: "https://<actions-service>.up.railway.app/webhook"
```

If both services run in the same Railway project and networking allows, you can use service name instead of public URL.

## 4) Wire URLs
- Frontend uses `REACT_APP_BACKEND_URL` to call the FastAPI backend.
- If the frontend calls Rasa directly, set `REACT_APP_RASA_URL` accordingly.
- Backend stays the same; ensure CORS allows your Netlify domain.

## 5) CORS notes
- Backend FastAPI should allow origins for your Netlify domain.
- Rasa server command includes `--cors "*"` for simplicity; restrict later if needed.

## 6) Testing
- Open Netlify site → verify API calls hit Render and chatbot endpoints.
- Check Railway logs for Rasa and actions.

## 7) Cost caveats
- Free tiers may sleep/scale down; first request can be slow.
- Email providers may not be free; consider disabling or using a free provider.

## 8) Optional: Render for Rasa
You can also deploy Rasa and actions on Render with Docker services using these Dockerfiles if you prefer one platform.
