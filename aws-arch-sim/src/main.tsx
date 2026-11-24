import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './global.css';
import { UiProvider } from './ui/Provider';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

createRoot(root).render(
  <StrictMode>
    <UiProvider>
      <App />
    </UiProvider>
  </StrictMode>,
);
