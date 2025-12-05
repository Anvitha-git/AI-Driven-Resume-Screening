import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CustomChatbot from './CustomChatbot';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const API_BASE = process.env.REACT_APP_BACKEND_URL;

function CandidateDashboard() {
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [activePage, setActivePage] = useState('jobs');
  const navigate = useNavigate();

  const [supportMessage, setSupportMessage] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');

  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });

  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    statusUpdates: true,
    jobAlerts: true
  });

  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

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
        localStorage.removeItem('token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('role');
        localStorage.removeItem('email');
        navigate('/login');
      }
      throw err;
    }
  }, [navigate, tryRefreshToken]);

  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

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

  const CHATBOT_ALWAYS_VISIBLE = false;

  const [jobs, setJobs] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [uploadingJob, setUploadingJob] = useState(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNotifDropdown && !event.target.closest('.dashboard-bell-container') && !event.target.closest('.dashboard-notifications-dropdown')) {
        setShowNotifDropdown(false);
      }
      if (showProfileDropdown && !event.target.closest('.dashboard-profile-container')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifDropdown, showProfileDropdown]);

  useEffect(() => {
    if (showNotifDropdown) {
      setUnreadNotifCount(0);
    }
  }, [showNotifDropdown]);

  const loadNotificationPreferences = useCallback(async () => {
    try {
      const response = await withAuth(async (token) => {
        return await axios.get(`${API_BASE}/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });
      if (response.data) {
        setNotificationPrefs({
          emailNotifications: response.data.email_notifications ?? true,
          statusUpdates: response.data.status_updates ?? true,
          jobAlerts: response.data.job_alerts ?? true
        });
      }
    } catch (error) {
      console.log('Could not load preferences, using defaults');
    }
  }, [withAuth]);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!userId || !token) {
      navigate('/login');
      return;
    }

    const chatUserId = localStorage.getItem('chat_user_id');
    if (!chatUserId || chatUserId !== userId) {
      localStorage.setItem('chat_user_id', userId);
    }

    withAuth(async (token) => {
      const res = await axios.get(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data || []);
    }).catch((err) => {
      console.error('Error fetching jobs:', err);
      setAlertMessage('Failed to load jobs');
      setAlertType('error');
      setShowAlertModal(true);
    });

    withAuth(async (token) => {
      const res = await axios.get(`${API_BASE}/applications/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApplications(res.data || []);
    }).catch((err) => {
      console.error('Error fetching applications:', err);
    });

    withAuth(async (token) => {
      const res = await axios.get(`${API_BASE}/notifications/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data || []);
      if (res.data && res.data.length > 0) {
        setUnreadNotifCount(res.data.length);
      }
    }).catch((err) => console.error('Error fetching notifications:', err));

    loadNotificationPreferences();

    const handleBeforeUnload = () => {
      localStorage.removeItem('token');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigate, withAuth, loadNotificationPreferences]);

  const handleFileChange = (jd_id) => (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFiles((prev) => ({ ...prev, [jd_id]: null }));
      return;
    }

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ];

    if (!allowedTypes.includes(file.type)) {
      setAlertMessage('Invalid file type. Please upload PDF, DOC, DOCX, PNG, or JPG.');
      setAlertType('error');
      setShowAlertModal(true);
      e.target.value = '';
      return;
    }

    const maxSizeInMB = 10;
    if (file.size > maxSizeInMB * 1024 * 1024) {
      setAlertMessage(`File size exceeds ${maxSizeInMB}MB limit.`);
      setAlertType('error');
      setShowAlertModal(true);
      e.target.value = '';
      return;
    }

    setSelectedFiles((prev) => ({ ...prev, [jd_id]: file }));
  };

  const hasAlreadyApplied = (jd_id) => {
    return applications.some((app) => app.jd_id === jd_id);
  };

  const hasOpenApplication = () => {
    return applications.some(app => {
      const job = jobs.find(j => j.jd_id === app.jd_id);
      return job && job.status !== 'closed';
    });
  };

  const handleUpload = async (jd_id) => {
    if (hasAlreadyApplied(jd_id)) {
      setAlertMessage('You have already applied to this job.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }

    const usedToken = getAccessToken();
    console.log('[UPLOAD] Starting upload process');
    console.log('[UPLOAD] Token exists:', !!usedToken);

    if (!usedToken) {
      setAlertMessage('No token found. Please login again.');
      setAlertType('error');
      setShowAlertModal(true);
      navigate('/login');
      return;
    }

    const file = selectedFiles[jd_id];
    if (!file) {
      setAlertMessage('Please select a file first.');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }

    setUploadingJob(jd_id);
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('[UPLOAD] Sending request to backend:', `${API_BASE}/upload-resume/${jd_id}`);
      const resp = await withAuth(async (token) => (
        axios.post(
          `${API_BASE}/upload-resume/${jd_id}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              refresh_token: localStorage.getItem('refresh_token') || '',
            },
          }
        )
      ));
      console.log('[UPLOAD] Success:', resp.data);
      setAlertMessage('Resume uploaded successfully!');
      setAlertType('success');
      setShowAlertModal(true);

      const userId = localStorage.getItem('user_id');
      localStorage.setItem('current_jd_id', jd_id);
      localStorage.setItem('chat_user_id', userId);

      setSelectedFiles((prev) => ({ ...prev, [jd_id]: null }));

      if (userId) {
        withAuth(async (token) => {
          const res = await axios.get(`${API_BASE}/applications/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setApplications(res.data || []);
        }).catch((err) => console.error('Error refreshing applications:', err));
      }
    } catch (error) {
      console.error('[UPLOAD] Error:', error);
      if (!error.response) {
        setAlertMessage('Upload failed: Network error. Check backend connection.');
        setAlertType('error');
        setShowAlertModal(true);
      } else {
        setAlertMessage('Upload failed: ' + (error.response.data?.detail || error.message));
        setAlertType('error');
        setShowAlertModal(true);
      }
    } finally {
      setUploadingJob(null);
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
      await axios.put(`${API_BASE}/update-name`, 
        { name: newName.trim() },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      localStorage.setItem('name', newName.trim());
      setShowEditNameModal(false);
      setNameError('');
      setAlertMessage('Name updated successfully!');
      setAlertType('success');
      setShowAlertModal(true);
    } catch (error) {
      console.error('Error updating name:', error);
      setNameError(error.response?.data?.detail || 'Failed to update name');
    }
  };

  const updateNotificationPref = async (prefKey, value) => {
    const newPrefs = { ...notificationPrefs, [prefKey]: value };
    setNotificationPrefs(newPrefs);

    try {
      await withAuth(async (token) => {
        return await axios.put(`${API_BASE}/preferences`, {
          email_notifications: newPrefs.emailNotifications,
          status_updates: newPrefs.statusUpdates,
          job_alerts: newPrefs.jobAlerts
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      setNotificationPrefs({ ...notificationPrefs });
    }
  };

  const handleChangePassword = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = async () => {
    if (!passwordData.current || !passwordData.new || !passwordData.confirm) {
      setAlertMessage('Please fill in all password fields');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }
    if (passwordData.new !== passwordData.confirm) {
      setAlertMessage('New passwords do not match');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }
    if (passwordData.new.length < 6) {
      setAlertMessage('Password must be at least 6 characters long');
      setAlertType('error');
      setShowAlertModal(true);
      return;
    }

    try {
      const token = getAccessToken();
      await axios.post(`${API_BASE}/change-password`, {
        current_password: passwordData.current,
        new_password: passwordData.new
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setAlertMessage('Password changed successfully!');
      setAlertType('success');
      setShowAlertModal(true);
      setShowPasswordModal(false);
      setPasswordData({ current: '', new: '', confirm: '' });
    } catch (error) {
      if (error.response?.status === 401) {
        setAlertMessage('Current password is incorrect');
        setAlertType('error');
        setShowAlertModal(true);
      } else if (error.response?.status === 404) {
        setAlertMessage('Password change feature coming soon!');
        setAlertType('success');
        setShowAlertModal(true);
        setShowPasswordModal(false);
        setPasswordData({ current: '', new: '', confirm: '' });
      } else {
        setAlertMessage('Error changing password. Please try again later.');
        setAlertType('error');
        setShowAlertModal(true);
      }
    }
  };

  const handleRefreshJobs = () => {
    const userId = localStorage.getItem('user_id');

    withAuth(async (token) => {
      const res = await axios.get(`${API_BASE}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data || []);
    }).catch((err) => {
      console.error('Error refreshing jobs:', err);
    });

    if (userId) {
      withAuth(async (token) => {
        const res = await axios.get(`${API_BASE}/applications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setApplications(res.data || []);
      }).catch((err) => {
        console.error('Error refreshing applications:', err);
      });

      withAuth(async (token) => {
        const res = await axios.get(`${API_BASE}/notifications/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(res.data || []);
      }).catch((err) => console.error('Error refreshing notifications:', err));
    }
  };

  function formatDateSafe(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split(/[-T:]/);
    if (parts.length >= 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  }

  function getApplicationStatusMeta(statusRaw) {
    const s = (statusRaw || '').toString().toLowerCase().trim();
    if (s === 'selected') {
      return { label: 'Selected', className: 'status-selected' };
    }
    if (s === 'rejected') {
      return { label: 'Rejected', className: 'status-rejected' };
    }
    if (s === 'pending') {
      return { label: 'Pending', className: 'status-pending' };
    }
    if (["submitted", "applied"].includes(s)) {
      return { label: 'Submitted', className: 'status-submitted' };
    }
    return { label: statusRaw || 'Submitted', className: 'status-submitted' };
  }

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <button className="dashboard-hamburger" onClick={() => setShowSideDrawer(true)} aria-label="Open Menu">
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
          <button aria-label="Toggle theme" onClick={handleThemeToggle} className="theme-toggle-btn">
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
                <button className="dashboard-profile-logout" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-container">
        {activePage === 'jobs' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Job Postings</h2>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button className="dashboard-btn-secondary" onClick={handleRefreshJobs}>
                Refresh
              </button>
            </div>
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
                            <div style={{ color: '#22543d', background: '#c6f6d5', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                              ✓ Already Applied
                            </div>
                          ) : (
                            <div className="dashboard-file-input-container">
                              <input className="dashboard-file-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileChange(job.jd_id)} />
                              <button className="dashboard-btn-primary" onClick={() => handleUpload(job.jd_id)} disabled={!selectedFiles[job.jd_id] || uploadingJob === job.jd_id}>
                                {uploadingJob === job.jd_id ? 'Uploading...' : 'Upload'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="dashboard-empty-state">
                        <div className="dashboard-empty-state-icon">📋</div>
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
                      <th>Application Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const key = app.resume_id || app.id || `${app.jd_id}-${app.user_id}`;
                      const title = app.job_descriptions?.title || 'Job';
                      const requirements = app.job_descriptions?.requirements 
                        ? (Array.isArray(app.job_descriptions.requirements) 
                          ? app.job_descriptions.requirements.join(', ') 
                          : app.job_descriptions.requirements)
                        : '-';
                      const applied = formatDateSafe(app.created_at) || '-';
                      const rawStatus = app.resumes?.decision || app.status || 'submitted';
                      const meta = getApplicationStatusMeta(rawStatus);
                      return (
                        <tr key={key}>
                          <td><strong>{title}</strong></td>
                          <td>{requirements}</td>
                          <td>{applied}</td>
                          <td><span className={`status-pill ${meta.className}`}>{meta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-icon">📄</div>
                <div>No applications yet</div>
              </div>
            )}
          </div>
        )}

        {showAlertModal && (
          <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{maxWidth: '400px', padding: '32px', textAlign: 'center'}}>
              <div style={{width: '64px', height: '64px', borderRadius: '50%', backgroundColor: alertType === 'success' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'white', fontSize: '32px', fontWeight: 'bold'}}>
                {alertType === 'success' ? '✓' : '!'}
              </div>
              <p style={{margin: 0, fontSize: '16px', lineHeight: '1.5'}}>{alertMessage}</p>
              <button className="modal-btn primary" onClick={() => setShowAlertModal(false)} style={{marginTop: '24px', padding: '10px 32px'}}>OK</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CandidateDashboard;
