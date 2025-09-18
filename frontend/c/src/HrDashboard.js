import React, { useState, useEffect } from 'react';
import { Container, Typography, Box, Button, TextField, Table, TableBody, TableCell, TableHead, TableRow, Select, MenuItem } from '@mui/material';
import axios from 'axios';

function HrDashboard() {
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({ title: '', description: '', requirements: '', deadline: '' });

  useEffect(() => {
    axios.get('http://localhost:8000/jobs').then((response) => setJobs(response.data));
  }, []);

  const handleJobSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:8000/jobs', {
      title: newJob.title,
      description: newJob.description,
      requirements: newJob.requirements.split(','),
      deadline: newJob.deadline
    }).then(() => {
      axios.get('http://localhost:8000/jobs').then((response) => setJobs(response.data));
    });
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        HR Dashboard
      </Typography>
      <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }} onSubmit={handleJobSubmit}>
        <TextField label="Job Title" value={newJob.title} onChange={(e) => setNewJob({ ...newJob, title: e.target.value })} />
        <TextField label="Description" value={newJob.description} onChange={(e) => setNewJob({ ...newJob, description: e.target.value })} />
        <TextField label="Requirements (comma-separated)" value={newJob.requirements} onChange={(e) => setNewJob({ ...newJob, requirements: e.target.value })} />
        <TextField label="Deadline (YYYY-MM-DD)" value={newJob.deadline} onChange={(e) => setNewJob({ ...newJob, deadline: e.target.value })} />
        <Button type="submit" variant="contained" color="primary">Post Job</Button>
      </Box>
      <Typography variant="h5">Job Postings</Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Candidates</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.jd_id}>
              <TableCell>{job.title}</TableCell>
              <TableCell>0</TableCell>
              <TableCell>
                <Button variant="outlined">Rank Resumes</Button>
                <Button variant="outlined">Review</Button>
                <Select value="applied">
                  <MenuItem value="selected">Selected</MenuItem>
                  <MenuItem value="not_selected">Not Selected</MenuItem>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
}

export default HrDashboard;