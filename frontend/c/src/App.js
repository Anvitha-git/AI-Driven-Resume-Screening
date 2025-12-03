

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import HrDashboard from './HrDashboard';
import CandidateDashboard from './CandidateDashboard';
import SignUp from './SignUp';
import LandingPage from './LandingPage';

function RequireAuth({ children, role }) {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PreventAuth({ children, allowIfLoggedIn = false }) {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const role = localStorage.getItem('role');
  
  // If allowIfLoggedIn is true, render children even if logged in
  if (allowIfLoggedIn) {
    return children;
  }
  
  // Otherwise, redirect logged-in users to their dashboard
  if (token) {
    if (role === 'HR') {
      return <Navigate to="/hr-dashboard" replace />;
    } else {
      return <Navigate to="/candidate-dashboard" replace />;
    }
  }
  return children;
}




function App() {
  React.useEffect(() => {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <PreventAuth allowIfLoggedIn={true}>
            <LandingPage />
          </PreventAuth>
        } />
        <Route path="/login" element={
          <PreventAuth>
            <Login />
          </PreventAuth>
        } />
        <Route path="/signup" element={
          <PreventAuth>
            <SignUp />
          </PreventAuth>
        } />
        <Route path="/hr-dashboard" element={
          <RequireAuth>
            <HrDashboard />
          </RequireAuth>
        } />
        <Route path="/candidate-dashboard" element={
          <RequireAuth>
            <CandidateDashboard />
          </RequireAuth>
        } />
      </Routes>
    </Router>
  );
}

export default App;