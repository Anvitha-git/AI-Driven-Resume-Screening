import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';
import './ExplanationModal.css';
import API_URL from './config';

function HrDashboard() {
      // To show the modal, call:
      // setAlertMessage('Your message here'); setShowAlertModal(true);
    // Modal state for browser-style alert

    // To show the modal, call:
    // setAlertMessage('Your message here'); setShowAlertModal(true);
  // Auth helpers: refresh expired access tokens and retry the request
  const getAccessToken = () => localStorage.getItem('access_token') || localStorage.getItem('token');
  const tryRefreshToken = useCallback(async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) return false;
    try {
      const resp = await axios.post(`${API_URL}/refresh`, { refresh_token });
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
        axios.post('/jobs', jobData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      setAlertType('success'); setAlertMessage('Job posted successfully!'); setShowAlertModal(true);
      setNewJob({ title: '', description: '', requirements: '', deadline: '', weights: { skills: 0.4, experience: 0.4, education: 0.2 } });
      fetchJobs();
    } catch (error) {
      // Surface backend error details if available
      const msg = error?.response?.data?.detail ? `Failed to post job: ${error.response.data.detail}` : 'Failed to post job';
      console.error('Post job error:', error);
      setAlertType('error'); setAlertMessage(msg); setShowAlertModal(true);
    }
  };

  // Handler for ranking resumes for a job
  const handleRankResumes = async (jdId) => {
    setRankingJob(jdId);
    try {
      const list = await withAuth(async (token) => {
        await axios.post(`${API_URL}/rank-resumes/${jdId}`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const res = await axios.get(`${API_URL}/resumes/${jdId}`, {
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
      setCurrentJobId(jdId); // Track the job ID for later submission
      setOpenCandidatesDialog(true);
      
      // Save to localStorage so dialog persists across page navigation
      localStorage.setItem('hr_candidates_dialog', JSON.stringify({
        isOpen: true,
        jobId: jdId,
        candidatesList: mapped
      }));
      
      // Note: Dialog stays open until HR submits decisions
      // Job status will be updated when HR clicks "Submit Decisions"
      
    } catch (error) {
      console.error('Rank resumes error:', error);
      const msg = error?.response?.data?.detail ? `Failed to rank resumes: ${error.response.data.detail}` : 'Failed to rank resumes';
      setAlertType('error'); setAlertMessage(msg); setShowAlertModal(true);
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
  const [currentJobId, setCurrentJobId] = useState(null); // Track which job's candidates are being viewed
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
  // Notification preferences state (HR)
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    statusUpdates: true,
    jobAlerts: true,
  });

  // Load HR notification preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const response = await withAuth(async (token) => {
          return await axios.get(`${API_URL}/preferences`, {
            headers: { Authorization: `Bearer ${token}` }
          });
        });
        setPreferences({
          emailNotifications: response.data.email_notifications ?? true,
          statusUpdates: response.data.status_updates ?? true,
          jobAlerts: response.data.job_alerts ?? true,
        });
      } catch (e) {
        console.warn('Failed to load preferences:', e);
      }
    };
    loadPrefs();
  }, [withAuth]);

  // Toggle handler
  const handlePreferenceToggle = async (key, value) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    try {
      await withAuth(async (token) => {
        return await axios.put(`${API_URL}/preferences`, {
          email_notifications: newPrefs.emailNotifications,
          status_updates: newPrefs.statusUpdates,
          job_alerts: newPrefs.jobAlerts,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });
    } catch (e) {
      console.error('Failed to update preferences:', e);
      setAlertType('error'); setAlertMessage('Failed to save preferences'); setShowAlertModal(true);
    }
  };
  
  // Load candidates dialog state from localStorage on mount
  useEffect(() => {
    const savedDialogState = localStorage.getItem('hr_candidates_dialog');
    if (savedDialogState) {
      try {
        const { isOpen, jobId, candidatesList } = JSON.parse(savedDialogState);
        if (isOpen && jobId && candidatesList && activePage === 'job-postings') {
          setOpenCandidatesDialog(true);
          setCurrentJobId(jobId);
          setCandidates(candidatesList);
        }
      } catch (e) {
        console.error('Failed to restore candidates dialog:', e);
      }
    }
  }, [activePage]);
  
  // Close candidates dialog when navigating away from job postings
  useEffect(() => {
    if (activePage !== 'job-postings' && openCandidatesDialog) {
      setOpenCandidatesDialog(false);
      localStorage.removeItem('hr_candidates_dialog');
    }
  }, [activePage, openCandidatesDialog]);
  
  // Settings state for HR
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  
  // LIME Explanation Modal
  const [showExplanationModal, setShowExplanationModal] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Alert dialog state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success'); // 'success' or 'error'

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
  const formatCandidateName = (candidateData) => {
    if (!candidateData) return 'Unknown';
    // If candidateData is a string (legacy behavior), process it
    if (typeof candidateData === 'string') {
      if (candidateData.includes('@')) {
        const name = candidateData.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
      return candidateData;
    }
    // If it's the full candidate object, return as is
    return candidateData;
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
            const response = await axios.get('/jobs', {
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
            const response = await axios.get('/hr/jobs', {
              headers: { Authorization: `Bearer ${token}` },
            });
            const jobs = response.data || [];
            const jobsWithCandidates = await Promise.all(jobs.map(async (job) => {
              try {
                const res = await axios.get(`${API_URL}/hr/jobs/${job.jd_id}/candidates`, {
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
        const response = await axios.get(`${API_URL}/jobs`, {
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
        const response = await axios.get(`${API_URL}/hr/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('HR jobs response:', response.data);
        const jobs = response.data || [];
        console.log(`Found ${jobs.length} jobs for this HR`);
        const jobsWithCandidates = await Promise.all(jobs.map(async (job) => {
          try {
            const res = await axios.get(`${API_URL}/hr/jobs/${job.jd_id}/candidates`, {
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
        const response = await axios.get(`${API_URL}/hr/jobs/${jdId}/candidates`, {
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
        setAlertType('error'); setAlertMessage('No token found. Please login again.'); setShowAlertModal(true);
        navigate('/login');
        return;
      }
      
      await withAuth(async (token) => (
        axios.post(`${API_URL}/decisions/${resumeId}`, {
          decision,
          decided_by: userId
        }, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      
      // Update local state
      setCandidates(prev => {
        const updated = prev.map(c => 
          c.id === resumeId ? { ...c, decision } : c
        );
        
        // Update localStorage when decisions change
        if (currentJobId) {
          localStorage.setItem('hr_candidates_dialog', JSON.stringify({
            isOpen: true,
            jobId: currentJobId,
            candidatesList: updated
          }));
        }
        
        return updated;
      });
      
      // Success - decision saved (no alert to avoid spam)
    } catch (error) {
      setAlertType('error'); setAlertMessage('Failed to update decision'); setShowAlertModal(true);
    }
  };

  // Handler to submit all decisions and close the candidates dialog
  const handleSubmitDecisions = async () => {
    const pendingCount = candidates.filter(c => c.decision === 'pending').length;
    
    if (pendingCount > 0) {
      const confirm = window.confirm(
        `${pendingCount} candidate(s) still have pending decisions. Do you want to submit anyway?`
      );
      if (!confirm) return;
    }
    
    // Submit decisions - this will send emails and notifications
    if (currentJobId) {
      try {
        await withAuth(async (token) => {
          // Call submit-decisions endpoint to send emails and notifications
          const submitResponse = await axios.post(
            `${API_URL}/hr/jobs/${currentJobId}/submit-decisions`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          console.log('Decisions submitted:', submitResponse.data);
          
          // Update job status to closed
          await axios.patch(
            `${API_URL}/jobs/${currentJobId}`,
            { status: 'closed' },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        });
        
        // Update local state
        setJobs(prevJobs => prevJobs.map(job => 
          job.jd_id === currentJobId ? { ...job, status: 'closed' } : job
        ));
        
        setAlertType('success'); setAlertMessage('Decisions submitted successfully! Candidates have been notified via email.'); setShowAlertModal(true);
      } catch (err) {
        console.error('Failed to submit decisions:', err);
        const errorMsg = err?.response?.data?.detail || err?.message || 'Unknown error';
        setAlertType('error'); setAlertMessage(`Failed to submit decisions: ${errorMsg}`); setShowAlertModal(true);
        return;
      }
    }
    
    setOpenCandidatesDialog(false);
    setCurrentJobId(null);
    
    // Clear localStorage when decisions are submitted
    localStorage.removeItem('hr_candidates_dialog');
  };

  const handleViewResume = async (fileUrl) => {
    try {
      let resumePath = fileUrl;
      if (fileUrl && typeof fileUrl === 'object') {
        resumePath = fileUrl.publicUrl || fileUrl.public_url || fileUrl?.data?.publicUrl;
      }
      if (!resumePath || typeof resumePath !== 'string') {
        setAlertType('error'); setAlertMessage('Resume URL is not available.'); setShowAlertModal(true);
        return;
      }

      // Remove trailing ? and any query parameters
      resumePath = resumePath.split('?')[0];

      // Use Google Docs Viewer as a workaround for PDF viewing
      const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(resumePath)}&embedded=true`;
      window.open(googleDocsUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error viewing resume:', error);
      setAlertType('error'); setAlertMessage('Failed to load resume. Please try again.'); setShowAlertModal(true);
    }
  };

  const handleExplainRanking = async (resumeId) => {
    setLoadingExplanation(true);
    setShowExplanationModal(true);
    setCurrentExplanation(null);
    
    try {
      const response = await withAuth(async (token) => {
        return await axios.get(`${API_URL}/explain-ranking/${resumeId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      });
      
      setCurrentExplanation(response.data);
    } catch (error) {
      console.error('Failed to load explanation:', error);
      setAlertType('error'); setAlertMessage('Failed to load ranking explanation. Please try again.'); setShowAlertModal(true);
      setShowExplanationModal(false);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('name');
    navigate('/', { replace: true });
  };

  // Name editing handlers
  const handleEditName = () => {
    const currentName = localStorage.getItem('name') || '';
    setNewName(currentName);
    setNameError('');
    setShowEditNameModal(true);
  };

  const handleNameSubmit = async () => {
    if (!newName.trim()) {
      setNameError('Name cannot be empty');
      return;
    }
    
    try {
      const token = getAccessToken();
      await axios.put(`${API_URL}/update-name`, 
        { name: newName.trim() },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      localStorage.setItem('name', newName.trim());
      setShowEditNameModal(false);
      setNameError('');
      setAlertType('success'); setAlertMessage('Name updated successfully!'); setShowAlertModal(true);
    } catch (error) {
      console.error('Error updating name:', error);
      setNameError(error.response?.data?.detail || 'Failed to update name');
    }
  };

  // Settings handlers for HR
  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      setAlertType('error'); setAlertMessage('Please fill in all password fields'); setShowAlertModal(true);
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      setAlertType('error'); setAlertMessage('New passwords do not match'); setShowAlertModal(true);
      return;
    }
    if (passwordData.new.length < 6) {
      setAlertType('error'); setAlertMessage('Password must be at least 6 characters long'); setShowAlertModal(true);
      return;
    }
    
    try {
      const token = getAccessToken();
      await axios.post(`${API_URL}/change-password`, {
        current_password: passwordData.current,
        new_password: passwordData.new
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAlertType('success'); setAlertMessage('Password changed successfully!'); setShowAlertModal(true);
      setShowPasswordModal(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      if (error.response?.status === 401) {
        setAlertType('error'); setAlertMessage('Current password is incorrect'); setShowAlertModal(true);
      } else if (error.response?.status === 404) {
        setAlertType('error'); setAlertMessage('Password change feature coming soon! Your request has been noted.'); setShowAlertModal(true);
        setShowPasswordModal(false);
        setPasswordData({ current: '', new: '', confirm: '' });
      } else {
        setAlertType('error'); setAlertMessage('Error changing password. Please try again later.'); setShowAlertModal(true);
      }
    }
  };

  // Export handlers
  const handleExportAllJobs = async () => {
    try {
      console.log('Starting job export...');
      await withAuth(async (token) => {
        console.log('Fetching jobs from backend...');
        const response = await axios.get(`${API_URL}/hr/jobs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const jobsData = response.data || [];
        console.log(`Received ${jobsData.length} jobs from backend`);
        
        if (jobsData.length === 0) {
          setAlertType('error'); setAlertMessage('No jobs to export. You need to post at least one job first.'); setShowAlertModal(true);
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
            `"${Array.isArray(job.requirements) ? job.requirements.join('; ') : (job.requirements || '').replace(/"/g, '""')}"`,
            job.status || 'open',
            job.deadline || '',
            job.created_at || ''
          ].join(','))
        ].join('\n');

        console.log('CSV generated, downloading file...');
        
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
        
        console.log('Export completed successfully!');
        setAlertType('success'); setAlertMessage(`Successfully exported ${jobsData.length} job(s)!`); setShowAlertModal(true);
      });
    } catch (error) {
      console.error('Export error:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Unknown error';
      setAlertType('error'); setAlertMessage(`Failed to export jobs: ${errorMsg}`); setShowAlertModal(true);
    }
  };

  const handleExportApplications = async () => {
    try {
      console.log('Starting applications export...');
      await withAuth(async (token) => {
        // Get all jobs first
        console.log('Fetching all jobs...');
        const jobsResponse = await axios.get('/hr/jobs', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const allJobs = jobsResponse.data || [];
        console.log(`Found ${allJobs.length} jobs`);
        
        if (allJobs.length === 0) {
          setAlertType('error'); setAlertMessage('No jobs found. Please post a job first before exporting applications.'); setShowAlertModal(true);
          return;
        }

        // Get candidates for all jobs
        const allApplications = [];
        for (const job of allJobs) {
          try {
            console.log(`Fetching candidates for job: ${job.title}`);
            const candidatesResponse = await axios.get(`${API_URL}/hr/jobs/${job.jd_id}/candidates`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const candidates = candidatesResponse.data || [];
            console.log(`Found ${candidates.length} candidates for job ${job.jd_id}`);
            
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

        console.log(`Total applications to export: ${allApplications.length}`);

        if (allApplications.length === 0) {
          setAlertType('error'); setAlertMessage('No applications to export. Jobs exist but no candidates have applied yet.'); setShowAlertModal(true);
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

        console.log('CSV generated, downloading file...');
        
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
        
        console.log('Export completed successfully!');
        setAlertType('success'); setAlertMessage(`Successfully exported ${allApplications.length} application(s) from ${allJobs.length} job(s)!`); setShowAlertModal(true);
      });
    } catch (error) {
      console.error('Export applications error:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Unknown error';
      setAlertType('error'); setAlertMessage(`Failed to export applications: ${errorMsg}`); setShowAlertModal(true);
    }
  };

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
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
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            aria-label="Toggle theme"
            onClick={handleThemeToggle}
            className="theme-toggle-btn"
          >
            {theme === 'light' ? (
              // Sun SVG
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            ) : (
              // Moon SVG
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            )}
          </button>
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
                      const name = localStorage.getItem('name');
                      if (name) {
                        return name.charAt(0).toUpperCase() + name.slice(1);
                      }
                      const email = localStorage.getItem('email');
                      const userId = localStorage.getItem('user_id') || 'HR User';
                      const base = email || userId;
                      const namePart = base.includes('@') ? base.split('@')[0] : base;
                      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
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
                        const name = c.candidate_name || (c.candidate_email ? c.candidate_email.split('@')[0] : 'Candidate');
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
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="dashboard-btn-primary" onClick={handleSubmitDecisions}>
                  Submit Decisions
                </button>
                <button className="dashboard-btn-secondary" onClick={() => {
                  setOpenCandidatesDialog(false);
                  localStorage.removeItem('hr_candidates_dialog');
                }}>
                  Close
                </button>
              </div>
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
                  <button 
                    className="explain-ranking-btn"
                    onClick={() => handleExplainRanking(candidate.resume_id)}
                    title="See why this candidate got this score"
                  >
                    🔍 Explain Ranking
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
              <span className="settings-action-label">Change Password</span>
            </button>
            <p className="settings-help-text">Update your password to keep your account secure</p>
          </div>

          {/* Account Info */}
          <div className="profile-section">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
              <h3 className="profile-section-title" style={{margin: 0}}>Account Information</h3>
              <button 
                onClick={handleEditName}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Name
              </button>
            </div>
            <div className="profile-info-grid">
              <div className="profile-info-item">
                <span className="profile-info-label">Name</span>
                <span className="profile-info-value">{localStorage.getItem('name') || 'Not set'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-value">{localStorage.getItem('email') || '—'}</span>
              </div>
              <div className="profile-info-item">
                <span className="profile-info-label">User ID</span>
                <span className="profile-info-value">{localStorage.getItem('user_id') || '—'}</span>
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
                  <input
                    type="checkbox"
                    checked={preferences.emailNotifications}
                    onChange={(e) => handlePreferenceToggle('emailNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="settings-option">
                <div className="settings-option-info">
                  <h4 className="settings-option-label">Application Alerts</h4>
                  <p className="settings-option-description">Get notified when candidates apply to your jobs</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.statusUpdates}
                    onChange={(e) => handlePreferenceToggle('statusUpdates', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <div className="settings-option">
                <div className="settings-option-info">
                  <h4 className="settings-option-label">Weekly Reports</h4>
                  <p className="settings-option-description">Receive weekly hiring analytics and summaries</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={preferences.jobAlerts}
                    onChange={(e) => handlePreferenceToggle('jobAlerts', e.target.checked)}
                  />
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-7V7a6 6 0 10-12 0v3a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2zm-8-3a4 4 0 118 0v3H6V7zm10 12a1 1 0 01-1 1H7a1 1 0 01-1-1v-7a1 1 0 011-1h10a1 1 0 011 1v7z" fill="#2563eb"/>
                </svg>
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
                    <span>airesumescreening@gmail.com</span>
                  </div>
                  <div className="contact-method">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a.5.5 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
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

      {/* Alert Modal */}
      {showAlertModal && (
        <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', background: 'var(--card-bg, #fff)', color: 'var(--font-color, #222)', padding: '2rem 1.5rem' }}>
            <div className="modal-body" style={{ padding: 0, textAlign: 'center' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                {alertType === 'success' ? (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)' }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.6, color: 'inherit', marginBottom: '1.5rem' }}>
                {alertMessage}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="modal-btn primary" style={{ minWidth: 100, padding: '0.65rem 1.5rem', fontSize: 15 }} onClick={() => setShowAlertModal(false)}>OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {showEditNameModal && (
        <div className="modal-overlay" onClick={() => setShowEditNameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Name</h3>
              <button className="modal-close" onClick={() => setShowEditNameModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter your full name"
                  autoFocus
                />
                {nameError && <div className="error-message" style={{color: 'red', marginTop: '8px', fontSize: '14px'}}>{nameError}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowEditNameModal(false)}>
                Cancel
              </button>
              <button className="modal-btn primary" onClick={handleNameSubmit}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIME Explanation Modal */}
      {showExplanationModal && (
        <div className="modal-overlay" onClick={() => setShowExplanationModal(false)}>
          <div className="explanation-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 Ranking Explanation</h3>
              <button className="modal-close" onClick={() => setShowExplanationModal(false)}>×</button>
            </div>
            {loadingExplanation ? (
              <div className="modal-body" style={{textAlign: 'center', padding: '3rem'}}>
                <div className="loading-spinner"></div>
                <p style={{marginTop: '1rem', color: '#64748b'}}>Analyzing resume...</p>
              </div>
            ) : currentExplanation ? (
              <div className="modal-body explanation-body">
                {/* Score Breakdown */}
                <div className="explanation-section">
                  <h4>Score Breakdown</h4>
                  <div className="score-breakdown-grid">
                    {Object.entries(currentExplanation.score_breakdown).map(([key, data]) => (
                      <div key={key} className="breakdown-card">
                        <div className="breakdown-header">
                          <span className="breakdown-title">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <span className="breakdown-score">{data.score}%</span>
                        </div>
                        <div className="breakdown-bar-container">
                          <div className="breakdown-bar" style={{width: `${data.score}%`}}></div>
                        </div>
                        <div className="breakdown-details">
                          <span className="breakdown-weight">Weight: {data.weight}%</span>
                          <span className="breakdown-contribution">Contribution: {data.contribution}%</span>
                        </div>
                        <p className="breakdown-info">{data.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Matched & Missing Skills */}
                {(currentExplanation.matched_skills.length > 0 || currentExplanation.missing_skills.length > 0) && (
                  <div className="explanation-section">
                    <h4>Skills Analysis</h4>
                    <div className="skills-grid">
                      {currentExplanation.matched_skills.length > 0 && (
                        <div className="skills-column">
                          <div className="skills-header matched">
                            <span>✅ Matched Skills ({currentExplanation.matched_skills.length})</span>
                          </div>
                          <div className="skills-list">
                            {currentExplanation.matched_skills.map((skill, idx) => (
                              <span key={idx} className="skill-tag matched">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {currentExplanation.missing_skills.length > 0 && (
                        <div className="skills-column">
                          <div className="skills-header missing">
                            <span>❌ Missing Skills ({currentExplanation.missing_skills.length})</span>
                          </div>
                          <div className="skills-list">
                            {currentExplanation.missing_skills.slice(0, 10).map((skill, idx) => (
                              <span key={idx} className="skill-tag missing">{skill}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* LIME Word Importance */}
                {currentExplanation.top_positive_words && currentExplanation.top_positive_words.length > 0 && (
                  <div className="explanation-section">
                    <h4>Word-Level Impact Analysis</h4>
                    <p className="section-description">These words/phrases had the most influence on the ranking score:</p>
                    
                    <div className="lime-words-grid">
                      <div className="lime-column">
                        <div className="lime-header positive">
                          <span>📈 Positive Impact</span>
                        </div>
                        <div className="lime-words-list">
                          {currentExplanation.top_positive_words.slice(0, 8).map(([word, weight], idx) => (
                            <div key={idx} className="lime-word-item">
                              <span className="lime-word">{word}</span>
                              <div className="lime-bar-container">
                                <div className="lime-bar positive" style={{width: `${Math.min(100, weight * 500)}%`}}></div>
                              </div>
                              <span className="lime-weight">+{weight.toFixed(3)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {currentExplanation.top_negative_words && currentExplanation.top_negative_words.length > 0 && (
                        <div className="lime-column">
                          <div className="lime-header negative">
                            <span>📉 Negative Impact</span>
                          </div>
                          <div className="lime-words-list">
                            {currentExplanation.top_negative_words.slice(0, 8).map(([word, weight], idx) => (
                              <div key={idx} className="lime-word-item">
                                <span className="lime-word">{word}</span>
                                <div className="lime-bar-container">
                                  <div className="lime-bar negative" style={{width: `${Math.min(100, Math.abs(weight) * 500)}%`}}></div>
                                </div>
                                <span className="lime-weight">{weight.toFixed(3)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Interpretation */}
                <div className="explanation-section">
                  <h4>Recommendations</h4>
                  {currentExplanation.interpretation.strengths.length > 0 && (
                    <div className="interpretation-block">
                      <h5 className="interpretation-title positive">💪 Strengths</h5>
                      <ul className="interpretation-list">
                        {currentExplanation.interpretation.strengths.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentExplanation.interpretation.weaknesses.length > 0 && (
                    <div className="interpretation-block">
                      <h5 className="interpretation-title warning">⚠️ Weaknesses</h5>
                      <ul className="interpretation-list">
                        {currentExplanation.interpretation.weaknesses.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentExplanation.interpretation.recommendations.length > 0 && (
                    <div className="interpretation-block">
                      <h5 className="interpretation-title info">💡 Decision Guidance</h5>
                      <ul className="interpretation-list">
                        {currentExplanation.interpretation.recommendations.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="modal-body" style={{textAlign: 'center', padding: '3rem'}}>
                <p>No explanation data available</p>
              </div>
            )}
          </div>
        </div>
      )}


      </div>
    </div>
  );
}

export default HrDashboard;


