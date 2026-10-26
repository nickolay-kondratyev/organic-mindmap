import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './runner.css';

const root = document.getElementById('root');
if (root === null) throw new Error('Demo root element #root is missing');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
