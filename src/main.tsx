import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { StoreSaglayici } from './store';
import App from './App';
import './index.css';

// HashRouter: GitHub Pages statik sunumunda alt yollar için sunucu
// yapılandırması gerekmesin diye.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <StoreSaglayici>
        <App />
      </StoreSaglayici>
    </HashRouter>
  </StrictMode>,
);
