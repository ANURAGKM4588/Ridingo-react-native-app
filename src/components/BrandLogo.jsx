import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import ridingoBlack from '../assets/ridingo_black.png';
import ridingoWhite from '../assets/ridingo_white.png';
import driverLogoDark from '../assets/logo_drivers_01.png';
import driverLogoLight from '../assets/logo_drivers_02.png';

/**
 * BrandLogo Component
 * Bundled high-resolution assets with instant light/dark reactive theme switching,
 * scoped container detection (User App vs Driver App), and multi-layer fallback handling.
 */
export default function BrandLogo({
  height = 24,
  width = 96,
  center = false,
  className = '',
  style = {},
  themeOverride,
  isDriver: isDriverProp
}) {
  const wrapRef = useRef(null);
  const appContext = useApp();
  const contextTheme = appContext?.theme || 'light';

  // Determine if this instance represents the Driver App
  const computeIsDriver = () => {
    if (typeof isDriverProp === 'boolean') return isDriverProp;
    if (wrapRef.current) {
      if (wrapRef.current.closest('.driver-app-root, .driver-onboarding-modal, #driver-app, #col-d, [data-app="driver"]')) {
        return true;
      }
      if (wrapRef.current.closest('.user-app-root, #col-u, [data-app="user"], .home-tab-container')) {
        return false;
      }
    }
    if (appContext?.view === 'driver') return true;
    if (appContext?.view === 'user') return false;
    if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'driver') return true;
    if (typeof window !== 'undefined' && window.RIDINGO_TARGET === 'user') return false;
    if (typeof window !== 'undefined') {
      const port = (window.location.port || '');
      if (port === '5174') return true;
      const search = (window.location.search || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (search.includes('app=driver') || search.includes('view=driver') || path.includes('/driver') || hash.includes('driver')) {
        return true;
      }
    }
    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('standalone-driver') || document.body?.classList?.contains('standalone-driver')) {
        return true;
      }
    }
    return false;
  };

  const [isDriver, setIsDriver] = useState(computeIsDriver);

  // Sync isDriver if prop, appContext.view, or DOM changes
  useEffect(() => {
    setIsDriver(computeIsDriver());
  }, [isDriverProp, appContext?.view]);

  // Determine dark mode state based on scoped container or global theme
  const computeIsDark = () => {
    if (themeOverride === 'dark') return true;
    if (themeOverride === 'light') return false;

    // Check closest scoped container with data-theme (e.g. #col-u or #col-d)
    if (wrapRef.current) {
      const scopedContainer = wrapRef.current.closest('[data-theme]');
      if (scopedContainer) {
        const ct = scopedContainer.getAttribute('data-theme');
        if (ct === 'dark') return true;
        if (ct === 'light') return false;
      }
    }

    if (typeof document !== 'undefined') {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'dark') return true;
      if (attr === 'light') return false;
    }
    if (contextTheme === 'dark') return true;
    if (contextTheme === 'light') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  };

  const [isDark, setIsDark] = useState(computeIsDark);

  useEffect(() => {
    setIsDark(computeIsDark());
    setIsDriver(computeIsDriver());

    // Observe data-theme changes on closest scoped container and root
    const scoped = wrapRef.current?.closest('[data-theme]');
    const targetElement = scoped || document.documentElement;

    const observer = new MutationObserver(() => {
      setIsDark(computeIsDark());
      setIsDriver(computeIsDriver());
    });
    observer.observe(targetElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    });

    if (targetElement !== document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class']
      });
    }

    // Also observe media query
    const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const handleMql = () => setIsDark(computeIsDark());
    mql?.addEventListener?.('change', handleMql);

    return () => {
      observer.disconnect();
      mql?.removeEventListener?.('change', handleMql);
    };
  }, [themeOverride, contextTheme, isDriverProp]);

  const logoSrc = isDriver
    ? (isDark ? driverLogoDark : driverLogoLight)
    : (isDark ? ridingoWhite : ridingoBlack);

  const fallbackPublicSrc = isDriver
    ? (isDark ? '/Drivers/logo_drivers_01.png' : '/Drivers/logo_drivers_02.png')
    : (isDark ? '/ridingo_white.png' : '/ridingo_black.png');

  return (
    <span
      ref={wrapRef}
      className={`ridingo-brand-logo-wrap ${center ? 'center' : ''} ${className}`}
      style={{
        position: 'relative',
        display: center ? 'flex' : 'inline-flex',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        height: `${height}px`,
        width: `${width}px`,
        flex: 'none',
        ...style
      }}
    >
      <img
        src={logoSrc}
        alt="Ridingo"
        className="brand-logo-img"
        key={`${isDriver ? 'driver' : 'user'}-${isDark ? 'dark' : 'light'}`}
        onError={(e) => {
          if (!e.currentTarget.dataset.fallback) {
            e.currentTarget.dataset.fallback = '1';
            e.currentTarget.src = fallbackPublicSrc;
          } else if (e.currentTarget.dataset.fallback === '1') {
            e.currentTarget.dataset.fallback = '2';
            e.currentTarget.src = isDriver
              ? (isDark ? '/Drivers/Logo Drivers-01.png' : '/Drivers/Logo Drivers-02.png')
              : (isDark ? '/Ridingo White.png' : '/Ridingo Black.png');
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: center ? 'center center' : 'left center',
          display: 'block',
          transition: 'opacity 0.25s ease'
        }}
      />
    </span>
  );
}
