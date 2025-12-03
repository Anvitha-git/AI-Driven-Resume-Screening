import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const role = localStorage.getItem('role');
  const [isVisible, setIsVisible] = useState(false);
  const [showTeam, setShowTeam] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeTeam();
    };
    if (showTeam) {
      document.addEventListener('keydown', onKeyDown);
    }
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showTeam]);
  
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

  const openTeam = () => setShowTeam(true);
  const closeTeam = () => setShowTeam(false);
  const onOverlayClick = (e) => {
    if (e.target.classList.contains('team-modal-overlay')) closeTeam();
  };
  

  return (
    <div className="landing-container">
      {/* Navigation Header */}
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-nav-left">
            <div className="landing-nav-brand">
              <img src="/favicon-32x32.png" alt="AI Resume Screening" className="landing-brand-logo" />
              <span className="landing-brand-text">AI Resume Screening</span>
            </div>
            <div className="landing-nav-links">
              <span className="landing-nav-link" onClick={() => scrollToSection('features')}>Features</span>
              <span className="landing-nav-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span>
            </div>
          </div>
          <div className="landing-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
      <section className={`landing-hero ${isVisible ? 'fade-in' : ''}`}>
        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span>AI-Powered Recruitment Platform</span>
          </div>
          <h1 className="landing-hero-title">
            Transform Your Hiring Process with <span className="gradient-text">Intelligent AI</span>
          </h1>
          <p className="landing-hero-subtitle">
            Streamline recruitment, eliminate bias, and discover top talent faster with our advanced AI-powered resume screening platform. Trusted by forward-thinking companies worldwide.
          </p>
          <div className="landing-hero-buttons">
            <button onClick={handleGetStarted} className="landing-hero-btn primary">
              Get Started Free
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
          
          {/* Stats */}
          <div className="landing-hero-stats">
            <div className="hero-stat">
              <div className="stat-number">95%</div>
              <div className="stat-label">Accuracy Rate</div>
            </div>
            <div className="hero-stat">
              <div className="stat-number">10x</div>
              <div className="stat-label">Faster Screening</div>
            </div>
            <div className="hero-stat">
              <div className="stat-number">50+</div>
              <div className="stat-label">Companies Trust Us</div>
            </div>
          </div>
          
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
            Join hundreds of companies using AI to hire smarter, faster, and fairer.
          </p>
          <button onClick={handleGetStarted} className="landing-cta-btn">
            Get Started for Free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
          <p className="landing-cta-note">No credit card required • Free 14-day trial</p>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="landing-testimonials-section">
        <div className="landing-testimonials-content">
          <h2 className="landing-section-title">Trusted by HR Professionals</h2>
          <p className="landing-section-subtitle">
            See what our customers say about their experience with our platform.
          </p>
          
          <div className="testimonials-grid">
            <div className="testimonial-card">
              <div className="testimonial-stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-text">
                "This platform reduced our screening time by 80%. The AI insights are incredibly accurate and the bias-free approach has improved our diversity hiring."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">SK</div>
                <div>
                  <div className="author-name">Sarah Kumar</div>
                  <div className="author-role">HR Director, Tech Solutions Inc.</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-text">
                "The automated feedback feature is a game-changer. Candidates appreciate the personalized insights, and it's strengthened our employer brand significantly."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">RP</div>
                <div>
                  <div className="author-name">Rajesh Patel</div>
                  <div className="author-role">Talent Acquisition Lead, InnovateCorp</div>
                </div>
              </div>
            </div>

            <div className="testimonial-card">
              <div className="testimonial-stars">
                {'★'.repeat(5)}
              </div>
              <p className="testimonial-text">
                "Easy to use, powerful AI, and excellent support. We've cut our time-to-hire in half and found better-fit candidates consistently."
              </p>
              <div className="testimonial-author">
                <div className="author-avatar">MP</div>
                <div>
                  <div className="author-name">Maria Peterson</div>
                  <div className="author-role">Recruiting Manager, Global Enterprises</div>
                </div>
              </div>
            </div>
          </div>
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
                <p>airesumescreening@gmail.com</p>
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

      {/* Team Modal */}
      {showTeam && (
        <div className="team-modal-overlay" onClick={onOverlayClick}>
          <div className="team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
            <div className="team-modal-header">
              <h3 id="team-modal-title">Project Team</h3>
              <button className="team-close-btn" onClick={closeTeam} aria-label="Close team dialog">×</button>
            </div>
            <p className="team-modal-subtitle">Major Project — CMR Institute of Technology, Bengaluru</p>
            <div className="team-grid">
              <div className="team-card">
                <div className="team-avatar">AS</div>
                <div className="team-info">
                  <div className="team-name">Anvitha S</div>
                  <div className="team-role">Frontend & Chatbot Developer</div>
                </div>
              </div>
              <div className="team-card">
                <div className="team-avatar">LS</div>
                <div className="team-info">
                  <div className="team-name">Lingeshwari S</div>
                  <div className="team-role">Frontend & Chatbot Developer</div>
                </div>
              </div>
              <div className="team-card">
                <div className="team-avatar">PV</div>
                <div className="team-info">
                  <div className="team-name">Pranav V</div>
                  <div className="team-role">Backend & AI/ML Developer</div>
                </div>
              </div>
              <div className="team-card">
                <div className="team-avatar">SS</div>
                <div className="team-info">
                  <div className="team-name">Shariq Sheikh</div>
                  <div className="team-role">Backend & AI/ML Developer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-footer-links">
            <span className="landing-footer-link" onClick={() => scrollToSection('about')}>About</span>
            <span className="landing-footer-link" onClick={() => scrollToSection('contact')}>Contact</span>
            <span className="landing-footer-link" onClick={openTeam}>Team</span>
            <span className="landing-footer-link">Privacy Policy</span>
          </div>
          <p className="landing-footer-copyright">
            © 2025. All rights reserved.
          </p>
          <a
            href="https://github.com/Anvitha-git/AI-Driven-Resume-Screening"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-footer-github"
            aria-label="View on GitHub"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.48 2.87 8.28 6.84 9.63.5.09.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.36-3.37-1.36-.45-1.18-1.1-1.5-1.1-1.5-.9-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.7 0 0 .84-.28 2.75 1.05A9.38 9.38 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.44.1 2.7.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.58.69.48A10.01 10.01 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/>
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
