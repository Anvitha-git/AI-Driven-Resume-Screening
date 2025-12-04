import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import axios from "axios";
const BASE_URL = process.env.REACT_APP_BACKEND_URL;
import './Auth.css';

function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!name || !email || !password || !role) {
      setError("Please fill all fields.");
      return;
    }
    
    if (!agreeTerms) {
      setError("Please agree to the Terms and Conditions.");
      return;
    }
    
    try {
      await axios.post(`${BASE_URL}/signup`, { name, email, password, role });
      setSuccess("Sign up successful! Redirecting to login...");
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Sign up failed.");
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
          <h2 className="decoration-title">Join Our Platform</h2>
          <p className="decoration-subtitle">Transform your recruitment with AI-driven candidate screening</p>
          
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
              <span>Smart Candidate Matching</span>
            </div>
            <div className="feature-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Automated Resume Analysis</span>
            </div>
            <div className="feature-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Real-time Chat Support</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card-container">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-card-header">
            <div className="auth-brand-logo">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <path d="M12 18v-6"/>
                <path d="M9 15l3 3 3-3"/>
              </svg>
            </div>
            <h2 className="auth-card-title">Create an account</h2>
            <p className="auth-card-description">Welcome! Create an account to get started.</p>
          </div>

          {/* Form Content */}
          <div className="auth-card-content">
            <form onSubmit={handleSignUp} className="auth-form-modern">
              
              {/* Role Selection */}
              <div className="form-field">
                <label htmlFor="role" className="field-label">Role</label>
                <div className="select-wrapper">
                  <select
                    id="role"
                    className="field-input select-input"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select role</option>
                    <option value="HR">
                      HR Manager
                    </option>
                    <option value="Candidate">
                      Candidate
                    </option>
                  </select>
                  <svg className="select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Full Name */}
              <div className="form-field">
                <label htmlFor="name" className="field-label">Full Name</label>
                <input
                  id="name"
                  type="text"
                  className="field-input"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>

              {/* Email */}
              <div className="form-field">
                <label htmlFor="email" className="field-label">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="form-field">
                <label htmlFor="password" className="field-label">Password</label>
                <div className="password-field-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="field-input password-field"
                    placeholder="Create a password"
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  id="terms"
                  className="checkbox-input"
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                />
                <label htmlFor="terms" className="checkbox-label">
                  I agree to the{" "}
                  <button type="button" className="checkbox-link" onClick={() => {}}>Terms</button>
                  {" "}and{" "}
                  <button type="button" className="checkbox-link" onClick={() => {}}>Conditions</button>
                </label>
              </div>

              {/* Error/Success Messages */}
              {error && <div className="auth-error-message">{error}</div>}
              {success && <div className="auth-success-message">{success}</div>}

              {/* Submit Button */}
              <button type="submit" className="auth-submit-btn">
                Create free account
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="auth-card-footer">
            <p className="auth-footer-text">
              Already have an account?{" "}
              <button 
                type="button"
                className="auth-footer-link" 
                onClick={() => navigate('/login')}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp;
