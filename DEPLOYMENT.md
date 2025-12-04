# Deployment Guide

This guide deploys all three parts using your chosen stack:
- Backend (FastAPI) on Render
- Frontend (React) on Netlify
- Chatbot (Rasa + Actions) on Render using Docker

## 1) Backend on Render
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY` (if required)
  - Any SMTP/email creds if mailing is enabled
- After deploy, note your backend URL: `https://<service>.onrender.com`

- Render must see your app listening on `$PORT`. We expose `/health` to help port scanning.


Branch & Node version:
- `REACT_APP_BACKEND_URL` → Render backend URL (e.g., `https://backend-api.onrender.com`)
- `REACT_APP_RASA_URL` → Render Rasa server URL (optional, if frontend calls it)
- `REACT_APP_SUPABASE_URL` → your Supabase URL (optional)
- `REACT_APP_SUPABASE_ANON_KEY` → your Supabase anon key (optional)
- If you see 404s, check that Publish directory is `build` and Base directory is `frontend/c`.

## 3) Rasa Chatbot on Render (Docker)
Create two Render services in the same project.

Recommended: use `render.yaml` (Blueprint) at repo root so each service builds from the correct context:
- `backend-api`: root `backend/`, Python
- `frontend-app`: Static Site from `frontend/c` (you may still prefer Netlify)
- `rasa-server`: Docker context `chatbot/`
- `rasa-actions`: Docker context `chatbot/actions/`

If you deploy manually without Blueprint from the repo root, Docker may not find `chatbot/*` files, causing COPY errors. Use Blueprint or set the service Build Context to the correct subfolder.

### Rasa server service
- Type: Web Service
- Runtime: Docker → use `chatbot/Dockerfile` with Build Context set to `chatbot/`
- Port: `8080`
- Health check path: `/` (or disable)
- Start command handled by Dockerfile: `rasa run --enable-api --cors "*" --port 8080`

### Actions server service
- Type: Web Service
- Runtime: Docker → use `chatbot/actions/Dockerfile` with Build Context set to `chatbot/actions/`
- Port: `5055`
- Health check path: `/` (or disable)
- Start command handled by Dockerfile: `rasa run actions --port 5055`

### Configure endpoints
- In `chatbot/endpoints.yml`, set the actions endpoint to the public Render URL:

```yaml
action_endpoint:
  url: "https://<your-actions-service>.onrender.com/webhook"
```

If both services are in the same Render account, use the public URL.

## 4) Wire URLs
- Frontend uses `REACT_APP_BACKEND_URL` to call the FastAPI backend (Render URL).
- If the frontend calls Rasa directly, set `REACT_APP_RASA_URL` to the Rasa Render URL.
- Backend stays the same; ensure CORS allows your deployed frontend domain (Render Static Site/Vercel/Netlify).
  - FastAPI currently allows common localhost origins; add your Netlify site domain in env or code if needed.

### Live URLs
- Frontend (Netlify): https://ai-resumescreening.netlify.app
- Backend (Render): https://ai-driven-resume-screening-backend.onrender.com

Set these in your environments:
- Netlify env: `REACT_APP_BACKEND_URL=https://ai-driven-resume-screening-backend.onrender.com`
- Backend CORS: allow origin `https://ai-resumescreening.netlify.app`

## 5) CORS notes
- Backend FastAPI should allow origins for your Netlify domain.
- Rasa server command includes `--cors "*"` for simplicity; restrict later if needed.

## 6) Testing
- Open Netlify site → verify API calls hit Render and chatbot endpoints.
- Check Render logs for Rasa and actions.

Quick checks:
- Backend health: `curl https://<backend>.onrender.com/health`
- Rasa server: `GET https://<rasa-server>.onrender.com` should respond.
- Actions webhook: `POST https://<rasa-actions>.onrender.com/webhook` is used by Rasa.

## 7) Cost caveats
- Free tiers may sleep/scale down; first request can be slow.
- Email providers may not be free; consider disabling or using a free provider.

## 8) Optional: Render for Rasa or Koyeb
You can deploy Rasa and actions on Render (two services) or Koyeb (Docker). Choose based on free limits and preference.

---

## Environment Variables Reference

### Backend (Render)
- `SUPABASE_URL`: Supabase project URL, e.g., `https://xxxx.supabase.co`
- `SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_KEY`: Supabase service role key (only if backend needs privileged operations)
- `JWT_SECRET`: Secret for JWTs if applicable
- `CORS_ALLOW_ORIGINS`: comma-separated allowed origins, e.g., `https://your-frontend.vercel.app`
- `EMAIL_ENABLED`: `true` or `false`
- `SMTP_HOST`: SMTP server host (e.g., `smtp.sendgrid.net`)
- `SMTP_PORT`: SMTP port (e.g., `587`)
- `SMTP_USERNAME`: SMTP username (e.g., `apikey` for SendGrid)
- `SMTP_PASSWORD`: SMTP password or API key
- `SMTP_FROM_EMAIL`: sender email
- `SMTP_FROM_NAME`: sender name
- `FRONTEND_URL`: deployed frontend URL
- `RASA_URL`: public Rasa server URL (if backend calls Rasa)

Example (Render):

```
SUPABASE_URL=https://exbmjznbphjujgngtnrz.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_if_used
JWT_SECRET=super_secret_string_change_me

CORS_ALLOW_ORIGINS=https://your-frontend.vercel.app,https://staging-your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app

EMAIL_ENABLED=false
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=SG.xxxxxx_your_sendgrid_api_key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=AI Resume Screening

RASA_URL=https://your-rasa.onrender.com
```

### Frontend (Netlify)
- `REACT_APP_BACKEND_URL`: Render backend URL
- `REACT_APP_RASA_URL`: Render Rasa URL (optional)
- `REACT_APP_SUPABASE_URL`: Supabase URL (optional)
- `REACT_APP_SUPABASE_ANON_KEY`: Supabase anon key (optional)

Example:

```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
REACT_APP_RASA_URL=https://your-rasa.onrender.com
REACT_APP_SUPABASE_URL=https://exbmjznbphjujgngtnrz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
```

### Rasa (Render)
- `RASA_PORT`: `8080` (server)
- `ACTIONS_PORT`: `5055` (actions)
- Any extra secrets your actions need

Update `chatbot/endpoints.yml` with actions URL:

```yaml
action_endpoint:
  url: "https://<your-actions-service>.onrender.com/webhook"
```

### SMTP Provider Notes
- Gmail: `smtp.gmail.com`, `587`, username=email, password=app password
- SendGrid: `smtp.sendgrid.net`, `587`, username=`apikey`, password=API key
- Mailgun: `smtp.mailgun.org`, `587`, username=`postmaster@yourdomain.mailgun.org`, password=smtp password
