import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 🚀 Forces a module reload for Vite
if (import.meta.hot) {
  import.meta.hot.accept();
}
console.log('App loaded');
