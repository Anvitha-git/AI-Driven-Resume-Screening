import React from 'react';
import { createRoot } from 'react-dom/client';
// Ensure API config (and axios defaults) are initialized early
import './config';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(<App />);