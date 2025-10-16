import React from 'react';
import { Button, Container, TextField, Box, Typography, Divider } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:8000/login', { email, password });
      localStorage.setItem('token', response.data.access_token);
      navigate('/candidate-dashboard', { state: { token: response.data.access_token } });
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDemoLogin = async (role) => {
    try {
      const response = await axios.post(`http://localhost:8000/demo-login/${role}`);
      localStorage.setItem('token', response.data.access_token);
      navigate(role === 'demo_hr' ? '/hr-dashboard' : '/candidate-dashboard', { state: { token: response.data.access_token } });
    } catch (error) {
      alert('Demo login failed: ' + (error.response?.data?.detail || error.message));
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Login
        </Typography>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} onSubmit={handleLogin}>
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button variant="contained" color="primary" type="submit">
            Sign In
          </Button>
        </Box>
        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={() => handleDemoLogin('demo_hr')}>
            Login as Demo HR
          </Button>
          <Button variant="outlined" onClick={() => handleDemoLogin('demo_candidate')}>
            Login as Demo Candidate
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default Login;