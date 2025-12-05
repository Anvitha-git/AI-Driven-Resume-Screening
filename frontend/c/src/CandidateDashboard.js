/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

function CandidateDashboard() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [jobs, setJobs] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [uploadingJob, setUploadingJob] = useState(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [activePage, setActivePage] = useState('jobs');
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getAccessToken = () => localStorage.getItem('access_token') || localStorage.getItem('token');
  
  const tryRefreshToken = useCallback(async () => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) return false;
    try {
      const resp = await axios.post(`${API_BASE}/refresh`, { refresh_token });
      const { access_token, refresh_token: new_rt } = resp.data || {};
      if (access_token) {
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('token', access_token);
      }
      if (new_rt) {
        localStorage.setItem('refresh_token', new_rt);
      }
      return !!access_token;
    } catch {
      return false;
    }
  }, []);

  const withAuth = useCallback(async (requestFn) => {
    let token = getAccessToken();
    try {
      return await requestFn(token);
    } catch (err) {
      if (err?.response?.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          token = getAccessToken();
          return await requestFn(token);
        }
        localStorage.clear();
        navigate('/login');
      }
      throw err;
    }
  }, [navigate, tryRefreshToken]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showNotifDropdown && !e.target.closest('.dashboard-bell-container')) {
        setShowNotifDropdown(false);
      }
      if (showProfileDropdown && !e.target.closest('.dashboard-profile-container')) {
        setShowProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifDropdown, showProfileDropdown]);

  useEffect(() => {
    if (showNotifDropdown) setUnreadNotifCount(0);
  }, [showNotifDropdown]);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const token = getAccessToken();
    if (!userId || !token) {
      navigate('/login');
      return;
    }

    withAuth(async (token) => {
      try {
        const res = await axios.get(`${API_BASE}/jobs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setJobs(res.data || []);
      } catch (err) {
        setAlertMessage('Failed to load jobs: ' + (err.response?.data?.detail || err.message));
        setAlertType('error');
        setShowAlertModal(true);
      }
    });

    withAuth(async (token) => {
      try {
        const res = await axios.get(`${API_BASE}/applications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplications(res.data || []);
      } catch (err) {
        console.error('Failed to load applications:', err);
      }
    });

    withAuth(async (token) => {
      try {
        const res = await axios.get(`${API_BASE}/notifications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(res.data || []);
        setUnreadNotifCount(res.data?.length || 0);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    });

  }, [navigate, withAuth]);

  const handleFileChange = (jd_id) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      setAlertMessage('Invalid file type. Use PDF, DOC, DOCX, PNG, or JPG.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setAlertMessage('File exceeds 10MB limit.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }
    setSelectedFiles(prev => ({ ...prev, [jd_id]: file }));
  };

  const hasAlreadyApplied = (jd_id) => applications.some(app => app.jd_id === jd_id);

  const handleUpload = async (jd_id) => {
    if (hasAlreadyApplied(jd_id)) {
      setAlertMessage('Already applied to this job.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }

    const file = selectedFiles[jd_id];
    if (!file) {
      setAlertMessage('Please select a file.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }

    const token = getAccessToken();
    if (!token) {
      navigate('/login');
      return;
    }

    setUploadingJob(jd_id);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await withAuth(async (token) => {
        const resp = await axios.post(`${API_BASE}/upload-resume/${jd_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return resp;
      });

      setAlertMessage('Resume uploaded successfully!');
      setAlertType('success');
      setShowAlertModal(true);
      setSelectedFiles(prev => ({ ...prev, [jd_id]: null }));

      const userId = localStorage.getItem('user_id');
      withAuth(async (token) => {
        const res = await axios.get(`${API_BASE}/applications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplications(res.data || []);
      });
    } catch (error) {
      setAlertMessage('Upload failed: ' + (error.response?.data?.detail || error.message));
      setAlertType('error');
      setShowAlertModal(true);
    } finally {
      setUploadingJob(null);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  const handleRefreshJobs = () => {
    const userId = localStorage.getItem('user_id');
    withAuth(async (token) => {
      const res = await axios.get(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data || []);
    });

    if (userId) {
      withAuth(async (token) => {
        const res = await axios.get(`${API_BASE}/applications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplications(res.data || []);
      });
    }
  };

  const handleCloseSidebar = () => setShowSideDrawer(false);

  return (
    <div className="dashboard-root">
      {/* HEADER */}
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button className="dashboard-hamburger" onClick={() => setShowSideDrawer(true)} aria-label="Menu">
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <h1 className="dashboard-title">Candidate Dashboard</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="dashboard-bell-container" onClick={() => setShowNotifDropdown(!showNotifDropdown)}>
            <svg className="dashboard-bell-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {unreadNotifCount > 0 && <span className="dashboard-bell-badge">{unreadNotifCount}</span>}
          </div>
          <button onClick={handleThemeToggle} className="theme-toggle-btn" aria-label="Theme">
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="5"/></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            )}
          </button>
          <div className="dashboard-profile-container">
            <div className="dashboard-profile-icon" onClick={() => setShowProfileDropdown(!showProfileDropdown)}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="19" fill="white" stroke="#667eea" strokeWidth="2"/>
                <path d="M20 20C22.7614 20 25 17.7614 25 15C25 12.2386 22.7614 10 20 10C17.2386 10 15 12.2386 15 15C15 17.7614 17.2386 20 20 20Z" fill="#667eea"/>
              </svg>
            </div>
            {showProfileDropdown && (
              <div className="dashboard-profile-dropdown">
                <button className="dashboard-profile-logout" onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIDEBAR DRAWER */}
      {showSideDrawer && (
        <div className="sidebar-overlay" onClick={handleCloseSidebar}>
          <div className="sidebar-drawer" onClick={e => e.stopPropagation()}>
            <button className="sidebar-close" onClick={handleCloseSidebar}>&times;</button>
            <nav className="sidebar-nav">
              <button 
                className={`sidebar-item ${activePage === 'jobs' ? 'active' : ''}`}
                onClick={() => { setActivePage('jobs'); handleCloseSidebar(); }}
              >
                📋 Available Jobs
              </button>
              <button 
                className={`sidebar-item ${activePage === 'history' ? 'active' : ''}`}
                onClick={() => { setActivePage('history'); handleCloseSidebar(); }}
              >
                📄 My Applications
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="dashboard-container">
        {activePage === 'jobs' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Available Jobs</h2>
            <button className="dashboard-btn-secondary" onClick={handleRefreshJobs} style={{ marginBottom: '1rem' }}>
              Refresh
            </button>
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Description</th>
                    <th>Requirements</th>
                    <th>Upload Resume</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length > 0 ? (
                    jobs.map((job) => (
                      <tr key={job.jd_id}>
                        <td><strong>{job.title}</strong></td>
                        <td>{job.description}</td>
                        <td>{Array.isArray(job.requirements) ? job.requirements.join(', ') : job.requirements}</td>
                        <td>
                          {hasAlreadyApplied(job.jd_id) ? (
                            <div style={{ color: '#22543d', background: '#c6f6d5', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
                              ✓ Applied
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input 
                                type="file" 
                                onChange={handleFileChange(job.jd_id)} 
                                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                style={{ flex: 1 }}
                              />
                              <button 
                                onClick={() => handleUpload(job.jd_id)} 
                                disabled={!selectedFiles[job.jd_id] || uploadingJob === job.jd_id}
                                style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
                              >
                                {uploadingJob === job.jd_id ? 'Uploading...' : 'Upload'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📋</div>
                        <div>No jobs available</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePage === 'history' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">My Applications</h2>
            {applications.length > 0 ? (
              <div className="apps-table-wrapper">
                <table className="apps-table">
                  <thead>
                    <tr>
                      <th>Job Title</th>
                      <th>Requirements</th>
                      <th>Applied</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const title = app.job_descriptions?.title || 'Job';
                      const requirements = app.job_descriptions?.requirements 
                        ? (Array.isArray(app.job_descriptions.requirements) 
                          ? app.job_descriptions.requirements.join(', ') 
                          : app.job_descriptions.requirements)
                        : '-';
                      const status = app.resumes?.decision || 'Submitted';
                      return (
                        <tr key={app.resume_id || app.id}>
                          <td><strong>{title}</strong></td>
                          <td>{requirements}</td>
                          <td>{new Date(app.created_at).toLocaleDateString()}</td>
                          <td><span style={{ padding: '0.25rem 0.75rem', borderRadius: '4px', backgroundColor: status === 'selected' ? '#10b981' : status === 'rejected' ? '#ef4444' : '#f59e0b', color: 'white' }}>{status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📄</div>
                <div>No applications yet</div>
              </div>
            )}
          </div>
        )}

        {/* ALERTS */}
        {showAlertModal && (
          <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {alertType === 'success' ? '✅' : '❌'}
              </div>
              <p>{alertMessage}</p>
              <button onClick={() => setShowAlertModal(false)} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CandidateDashboard;
