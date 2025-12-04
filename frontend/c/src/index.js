import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import axios from 'axios';

// Configure axios to use deployed backends instead of localhost in production
const API_BASE = process.env.REACT_APP_BACKEND_URL;
const RASA_BASE = process.env.REACT_APP_RASA_URL;

if (API_BASE) {
	axios.defaults.baseURL = API_BASE;
}

axios.interceptors.request.use((config) => {
	if (config.url) {
		if (API_BASE && config.url.startsWith('http://localhost:8000')) {
			config.url = config.url.replace('http://localhost:8000', API_BASE);
		}
		if (RASA_BASE && config.url.startsWith('http://localhost:5005')) {
			config.url = config.url.replace('http://localhost:5005', RASA_BASE);
		}
	}
	return config;
});

const root = createRoot(document.getElementById('root'));
root.render(<App />);