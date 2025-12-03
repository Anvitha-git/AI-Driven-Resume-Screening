# Free Deployment Guide

This guide deploys all three parts for free using recommended providers:
- Backend (FastAPI) on Render
- Frontend (React) on Vercel or Netlify
- Chatbot (Rasa + Actions) on Fly.io using Docker

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

## 2) Frontend on Vercel (or Netlify)
Either platform works. Vercel steps:
- Import your GitHub repo → Framework: React
- Root/Base directory: `frontend/c`
- Build command: `npm install && npm run build`
- Output/publish directory: `build`
- Environment variables:
  - `REACT_APP_BACKEND_URL` → Render backend URL
  - `REACT_APP_RASA_URL` → Fly.io Rasa URL (optional)
  - `REACT_APP_SUPABASE_URL` → your Supabase URL (optional)
  - `REACT_APP_SUPABASE_ANON_KEY` → your Supabase anon key (optional)
Netlify is similar: Base dir `frontend/c`, Publish `build`, same env vars.

## 3) Rasa Chatbot on Fly.io (Docker)
Create two Fly apps in one organization.

### Rasa server
- Source: `chatbot/` with `Dockerfile` provided.
- Exposes port `8080`.
- Start: `rasa run --enable-api --cors "*" --port 8080`.

### Actions server
- Source: `chatbot/actions/` with `Dockerfile` provided.
- Exposes port `5055`.
- Start: `rasa run actions --port 5055`.

### Configure endpoints
- In `chatbot/endpoints.yml`, set the actions endpoint to the public Fly URL:

```yaml
action_endpoint:
  url: "https://<your-actions-app>.fly.dev/webhook"
```

If both services run in the same org, you may be able to use internal networking; otherwise use public URL.

## 4) Wire URLs
- Frontend uses `REACT_APP_BACKEND_URL` to call the FastAPI backend.
- If the frontend calls Rasa directly, set `REACT_APP_RASA_URL`.
- Backend stays the same; ensure CORS allows your deployed frontend domain (Vercel/Netlify).

## 5) CORS notes
- Backend FastAPI should allow origins for your Vercel/Netlify domain.
- Rasa server command includes `--cors "*"` for simplicity; restrict later if needed.

## 6) Testing
- Open Netlify site → verify API calls hit Render and chatbot endpoints.
- Check Railway logs for Rasa and actions.

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

RASA_URL=https://your-rasa.fly.dev
```

### Frontend (Vercel/Netlify)
- `REACT_APP_BACKEND_URL`: Render backend URL
- `REACT_APP_RASA_URL`: Fly.io Rasa URL (optional)
- `REACT_APP_SUPABASE_URL`: Supabase URL (optional)
- `REACT_APP_SUPABASE_ANON_KEY`: Supabase anon key (optional)

Example:

```
REACT_APP_BACKEND_URL=https://your-backend.onrender.com
REACT_APP_RASA_URL=https://your-rasa.fly.dev
REACT_APP_SUPABASE_URL=https://exbmjznbphjujgngtnrz.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key_here
```

### Rasa (Fly.io)
- `RASA_PORT`: `8080` (server)
- `ACTIONS_PORT`: `5055` (actions)
- Any extra secrets your actions need

Update `chatbot/endpoints.yml` with actions URL:

```yaml
action_endpoint:
  url: "https://<your-actions-app>.fly.dev/webhook"
```

### SMTP Provider Notes
- Gmail: `smtp.gmail.com`, `587`, username=email, password=app password
- SendGrid: `smtp.sendgrid.net`, `587`, username=`apikey`, password=API key
- Mailgun: `smtp.mailgun.org`, `587`, username=`postmaster@yourdomain.mailgun.org`, password=smtp password
