import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import LandingPage from './LandingPage';
import OperatorProfile from './OperatorProfile';
import Screening from './Screening';
import RateEngine from './RateEngine';
import { AuthProvider, RequireAdmin, LoginPage, AdminLayout } from './admin/Auth';
import { Dashboard, SubmissionDetail } from './admin/Dashboard';
import './styles/global.css';
import './styles.css';
import './brand-onboarding.css';
import './operator-profile-insights.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter><AuthProvider><Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding/*" element={<App />} />
      <Route element={<RequireAdmin />}>
        <Route element={<AdminLayout />}>
          <Route path="/profiles/curiocity-green-point" element={<OperatorProfile />} />
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/submissions/:id" element={<SubmissionDetail />} />
          <Route path="/screening/*" element={<Screening />} />
          <Route path="/rate-engine/*" element={<RateEngine />} />
        </Route>
        <Route path="/app" element={<Navigate to="/admin" replace />} />
      </Route>
      <Route path="*" element={<main className="admin-state"><h1>Page not found</h1><a href="/">Back to IRL</a></main>} />
    </Routes></AuthProvider></BrowserRouter>
  </React.StrictMode>,
);
