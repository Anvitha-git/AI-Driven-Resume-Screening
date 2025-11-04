
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './LandingPage.css';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const response = await axios.post('http://localhost:8000/login', { email, password });
  localStorage.setItem('token', response.data.access_token);
  localStorage.setItem('access_token', response.data.access_token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  localStorage.setItem('user_id', response.data.user_id);
  localStorage.setItem('role', response.data.role);
  // Persist email for friendly display name in dashboards
  localStorage.setItem('email', email);
      // Redirect based on role
      const role = response.data.role;
      if (role === 'HR') {
        navigate('/hr-dashboard', { state: { token: response.data.access_token }, replace: true });
      } else {
        navigate('/candidate-dashboard', { state: { token: response.data.access_token }, replace: true });
      }
    } catch (error) {
      setError(error.response?.data?.detail || error.message || 'Login failed.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-title">Sign In</div>
      <form className="auth-form" onSubmit={handleLogin} autoComplete="off">
        <input
          className="auth-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="auth-field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button className="auth-btn" type="submit">Sign In</button>
      </form>
      {error && <div className="auth-error">{error}</div>}
      <div className="auth-divider" />
      <div className="auth-alt-action">
        Don&apos;t have an account?{' '}
        <button className="auth-btn" style={{width: 'auto', padding: '0.4rem 1.2rem', fontSize: '1rem', marginTop: 0}} type="button" onClick={() => window.location.href = "/signup"}>Sign Up</button>
      </div>
    </div>
  );
}

export default Login;