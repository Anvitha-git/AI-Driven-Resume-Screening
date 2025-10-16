// import React, { useState, useEffect } from 'react';
// import { Container, Typography, Box, Button, Input, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
// import axios from 'axios';
// import ChatBot from 'react-simple-chatbot';

// function CandidateDashboard() {
//   console.log('CandidateDashboard rendered');
//   const [jobs, setJobs] = useState([]);
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [resumeUploaded, setResumeUploaded] = useState(false);

//   useEffect(() => {
//     axios.get('http://localhost:8000/jobs')
//       .then((response) => {
//         console.log('Jobs fetched:', response.data);
//         setJobs(response.data);
//       })
//       .catch((error) => console.error('Error fetching jobs:', error));
//   }, []);

//   const handleFileChange = (e) => {
//     const file = e.target.files[0];
//     console.log('Selected file:', file);
//     setSelectedFile(file);
//   };

//   const handleUpload = async (jd_id) => {
//     console.log('Uploading resume for jd_id:', jd_id, 'File:', selectedFile);
//     const formData = new FormData();
//     formData.append('file', selectedFile);

//     // Replace with your demo candidate token
//     const token = "eyJhbGciOiJIUzI1NiIsImtpZCI6Ik5KYUVCZm5VSmdBMlVkaCsiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2V4Ym1qem5icGhqdWpnbmd0bnJ6LnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI3MTMxYzFiMC04YjI3LTQ3OTktODM3Mi1jMjgwMWY3MGU1N2UiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYwMjgyNzczLCJpYXQiOjE3NjAyNzkxNzMsImVtYWlsIjoiZGVtb19jYW5kaWRhdGVAcHJvamVjdC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc2MDI3OTE3M31dLCJzZXNzaW9uX2lkIjoiMDU5YmY4YzgtMjU2ZS00MWU4LWFkNGQtODJiOWM0MTg1Yjc4IiwiaXNfYW5vbnltb3VzIjpmYWxzZX0.v5wYiPTu23NBDBGr2hVLDqwHK1zPwK8utggiDULqgDY"; // From /demo-login/demo_candidate

//     try {
//       const response = await axios.post(
//         `http://localhost:8000/upload-resume/${jd_id}`,
//         formData,
//         {
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'multipart/form-data',
//           },
//         }
//       );
//       console.log('Upload successful:', response.data);
//       setResumeUploaded(true);
//     } catch (error) {
//       console.error('Error uploading resume:', error.response?.data || error.message);
//     }
//   };

//   const handleNewUserMessage = async (message) => {
//     try {
//       console.log('Sending message to Rasa:', message);
//       const response = await fetch('http://localhost:5005/webhooks/rest/webhook', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ sender: 'user', message })
//       });
//       const data = await response.json();
//       console.log('Rasa response:', data);
//       return data.length > 0 ? data[0].text : 'Sorry, I didn’t understand.';
//     } catch (error) {
//       console.error('Error communicating with Rasa:', error);
//       return 'Error connecting to chatbot.';
//     }
//   };

//   const config = {
//     width: '300px',
//     height: '400px',
//     floating: true,
//     headerTitle: 'Job Application Assistant',
//   };

//   const steps = [
//     {
//       id: 'welcome',
//       message: 'Resume uploaded! Can you describe your experience with Python?',
//       trigger: 'user',
//     },
//     {
//       id: 'user',
//       user: true,
//       trigger: ({ value }) => handleNewUserMessage(value).then((response) => ({
//         id: 'response',
//         message: response,
//         trigger: 'user',
//       })),
//     },
//   ];

//   return (
//     <Container maxWidth="md">
//       <Typography variant="h4" gutterBottom>
//         Candidate Dashboard
//       </Typography>
//       <Typography variant="h5">Job Postings</Typography>
//       <Table>
//         <TableHead>
//           <TableRow>
//             <TableCell>Title</TableCell>
//             <TableCell>Description</TableCell>
//             <TableCell>Upload Resume</TableCell>
//           </TableRow>
//         </TableHead>
//         <TableBody>
//           {jobs.length > 0 ? (
//             jobs.map((job) => (
//               <TableRow key={job.jd_id}>
//                 <TableCell>{job.title}</TableCell>
//                 <TableCell>{job.description}</TableCell>
//                 <TableCell>
//                   <Input type="file" onChange={handleFileChange} inputProps={{ accept: '.pdf' }} />
//                   <Button
//                     variant="contained"
//                     onClick={() => handleUpload(job.jd_id)}
//                     disabled={!selectedFile}
//                     sx={{ mt: 1 }}
//                   >
//                     Upload
//                   </Button>
//                 </TableCell>
//               </TableRow>
//             ))
//           ) : (
//             <TableRow>
//               <TableCell colSpan={3}>No jobs available</TableCell>
//             </TableRow>
//           )}
//         </TableBody>
//       </Table>
//       {resumeUploaded && <ChatBot steps={steps} {...config} />}
//     </Container>
//   );
// }

// export default CandidateDashboard;

// ...existing code...
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow
} from '@mui/material';
import axios from 'axios';
import ChatBot from 'react-simple-chatbot';
import { useLocation, useNavigate } from 'react-router-dom';

function CandidateDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = location.state?.token || localStorage.getItem('token') || null;

  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  const [jobs, setJobs] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState({}); // map: jd_id -> File
  const [resumeUploaded, setResumeUploaded] = useState(false);

  useEffect(() => {
    axios.get('http://localhost:8000/jobs')
      .then((res) => setJobs(res.data || []))
      .catch((err) => console.error('Error fetching jobs:', err));
  }, []);

  const handleFileChange = (jd_id) => (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFiles((prev) => ({ ...prev, [jd_id]: file }));
  };

  const handleUpload = async (jd_id) => {
    const usedToken = token || localStorage.getItem('token');
    if (!usedToken) {
      alert('No token found. Please login as Demo Candidate.');
      return;
    }

    const file = selectedFiles[jd_id];
    if (!file) {
      alert('Select a file for this job first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await axios.post(
        `http://localhost:8000/upload-resume/${jd_id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${usedToken}`,
            // do not set Content-Type; browser will set multipart boundary
          },
        }
      );
      console.log('Upload successful:', resp.data);
      setResumeUploaded(true);
      setSelectedFiles((prev) => ({ ...prev, [jd_id]: null }));
    } catch (error) {
      console.error('Upload error:', error);
      if (!error.response) {
        alert('Upload failed: Network error or CORS blocked. Check backend logs and browser console (Network tab).');
      } else {
        alert('Upload failed: ' + (error.response.data?.detail || error.response.data || error.message));
      }
    }
  };

  const handleNewUserMessage = async (message) => {
    try {
      const resp = await fetch('http://localhost:5005/webhooks/rest/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'user', message }),
      });
      const data = await resp.json();
      return data.length > 0 ? data[0].text : 'Sorry, I didn’t understand.';
    } catch (err) {
      console.error('Rasa error', err);
      return 'Error connecting to chatbot.';
    }
  };

  const config = { width: '300px', height: '400px', floating: true, headerTitle: 'Job Application Assistant' };

  const steps = [
    { id: 'welcome', message: 'Resume uploaded! Can you describe your experience with Python?', trigger: 'user' },
    {
      id: 'user',
      user: true,
      trigger: ({ value }) =>
        handleNewUserMessage(value).then((response) => ({
          id: 'response',
          message: response,
          trigger: 'user',
        })),
    },
  ];

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>Candidate Dashboard</Typography>
        <Typography variant="h6" gutterBottom>Job Postings</Typography>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Upload Resume</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <TableRow key={job.jd_id}>
                  <TableCell>{job.title}</TableCell>
                  <TableCell>{job.description}</TableCell>
                  <TableCell>
                    <Input
                      type="file"
                      onChange={handleFileChange(job.jd_id)}
                      inputProps={{ accept: '.pdf' }}
                    />
                    <Button
                      variant="contained"
                      onClick={() => handleUpload(job.jd_id)}
                      disabled={!selectedFiles[job.jd_id]}
                      sx={{ mt: 1 }}
                    >
                      Upload
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3}>No jobs available</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {resumeUploaded && <ChatBot steps={steps} {...config} />}
      </Box>
    </Container>
  );
}

export default CandidateDashboard;
// ...existing code...