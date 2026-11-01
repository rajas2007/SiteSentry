import React from 'react';
import ReactDOM from 'react-dom/client';
import WarningApp from './WarningApp';
import '../popup/index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <WarningApp />
    </React.StrictMode>
  );
}
