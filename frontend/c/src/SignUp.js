
import React, { useState } from "react";
import axios from "axios";
import './LandingPage.css';

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    if (!email || !password || !role) {
      setError("Please fill all fields.");
      return;
    }
    try {
      await axios.post("http://localhost:8000/signup", { email, password, role });
      setSuccess("Sign up successful! Redirecting to login...");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Sign up failed.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-title">Sign Up</div>
      <form className="auth-form" onSubmit={handleSignUp} autoComplete="off">
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
        <select
          className="auth-field"
          value={role}
          onChange={e => setRole(e.target.value)}
          required
        >
          <option value="" disabled>Select Role</option>
          <option value="HR">HR</option>
          <option value="Candidate">Candidate</option>
        </select>
        <button className="auth-btn" type="submit">Sign Up</button>
      </form>
      {error && <div className="auth-error">{error}</div>}
      {success && <div className="auth-success">{success}</div>}
      <div className="auth-divider" />
      <div className="auth-alt-action">
        Already have an account?{' '}
        <button className="auth-btn" style={{width: 'auto', padding: '0.4rem 1.2rem', fontSize: '1rem', marginTop: 0}} type="button" onClick={() => window.location.href = "/login"}>Sign In</button>
      </div>
    </div>
  );
}

export default SignUp;
