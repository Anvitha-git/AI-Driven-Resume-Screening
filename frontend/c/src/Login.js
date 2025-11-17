
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
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
      localStorage.setItem('email', email);
      // Store name from response (if available)
      if (response.data.name) {
        localStorage.setItem('name', response.data.name);
      }
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
    <div className="modern-auth-wrapper">
      <div className="modern-auth-container">
        {/* Left side - Illustration */}
        <div className="auth-illustration-panel">
          <div className="geometric-characters">
            <div className="character character-purple"></div>
            <div className="character character-black"></div>
            <div className="character character-orange"></div>
            <div className="character character-yellow"></div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className="auth-form-panel">
          <div className="auth-header">
            <div className="auth-logo">💼</div>
            <h1 className="auth-heading">Welcome back!</h1>
            <p className="auth-subheading">Please enter your details</p>
          </div>

          <form className="modern-auth-form" onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input
                id="email"
                className="modern-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  className="modern-input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-extras">
              <button type="button" className="link-button">Forgot password?</button>
            </div>

            {error && <div className="modern-auth-error">{error}</div>}

            <button className="modern-auth-btn" type="submit">Log in</button>

            <button type="button" className="google-btn" onClick={() => alert('Google login not implemented yet')}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
              </svg>
              Log in with Google
            </button>
          </form>

          <div className="auth-footer">
            <span>Don't have an account? </span>
            <button className="link-button" onClick={() => navigate('/signup')}>Sign up</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;