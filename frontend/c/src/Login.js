
import React from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Auth.css';
import API_URL from './config';

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
      const response = await axios.post(`${API_URL}/login`, { email, password });
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
    <div className="auth-page-wrapper">
      {/* Decorative Side Panel */}
      <div className="auth-decoration-panel">
        <div className="decoration-content">
          <div className="decoration-logo">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6"/>
              <path d="M12 18v-6"/>
              <path d="M9 15h6"/>
            </svg>
          </div>
          <h2 className="decoration-title">AI-Powered Resume Screening</h2>
          <p className="decoration-subtitle">Streamline your hiring process with intelligent candidate matching</p>
          
          <div className="decoration-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
          </div>
          
          <div className="decoration-features">
            <div className="feature-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>95% Match Accuracy</span>
            </div>
            <div className="feature-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>10x Faster Screening</span>
            </div>
            <div className="feature-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Intelligent Insights</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card-container">
        <div className="auth-card">
          {/* Card Header */}
          <div className="auth-card-header">
            <div className="auth-brand-logo">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <path d="M14 2v6h6"/>
                <path d="M12 18v-6"/>
                <path d="M9 15h6"/>
              </svg>
            </div>
            <h1 className="auth-card-title">Welcome back</h1>
            <p className="auth-card-description">
              Sign in to your account to continue
            </p>
          </div>

          {/* Card Content */}
          <div className="auth-card-content">
            <form className="auth-form-modern" onSubmit={handleLogin}>
              {error && <div className="auth-error-message">{error}</div>}

              {/* Email Field */}
              <div className="form-field">
                <label htmlFor="email" className="field-label">
                  Email <span className="required">*</span>
                </label>
                <input
                  id="email"
                  className="field-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password Field */}
              <div className="form-field">
                <label htmlFor="password" className="field-label">
                  Password <span className="required">*</span>
                </label>
                <div className="password-field-wrapper">
                  <input
                    id="password"
                    className="field-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div style={{ textAlign: 'right', marginTop: '-0.5rem' }}>
                <button type="button" className="checkbox-link" style={{ fontSize: '0.875rem' }}>
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button className="auth-submit-btn" type="submit">
                Sign in
              </button>
            </form>
          </div>

          {/* Card Footer */}
          <div className="auth-card-footer">
            <p className="auth-footer-text">
              Don't have an account?
              <button 
                type="button"
                className="auth-footer-link" 
                onClick={() => navigate('/signup')}
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;