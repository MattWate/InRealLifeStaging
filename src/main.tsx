import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import OperatorProfile from './OperatorProfile';
import Screening from './Screening';
import RateEngine from './RateEngine';
import './styles.css';
import './operator-profile-insights.css';

const path = window.location.pathname;
const page = path.startsWith('/screening')
  ? <Screening />
  : path.startsWith('/rate-engine')
    ? <RateEngine />
    : path === '/profiles/curiocity-green-point'
      ? <OperatorProfile />
      : <App />;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>{page}</BrowserRouter>
  </React.StrictMode>,
);
