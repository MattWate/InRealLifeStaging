import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import OperatorProfile from './OperatorProfile';
import './styles.css';
import './operator-profile-insights.css';

const isOperatorProfile = window.location.pathname === '/profiles/curiocity-green-point';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      {isOperatorProfile ? <OperatorProfile /> : <App />}
    </BrowserRouter>
  </React.StrictMode>,
);
