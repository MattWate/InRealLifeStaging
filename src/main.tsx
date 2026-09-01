import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import LandingPage from './LandingPage';
import OperatorProfile from './OperatorProfile';
import Screening from './Screening';
import RateEngine from './RateEngine';
import { initOnboardingPersistence } from './onboarding-persistence';
import './styles/global.css';
import './styles.css';
import './brand-onboarding.css';
import './operator-profile-insights.css';

initOnboardingPersistence();

const path = window.location.pathname;
const page = path === '/'
  ? <LandingPage />
  : path.startsWith('/screening')
    ? <Screening />
    : path.startsWith('/rate-engine')
      ? <RateEngine />
      : path === '/profiles/curiocity-green-point'
        ? <OperatorProfile />
        : path.startsWith('/onboarding')
          ? <App />
          : <LandingPage />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>{page}</BrowserRouter>
  </React.StrictMode>,
);
