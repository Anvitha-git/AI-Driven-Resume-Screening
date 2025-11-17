# Frontend Documentation - AI-Driven Resume Screening System

## Table of Contents
1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [State Management](#state-management)
6. [Routing & Navigation](#routing--navigation)
7. [UI/UX Design](#uiux-design)
8. [Why We Chose These Technologies](#why-we-chose-these-technologies)
9. [Alternatives Considered](#alternatives-considered)
10. [Features Implemented](#features-implemented)

---

## Overview

The frontend is a **React 18.2.0** single-page application (SPA) that provides an intuitive interface for:
- **HR Users**: Job posting, resume upload, candidate ranking, decision-making
- **Candidates**: Application tracking, chatbot interaction, notifications
- **Both**: Authentication, profile management, real-time updates

**Key Characteristics:**
- Modern, responsive design (mobile-friendly)
- Material-UI components (professional look)
- Client-side routing (fast navigation)
- Local storage persistence (UX continuity)
- Real-time chat integration

---

## Technology Stack

### Core Framework
- **React 18.2.0** - Component-based UI library
- **React DOM 18.2.0** - DOM rendering
- **React Scripts 5.0.1** - Build tooling (Webpack, Babel)

### UI Components
- **Material-UI (MUI) 5.18.0** - Component library
  - `@mui/material` - Core components (Button, Dialog, TextField)
  - `@mui/icons-material` - Icon library (1000+ icons)
  - `@emotion/react` & `@emotion/styled` - CSS-in-JS styling

### Routing & Navigation
- **React Router DOM 6.30.1** - Client-side routing
  - `BrowserRouter` - HTML5 history API
  - `Routes` & `Route` - Declarative routing
  - `useNavigate` - Programmatic navigation

### HTTP Client
- **Axios 1.12.2** - Promise-based HTTP client
  - Request/response interceptors
  - Automatic JSON parsing
  - Error handling

### Chatbot
- **React Simple Chatbot 0.6.1** - Chat UI components
- **Styled Components 5.3.11** - Chatbot styling

### Testing
- **Testing Library** - Component testing
  - `@testing-library/react` 16.3.0
  - `@testing-library/jest-dom` 6.8.0
  - `@testing-library/user-event` 13.5.0

### CSS & Styling
- **@csstools/normalize.css** - Cross-browser consistency
- **Custom CSS** - Component-specific styles

### Other Libraries
- **ajv 8.17.1** - JSON schema validation
- **web-vitals 2.1.4** - Performance metrics

---

## Project Structure

```
frontend/c/
├── public/
│   ├── index.html          # Root HTML file
│   ├── favicon.ico         # Browser tab icon
│   ├── logo192.png         # PWA icon (192x192)
│   ├── logo512.png         # PWA icon (512x512)
│   ├── manifest.json       # PWA configuration
│   └── robots.txt          # SEO crawler rules
│
├── src/
│   ├── App.js              # Main application component
│   ├── App.css             # Global styles
│   ├── index.js            # React entry point
│   ├── index.css           # Base styles
│   │
│   ├── Login.js            # Authentication page
│   ├── HrDashboard.js      # HR user interface (~2038 lines)
│   ├── CandidateDashboard.js  # Candidate interface (~1209 lines)
│   ├── LandingPage.js      # Public homepage
│   │
│   ├── setupTests.js       # Jest configuration
│   ├── reportWebVitals.js  # Performance monitoring
│   └── App.test.js         # App component tests
│
└── package.json            # Dependencies & scripts
```

---

## Core Components

### 1. **App.js** - Root Component

**Purpose:** Application routing and layout

**Code Structure:**
```javascript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import HrDashboard from './HrDashboard';
import CandidateDashboard from './CandidateDashboard';
import LandingPage from './LandingPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/hr-dashboard" element={<HrDashboard />} />
        <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Why this pattern?**
- Single responsibility (routing only)
- Clean separation of concerns
- Easy to add new routes
- Type-safe with React Router v6

---

### 2. **Login.js** - Authentication Page

**Features:**
- Email + Password login
- Role-based redirect (HR vs Candidate)
- Registration form
- Form validation
- Error handling

**State Management:**
```javascript
const [isLogin, setIsLogin] = useState(true);  // Toggle login/register
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [name, setName] = useState('');
const [role, setRole] = useState('candidate');
const [error, setError] = useState('');
```

**Login Flow:**
```javascript
const handleLogin = async (e) => {
  e.preventDefault();
  
  try {
    const response = await axios.post('http://localhost:8000/login', {
      email,
      password
    });
    
    // Save token to localStorage
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('user_role', response.data.user.role);
    
    // Redirect based on role
    if (response.data.user.role === 'hr') {
      navigate('/hr-dashboard');
    } else {
      navigate('/candidate-dashboard');
    }
  } catch (err) {
    setError('Invalid email or password');
  }
};
```

**Why localStorage for tokens?**
- Persists across browser sessions
- Accessible in all tabs
- Simple API (`getItem`, `setItem`, `removeItem`)
- Survives page refreshes

**Alternatives:**
- ❌ sessionStorage - Lost on tab close
- ❌ Cookies - More complex to manage
- ❌ Redux store - Lost on refresh (needs middleware)

---

### 3. **HrDashboard.js** (~2038 lines) - HR Interface

The most complex component with multiple features.

#### **State Variables:**

```javascript
// Authentication
const [user, setUser] = useState(null);

// Job Management
const [jobs, setJobs] = useState([]);
const [selectedJob, setSelectedJob] = useState(null);
const [showJobForm, setShowJobForm] = useState(false);

// Resume Management
const [resumes, setResumes] = useState([]);
const [uploadedFiles, setUploadedFiles] = useState([]);
const [uploading, setUploading] = useState(false);

// Decision Tracking
const [decisions, setDecisions] = useState({});  // {resume_id: 'selected'}
const [showCandidatesDialog, setShowCandidatesDialog] = useState(false);
const [selectedCandidates, setSelectedCandidates] = useState([]);

// Explanation Modal
const [showExplanationModal, setShowExplanationModal] = useState(false);
const [currentExplanation, setCurrentExplanation] = useState(null);
```

---

#### **Key Features:**

##### **A) Job Posting**

**UI:**
```javascript
<Dialog open={showJobForm} onClose={() => setShowJobForm(false)}>
  <DialogTitle>Create New Job Posting</DialogTitle>
  <DialogContent>
    <TextField label="Job Title" fullWidth margin="normal" />
    <TextField label="Description" multiline rows={4} fullWidth />
    <TextField label="Requirements" multiline rows={3} fullWidth />
    <TextField label="Location" fullWidth margin="normal" />
    <TextField label="Salary Range" fullWidth margin="normal" />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleCreateJob}>Post Job</Button>
  </DialogActions>
</Dialog>
```

**API Call:**
```javascript
const handleCreateJob = async () => {
  const token = localStorage.getItem('access_token');
  
  const response = await axios.post(
    'http://localhost:8000/hr/jobs',
    {
      title: jobTitle,
      description: jobDescription,
      requirements: jobRequirements.split('\n'),  // Convert to array
      location,
      salary_range: salaryRange
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  // Refresh job list
  fetchJobs();
};
```

---

##### **B) Resume Upload**

**File Selection:**
```javascript
<input
  type="file"
  multiple
  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
  onChange={(e) => setUploadedFiles(Array.from(e.target.files))}
/>
```

**Upload with FormData:**
```javascript
const handleUploadResumes = async () => {
  const formData = new FormData();
  
  // Append each file
  uploadedFiles.forEach(file => {
    formData.append('files', file);
  });
  
  setUploading(true);
  
  const response = await axios.post(
    `http://localhost:8000/hr/jobs/${selectedJob.id}/upload-resumes`,
    formData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data'
      }
    }
  );
  
  setUploading(false);
  fetchResumes(selectedJob.id);  // Refresh resume list
};
```

**Why FormData?**
- Supports file uploads
- Handles binary data
- Works with multipart/form-data
- Browser-native API

---

##### **C) Candidate Ranking Display**

**Resume List (Sorted by Score):**
```javascript
{resumes
  .sort((a, b) => b.ranking_score - a.ranking_score)  // Highest first
  .map((resume, index) => (
    <Card key={resume.id} sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h6">
          #{index + 1} - {resume.candidate_name}
        </Typography>
        
        {/* Score with color coding */}
        <Chip 
          label={`Score: ${resume.ranking_score?.toFixed(1)}%`}
          color={
            resume.ranking_score >= 80 ? 'success' :
            resume.ranking_score >= 60 ? 'warning' :
            'error'
          }
        />
        
        {/* Skills */}
        <Box sx={{ mt: 2 }}>
          {resume.skills?.map(skill => (
            <Chip key={skill} label={skill} size="small" sx={{ mr: 1 }} />
          ))}
        </Box>
        
        {/* Decision Dropdown */}
        <FormControl sx={{ mt: 2, minWidth: 200 }}>
          <Select
            value={decisions[resume.id] || resume.decision || 'pending'}
            onChange={(e) => handleDecision(resume.id, e.target.value)}
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="selected">Selected</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
        
        {/* Explanation Button */}
        <Button 
          variant="outlined"
          onClick={() => handleExplainRanking(resume.id)}
        >
          Why this score?
        </Button>
      </CardContent>
    </Card>
  ))
}
```

**Color Coding Logic:**
- 🟢 Green (80-100%): Excellent match
- 🟡 Yellow (60-79%): Good match
- 🔴 Red (0-59%): Poor match

---

##### **D) Decision Workflow**

**Step 1: Save Decision (No Email)**
```javascript
const handleDecision = async (resumeId, decision) => {
  const token = localStorage.getItem('access_token');
  
  // Save to backend (NO email sent)
  await axios.post(
    `http://localhost:8000/decisions/${resumeId}`,
    { decision },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  // Update local state
  setDecisions(prev => ({ ...prev, [resumeId]: decision }));
  
  // Track selected candidates for dialog
  if (decision === 'selected') {
    const resume = resumes.find(r => r.id === resumeId);
    setSelectedCandidates(prev => [...prev, resume]);
  }
};
```

**Step 2: Submit Decisions (Send Emails)**
```javascript
const handleSubmitDecisions = async () => {
  const token = localStorage.getItem('access_token');
  
  try {
    // Call submit-decisions endpoint (sends emails)
    const response = await axios.post(
      `http://localhost:8000/hr/jobs/${selectedJob.id}/submit-decisions`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('Emails sent:', response.data.emails_sent);
    
    // Update job status to closed
    await axios.patch(
      `http://localhost:8000/jobs/${selectedJob.id}`,
      { status: 'closed' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    // Clear localStorage and close dialog
    localStorage.removeItem('candidatesDialogOpen');
    localStorage.removeItem('selectedCandidates');
    setShowCandidatesDialog(false);
    
    alert('Decisions submitted and emails sent!');
  } catch (error) {
    console.error('Error submitting decisions:', error);
    alert('Failed to submit decisions');
  }
};
```

---

##### **E) localStorage Persistence**

**Problem:** Dialog auto-closes when navigating between pages.

**Solution:** Save dialog state to localStorage.

**Implementation:**
```javascript
// Load state on component mount
useEffect(() => {
  const dialogOpen = localStorage.getItem('candidatesDialogOpen');
  const candidatesData = localStorage.getItem('selectedCandidates');
  
  if (dialogOpen === 'true' && candidatesData) {
    setShowCandidatesDialog(true);
    setSelectedCandidates(JSON.parse(candidatesData));
  }
}, []);

// Save state when dialog opens
const openCandidatesDialog = () => {
  setShowCandidatesDialog(true);
  localStorage.setItem('candidatesDialogOpen', 'true');
  localStorage.setItem('selectedCandidates', JSON.stringify(selectedCandidates));
};

// Clear state when submitting
const handleSubmitDecisions = async () => {
  // ... API calls ...
  
  localStorage.removeItem('candidatesDialogOpen');
  localStorage.removeItem('selectedCandidates');
  setShowCandidatesDialog(false);
};
```

**Why this pattern?**
- Persists across page navigation
- Survives browser refresh
- Easy to implement
- No backend changes needed

---

##### **F) Explanation Modal**

**Fetch Explanation:**
```javascript
const handleExplainRanking = async (resumeId) => {
  const token = localStorage.getItem('access_token');
  
  const response = await axios.get(
    `http://localhost:8000/hr/resumes/${resumeId}/explain`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  setCurrentExplanation(response.data);
  setShowExplanationModal(true);
};
```

**Display Breakdown:**
```javascript
<Dialog open={showExplanationModal} onClose={() => setShowExplanationModal(false)}>
  <DialogTitle>Why this score?</DialogTitle>
  <DialogContent>
    {/* Overall Score */}
    <Typography variant="h4">
      Overall Score: {currentExplanation?.overall_score}%
    </Typography>
    
    {/* Component Scores */}
    <Typography variant="h6" sx={{ mt: 3 }}>Score Breakdown:</Typography>
    
    <Box sx={{ mt: 2 }}>
      {/* Skill Match */}
      <Typography>
        <strong>Skill Match:</strong> {currentExplanation?.score_breakdown.skill_match.score}%
        <br />
        <small>Weight: {currentExplanation?.score_breakdown.skill_match.weight}%</small>
        <br />
        <small>Contribution: {currentExplanation?.score_breakdown.skill_match.contribution}%</small>
      </Typography>
      
      {/* Semantic Similarity */}
      <Typography sx={{ mt: 2 }}>
        <strong>Semantic Similarity:</strong> {currentExplanation?.score_breakdown.semantic_similarity.score}%
      </Typography>
      
      {/* Experience */}
      <Typography sx={{ mt: 2 }}>
        <strong>Experience:</strong> {currentExplanation?.score_breakdown.experience.score}%
      </Typography>
      
      {/* Education */}
      <Typography sx={{ mt: 2 }}>
        <strong>Education:</strong> {currentExplanation?.score_breakdown.education.score}%
      </Typography>
    </Box>
    
    {/* Matched Skills */}
    <Typography variant="h6" sx={{ mt: 3 }}>Matched Skills:</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {currentExplanation?.matched_skills.map(skill => (
        <Chip key={skill} label={skill} color="success" />
      ))}
    </Box>
    
    {/* Missing Skills */}
    <Typography variant="h6" sx={{ mt: 3 }}>Missing Skills:</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {currentExplanation?.missing_skills.map(skill => (
        <Chip key={skill} label={skill} color="error" />
      ))}
    </Box>
  </DialogContent>
</Dialog>
```

**Benefits:**
- Transparency (shows AI reasoning)
- Educational (HR learns what matters)
- Actionable (candidates know what to improve)
- Compliance (EU AI Act transparency requirements)

---

### 4. **CandidateDashboard.js** (~1209 lines) - Candidate Interface

#### **Key Features:**

##### **A) Application Tracking**

**Fetch Applications:**
```javascript
useEffect(() => {
  const fetchApplications = async () => {
    const token = localStorage.getItem('access_token');
    
    const response = await axios.get(
      'http://localhost:8000/candidate/applications',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    setApplications(response.data.applications);
  };
  
  fetchApplications();
}, []);
```

**Display:**
```javascript
{applications.map(app => (
  <Card key={app.id}>
    <CardContent>
      <Typography variant="h6">{app.job_title}</Typography>
      <Typography>Company: {app.company_name}</Typography>
      
      {/* Status Badge */}
      <Chip 
        label={app.decision.toUpperCase()}
        color={
          app.decision === 'selected' ? 'success' :
          app.decision === 'rejected' ? 'error' :
          'default'
        }
      />
      
      <Typography>Score: {app.ranking_score}%</Typography>
      <Typography>Applied: {new Date(app.uploaded_at).toLocaleDateString()}</Typography>
    </CardContent>
  </Card>
))}
```

---

##### **B) Chatbot Integration**

**Rasa Integration:**
```javascript
import ChatBot from 'react-simple-chatbot';

const steps = [
  {
    id: '1',
    message: 'Hi! I\'m your interview prep assistant. Ready to practice?',
    trigger: '2',
  },
  {
    id: '2',
    options: [
      { value: 'yes', label: 'Yes, let\'s start!', trigger: 'start-interview' },
      { value: 'no', label: 'Not now', trigger: 'goodbye' },
    ],
  },
  {
    id: 'start-interview',
    user: true,
    trigger: 'rasa-response',
  },
  {
    id: 'rasa-response',
    component: <RasaMessage />,
    waitAction: true,
    trigger: 'start-interview',
  },
];

<ChatBot
  steps={steps}
  floating={true}
  headerTitle="Interview Prep Bot"
/>
```

**Rasa API Call:**
```javascript
const RasaMessage = ({ previousStep, triggerNextStep }) => {
  useEffect(() => {
    const sendMessage = async () => {
      const response = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
        sender: 'user-id',
        message: previousStep.value
      });
      
      const botMessage = response.data[0]?.text || 'Sorry, I didn\'t understand.';
      triggerNextStep({ value: botMessage });
    };
    
    sendMessage();
  }, []);
  
  return <div>Thinking...</div>;
};
```

**Why react-simple-chatbot?**
- Easy to integrate
- Customizable UI
- Supports async messages
- TypeScript-friendly

**Alternatives:**
- ❌ react-chatbot-kit - More complex setup
- ❌ Custom chat UI - Weeks of work
- ❌ Rasa X - Overkill for simple chat

---

##### **C) Notifications**

**Fetch Notifications:**
```javascript
const fetchNotifications = async () => {
  const token = localStorage.getItem('access_token');
  
  const response = await axios.get(
    'http://localhost:8000/notifications',
    { headers: { Authorization: `Bearer ${token}` } }
  );
  
  setNotifications(response.data.notifications);
};
```

**Display:**
```javascript
<Badge badgeContent={notifications.filter(n => !n.read).length} color="error">
  <NotificationsIcon />
</Badge>

{/* Notification List */}
<Menu open={showNotifications}>
  {notifications.map(notif => (
    <MenuItem key={notif.id}>
      <ListItemText
        primary={notif.message}
        secondary={new Date(notif.created_at).toLocaleString()}
      />
      {!notif.read && <FiberManualRecordIcon color="primary" />}
    </MenuItem>
  ))}
</Menu>
```

---

### 5. **LandingPage.js** - Public Homepage

**Sections:**
- Hero (headline + CTA)
- Features (AI ranking, chatbot, analytics)
- How It Works (3-step process)
- Pricing (free tier, pro plan)
- Contact (support email)

**Call-to-Action:**
```javascript
<Button
  variant="contained"
  size="large"
  onClick={() => navigate('/login')}
>
  Get Started Free
</Button>
```

---

## State Management

### Why No Redux?

**Our approach:** Component-level `useState` + `useEffect`

**Reasons:**
- Simple data flow (no complex state sharing)
- API calls localized to components
- localStorage handles persistence
- Fewer dependencies (faster bundle)

**When to use Redux:**
- State shared across 5+ components
- Complex state updates (time travel debugging)
- Large team (enforced patterns)

**Alternatives:**
- ✅ Context API - Good for theme, auth
- ✅ Zustand - Lighter than Redux
- ❌ MobX - Steeper learning curve

---

## Routing & Navigation

### React Router v6 Features

**Declarative Routes:**
```javascript
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/login" element={<Login />} />
  <Route path="/hr-dashboard" element={<HrDashboard />} />
  <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
</Routes>
```

**Programmatic Navigation:**
```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();

// After login
navigate('/hr-dashboard');

// Go back
navigate(-1);

// Replace history
navigate('/login', { replace: true });
```

**Protected Routes:**
```javascript
const ProtectedRoute = ({ children, allowedRoles }) => {
  const role = localStorage.getItem('user_role');
  
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

<Route 
  path="/hr-dashboard" 
  element={
    <ProtectedRoute allowedRoles={['hr']}>
      <HrDashboard />
    </ProtectedRoute>
  } 
/>
```

**Why React Router?**
- Industry standard
- TypeScript support
- Data loading (upcoming)
- Server-side rendering support

---

## UI/UX Design

### Material-UI Benefits

**1. Pre-built Components:**
- Buttons, Cards, Dialogs, Menus
- Form inputs, Checkboxes, Switches
- Tables, Lists, Grids
- Icons (1000+)

**2. Responsive Design:**
```javascript
<Grid container spacing={2}>
  <Grid item xs={12} sm={6} md={4}>
    <Card>...</Card>
  </Grid>
</Grid>
```
- `xs`: Extra small (mobile)
- `sm`: Small (tablet)
- `md`: Medium (desktop)

**3. Theming:**
```javascript
import { createTheme, ThemeProvider } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

**4. Accessibility:**
- ARIA labels built-in
- Keyboard navigation
- Screen reader support
- WCAG 2.1 compliant

**Why Material-UI?**
- Professional look (Google Material Design)
- Faster development (no CSS from scratch)
- Consistent UX across app
- Mobile-friendly out-of-box

**Alternatives:**
- ❌ Bootstrap - Older, less React-friendly
- ❌ Ant Design - Less popular in West
- ❌ Custom CSS - Weeks of work
- ✅ Chakra UI - Good alternative

---

## Why We Chose These Technologies

### React vs Vue vs Angular

| Feature | React | Vue | Angular |
|---------|-------|-----|---------|
| **Learning Curve** | Medium | Easy | Hard |
| **Bundle Size** | Small | Smallest | Large |
| **Ecosystem** | Huge | Growing | Large |
| **TypeScript** | Optional | Optional | Built-in |
| **Company** | Meta | Independent | Google |
| **Best For** | SPAs, UI libs | Small apps | Enterprise |

**Why React?**
- Largest ecosystem (most libraries)
- Job market demand (most jobs)
- Flexible (not opinionated)
- Virtual DOM (fast updates)
- Reusable components

**When to use Vue:**
- Simpler learning curve needed
- Smaller team
- Greenfield project

**When to use Angular:**
- Large enterprise app
- Full framework needed (router, HTTP, etc. built-in)
- TypeScript mandatory

---

### Axios vs Fetch API

| Feature | Axios | Fetch |
|---------|-------|-------|
| **Syntax** | Simpler | Verbose |
| **JSON Parsing** | Automatic | Manual |
| **Interceptors** | ✅ Yes | ❌ No |
| **Timeout** | ✅ Yes | ❌ No |
| **Progress** | ✅ Yes | ❌ No |
| **Size** | 13 KB | Built-in |

**Why Axios?**
```javascript
// Axios
const response = await axios.post('/api', data, { headers });
console.log(response.data);  // Already JSON

// Fetch
const response = await fetch('/api', {
  method: 'POST',
  headers,
  body: JSON.stringify(data)
});
const json = await response.json();  // Extra step
```

**Axios Interceptors:**
```javascript
// Add token to all requests
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**When to use Fetch:**
- No extra dependencies
- Modern browser only
- Simple GET requests

---

### Material-UI vs Bootstrap

| Feature | Material-UI | Bootstrap |
|---------|-------------|-----------|
| **Design** | Material Design | Generic |
| **React Integration** | Native | react-bootstrap |
| **Customization** | Theme API | SASS variables |
| **Bundle Size** | Medium | Small |
| **Accessibility** | Excellent | Good |

**Why Material-UI?**
- Built for React (not jQuery)
- Professional look
- Active development
- Great documentation

---

## Alternatives Considered

### State Management

**❌ Redux**
- Boilerplate (actions, reducers, store)
- Learning curve
- Overkill for our app size
- ✅ useState: Simpler, sufficient

**❌ Context API**
- Good for theme, auth
- Re-renders all consumers (performance)
- ✅ useState: Better for local state

**✅ React Query (future)**
- Cache API responses
- Auto-refetch
- Optimistic updates

---

### Styling

**❌ Styled Components (alone)**
- No pre-built components
- Need to build everything
- ✅ MUI: 50+ components ready

**❌ Tailwind CSS**
- Utility-first (verbose JSX)
- No pre-built components
- Learning curve (class names)
- ✅ MUI: Semantic props

**❌ Custom CSS**
- Weeks of work
- Cross-browser issues
- Not responsive by default
- ✅ MUI: Works out-of-box

---

### Routing

**❌ React Router v5**
- Older API
- Less type-safe
- ✅ v6: Better DX

**❌ Reach Router**
- Merged into React Router
- No longer maintained
- ✅ React Router: Active

---

## Features Implemented

### 1. **Authentication Flow**
- ✅ Login with email/password
- ✅ Registration (HR/Candidate roles)
- ✅ JWT token storage
- ✅ Role-based redirect
- ✅ Protected routes
- ✅ Logout functionality

### 2. **HR Dashboard**
- ✅ Job posting form (title, description, requirements)
- ✅ Job listing with status
- ✅ Resume upload (multiple files, PDF/DOCX/PNG)
- ✅ Candidate ranking display (sorted by score)
- ✅ Color-coded scores (green/yellow/red)
- ✅ Decision dropdown (selected/rejected/pending)
- ✅ Explanation modal (score breakdown)
- ✅ Submit decisions (sends emails)
- ✅ localStorage persistence (dialog state)

### 3. **Candidate Dashboard**
- ✅ Application tracking
- ✅ Status badges (selected/rejected/pending)
- ✅ Chatbot integration (Rasa)
- ✅ Notification center
- ✅ Profile management
- ✅ Job search

### 4. **Landing Page**
- ✅ Hero section
- ✅ Features showcase
- ✅ How it works
- ✅ Pricing table
- ✅ Contact information

### 5. **UI/UX**
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Material Design (MUI)
- ✅ Loading states (spinners)
- ✅ Error handling (alerts)
- ✅ Form validation
- ✅ Accessible (ARIA labels)

---

## Performance Optimizations

### 1. **Code Splitting**
```javascript
// Lazy load components
const HrDashboard = React.lazy(() => import('./HrDashboard'));
const CandidateDashboard = React.lazy(() => import('./CandidateDashboard'));

<Suspense fallback={<CircularProgress />}>
  <Routes>
    <Route path="/hr-dashboard" element={<HrDashboard />} />
    <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
  </Routes>
</Suspense>
```

### 2. **Memoization**
```javascript
// Avoid re-rendering
const SortedResumes = React.memo(({ resumes }) => {
  const sorted = useMemo(
    () => resumes.sort((a, b) => b.ranking_score - a.ranking_score),
    [resumes]
  );
  
  return sorted.map(resume => <ResumeCard key={resume.id} {...resume} />);
});
```

### 3. **Debouncing**
```javascript
// Search input
const [searchTerm, setSearchTerm] = useState('');

const debouncedSearch = useMemo(
  () => _.debounce((term) => fetchJobs(term), 300),
  []
);

<TextField
  onChange={(e) => {
    setSearchTerm(e.target.value);
    debouncedSearch(e.target.value);
  }}
/>
```

---

## Build & Deployment

### Development
```bash
cd frontend/c
npm install
npm start
# Opens http://localhost:3000
```

### Production Build
```bash
npm run build
# Creates optimized build/ folder
# Deploy to Netlify, Vercel, or AWS S3
```

### Environment Variables
```bash
# Create .env file
REACT_APP_API_URL=http://localhost:8000
REACT_APP_RASA_URL=http://localhost:5005
```

**Usage:**
```javascript
const API_URL = process.env.REACT_APP_API_URL;
axios.post(`${API_URL}/login`, data);
```

---

## Future Improvements

### Short-term:
- [ ] Dark mode toggle
- [ ] Advanced search/filters
- [ ] Pagination (100+ resumes)
- [ ] Drag-and-drop file upload
- [ ] Resume preview (PDF viewer)

### Long-term:
- [ ] Real-time updates (WebSocket)
- [ ] Video interview scheduling
- [ ] Analytics dashboard (charts)
- [ ] Bulk operations (select all)
- [ ] Mobile app (React Native)

---

**Last Updated:** November 17, 2025  
**Version:** 1.0  
**Author:** AI-Driven Resume Screening Team
