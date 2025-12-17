import axios from 'axios';

// API Base URL selection logic:
// - If REACT_APP_API_URL is set and we're not in local development, use it.
// - If running in development on localhost, prefer the local backend at port 8000
//   so the project works fully on your machine without touching deployed services.
let API_URL = process.env.REACT_APP_API_URL || '';
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
	const host = window.location.hostname;
	if (host === 'localhost' || host === '127.0.0.1') {
		// Force local backend for dev to avoid CORS and remote deploy limits.
		API_URL = 'http://localhost:8000';
	}
}

if (!API_URL) {
	// Final fallback
	API_URL = 'http://localhost:8000';
}

// Configure axios default baseURL so modules that import axios directly
// use the correct backend in both local and deployed environments.
axios.defaults.baseURL = API_URL;

export default API_URL;
