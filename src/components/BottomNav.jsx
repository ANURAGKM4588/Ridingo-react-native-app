import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';

export default function BottomNav() {
  const { uTab, setUTab, onboardingOpen, bookingOpen, paymentOpen, liveTrackingOpen } = useApp();
  const [mapPickerActive, setMapPickerActive] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const updateMapState = () => {
      const active = Boolean(
        document.body.classList.contains('map-picker-open') ||
        document.querySelector('.map-picker-scrim')
      );
      setMapPickerActive(active);
    };

    updateMapState();
    const observer = new MutationObserver(updateMapState);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    // Focus & VisualViewport tracking for mobile virtual keyboard
    const handleFocusIn = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) {
        setKeyboardOpen(true);
        document.body.classList.add('keyboard-open');
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const active = document.activeElement;
        const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
        if (!isInput) {
          setKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        }
      }, 100);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const isShrunk = window.innerHeight - window.visualViewport.height > 120;
        setKeyboardOpen(isShrunk);
        if (isShrunk) {
          document.body.classList.add('keyboard-open');
        } else {
          document.body.classList.remove('keyboard-open');
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize, { passive: true });
    }

    // Capacitor Native Keyboard listeners
    let removeCapKeyboard = null;
    try {
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        const showSub = Keyboard.addListener('keyboardWillShow', () => {
          setKeyboardOpen(true);
          document.body.classList.add('keyboard-open');
        });
        const hideSub = Keyboard.addListener('keyboardWillHide', () => {
          setKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        });
        removeCapKeyboard = () => {
          showSub.then(s => s?.remove?.()).catch(() => {});
          hideSub.then(s => s?.remove?.()).catch(() => {});
        };
      }).catch(() => {});
    } catch (_) {}

    return () => {
      observer.disconnect();
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
      if (removeCapKeyboard) removeCapKeyboard();
    };
  }, []);

  if (onboardingOpen || bookingOpen || paymentOpen || liveTrackingOpen || mapPickerActive || keyboardOpen) return null;

  const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'trips', label: 'History', icon: 'history' },
    { id: 'wallet', label: 'Wallet', icon: 'wallet' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ];

  return (
    <nav className="nav" id="u-nav" aria-label="User app">
      {NAV_ITEMS.map(n => (
        <button
          key={n.id}
          className={`nv ${uTab === n.id ? 'on' : ''}`}
          aria-label={n.label}
          aria-current={uTab === n.id}
          onClick={() => {
            setUTab(n.id);
            const el = document.getElementById('u-content');
            if (el) el.scrollTop = 0;
          }}
        >
          <span className="nv-i">
            <Icon name={n.icon} size={23} filled={uTab === n.id} />
          </span>
          <span className="nv-l">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
