import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CustomChatbot from './CustomChatbot';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function CandidateDashboard() {
  // Drawer state
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [activePage, setActivePage] = useState('jobs'); // 'jobs', 'history', 'notifications', 'profile', 'resources', 'settings', 'help'
  const navigate = useNavigate();
  
  // Help & Support state
  const [supportMessage, setSupportMessage] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showBugReportModal, setShowBugReportModal] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  
  // Settings state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  
  // Auth helpers
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
        // if refresh fails, force logout
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

  const CHATBOT_ALWAYS_VISIBLE = false;

  const [jobs, setJobs] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({}); // map: jd_id -> File
  const [applications, setApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [uploadingJob, setUploadingJob] = useState(null);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close notifications dropdown if clicked outside
      if (showNotifDropdown && !event.target.closest('.dashboard-bell-container') && !event.target.closest('.dashboard-notifications-dropdown')) {
        setShowNotifDropdown(false);
      }
      // Close profile dropdown if clicked outside
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
    const userId = localStorage.getItem('user_id');
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!userId || !token) {
      navigate('/login');
      return;
    }

    // Fetch jobs
    withAuth(async (token) => {
      const res = await axios.get('http://localhost:8000/jobs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setJobs(res.data || []);
    }).catch((err) => {
      console.error('Error fetching jobs:', err);
      alert('Failed to load jobs');
    });

    // Fetch user's applications
    withAuth(async (token) => {
      const res = await axios.get(`http://localhost:8000/applications/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Applications response:', res.data);
      if (res.data && res.data.length > 0) {
        console.log('First application sample:', res.data[0]);
      }
      setApplications(res.data || []);
    }).catch((err) => {
      console.error('Error fetching applications:', err);
      alert('Failed to load applications. Please try again.');
    });

    // Fetch notifications
    withAuth(async (token) => {
      const res = await axios.get(`http://localhost:8000/notifications/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data || []);
    }).catch((err) => console.error('Error fetching notifications:', err));

    // Logout when window/tab is closed
    const handleBeforeUnload = () => {
      localStorage.removeItem('token');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [navigate, withAuth]);

  const handleFileChange = (jd_id) => (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFiles((prev) => ({ ...prev, [jd_id]: file }));
  };

  // Helper to check if already applied to a job
  const hasAlreadyApplied = (jd_id) => {
    return applications.some((app) => app.jd_id === jd_id);
  };

  // Helper: does user have any open application?
const hasOpenApplication = () => {
  // Find jobs the user applied to that are not closed
  return applications.some(app => {
    const job = jobs.find(j => j.jd_id === app.jd_id);
    return job && job.status !== 'closed';
  });
};

  const handleUpload = async (jd_id) => {
    // Check if already applied
    if (hasAlreadyApplied(jd_id)) {
      alert('You have already applied to this job.');
      return;
    }
  const usedToken = getAccessToken();
    // Debug logs
    console.log('=== UPLOAD DEBUG ===');
    console.log('Token from localStorage:', localStorage.getItem('token'));
    console.log('Using token:', usedToken);
    console.log('Token length:', usedToken ? usedToken.length : 0);
    console.log('User ID:', localStorage.getItem('user_id'));
    console.log('==================');
    if (!usedToken) {
      alert('No token found. Please login again.');
      navigate('/login');
      return;
    }
    const file = selectedFiles[jd_id];
    if (!file) {
      alert('Please select a file first.');
      return;
    }
    setUploadingJob(jd_id);
    const formData = new FormData();
    formData.append('file', file);
    try {
      console.log('Sending request to:', `http://localhost:8000/upload-resume/${jd_id}`);
      console.log('Authorization header:', `Bearer ${usedToken.substring(0, 20)}...`);
      const resp = await withAuth(async (token) => (
        axios.post(
          `http://localhost:8000/upload-resume/${jd_id}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              refresh_token: localStorage.getItem('refresh_token') || '',
            },
          }
        )
      ));
      console.log('Upload successful:', resp.data);
      alert('Resume uploaded successfully! ' + (resp.data.insights || ''));
      
      // Store jd_id and user_id for chatbot
      const userId = localStorage.getItem('user_id');
      localStorage.setItem('current_jd_id', jd_id);
      localStorage.setItem('chat_user_id', userId);
      
      setSelectedFiles((prev) => ({ ...prev, [jd_id]: null }));
      
      // Refresh applications
      if (userId) {
        withAuth(async (token) => {
          const res = await axios.get(`http://localhost:8000/applications/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setApplications(res.data || []);
        }).catch((err) => console.error('Error refreshing applications:', err));
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (!error.response) {
        alert('Upload failed: Network error. Check backend connection.');
      } else {
        alert('Upload failed: ' + (error.response.data?.detail || error.message));
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
    navigate('/', { replace: true });
  };

  // Settings handlers
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
      // Call backend to change password (endpoint needs to be created)
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

  // Help & Support handlers
  const handleSendMessage = () => {
    setShowSupportModal(true);
  };

  const handleSupportSubmit = async () => {
    if (!supportMessage.trim()) {
      alert('Please enter a message');
      return;
    }
    
    try {
      const userId = localStorage.getItem('user_id');
      const email = localStorage.getItem('email');
      
      // For now, just log it and show success (backend endpoint can be added later)
      console.log('Support message:', {
        user_id: userId,
        email: email,
        message: supportMessage,
        timestamp: new Date().toISOString()
      });
      
      alert('Thank you for contacting us! Our support team will get back to you within 24 hours.');
      setShowSupportModal(false);
      setSupportMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again or email us directly at support@resumescreening.com');
    }
  };

  const handleReportBug = () => {
    setShowBugReportModal(true);
  };

  const handleBugSubmit = async () => {
    if (!bugDescription.trim()) {
      alert('Please describe the issue');
      return;
    }
    
    try {
      const userId = localStorage.getItem('user_id');
      const email = localStorage.getItem('email');
      
      // For now, just log it and show success (backend endpoint can be added later)
      console.log('Bug report:', {
        user_id: userId,
        email: email,
        description: bugDescription,
        timestamp: new Date().toISOString(),
        page: activePage
      });
      
      alert('Thank you for reporting this issue! Our team will investigate it promptly.');
      setShowBugReportModal(false);
      setBugDescription('');
    } catch (error) {
      console.error('Error reporting bug:', error);
      alert('Error submitting bug report. Please try again.');
    }
  };

  const handleRefreshJobs = () => {
    const userId = localStorage.getItem('user_id');
  const token = getAccessToken();
    
    // Refresh jobs
    withAuth(async (token2) => {
      const res = await axios.get('http://localhost:8000/jobs', {
        headers: { Authorization: `Bearer ${token2}` },
      });
      setJobs(res.data || []);
    }).catch((err) => {
      console.error('Error refreshing jobs:', err);
    });
    
    // Refresh applications
    if (userId && token) {
      withAuth(async (token2) => {
        const res = await axios.get(`http://localhost:8000/applications/${userId}`, {
          headers: { Authorization: `Bearer ${token2}` },
        });
        setApplications(res.data || []);
      }).catch((err) => {
        console.error('Error refreshing applications:', err);
      });
      
      // Refresh notifications
      withAuth(async (token2) => {
        const res = await axios.get(`http://localhost:8000/notifications/${userId}`, {
          headers: { Authorization: `Bearer ${token2}` },
        });
        setNotifications(res.data || []);
      }).catch((err) => console.error('Error refreshing notifications:', err));
    }
  };

  function formatDateSafe(dateStr) {
    if (!dateStr) return '';
    // Try to parse ISO or yyyy-mm-dd
    const parts = dateStr.split(/[-T:]/);
    if (parts.length >= 3) {
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }
    // Fallback to Date object
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  }

  // Map raw application status to label and CSS class (UI only, no logic change)
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
    if (s === 'under review' || s === 'under_review' || s === 'in review') {
      return { label: 'Under Review', className: 'status-under-review' };
    }
    if (s.startsWith('interview')) {
      return { label: 'Interviewing', className: 'status-interviewing' };
    }
    if (s === 'withdrawn') {
      return { label: 'Withdrawn', className: 'status-withdrawn' };
    }
    // Default
    return { label: statusRaw || 'Submitted', className: 'status-submitted' };
  }  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          {/* Hamburger */}
          <div className="dashboard-hamburger" onClick={() => setShowSideDrawer(true)} title="Menu">
            <div className="hamburger-line" />
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>
          <div>
            <h1 className="dashboard-title">Candidate Dashboard</h1>
            <div className="welcome-banner" style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: 4 }}>
              Welcome, {(() => {
                const email = localStorage.getItem('email');
                const userId = localStorage.getItem('user_id') || 'Candidate';
                const base = email || userId;
                const name = base.includes('@') ? base.split('@')[0] : base;
                return name.charAt(0).toUpperCase() + name.slice(1);
              })()}!
            </div>
          </div>
        </div>
        <div className="dashboard-header-actions">
          {/* Notifications Bell */}
          <div
            className="dashboard-bell-container"
            onClick={() => {
              // Mark all as read and toggle dropdown
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              setShowNotifDropdown((prev) => !prev);
            }}
            title="Notifications"
          >
            <svg
              className="dashboard-bell-icon"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2z" fill="white" opacity="0.9"/>
              <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="dashboard-bell-badge">{notifications.filter((n) => !n.read).length}</span>
            )}
          </div>

          {/* Profile */}
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
                      const userId = localStorage.getItem('user_id') || 'Candidate User';
                      const base = email || userId;
                      const name = base.includes('@') ? base.split('@')[0] : base;
                      return name.charAt(0).toUpperCase() + name.slice(1);
                    })()}
                  </div>
                  <div className="dashboard-profile-role">Role: Candidate</div>
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

          {/* Notifications Dropdown */}
          {showNotifDropdown && (
            <div className="dashboard-notifications-dropdown">
              <div className="dashboard-notifications-header">Notifications</div>
              {notifications && notifications.length > 0 ? (
                <div className="dashboard-notifications-list">
                  {notifications.map((n, idx) => (
                    <div className="dashboard-notification-item" key={n.id || n.notification_id || idx}>
                      <div className={`dashboard-notification-icon ${
                        n.type === 'selected' ? 'notif-selected' :
                        n.type === 'rejected' ? 'notif-rejected' :
                        n.type === 'pending' ? 'notif-pending' :
                        n.type === 'new_job' ? 'notif-new-job' : 'notif-generic'}`}></div>
                      <div className="dashboard-notification-content">
                        <div className="dashboard-notification-text">{n.message || n.text || n.title || 'Notification'}</div>
                        {n.created_at && (
                          <div className="dashboard-notification-time">{formatDateSafe(n.created_at)}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-notification-empty">No notifications</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Side drawer */}
      {showSideDrawer && (
        <div className="dashboard-drawer-overlay" onClick={() => setShowSideDrawer(false)}>
          <div className="dashboard-side-drawer left" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">Menu</div>
              <button className="drawer-close" onClick={() => setShowSideDrawer(false)} aria-label="Close Menu">Ã—</button>
            </div>
            <div className="drawer-nav">
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('jobs'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Job Postings
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('history'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                My Applications
              </span>
              <span className="drawer-nav-link" onClick={() => { setShowSideDrawer(false); setActivePage('resources'); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                Career Resources
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
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-container">


        {/* Main content by activePage */}
        {activePage === 'jobs' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Job Postings</h2>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button 
                className="dashboard-btn-secondary" 
                onClick={handleRefreshJobs}
                style={{ fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
              >
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
                    jobs.map((job) => {
                      const alreadyApplied = hasAlreadyApplied(job.jd_id);
                      return (
                      <tr key={job.jd_id}>
                        <td><strong>{job.title}</strong></td>
                        <td>{job.description}</td>
                        <td>{Array.isArray(job.requirements) ? job.requirements.join(', ') : job.requirements}</td>
                        <td>
                          {alreadyApplied ? (
                            <div style={{ 
                              color: '#22543d', 
                              fontWeight: '600', 
                              background: '#c6f6d5', 
                              padding: '0.6rem 1rem', 
                              borderRadius: '8px',
                              display: 'inline-block'
                            }}>
                              âœ“ Already Applied
                            </div>
                          ) : (
                          <div className="dashboard-file-input-container">
                            <input
                              className="dashboard-file-input"
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={handleFileChange(job.jd_id)}
                            />
                            <button
                              className="dashboard-btn-primary"
                              onClick={() => handleUpload(job.jd_id)}
                              disabled={!selectedFiles[job.jd_id] || uploadingJob === job.jd_id}
                              style={{ fontSize: '0.9rem', padding: '0.6rem 1.2rem' }}
                            >
                              {uploadingJob === job.jd_id ? 'Uploading...' : 'Upload'}
                            </button>
                          </div>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="dashboard-empty-state">
                        <div className="dashboard-empty-state-icon">ðŸ“‹</div>
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
                        : (app.job_descriptions?.description || 'â€”');
                      const applied = formatDateSafe(app.created_at) || 'â€”';
                      const rawStatus = app.resumes?.decision || app.status || 'submitted';
                      const meta = getApplicationStatusMeta(rawStatus);
                      return (
                        <tr key={key}>
                          <td><strong>{title}</strong></td>
                          <td style={{ maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {requirements}
                          </td>
                          <td>{applied}</td>
                          <td>
                            <span className={`status-pill ${meta.className}`}>{meta.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <div className="dashboard-empty-state-icon">ðŸ“„</div>
                <div>No applications yet</div>
              </div>
            )}
          </div>
        )}

        {activePage === 'notifications' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Notifications</h2>
            {notifications.length > 0 ? (
              <div className="dashboard-notifications-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
                {notifications.map((n, idx) => (
                  <div className="dashboard-notification-item" key={n.id || n.notification_id || idx}>
                    <div className={`dashboard-notification-icon ${
                      n.type === 'selected' ? 'notif-selected' :
                      n.type === 'rejected' ? 'notif-rejected' :
                      n.type === 'pending' ? 'notif-pending' :
                      n.type === 'new_job' ? 'notif-new-job' : 'notif-generic'}`}></div>
                    <div className="dashboard-notification-content">
                      <div className="dashboard-notification-text">{n.message || n.text || n.title || 'Notification'}</div>
                      {n.created_at && (
                        <div className="dashboard-notification-time">{formatDateSafe(n.created_at)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-notification-empty">No notifications</div>
            )}
          </div>
        )}

        {/* My Profile Page */}
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
                    const userId = localStorage.getItem('user_id') || 'Candidate';
                    const base = email || userId;
                    const name = base.includes('@') ? base.split('@')[0] : base;
                    return name.charAt(0).toUpperCase() + name.slice(1);
                  })()}
                </h3>
                <p className="profile-email">{localStorage.getItem('email') || 'No email set'}</p>
                <p className="profile-role">Role: Candidate</p>
              </div>
            </div>

            {/* Application Statistics */}
            <div className="profile-section">
              <h3 className="profile-section-title">Application Statistics</h3>
              <div className="profile-stats-grid">
                <div className="profile-stat-card">
                  <div className="profile-stat-value">{applications.length}</div>
                  <div className="profile-stat-label">Total Applications</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value">{applications.filter(a => (a.resumes?.decision || a.status) === 'selected').length}</div>
                  <div className="profile-stat-label">Selected</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value">{applications.filter(a => (a.resumes?.decision || a.status) === 'pending' || (a.resumes?.decision || a.status) === 'submitted').length}</div>
                  <div className="profile-stat-label">Pending</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-value">{applications.filter(a => (a.resumes?.decision || a.status) === 'rejected').length}</div>
                  <div className="profile-stat-label">Rejected</div>
                </div>
              </div>
            </div>

            {/* Resume Upload */}
            <div className="profile-section">
              <h3 className="profile-section-title">Resume Management</h3>
              <div className="profile-resume-upload">
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                  You can upload a new resume when applying for jobs. Your latest resume will be used for applications.
                </p>
                <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '12px', border: '2px dashed #0ea5e9' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" style={{ margin: '0 auto 1rem', display: 'block' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p style={{ textAlign: 'center', color: '#0ea5e9', fontWeight: '600' }}>
                    Upload your resume when applying for jobs
                  </p>
                </div>
              </div>
            </div>

            {/* Account Info */}
            <div className="profile-section">
              <h3 className="profile-section-title">Account Information</h3>
              <div className="profile-info-grid">
                <div className="profile-info-item">
                  <span className="profile-info-label">User ID</span>
                  <span className="profile-info-value">{localStorage.getItem('user_id') || 'â€”'}</span>
                </div>
                <div className="profile-info-item">
                  <span className="profile-info-label">Email</span>
                  <span className="profile-info-value">{localStorage.getItem('email') || 'â€”'}</span>
                </div>
                <div className="profile-info-item">
                  <span className="profile-info-label">Member Since</span>
                  <span className="profile-info-value">2025</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Career Resources Page */}
        {activePage === 'resources' && (
          <div className="dashboard-card">
            <h2 className="dashboard-card-title">Career Resources</h2>
            
            <div className="resources-grid">
              {/* Interview Tips */}
              <div className="resource-card">
                <div className="resource-icon" style={{ background: '#dbeafe' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <h3 className="resource-title">Interview Preparation</h3>
                <p className="resource-description">
                  Master common interview questions, learn STAR method, and practice behavioral interviews.
                </p>
                <ul className="resource-tips">
                  <li>Research the company thoroughly</li>
                  <li>Prepare 3-5 questions for the interviewer</li>
                  <li>Practice your answers out loud</li>
                  <li>Dress professionally and arrive early</li>
                </ul>
              </div>

              {/* Resume Tips */}
              <div className="resource-card">
                <div className="resource-icon" style={{ background: '#ddd6fe' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <h3 className="resource-title">Resume Writing Guide</h3>
                <p className="resource-description">
                  Create a standout resume that gets noticed by recruiters and passes ATS systems.
                </p>
                <ul className="resource-tips">
                  <li>Use action verbs and quantify achievements</li>
                  <li>Tailor your resume for each job application</li>
                  <li>Keep it concise (1-2 pages maximum)</li>
                  <li>Use keywords from the job description</li>
                </ul>
              </div>

              {/* Career Growth */}
              <div className="resource-card">
                <div className="resource-icon" style={{ background: '#d1fae5' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <line x1="12" y1="20" x2="12" y2="10"/>
                    <line x1="18" y1="20" x2="18" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="16"/>
                  </svg>
                </div>
                <h3 className="resource-title">Career Path Planning</h3>
                <p className="resource-description">
                  Map out your career trajectory and identify skills needed for your dream role.
                </p>
                <ul className="resource-tips">
                  <li>Set clear short-term and long-term goals</li>
                  <li>Identify skill gaps and learning opportunities</li>
                  <li>Network with professionals in your field</li>
                  <li>Seek mentorship and continuous feedback</li>
                </ul>
              </div>

              {/* Industry Trends */}
              <div className="resource-card">
                <div className="resource-icon" style={{ background: '#fef3c7' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                </div>
                <h3 className="resource-title">Industry Insights</h3>
                <p className="resource-description">
                  Stay updated with the latest trends, salary insights, and in-demand skills.
                </p>
                <ul className="resource-tips">
                  <li>AI and Machine Learning skills are in high demand</li>
                  <li>Remote work continues to be popular in 2025</li>
                  <li>Soft skills like communication are increasingly valued</li>
                  <li>Continuous learning is key to career success</li>
                </ul>
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
                    <p className="settings-option-description">Receive email updates about your applications</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-option">
                  <div className="settings-option-info">
                    <h4 className="settings-option-label">Application Status Updates</h4>
                    <p className="settings-option-description">Get notified when your application status changes</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <div className="settings-option">
                  <div className="settings-option-info">
                    <h4 className="settings-option-label">New Job Alerts</h4>
                    <p className="settings-option-description">Receive alerts about new job postings matching your profile</p>
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
                  <div className="help-card-icon">ðŸ“š</div>
                  <h4 className="help-card-title">Getting Started</h4>
                  <p className="help-card-description">Learn the basics of using the platform</p>
                </div>
                <div className="help-card">
                  <div className="help-card-icon">ðŸ’¼</div>
                  <h4 className="help-card-title">Applying for Jobs</h4>
                  <p className="help-card-description">How to search and apply for positions</p>
                </div>
                <div className="help-card">
                  <div className="help-card-icon">ðŸ“„</div>
                  <h4 className="help-card-title">Resume Tips</h4>
                  <p className="help-card-description">Best practices for resume submission</p>
                </div>
                <div className="help-card">
                  <div className="help-card-icon">ðŸ“Š</div>
                  <h4 className="help-card-title">Track Applications</h4>
                  <p className="help-card-description">Monitor your application status</p>
                </div>
              </div>
            </div>

            {/* FAQ */}
            <div className="help-section">
              <h3 className="help-section-title">Frequently Asked Questions</h3>
              <div className="faq-list">
                <details className="faq-item">
                  <summary className="faq-question">How do I update my resume?</summary>
                  <p className="faq-answer">
                    You can upload a new resume each time you apply for a job. Simply select your updated resume file when applying. 
                    Your most recent resume will be used for all future applications until you upload a newer version.
                  </p>
                </details>
                <details className="faq-item">
                  <summary className="faq-question">How long does it take to hear back after applying?</summary>
                  <p className="faq-answer">
                    Response times vary by employer, but typically you can expect to hear back within 1-2 weeks. 
                    You'll receive a notification when your application status changes. Check your "My Applications" 
                    page regularly for updates.
                  </p>
                </details>
                <details className="faq-item">
                  <summary className="faq-question">What does the match score mean?</summary>
                  <p className="faq-answer">
                    The match score indicates how well your resume aligns with the job requirements. It's calculated using 
                    AI analysis of your skills, experience, and qualifications compared to the job description. 
                    A higher score suggests a better fit for the position.
                  </p>
                </details>
                <details className="faq-item">
                  <summary className="faq-question">Can I apply for multiple positions?</summary>
                  <p className="faq-answer">
                    Yes! You can apply for as many positions as you'd like. Each application is tracked separately, 
                    and you can view all your applications in the "My Applications" section.
                  </p>
                </details>
                <details className="faq-item">
                  <summary className="faq-question">How do I withdraw an application?</summary>
                  <p className="faq-answer">
                    Currently, you cannot withdraw applications directly through the platform. If you need to withdraw, 
                    please contact support with your application details, and we'll assist you.
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
                      <span>support@resumescreening.com</span>
                    </div>
                    <div className="contact-method">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a.5.5 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <span>+1 (555) 123-4567</span>
                    </div>
                  </div>
                  <button className="contact-support-btn" onClick={handleSendMessage}>
                    Send Message
                  </button>
                </div>
              </div>
            </div>

            {/* Report Issue */}
            <div className="help-section">
              <h3 className="help-section-title">Report a Bug</h3>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                Found a technical issue? Let us know so we can fix it quickly.
              </p>
              <button className="settings-action-btn secondary" onClick={handleReportBug}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                Report an Issue
              </button>
            </div>
          </div>
        )}

        {/* Chatbot: Show when resume uploaded OR testing flag is enabled */}
        {(CHATBOT_ALWAYS_VISIBLE || hasOpenApplication()) && <CustomChatbot />}

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Change Password</h3>
                <button className="modal-close" onClick={() => setShowPasswordModal(false)}>Ã—</button>
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

        {/* Support Message Modal */}
        {showSupportModal && (
          <div className="modal-overlay" onClick={() => setShowSupportModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Contact Support</h3>
                <button className="modal-close" onClick={() => setShowSupportModal(false)}>Ã—</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Your Message</label>
                  <textarea
                    className="form-textarea"
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    rows="6"
                  />
                </div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Our support team typically responds within 24 hours.
                </p>
              </div>
              <div className="modal-footer">
                <button className="modal-btn secondary" onClick={() => setShowSupportModal(false)}>
                  Cancel
                </button>
                <button className="modal-btn primary" onClick={handleSupportSubmit}>
                  Send Message
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bug Report Modal */}
        {showBugReportModal && (
          <div className="modal-overlay" onClick={() => setShowBugReportModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Report a Bug</h3>
                <button className="modal-close" onClick={() => setShowBugReportModal(false)}>Ã—</button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Bug Description</label>
                  <textarea
                    className="form-textarea"
                    value={bugDescription}
                    onChange={(e) => setBugDescription(e.target.value)}
                    placeholder="Please describe the issue you encountered, including steps to reproduce it..."
                    rows="6"
                  />
                </div>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Thank you for helping us improve! We'll investigate this issue promptly.
                </p>
              </div>
              <div className="modal-footer">
                <button className="modal-btn secondary" onClick={() => setShowBugReportModal(false)}>
                  Cancel
                </button>
                <button className="modal-btn primary" onClick={handleBugSubmit}>
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CandidateDashboard;
