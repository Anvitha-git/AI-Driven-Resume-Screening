import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Button, Input, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import axios from 'axios';

function CandidateDashboard() {
  const [jobs, setJobs] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:8000/jobs').then((response) => setJobs(response.data));
  }, []);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUpload = (jd_id) => {
    const formData = new FormData();
    formData.append('file', selectedFile);
    axios.post(`http://localhost:8000/upload-resume/${jd_id}`, formData).then(() => {
      alert('Resume uploaded successfully!');
    });
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Candidate Dashboard
      </Typography>
      <Typography variant="h5">Job Postings</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Upload Resume</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.jd_id}>
              <TableCell>{job.title}</TableCell>
              <TableCell>{job.description}</TableCell>
              <TableCell>
                <Input type="file" onChange={handleFileChange} />
                <Button variant="contained" onClick={() => handleUpload(job.jd_id)} disabled={!selectedFile}>
                  Upload
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
}

export default CandidateDashboard;