import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { checkAndSync } from './services/syncService';

// Synchroniser au démarrage si connecté
checkAndSync().then(() => {
  console.log('✅ Synchronisation initiale terminée');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);