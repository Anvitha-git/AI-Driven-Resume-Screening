import axios from 'axios';

// API Base URL selection logic:
// - If REACT_APP_API_URL is set and we're not in local development, use it.
// - If running in development on localhost, prefer the local backend at port 8000
//   so the project works fully on your machine without touching deployed services.
// Prefer an explicitly provided backend URL (from environment) if available.
// This is useful when running the frontend in production or CI where
// `REACT_APP_API_URL` is set to the deployed backend (e.g., Render).
let API_URL = process.env.REACT_APP_API_URL || '';

// If no explicit URL is provided, keep the developer-friendly fallback:
// when running locally on `localhost` use the local backend at port 8000.
if (!API_URL && process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
	const host = window.location.hostname;
	if (host === 'localhost' || host === '127.0.0.1') {
		API_URL = 'http://localhost:8000';
	}
}

if (!API_URL) {
	// Final fallback to localhost for safety in quick dev runs.
	API_URL = 'http://localhost:8000';
}

// Configure axios default baseURL so modules that import axios directly
// use the correct backend in both local and deployed environments.
axios.defaults.baseURL = API_URL;

export default API_URL;
