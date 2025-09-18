import React from 'react';
import { Button, Container, TextField, Box, Typography, Divider } from '@mui/material';
import { Link } from 'react-router-dom';

function Login() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Login
        </Typography>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Email" variant="outlined" fullWidth />
          <TextField label="Password" type="password" variant="outlined" fullWidth />
          <Button variant="contained" color="primary" type="submit">
            Sign In
          </Button>
        </Box>
        <Divider sx={{ my: 2 }}>OR</Divider>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" component={Link} to="/hr-dashboard">
            Login as Demo HR
          </Button>
          <Button variant="outlined" component={Link} to="/candidate-dashboard">
            Login as Demo Candidate
          </Button>
        </Box>
      </Box>
    </Container>
  );
}

export default Login;