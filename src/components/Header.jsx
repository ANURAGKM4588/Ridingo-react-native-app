import React from 'react';
import { useApp } from '../context/AppContext';
import BrandLogo from './BrandLogo';

export default function Header() {
  const { view, setView, resetDemo } = useApp();

  return (
    <header className="top">
      <div className="brand">
        <div>
          <BrandLogo height={32} width={128} style={{ display: 'block', marginBottom: '2px' }} />
          <small>Hire a driver for your own car</small>
        </div>
      </div>
      <div className="top-r">
        <button className="sb-status-btn" aria-label="Supabase database status">
          <span className="sb-status-dot"></span>
          <span className="sb-status-text">Supabase DB</span>
        </button>
        <div className="seg viewseg" role="tablist" aria-label="Choose app">
          <button
            className={view === 'user' ? 'on' : ''}
            onClick={() => setView('user')}
          >
            User app
          </button>
          <button
            className={view === 'driver' ? 'on' : ''}
            onClick={() => setView('driver')}
          >
            Driver app
          </button>
        </div>

      </div>
    </header>
  );
}
