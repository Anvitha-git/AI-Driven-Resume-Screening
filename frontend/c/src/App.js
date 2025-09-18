import React from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import HrDashboard from './HrDashboard';
import CandidateDashboard from './CandidateDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Container maxWidth="md">
              <Box sx={{ textAlign: 'right', mt: 2 }}>
                <Button variant="contained" color="primary" component={Link} to="/login">
                  Login/Sign Up
                </Button>
              </Box>
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <Typography variant="h3" gutterBottom>
                  AI-Driven Resume Screening System
                </Typography>
                <Typography variant="h6" gutterBottom>
                  A web-based application to streamline hiring with AI-powered resume screening and chatbot integration.
                </Typography>
                <Typography variant="body1" gutterBottom>
                  <strong>Features:</strong>
                  <ul>
                    <li>AI-driven resume parsing and ranking</li>
                    <li>Chatbot for screening questions and resume tips</li>
                    <li>HR and candidate dashboards</li>
                    <li>Job postings and email notifications</li>
                  </ul>
                </Typography>
              </Box>
            </Container>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/hr-dashboard" element={<HrDashboard />} />
        <Route path="/candidate-dashboard" element={<CandidateDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;