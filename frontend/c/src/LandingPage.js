import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const role = localStorage.getItem('role');
  
  const handleGoToDashboard = () => {
    if (role === 'HR') {
      navigate('/hr-dashboard');
    } else {
      navigate('/candidate-dashboard');
    }
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleSignUp = () => {
    navigate('/signup');
  };

  const handleGetStarted = () => {
    if (token) {
      handleGoToDashboard();
    } else {
      navigate('/signup');
    }
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="landing-container">
      {/* Navigation Header */}
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-nav-left">
            <span className="landing-nav-link" onClick={() => scrollToSection('features')}>Features</span>
            <span className="landing-nav-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span>
          </div>
          <div className="landing-nav-right">
            {token ? (
              <button onClick={handleGoToDashboard} className="landing-nav-btn landing-nav-btn-primary">
                Go to Dashboard
              </button>
            ) : (
              <>
                <button onClick={handleLogin} className="landing-nav-btn landing-nav-btn-secondary">
                  Login
                </button>
                <button onClick={handleSignUp} className="landing-nav-btn landing-nav-btn-primary">
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <h1 className="landing-hero-title">
            Revolutionize Hiring with AI-Powered Resume Screening
          </h1>
          <p className="landing-hero-subtitle">
            Automate bias-free candidate selection and provide personalized feedback to build a world-class team.
          </p>
          <button onClick={handleGetStarted} className="landing-hero-btn">
            Get Started
          </button>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="landing-features-section">
        <div className="landing-features-content">
          <h2 className="landing-section-title">Key Features</h2>
          <p className="landing-section-subtitle">
            Our AI-driven platform offers a suite of tools to streamline your hiring process and enhance the candidate experience.
          </p>
          
          <div className="landing-features-grid">
            {/* Feature 1 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-blue">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <h3 className="landing-feature-title">AI Resume Parsing & Ranking</h3>
              <p className="landing-feature-description">
                Automatically extract key information from resumes, rank candidates based on job requirements, and mitigate bias in the selection process.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-cyan">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  <line x1="9" y1="10" x2="15" y2="10"/>
                  <line x1="9" y1="14" x2="13" y2="14"/>
                </svg>
              </div>
              <h3 className="landing-feature-title">Conversational Chatbot</h3>
              <p className="landing-feature-description">
                Provide instant, personalized feedback to candidates, offer interview preparation resources, and answer common questions through an interactive chatbot.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon landing-feature-icon-purple">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              </div>
              <h3 className="landing-feature-title">Intuitive Dashboards</h3>
              <p className="landing-feature-description">
                Gain insights into candidate performance, track application status, and access valuable resources for both HR teams and candidates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-how-section">
        <div className="landing-how-content">
          <h2 className="landing-section-title">How It Works</h2>
          <p className="landing-section-subtitle">
            A simple, streamlined process to revolutionize your recruitment workflow.
          </p>

          <div className="landing-steps">
            {/* Step 1 */}
            <div className="landing-step">
              <div className="landing-step-number">1</div>
              <div className="landing-step-content">
                <h3 className="landing-step-title">Upload Resumes</h3>
                <p className="landing-step-description">
                  HR managers upload multiple resumes in various formats (PDF, DOCX, etc.) through our secure portal.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="landing-step">
              <div className="landing-step-number">2</div>
              <div className="landing-step-content">
                <h3 className="landing-step-title">AI Analysis & Screening</h3>
                <p className="landing-step-description">
                  Our AI engine parses and analyzes each resume, scoring and ranking candidates based on skills, experience, and custom criteria.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="landing-step">
              <div className="landing-step-number">3</div>
              <div className="landing-step-content">
                <h3 className="landing-step-title">Shortlist & Engage</h3>
                <p className="landing-step-description">
                  View the top candidates on an intuitive dashboard. Engage with them through automated, personalized emails and our chatbot.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="landing-step">
              <div className="landing-step-number">4</div>
              <div className="landing-step-content">
                <h3 className="landing-step-title">Candidate Feedback</h3>
                <p className="landing-step-description">
                  Unsuccessful candidates automatically receive constructive feedback and suggestions for improvement, enhancing your employer brand.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="landing-cta-section">
        <div className="landing-cta-content">
          <h2 className="landing-cta-title">Ready to Transform Your Hiring?</h2>
          <p className="landing-cta-subtitle">
            Join the companies revolutionizing their recruitment process.
          </p>
          <button onClick={handleGetStarted} className="landing-cta-btn">
            Get Started for Free
          </button>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="landing-about-section">
        <div className="landing-about-content">
          <h2 className="landing-section-title">About</h2>
          <p className="landing-about-text">
            Built with FastAPI, React, and Supabase, our AI-Driven Resume Screening platform leverages 
            state-of-the-art artificial intelligence to revolutionize the hiring process. We're committed 
            to making recruitment fairer, faster, and more efficient for both employers and job seekers.
          </p>
          <p className="landing-about-text">
            Our mission is to eliminate bias in hiring while providing valuable feedback to candidates, 
            helping them grow and succeed in their career journey. Join us in transforming the future of recruitment.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="landing-contact-section">
        <div className="landing-contact-content">
          <h2 className="landing-section-title">Contact Us</h2>
          <p className="landing-section-subtitle">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
          <div className="landing-contact-info">
            <div className="landing-contact-item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <h4>Email</h4>
                <p>support@resumescreening.com</p>
              </div>
            </div>
            <div className="landing-contact-item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <div>
                <h4>Phone</h4>
                <p>+91 88441 99900</p>
              </div>
            </div>
            <div className="landing-contact-item">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <h4>Office</h4>
                <p>CMR Institute of Technology, AECS Layout, ITPL, Bengaluru 560036</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-links">
            <span className="landing-footer-link" onClick={() => scrollToSection('about')}>About</span>
            <span className="landing-footer-link" onClick={() => scrollToSection('contact')}>Contact</span>
            <span className="landing-footer-link">Privacy Policy</span>
          </div>
          <p className="landing-footer-copyright">
            © 2025. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
