import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './lib/auth.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import 'katex/dist/katex.min.css';
import './index.css';
import './app-ui.css';

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </ErrorBoundary>
);
