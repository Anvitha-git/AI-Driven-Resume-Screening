# Quick Start Guide

> Fast setup instructions for running the AI-Driven Resume Screening System locally

---

## 🚀 Running the Application

Open **four PowerShell terminals**, navigate to the project root directory, then run the following commands:

### Terminal 1️⃣ - Backend (FastAPI)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2️⃣ - Frontend (React)
```powershell
cd frontend/c
npm start
```

### Terminal 3️⃣ - Rasa Actions Server
```powershell
cd chatbot
.\venv\Scripts\Activate.ps1
rasa run actions --port 5055
```

### Terminal 4️⃣ - Rasa Chat Server
```powershell
cd chatbot
.\venv\Scripts\Activate.ps1
rasa run --enable-api --cors "*" --port 5005
```

---

## 🌐 Access URLs

Once all services are running, access them at:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | [http://localhost:3000](http://localhost:3000) | React application (HR & Candidate dashboards) |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI server |
| **API Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive Swagger documentation |
| **Rasa Server** | [http://localhost:5005](http://localhost:5005) | Chatbot API endpoint |
| **Rasa Actions** | [http://localhost:5055](http://localhost:5055) | Custom action server |

---

## 📝 Important Notes

- ✅ Run all commands from the **project root directory** (the folder containing `backend/`, `frontend/`, `chatbot/`)
- ✅ Keep **all four terminals open** while using the application
- ✅ If virtual environments or `node_modules` are missing, see [Installation Guide](README.md#installation) for first-time setup
- ✅ Ensure Python 3.11+ and Node.js 18+ are installed

---

## 🐛 Troubleshooting

### Backend won't start
- Ensure virtual environment is activated: `.\venv\Scripts\Activate.ps1`
- Check if port 8000 is available: `netstat -ano | findstr :8000`
- Verify .env file exists with required variables

### Frontend won't start
- Delete `node_modules` and reinstall: `rm -r node_modules; npm install`
- Clear npm cache: `npm cache clean --force`

### Rasa errors
- Retrain the model: `rasa train`
- Ensure spaCy model is installed: `python -m spacy download en_core_web_sm`

---

## 🔗 Related Documentation

For detailed setup, configuration, and architecture information, refer to:
- [Complete Installation Guide](README.md#installation)
- [Backend Documentation](docs/BACKEND_DOCUMENTATION.md)
- [Frontend Documentation](docs/FRONTEND_DOCUMENTATION.md)
- [Chatbot Documentation](docs/CHATBOT_DOCUMENTATION.md)

---

**Team:** AI-Resume-Screening | CMR Institute of Technology
