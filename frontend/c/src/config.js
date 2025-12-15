import axios from 'axios';

// API Base URL - use environment variable or fallback to localhost for development
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Configure axios default baseURL so modules that import axios directly
// use the correct backend in both local and deployed environments.
axios.defaults.baseURL = API_URL;

export default API_URL;
