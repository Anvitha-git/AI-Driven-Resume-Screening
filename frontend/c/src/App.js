import React from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import { Link } from 'react-router-dom';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';

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
                </Typography>
                <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                  <li>AI-driven resume parsing and ranking</li>
                  <li>Chatbot for screening questions and resume tips</li>
                  <li>HR and candidate dashboards</li>
                  <li>Job postings and email notifications</li>
                </ul>
              </Box>
            </Container>
          }
        />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;