import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

function HrDashboard() {
  // Auth helpers: refresh expired access tokens and retry the request
  const getAccessToken = () => localStorage.getItem('access_token') || localStorage.getItem('token');
  const tryRefreshToken = useCallback(async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) return false;
    try {
      const resp = await axios.post('http://localhost:8000/refresh', { refresh_token });
      const { access_token, refresh_token: new_rt } = resp.data || {};
      if (access_token) {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('token', access_token);
      }
      if (new_rt) {
        localStorage.setItem('refresh_token', new_rt);
      }
      return !!access_token;
    } catch (e) {
      return false;
    }
  }, []);
  const withAuth = useCallback(async (requestFn) => {
    let token = getAccessToken();
    try {
      return await requestFn(token);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          token = getAccessToken();
          return await requestFn(token);
        } else {
          // If refresh fails, clear session
          localStorage.removeItem('token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_id');
          localStorage.removeItem('role');
          localStorage.removeItem('email');
        }
      }
      throw err;
    }
  }, [tryRefreshToken]);
  // Handler for posting a new job
  const handleJobSubmit = async (e) => {
    e.preventDefault();
    try {
      // Backend expects requirements: List[str]. Wrap textarea string as a single-item array.
      const jobData = {
        title: newJob.title,
        description: newJob.description,
        requirements: newJob.requirements ? [newJob.requirements] : [],
        deadline: newJob.deadline,
        weights: newJob.weights,
      };
      await withAuth(async (token) => (
        axios.post('http://localhost:8000/jobs', jobData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      alert('Job posted successfully!');
      setNewJob({ title: '', description: '', requirements: '', deadline: '', weights: { skills: 0.4, experience: 0.4, education: 0.2 } });
      fetchJobs();
    } catch (error) {
      // Surface backend error details if available
      const msg = error?.response?.data?.detail ? `Failed to post job: ${error.response.data.detail}` : 'Failed to post job';
      console.error('Post job error:', error);
      alert(msg);
    }
  };

  // Handler for ranking resumes for a job
  const handleRankResumes = async (jdId) => {
    setRankingJob(jdId);
    try {
      const list = await withAuth(async (token) => {
        await axios.post(`http://localhost:8000/rank-resumes/${jdId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await axios.get(`http://localhost:8000/resumes/${jdId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return Array.isArray(res.data) ? res.data : [];
      });
      
      const mapped = list.map(r => ({
        id: r.resume_id,
        rank: r.rank,
        candidate: r.user_email || r.user_id,
        score: typeof r.score === 'number' ? (r.score * 100).toFixed(1) : r.score,
        explanation: r.explanation,
        file_url: r.file_url,
        resume_id: r.resume_id,
        decision: r.decision || 'pending',
      }));
      setCandidates(mapped);
      setOpenCandidatesDialog(true);
      
      // ⚠️ Close the job posting after ranking
      // Update the job status to 'closed' in the local state
      setJobs(prevJobs => prevJobs.map(job => 
        job.jd_id === jdId ? { ...job, status: 'closed' } : job
      ));
      
      // Also update in the database
      try {
        await withAuth(async (token) => {
          await axios.patch(
            `http://localhost:8000/jobs/${jdId}`,
            { status: 'closed' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        });
      } catch (err) {
        console.error('Failed to update job status:', err);
      }
      
    } catch (error) {
      console.error('Rank resumes error:', error);
      const msg = error?.response?.data?.detail ? `Failed to rank resumes: ${error.response.data.detail}` : 'Failed to rank resumes';
      alert(msg);
    }
    setRankingJob(null);
  };

  // Handler for opening a job in history
  const openJobInHistory = async (job) => {
    setSelectedHistoryJob(job);
    await fetchCandidatesForJob(job.jd_id);
  };
  const navigate = useNavigate();
  // Prevent back navigation from dashboard
  React.useEffect(() => {
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({ 
    title: '', 
    description: '', 
    requirements: '', 
    deadline: '',
    weights: { skills: 0.4, experience: 0.4, education: 0.2 }
  });
  
  const [candidates, setCandidates] = useState([]);
  const [openCandidatesDialog, setOpenCandidatesDialog] = useState(false);
  const [rankingJob, setRankingJob] = useState(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [hrJobsHistory, setHrJobsHistory] = useState([]);
  const [selectedHistoryJob, setSelectedHistoryJob] = useState(null);
  const [historyJobCandidates, setHistoryJobCandidates] = useState([]);
  const [activePage, setActivePage] = useState('new-job'); // 'new-job', 'job-postings', 'history', 'profile', 'analytics', 'settings', 'help', 'interviews', 'team'
  const [candidatesSearchTerm, setCandidatesSearchTerm] = useState('');
  const [candidatesFilterTab, setCandidatesFilterTab] = useState('all'); // 'all', 'skills', 'experience', 'match-score'
  const [decisionFilter, setDecisionFilter] = useState('all'); // 'all', 'selected', 'rejected', 'pending'
  
  // Settings state for HR
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.dashboard-profile-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Utility function to format date from yyyy-mm-dd to dd/mm/yyyy for display
  const formatDateForDisplay = (dateStr) => {
    if (!dateStr) return '';
    // Split the date string to avoid timezone issues
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Utility function to format candidate name from email or ID
  const formatCandidateName = (userId) => {
    if (!userId) return 'Unknown';
    // If it's an email, extract the name part
    if (userId.includes('@')) {
      const name = userId.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    // If it's a UUID or other ID, return as is (shouldn't happen with emails)
    return userId;
  };

  // Function to handle weight changes and auto-adjust others to maintain total = 1.0
  const handleWeightChange = (changedWeight, value) => {
    const newValue = parseFloat(value) || 0;
    const clampedValue = Math.max(0, Math.min(1, newValue));
    
    const currentWeights = { ...newJob.weights };
    currentWeights[changedWeight] = clampedValue;
    
    // Calculate remaining weight to distribute
    const remaining = 1 - clampedValue;
    
    // Get the other two weights
    const otherWeights = Object.keys(currentWeights).filter(key => key !== changedWeight);
    
    if (remaining <= 0) {
      // If changed weight is 1.0, set others to 0
      otherWeights.forEach(key => currentWeights[key] = 0);
    } else {
      // Calculate current sum of other weights
      const otherSum = otherWeights.reduce((sum, key) => sum + currentWeights[key], 0);
      
      if (otherSum > 0) {
        // Distribute remaining proportionally
        otherWeights.forEach(key => {
          currentWeights[key] = (currentWeights[key] / otherSum) * remaining;
        });
      } else {
        // If other weights are 0, distribute equally
        otherWeights.forEach(key => {
          currentWeights[key] = remaining / otherWeights.length;
        });
      }
    }
    
    setNewJob({ ...newJob, weights: currentWeights });
  };

  useEffect(() => {
    const fetchForPage = async () => {
      if (activePage === 'job-postings') {
        try {
          await withAuth(async (token) => {
            const response = await axios.get('http://localhost:8000/jobs', {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            setJobs(response.data);
          });
        } catch (error) {
          console.error('Failed to fetch jobs', error);
        }
      } else if (activePage === 'history') {
        try {
          await withAuth(async (token) => {
            const response = await axios.get('http://localhost:8000/hr/jobs', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const jobs = response.data || [];
            const jobsWithCandidates = await Promise.all(jobs.map(async (job) => {
              try {
                const res = await axios.get(`http://localhost:8000/hr/jobs/${job.jd_id}/candidates`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                return { ...job, candidates: res.data || [] };
              } catch {
                return { ...job, candidates: [] };
              }
            }));
            setHrJobsHistory(jobsWithCandidates);
          });
        } catch (error) {
          console.error('Failed to fetch HR jobs history', error);
        }
      }
    };
    fetchForPage();
    // Logout when window/tab is closed
    const handleBeforeUnload = () => {
      localStorage.removeItem('token');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activePage, withAuth]);

  const fetchJobs = async () => {
    try {
      await withAuth(async (token) => {
        const response = await axios.get('http://localhost:8000/jobs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJobs(response.data);
      });
    } catch (error) {
      console.error('Failed to fetch jobs', error);
    }
  };

  // HR history: all jobs posted by the HR
  const fetchHrJobsHistory = async () => {
    try {
      await withAuth(async (token) => {
        console.log('Fetching HR jobs history...');
        const response = await axios.get('http://localhost:8000/hr/jobs', {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('HR jobs response:', response.data);
        const jobs = response.data || [];
        console.log(`Found ${jobs.length} jobs for this HR`);
        const jobsWithCandidates = await Promise.all(jobs.map(async (job) => {
          try {
            const res = await axios.get(`http://localhost:8000/hr/jobs/${job.jd_id}/candidates`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            return { ...job, candidates: res.data || [] };
          } catch {
            return { ...job, candidates: [] };
          }
        }));
        console.log('Jobs with candidates:', jobsWithCandidates);
        setHrJobsHistory(jobsWithCandidates);
      });
    } catch (error) {
      console.error('Failed to fetch HR jobs history', error);
    }
  };

  const fetchCandidatesForJob = async (jdId) => {
    try {
      await withAuth(async (token) => {
        const response = await axios.get(`http://localhost:8000/hr/jobs/${jdId}/candidates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setHistoryJobCandidates(response.data || []);
      });
    } catch (error) {
      console.error('Failed to fetch job candidates', error);
    }
  };

  const handleDecision = async (resumeId, decision) => {
    try {
      const userId = localStorage.getItem('user_id');
      
      if (!getAccessToken()) {
        alert('No token found. Please login again.');
        navigate('/login');
        return;
      }
      
      await withAuth(async (token) => (
        axios.post(`http://localhost:8000/decisions/${resumeId}`, {
          decision,
          decided_by: userId
        }, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      
      // Update local state
      setCandidates(prev => prev.map(c => 
        c.id === resumeId ? { ...c, decision } : c
      ));
      
      alert(`Candidate ${decision}!`);
    } catch (error) {
      alert('Failed to update decision');
    }
  };

  const handleViewResume = (fileUrl) => {
    let url = fileUrl;
    if (fileUrl && typeof fileUrl === 'object') {
      url = fileUrl.publicUrl || fileUrl.public_url || fileUrl?.data?.publicUrl;
    }
    if (!url || typeof url !== 'string') {
      alert('Resume URL is not available.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    navigate('/', { replace: true });
  };

  // Settings handlers for HR
  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      alert('Please fill in all password fields');
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      alert('New passwords do not match');
      return;
    }
    if (passwordData.new.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }
    
    try {
      const token = getAccessToken();
      await axios.post('http://localhost:8000/change-password', {
        current_password: passwordData.current,
        new_password: passwordData.new
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Password changed successfully!');
      setShowPasswordModal(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      if (error.response?.status === 401) {
        alert('Current password is incorrect');
      } else if (error.response?.status === 404) {
        alert('Password change feature coming soon! Your request has been noted.');
        setShowPasswordModal(false);
        setPasswordData({ current: '', new: '', confirm: '' });
      } else {
        alert('Error changing password. Please try again later.');
      }
    }
  };

  // Export handlers
  const handleExportAllJobs = async () => {
    try {
      await withAuth(async (token) => {
        const response = await axios.get('http://localhost:8000/hr/jobs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const jobsData = response.data || [];
        if (jobsData.length === 0) {
          alert('No jobs to export');
          return;
        }

        // Convert to CSV
        const headers = ['Job ID', 'Title', 'Description', 'Requirements', 'Status', 'Deadline', 'Created At'];
        const csvContent = [
          headers.join(','),
          ...jobsData.map(job => [
            job.jd_id || '',
            `"${(job.title || '').replace(/"/g, '""')}"`,
            `"${(job.description || '').replace(/"/g, '""')}"`,
            `"${(job.requirements || '').replace(/"/g, '""')}"`,
            job.status || 'open',
            job.deadline || '',
            job.created_at || ''
          ].join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `jobs_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export jobs');
    }
  };

  const handleExportApplications = async () => {
    try {
      await withAuth(async (token) => {
        // Get all jobs first
        const jobsResponse = await axios.get('http://localhost:8000/hr/jobs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const allJobs = jobsResponse.data || [];
        if (allJobs.length === 0) {
          alert('No jobs found to export applications from');
          return;
        }

        // Get candidates for all jobs
        const allApplications = [];
        for (const job of allJobs) {
          try {
            const candidatesResponse = await axios.get(`http://localhost:8000/hr/jobs/${job.jd_id}/candidates`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const candidates = candidatesResponse.data || [];
            candidates.forEach(candidate => {
              allApplications.push({
                jobTitle: job.title,
                jobId: job.jd_id,
                candidateEmail: candidate.candidate_email || 'N/A',
                matchScore: candidate.match_score || 'N/A',
                decision: candidate.decision || 'pending',
                status: candidate.status || 'applied',
                appliedAt: candidate.applied_at || '',
                explanation: candidate.explanation || ''
              });
            });
          } catch (err) {
            console.error(`Error fetching candidates for job ${job.jd_id}:`, err);
          }
        }

        if (allApplications.length === 0) {
          alert('No applications to export');
          return;
        }

        // Convert to CSV
        const headers = ['Job Title', 'Job ID', 'Candidate Email', 'Match Score', 'Decision', 'Status', 'Applied At', 'Explanation'];
        const csvContent = [
          headers.join(','),
          ...allApplications.map(app => [
            `"${(app.jobTitle || '').replace(/"/g, '""')}"`,
            app.jobId || '',
            app.candidateEmail || '',
            app.matchScore || '',
            app.decision || '',
            app.status || '',
            app.appliedAt || '',
            `"${(app.explanation || '').replace(/"/g, '""')}"`,
          ].join(','))
        ].join('\n');

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `applications_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export applications');
    }
  };

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button
            className="dashboard-hamburger"
            onClick={() => { setShowSideDrawer(true); fetchHrJobsHistory(); }}
            aria-label="Open Menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <div>
            <h1 className="dashboard-title">HR Dashboard</h1>
            <div className="dashboard-welcome">
              {(() => {
                const email = localStorage.getItem('email');
                const base = email || 'HR User';
                const name = base.includes('@') ? base.split('@')[0] : base;
                return `Welcome, ${name.charAt(0).toUpperCase() + name.slice(1)}`;
              })()}
            </div>
          </div>
        </div>
        <div className="dashboard-profile-container">
          <div 
            className="dashboard-profile-icon" 
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="19" fill="white" stroke="#667eea" strokeWidth="2"/>
              <path d="M20 20C22.7614 20 25 17.7614 25 15C25 12.2386 22.7614 10 20 10C17.2386 10 15 12.2386 15 15C15 17.7614 17.2386 20 20 20Z" fill="#667eea"/>
              <path d="M12 30C12 25.5817 15.5817 22 20 22C24.4183 22 28 25.5817 28 30" stroke="#667eea" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          {showProfileDropdown && (
            <div className="dashboard-profile-dropdown">
              <div className="dashboard-profile-info">
                <div className="dashboard-profile-email">
                  {(() => {
                    const email = localStorage.getItem('email');
                    const userId = localStorage.getItem('user_id') || 'HR User';
                    const base = email || userId;
                    const name = base.includes('@') ? base.split('@')[0] : base;
                    return name.charAt(0).toUpperCase() + name.slice(1);
                  })()}
                </div>
                <div className="dashboard-profile-role">Role: HR</div>
              </div>
              <div className="dashboard-profile-divider"></div>
              <button 
                className="dashboard-profile-menu-item" 
                onClick={() => { setShowProfileDropdown(false); setActivePage('profile'); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                My Profile
              </button>
              <div className="dashboard-profile-divider"></div>
              <button className="dashboard-profile-logout" onClick={handleLogout}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M3 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3zm7.5 10.5v2H3v-12h7.5v2h1v-2.5a.5.5 0 0 0-.5-.5H3a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5v-2.5h-1z"/>
                  <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H6.5a.5.5 0 0 0 0 1h7.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="dashboard-container">

      {/* Side drawer: HR job history and candidates */}
      {showSideDrawer && (
        <div className="dashboard-drawer-overlay" onClick={() => setShowSideDrawer(false)}>
          <div className="dashboard-side-drawer left" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Menu</div>
              <button className="drawer-close" onClick={() => setShowSideDrawer(false)} aria-label="Close Menu">×</button>
            </div>
            <div className="drawer-nav">
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('new-job'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="16"/>
                  <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                New Job Posting
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('job-postings'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Job Postings
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('history'); setSelectedHistoryJob(null); fetchHrJobsHistory(); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Job Postings History
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('analytics'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                Analytics & Reports
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('settings'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m-8-8h6m6 0h6m-14.485-5.515l4.243 4.243m6.364 0l4.242-4.243M6.343 17.657l4.243-4.243m6.364 0l4.242 4.243"/>
                </svg>
                Settings
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('help'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Help & Support
              </span>
              <span className="drawer-nav-link coming-soon" onClick={() => { setShowSideDrawer(false); setActivePage('interviews'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Interview Scheduler
                <span className="coming-soon-badge">Coming Soon</span>
              </span>
              <span className="drawer-nav-link coming-soon" onClick={() => { setShowSideDrawer(false); setActivePage('team'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Team Management
                <span className="coming-soon-badge">Coming Soon</span>
              </span>
            </div>
            {/* Only show job history details if a job is selected */}

            {selectedHistoryJob && (
              <div className="drawer-section">
                <div className="drawer-section-title">Candidates for: {selectedHistoryJob.title}</div>
                <div className="drawer-candidates-list">
                  {historyJobCandidates.length === 0 ? (
                    <div className="drawer-empty">No candidates applied yet.</div>
                  ) : (
                    <table className="drawer-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Score</th>
                          <th>Status</th>
                          <th>Decision</th>
                          <th>Applied</th>
                          <th>Resume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyJobCandidates.map((c) => {
                          const base = c.candidate_email || c.user_id || 'Candidate';
                          const name = base.includes('@') ? base.split('@')[0] : base;
                          const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
                          const score = c.match_score != null ? `${(c.match_score * 100).toFixed(1)}%` : '—';
                          const appliedAt = c.applied_at ? new Date(c.applied_at).toLocaleString() : '—';
                          return (
                            <tr key={c.application_id || c.resume_id}>
                              <td>{prettyName}</td>
                              <td>{score}</td>
                              <td>{c.status || 'applied'}</td>
                              <td>{c.decision || 'pending'}</td>
                              <td>{appliedAt}</td>
                              <td>
                                {c.file_url ? (
                                  <button className="dashboard-btn-secondary" style={{ padding: '0.3rem 0.8rem' }} onClick={() => handleViewResume(c.file_url)}>Open</button>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job Posting Form */}
      {activePage === 'new-job' && (
        <div className="dashboard-card" id="new-job-section">
          <h2 className="dashboard-card-title">Post New Job</h2>
          <form className="dashboard-form" onSubmit={handleJobSubmit}>
          <div className="dashboard-form-field">
            <label className="dashboard-field-label">Job Title</label>
            <input 
              className="dashboard-input"
              name="title"
              placeholder="Job Title *" 
              value={newJob.title} 
              onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} 
              required
            />
          </div>
          <div className="dashboard-form-field">
            <label className="dashboard-field-label">Job Description</label>
            <textarea 
              className="dashboard-textarea"
              name="description"
              placeholder="Job Description *" 
              value={newJob.description} 
              onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} 
              rows={3}
              required
            />
          </div>
          <div className="dashboard-form-field">
            <label className="dashboard-field-label">Requirements</label>
            <textarea 
              className="dashboard-textarea"
              name="requirements"
              placeholder="Describe the job requirements *" 
              value={newJob.requirements} 
              onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} 
              rows={4}
              required
            />
          </div>
          <div className="dashboard-form-field">
            <label className="dashboard-field-label">Application Deadline</label>
            <input 
              className="dashboard-input"
              name="deadline"
              type="date" 
              placeholder="mm/dd/yyyy"
              value={newJob.deadline} 
              onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })} 
              required
            />
          </div>
          
          <div style={{ marginTop: '1rem', marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: '600', color: '#667eea' }}>
            Ranking Weights (Total: {(newJob.weights.skills + newJob.weights.experience + newJob.weights.education).toFixed(1)})
          </div>
          <div className="dashboard-weights-grid">
            <div className="dashboard-weight-input-wrapper">
              <label className="dashboard-weight-label">Skills Weight</label>
              <input 
                className="dashboard-input"
                type="number"
                min="0" max="1" step="0.1"
                value={newJob.weights.skills.toFixed(1)} 
                onChange={(e) => handleWeightChange('skills', e.target.value)}
              />
            </div>
            <div className="dashboard-weight-input-wrapper">
              <label className="dashboard-weight-label">Experience Weight</label>
              <input 
                className="dashboard-input"
                type="number"
                min="0" max="1" step="0.1"
                value={newJob.weights.experience.toFixed(1)} 
                onChange={(e) => handleWeightChange('experience', e.target.value)}
              />
            </div>
            <div className="dashboard-weight-input-wrapper">
              <label className="dashboard-weight-label">Education Weight</label>
              <input 
                className="dashboard-input"
                type="number"
                min="0" max="1" step="0.1"
                value={newJob.weights.education.toFixed(1)} 
                onChange={(e) => handleWeightChange('education', e.target.value)}
              />
            </div>
          </div>
          
          <button type="submit" className="dashboard-btn-primary">
            Post Job
          </button>
        </form>
      </div>

  )}

      {activePage === 'job-postings' && (
        <div className="dashboard-card" id="job-postings-section">
          <h2 className="dashboard-card-title">Job Postings</h2>
          <div className="dashboard-table-container">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Requirements</th>
                  <th>Deadline</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jd_id}>
                    <td>{job.title}</td>
                    <td>{Array.isArray(job.requirements) ? job.requirements.join(', ') : job.requirements}</td>
                    <td>{formatDateForDisplay(job.deadline)}</td>
                    <td>
                      <span className={`dashboard-status-badge ${job.status === 'closed' ? 'dashboard-status-closed' : 'dashboard-status-open'}`}>
                        {job.status || 'open'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="dashboard-btn-secondary"
                        onClick={() => handleRankResumes(job.jd_id)}
                        disabled={job.status === 'closed' || rankingJob === job.jd_id}
                      >
                        {rankingJob === job.jd_id ? 'Ranking...' : job.status === 'closed' ? 'Ranked' : 'Close & Rank'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activePage === 'history' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Job Postings History</h2>
          <div className="drawer-job-list">
            {hrJobsHistory.length === 0 && (
              <div className="drawer-empty">No jobs yet.</div>
            )}
            {hrJobsHistory.map((job) => {
              const candidates = job.candidates || [];
              const total = candidates.length;
              const selected = candidates.filter(c => c.decision === 'selected').length;
              const rejected = candidates.filter(c => c.decision === 'rejected').length;
              return (
                <div
                  key={job.jd_id}
                  className={`drawer-job-item ${selectedHistoryJob?.jd_id === job.jd_id ? 'active' : ''}`}
                  onClick={() => openJobInHistory(job)}
                >
                  <div className="drawer-job-title">{job.title}</div>
                  <div className="drawer-job-meta">
                    <span className={`drawer-badge ${job.status === 'closed' ? 'closed' : 'open'}`}>{job.status || 'open'}</span>
                    <span className="drawer-deadline">Due: {formatDateForDisplay(job.deadline)}</span>
                  </div>
                  <div className="drawer-job-stats">
                    <span>Total: {total}</span>
                    <span style={{marginLeft:8}}>Selected: {selected}</span>
                    <span style={{marginLeft:8}}>Rejected: {rejected}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedHistoryJob && (
            <div className="drawer-section">
              <div className="drawer-section-title">Candidates for: {selectedHistoryJob.title}</div>
              <div className="drawer-candidates-list">
                {historyJobCandidates.length === 0 ? (
                  <div className="drawer-empty">No candidates applied yet.</div>
                ) : (
                  <table className="drawer-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Decision</th>
                        <th>Applied</th>
                        <th>Resume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyJobCandidates.map((c) => {
                        const base = c.candidate_email || c.user_id || 'Candidate';
                        const name = base.includes('@') ? base.split('@')[0] : base;
                        const prettyName = name.charAt(0).toUpperCase() + name.slice(1);
                        const score = c.match_score != null ? `${(c.match_score * 100).toFixed(1)}%` : '—';
                        const appliedAt = c.applied_at ? new Date(c.applied_at).toLocaleString() : '—';
                        return (
                          <tr key={c.application_id || c.resume_id}>
                            <td>{prettyName}</td>
                            <td>{score}</td>
                            <td>{c.status || 'applied'}</td>
                            <td>{c.decision || 'pending'}</td>
                            <td>{appliedAt}</td>
                            <td>
                              {c.file_url ? (
                                <button className="dashboard-btn-secondary" style={{ padding: '0.3rem 0.8rem' }} onClick={() => handleViewResume(c.file_url)}>Open</button>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Candidates DataGrid Dialog */}
      {openCandidatesDialog && (
        <div className="dashboard-card">
          <div className="candidates-header-section">
            <div className="candidates-header-top">
              <div>
                <h2 className="candidates-title">Candidates</h2>
                <p className="candidates-subtitle">Manage and evaluate candidates for open positions.</p>
              </div>
              <button className="dashboard-btn-secondary" onClick={() => setOpenCandidatesDialog(false)}>
                Close
              </button>
            </div>

            {/* Search and Filter */}
            <div className="candidates-search-wrapper">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input 
                type="text"
                className="candidates-search-input"
                placeholder="Search candidates"
                value={candidatesSearchTerm}
                onChange={(e) => setCandidatesSearchTerm(e.target.value)}
              />
            </div>

            <div className="candidates-filter-tabs">
              <button 
                className={`filter-tab ${candidatesFilterTab === 'all' ? 'active' : ''}`}
                onClick={() => setCandidatesFilterTab('all')}
              >
                All Candidates
              </button>
              <button 
                className={`filter-tab ${candidatesFilterTab === 'experience' ? 'active' : ''}`}
                onClick={() => setCandidatesFilterTab('experience')}
              >
                By Experience
              </button>
              <button 
                className={`filter-tab ${candidatesFilterTab === 'match-score' ? 'active' : ''}`}
                onClick={() => setCandidatesFilterTab('match-score')}
              >
                By Match Score
              </button>
            </div>

            <h3 className="ranked-candidates-heading">Ranked Candidates</h3>
          </div>

          {/* Candidate Cards */}
          <div className="candidates-cards-container">
            {candidates
              .filter((c) => {
                // Filter by search term
                const name = formatCandidateName(c.candidate).toLowerCase();
                const search = candidatesSearchTerm.toLowerCase();
                const matchesSearch = !search || name.includes(search);
                
                // Filter by decision status
                const matchesDecision = decisionFilter === 'all' || c.decision === decisionFilter;
                
                return matchesSearch && matchesDecision;
              })
              .sort((a, b) => {
                // Sort based on selected filter tab
                if (candidatesFilterTab === 'match-score') {
                  return (b.score || 0) - (a.score || 0); // Highest score first
                } else if (candidatesFilterTab === 'experience') {
                  // Sort by experience (you can customize this based on your data structure)
                  const expA = a.candidate?.experience?.length || 0;
                  const expB = b.candidate?.experience?.length || 0;
                  return expB - expA;
                } else {
                  // Default: sort by match score
                  return (b.score || 0) - (a.score || 0);
                }
              })
              .map((candidate) => (
              <div key={candidate.id} className="candidate-card">
                <div className="candidate-card-content">
                  <h4 className="candidate-name">{formatCandidateName(candidate.candidate)}</h4>
                  <div className="candidate-scores">
                    <span className="candidate-score-item">Match Score: {candidate.score}%</span>
                    <span className="candidate-score-divider">|</span>
                    <span className="candidate-score-item">Explainable AI Score: {candidate.score}</span>
                  </div>
                </div>
                
                {/* Action buttons */}
                <div className="candidate-actions">
                  <button 
                    className="view-profile-btn"
                    onClick={() => handleViewResume(candidate.file_url)}
                  >
                    View Resume
                  </button>
                  <select
                    className={`candidate-decision-select-compact decision-${candidate.decision || 'pending'}`}
                    value={candidate.decision || 'pending'}
                    onChange={(e) => handleDecision(candidate.resume_id, e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="selected">Selected</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Simple Statistics */}
          {candidates.length > 0 && (
            <div className="dashboard-stats-grid">
              <div 
                className={`dashboard-stat-card ${decisionFilter === 'all' ? 'stat-card-active' : ''}`}
                onClick={() => setDecisionFilter('all')}
                style={{ cursor: 'pointer' }}
              >
                <div className="dashboard-stat-value">{candidates.length}</div>
                <div className="dashboard-stat-label">Total Candidates</div>
              </div>
              <div 
                className={`dashboard-stat-card ${decisionFilter === 'selected' ? 'stat-card-active' : ''}`}
                onClick={() => setDecisionFilter('selected')}
                style={{ cursor: 'pointer' }}
              >
                <div className="dashboard-stat-value">{candidates.filter(c => c.decision === 'selected').length}</div>
                <div className="dashboard-stat-label">Selected</div>
              </div>
              <div 
                className={`dashboard-stat-card ${decisionFilter === 'rejected' ? 'stat-card-active' : ''}`}
                onClick={() => setDecisionFilter('rejected')}
                style={{ cursor: 'pointer' }}
              >
                <div className="dashboard-stat-value">{candidates.filter(c => c.decision === 'rejected').length}</div>
                <div className="dashboard-stat-label">Rejected</div>
              </div>
              <div 
                className={`dashboard-stat-card ${decisionFilter === 'pending' ? 'stat-card-active' : ''}`}
                onClick={() => setDecisionFilter('pending')}
                style={{ cursor: 'pointer' }}
              >
                <div className="dashboard-stat-value">{candidates.filter(c => c.decision === 'pending').length}</div>
                <div className="dashboard-stat-label">Pending</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* My Profile Page for HR */}
      {activePage === 'profile' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">My Profile</h2>
          
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-avatar">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="40" cy="40" r="38" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="4"/>
                <path d="M40 40C47.732 40 54 33.732 54 26C54 18.268 47.732 12 40 12C32.268 12 26 18.268 26 26C26 33.732 32.268 40 40 40Z" fill="#0ea5e9"/>
                <path d="M20 68C20 55.849 29.849 46 42 46C54.151 46 64 55.849 64 68" stroke="#0ea5e9" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="profile-info">
              <h3 className="profile-name">
                {(() => {
                  const email = localStorage.getItem('email');
                  const userId = localStorage.getItem('user_id') || 'HR Manager';
                  const base = email || userId;
                  const name = base.includes('@') ? base.split('@')[0] : base;
                  return name.charAt(0).toUpperCase() + name.slice(1);
                })()}
              </h3>
              <p className="profile-email">{localStorage.getItem('email') || 'No email set'}</p>
              <p className="profile-role">Role: HR Manager</p>
            </div>
          </div>

          {/* Job Posting Statistics */}
          <div className="profile-section">
            <h3 className="profile-section-title">Job Posting Statistics</h3>
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <div className="profile-stat-value">{jobs.length}</div>
                <div className="profile-stat-label">Total Job Postings</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">{jobs.filter(j => new Date(j.deadline) >= new Date()).length}</div>
                <div className="profile-stat-label">Active Jobs</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">{hrJobsHistory.length}</div>
                <div className="profile-stat-label">Total Applications</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {hrJobsHistory.reduce((sum, job) => sum + (job.candidates?.filter(c => c.decision === 'selected').length || 0), 0)}
                </div>
                <div className="profile-stat-label">Selected Candidates</div>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="profile-section">
            <h3 className="profile-section-title">Account Security</h3>
            <button className="settings-action-btn" onClick={handleChangePassword}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Change Password
            </button>
            <p className="settings-help-text">Update your password to keep your account secure</p>
          </div>

          {/* Account Info */}
          <div className="profile-section">
            <h3 className="profile-section-title">Account Information</h3>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">User ID</span>
                <span className="profile-info-value">{localStorage.getItem('user_id') || '—'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{localStorage.getItem('email') || '—'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Member Since</span>
                <span className="profile-info-value">2025</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics & Reports Page */}
      {activePage === 'analytics' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Analytics & Reports</h2>
          
          {/* Overview Statistics */}
          <div className="profile-section">
            <h3 className="profile-section-title">Hiring Overview</h3>
            <div className="profile-stats-grid">
              <div className="profile-stat-card">
                <div className="profile-stat-value">{jobs.length}</div>
                <div className="profile-stat-label">Total Job Postings</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">{hrJobsHistory.length}</div>
                <div className="profile-stat-label">Total Applications</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {hrJobsHistory.reduce((sum, job) => sum + (job.candidates?.filter(c => c.decision === 'selected').length || 0), 0)}
                </div>
                <div className="profile-stat-label">Candidates Selected</div>
              </div>
              <div className="profile-stat-card">
                <div className="profile-stat-value">
                  {hrJobsHistory.length > 0 
                    ? Math.round((hrJobsHistory.reduce((sum, job) => sum + (job.candidates?.filter(c => c.decision === 'selected').length || 0), 0) / hrJobsHistory.length) * 100)
                    : 0}%
                </div>
                <div className="profile-stat-label">Selection Rate</div>
              </div>
            </div>
          </div>

          {/* Job Performance */}
          <div className="profile-section">
            <h3 className="profile-section-title">Recent Job Performance</h3>
            {jobs.length === 0 ? (
              <p style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>No job postings yet. Create your first job to see analytics.</p>
            ) : (
              <div className="dashboard-table-container">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Applications</th>
                      <th>Selected</th>
                      <th>Rejected</th>
                      <th>Pending</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.slice(0, 5).map((job) => {
                      const jobHistory = hrJobsHistory.find(h => h.jd_id === job.jd_id);
                      const totalApps = jobHistory?.candidates?.length || 0;
                      const selected = jobHistory?.candidates?.filter(c => c.decision === 'selected').length || 0;
                      const rejected = jobHistory?.candidates?.filter(c => c.decision === 'rejected').length || 0;
                      const pending = jobHistory?.candidates?.filter(c => c.decision === 'pending').length || 0;
                      const isActive = new Date(job.deadline) >= new Date();
                      
                      return (
                        <tr key={job.jd_id}>
                          <td>{job.title}</td>
                          <td>{totalApps}</td>
                          <td><span className="status-badge status-selected">{selected}</span></td>
                          <td><span className="status-badge status-rejected">{rejected}</span></td>
                          <td><span className="status-badge status-pending">{pending}</span></td>
                          <td>
                            <span className={`status-badge ${isActive ? 'status-submitted' : 'status-pending'}`}>
                              {isActive ? 'Active' : 'Closed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Export Section */}
          <div className="profile-section">
            <h3 className="profile-section-title">Export Data</h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Download comprehensive reports of your hiring data for analysis or record-keeping.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="settings-action-btn" onClick={handleExportAllJobs}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export All Jobs
              </button>
              <button className="settings-action-btn secondary" onClick={handleExportApplications}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Applications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Page */}
      {activePage === 'settings' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Settings</h2>
          
          {/* Notification Preferences */}
          <div className="settings-section">
            <h3 className="settings-section-title">Notification Preferences</h3>
            <div className="settings-options">
              <div className="settings-option">
                <div className="settings-option-info">
                  <h4 className="settings-option-label">Email Notifications</h4>
                  <p className="settings-option-description">Receive email updates about new applications</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="settings-option">
                <div className="settings-option-info">
                  <h4 className="settings-option-label">Application Alerts</h4>
                  <p className="settings-option-description">Get notified when candidates apply to your jobs</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="settings-option">
                <div className="settings-option-info">
                  <h4 className="settings-option-label">Weekly Reports</h4>
                  <p className="settings-option-description">Receive weekly hiring analytics and summaries</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" defaultChecked />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="settings-section">
            <h3 className="settings-section-title">Account Security</h3>
            <div className="settings-options">
              <button className="settings-action-btn" onClick={handleChangePassword}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Change Password
              </button>
              <p className="settings-help-text">Update your password to keep your account secure</p>
            </div>
          </div>

        </div>
      )}

      {/* Help & Support Page */}
      {activePage === 'help' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Help & Support</h2>
          
          {/* Quick Help */}
          <div className="help-section">
            <h3 className="help-section-title">Quick Help</h3>
            <div className="help-cards-grid">
              <div className="help-card">
                <div className="help-card-icon">✏️</div>
                <h4 className="help-card-title">Posting Jobs</h4>
                <p className="help-card-description">Learn how to create effective job postings</p>
              </div>
              <div className="help-card">
                <div className="help-card-icon">🤖</div>
                <h4 className="help-card-title">AI Screening</h4>
                <p className="help-card-description">Understanding resume ranking and scoring</p>
              </div>
              <div className="help-card">
                <div className="help-card-icon">👥</div>
                <h4 className="help-card-title">Managing Candidates</h4>
                <p className="help-card-description">Review, select, or reject applicants</p>
              </div>
              <div className="help-card">
                <div className="help-card-icon">�</div>
                <h4 className="help-card-title">Analytics</h4>
                <p className="help-card-description">Track hiring metrics and performance</p>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="help-section">
            <h3 className="help-section-title">Frequently Asked Questions</h3>
            <div className="faq-list">
              <details className="faq-item">
                <summary className="faq-question">How does the AI ranking work?</summary>
                <p className="faq-answer">
                  Our AI analyzes resumes against your job requirements using natural language processing. 
                  It considers skills, experience, education, and other factors you specify in the job posting. 
                  Candidates are ranked based on how well they match your criteria, with weighted scoring for different aspects.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">Can I customize the screening criteria?</summary>
                <p className="faq-answer">
                  Yes! When creating a job posting, you can adjust the weights for skills, experience, and education. 
                  You can also provide detailed requirements that the AI will use to evaluate candidates more precisely.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">How do candidates receive feedback?</summary>
                <p className="faq-answer">
                  When you make a decision (selected/rejected), candidates are automatically notified through the platform. 
                  Rejected candidates receive constructive feedback based on the AI analysis to help them improve for future applications.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">Can I export my hiring data?</summary>
                <p className="faq-answer">
                  Yes! Visit the Analytics & Reports page to export your job postings and application data. 
                  This is useful for maintaining records and conducting deeper analysis.
                </p>
              </details>
              <details className="faq-item">
                <summary className="faq-question">How do I edit or close a job posting?</summary>
                <p className="faq-answer">
                  Job postings automatically close after their deadline. Currently, editing live postings is not supported, 
                  but you can create a new posting with updated information. This feature is coming in a future update!
                </p>
              </details>
            </div>
          </div>

          {/* Contact Support */}
          <div className="help-section">
            <h3 className="help-section-title">Contact Support</h3>
            <div className="contact-support-card">
              <div className="contact-support-content">
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1f2937' }}>Need More Help?</h4>
                <p style={{ margin: '0 0 1rem 0', color: '#6b7280' }}>
                  Our support team is here to help you with any questions or issues.
                </p>
                <div className="contact-methods">
                  <div className="contact-method">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    <span>hr-support@resumescreening.com</span>
                  </div>
                  <div className="contact-method">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                    <span>+1 (555) 123-4567</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interview Scheduler - Coming Soon */}
      {activePage === 'interviews' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Interview Scheduler</h2>
          <div className="coming-soon-container">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <h3 className="coming-soon-title">Coming Soon!</h3>
            <p className="coming-soon-text">
              Schedule and manage interviews directly from the platform. Integrate with your calendar, 
              send automated reminders to candidates, and track interview outcomes all in one place.
            </p>
            <div className="coming-soon-features">
              <div className="coming-soon-feature">✓ Calendar integration</div>
              <div className="coming-soon-feature">✓ Automated email reminders</div>
              <div className="coming-soon-feature">✓ Interview notes & scoring</div>
              <div className="coming-soon-feature">✓ Video conferencing links</div>
            </div>
          </div>
        </div>
      )}

      {/* Team Management - Coming Soon */}
      {activePage === 'team' && (
        <div className="dashboard-card">
          <h2 className="dashboard-card-title">Team Management</h2>
          <div className="coming-soon-container">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <h3 className="coming-soon-title">Coming Soon!</h3>
            <p className="coming-soon-text">
              Collaborate with your HR team seamlessly. Add team members, assign roles and permissions, 
              and work together on hiring decisions with shared access to candidates and analytics.
            </p>
            <div className="coming-soon-features">
              <div className="coming-soon-feature">✓ Multi-user accounts</div>
              <div className="coming-soon-feature">✓ Role-based permissions</div>
              <div className="coming-soon-feature">✓ Collaborative hiring</div>
              <div className="coming-soon-feature">✓ Activity tracking</div>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Password</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.current}
                  onChange={(e) => setPasswordData({...passwordData, current: e.target.value})}
                  placeholder="Enter current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.new}
                  onChange={(e) => setPasswordData({...passwordData, new: e.target.value})}
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordData.confirm}
                  onChange={(e) => setPasswordData({...passwordData, confirm: e.target.value})}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowPasswordModal(false)}>
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handlePasswordSubmit}>
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default HrDashboard;