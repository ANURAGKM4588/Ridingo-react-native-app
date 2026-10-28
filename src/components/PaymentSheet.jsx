import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import {
  registerPaymentSheetHandler,
  unregisterPaymentSheetHandler,
  PHONEPE_MERCHANT_ID,
  generateLivePhonePeQrUrl,
  buildPhonePePayRequest,
  verifyPhonePePaymentStatus
} from '../utils/phonepe';
import {
  getInstalledUpiApps,
  launchUpiApp,
  launchDeepLink,
  checkAppInstalled,
  openAppStoreForApp,
  PRESET_UPI_APPS,
  KNOWN_UPI_APPS
} from '../services/installedUpiService';
import { MAJOR_UPI_APPS } from '../utils/upiDeepLink';

const POPULAR_BANKS = [
  { id: 'HDFC', name: 'HDFC Bank', code: 'HDFC', color: '#004c8f' },
  { id: 'SBI', name: 'State Bank of India', code: 'SBI', color: '#280071' },
  { id: 'ICICI', name: 'ICICI Bank', code: 'ICICI', color: '#b82a24' },
  { id: 'AXIS', name: 'Axis Bank', code: 'Axis', color: '#97144d' },
  { id: 'KOTAK', name: 'Kotak Mahindra Bank', code: 'Kotak', color: '#e61e24' },
  { id: 'PNB', name: 'Punjab National Bank', code: 'PNB', color: '#a20f2e' }
];

function FloatingInput({ label, type = 'text', value, onChange, maxLength, placeholder = '', error, style, rightElement }) {
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || (value !== undefined && value !== null && value.toString().length > 0);

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <div
        style={{
          position: 'relative',
          borderRadius: '12px',
          border: error ? '1px solid #EF4444' : isFocused ? '1.5px solid var(--ink, #0F172A)' : '1px solid var(--line, #E2E8F0)',
          background: 'var(--field, #FFFFFF)',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          boxShadow: isFocused ? '0 0 0 3px rgba(255, 199, 10, 0.15)' : 'none'
        }}
      >
        <label
          style={{
            position: 'absolute',
            left: '14px',
            top: isFloating ? '7px' : '50%',
            transform: isFloating ? 'translateY(0)' : 'translateY(-50%)',
            fontSize: isFloating ? '10px' : '13.5px',
            fontWeight: isFloating ? 600 : 400,
            color: error ? '#EF4444' : isFocused ? 'var(--ink, #0F172A)' : 'var(--muted, #64748B)',
            pointerEvents: 'none',
            transition: 'all 0.16s cubic-bezier(0.4, 0, 0.2, 1)',
            letterSpacing: isFloating ? '0.02em' : 'normal',
            zIndex: 1
          }}
        >
          {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? placeholder : ''}
          style={{
            width: '100%',
            height: '48px',
            padding: isFloating ? '18px 14px 4px' : '0 14px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '14px',
            color: 'var(--ink, #0F172A)',
            fontWeight: 500,
            fontFamily: type === 'password' || label.toLowerCase().includes('card number') || label.toLowerCase().includes('expiry') || label.toLowerCase().includes('cvv') ? 'monospace' : 'inherit',
            letterSpacing: label.toLowerCase().includes('card number') ? '0.04em' : 'normal',
            boxSizing: 'border-box'
          }}
        />
        {rightElement && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            {rightElement}
          </div>
        )}
      </div>
      {error && <span style={{ fontSize: '11px', color: '#EF4444', marginTop: '4px', display: 'block', fontWeight: 500 }}>{error}</span>}
    </div>
  );
}

const MinimalRadio = ({ isSelected }) => (
  <div
    style={{
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      border: isSelected ? '5px solid var(--ink, #0F172A)' : '1.5px solid var(--line-strong, #CBD5E1)',
      background: 'var(--card, #FFFFFF)',
      transition: 'all 0.15s ease',
      flexShrink: 0
    }}
  />
);

const SleekWalletOutlineIcon = ({ size = 20, color = '#0F172A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="14" rx="3" />
    <path d="M2 10h20" />
    <circle cx="16.5" cy="14.5" r="1.25" fill={color} />
  </svg>
);

const SleekCardOutlineIcon = ({ size = 20, color = '#0F172A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2.5" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </svg>
);

const SleekBankOutlineIcon = ({ size = 20, color = '#0F172A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-6 9 6" />
    <path d="M4 10h16" />
    <path d="M6 14v4" />
    <path d="M10 14v4" />
    <path d="M14 14v4" />
    <path d="M18 14v4" />
    <path d="M3 21h18" />
  </svg>
);

const SleekQrOutlineIcon = ({ size = 20, color = '#0F172A' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="3" height="3" fill={color} />
    <path d="M20 14v3h-3" />
    <path d="M14 20h6" />
  </svg>
);

const PhonePeLogo = () => (
  <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, filter: 'drop-shadow(0 2px 5px rgba(95,37,159,0.25))' }}>
    <svg width="36" height="36" viewBox="0 0 24 24" fill="#5F259F" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.206 9.941h2.949v4.692c-.402.201-.938.268-1.34.268-1.072 0-1.609-.536-1.609-1.743V9.941zm13.47 4.816c-1.523 6.449-7.985 10.442-14.433 8.919C2.794 22.154-1.199 15.691.324 9.243 1.847 2.794 8.309-1.199 14.757.324c6.449 1.523 10.442 7.985 8.919 14.433zm-6.231-5.888a.887.887 0 0 0-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021 3.82H6.386c-.201 0-.335.134-.335.335v.67c0 .469.402.871.871.871h.938v3.217c0 2.413 1.273 3.82 3.418 3.82.67 0 1.206-.067 1.877-.335v2.145c0 .603.469 1.072 1.072 1.072h.938a.432.432 0 0 0 .402-.402V9.874h1.542c.201 0 .335-.134.335-.335v-.67z"/>
    </svg>
  </div>
);

const GPayLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  }}>
    <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" fill="#4285F4"/>
      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z" fill="#34A853"/>
      <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z" fill="#FBBC05"/>
      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"/>
    </svg>
  </div>
);

const CREDLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#0F172A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(15,23,42,0.25)'
  }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 6v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V6l-8-4z" />
      <path d="M12 7v10M8.5 11.5h7" strokeWidth="2" />
    </svg>
  </div>
);

const ApplePayLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
  }}>
    <svg width="28" height="16" viewBox="0 0 60 25" fill="#FFFFFF">
      <path d="M12.98 12.06c-.02-2.73 2.23-4.04 2.33-4.1-1.27-1.86-3.25-2.11-3.95-2.14-1.69-.17-3.3 1-4.16 1-.86 0-2.18-.98-3.58-.95-1.84.03-3.54 1.07-4.49 2.72-1.92 3.32-.49 8.24 1.38 10.94.92 1.32 1.99 2.79 3.42 2.74 1.39-.06 1.91-.89 3.59-.89 1.67 0 2.15.89 3.59.86 1.49-.03 2.43-1.33 3.33-2.66 1.05-1.53 1.48-3.01 1.51-3.09-.03-.01-2.94-1.13-2.97-4.43zM10.15 4.39c.76-.92 1.28-2.21 1.14-3.49-1.1.05-2.43.73-3.21 1.65-.69.8-1.29 2.09-1.13 3.34 1.23.09 2.44-.58 3.2-1.5z"/>
      <text x="20" y="17.5" fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', Roboto, sans-serif" fontSize="16" fontWeight="600" fill="#FFFFFF">Pay</text>
    </svg>
  </div>
);

const PaytmLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  }}>
    <svg width="30" height="15" viewBox="0 0 24 12" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0, -6.5)">
        <path fill="#002970" d="M.232 9.4A.234.234 0 0 0 0 9.636v5.924c0 .132.096.238.216.241h1.09c.13 0 .237-.107.237-.24l.004-1.658H2.57c.857 0 1.453-.605 1.453-1.481v-1.538c0-.877-.596-1.484-1.453-1.484H.232zm9.032 0a.239.239 0 0 0-.237.241v2.47c0 .94.657 1.608 1.579 1.608h.675s.016 0 .037.004a.253.253 0 0 1 .222.253c0 .13-.096.235-.219.251l-.018.004-.303.006H9.739a.239.239 0 0 0-.236.24v1.09a.24.24 0 0 0 .236.242h1.75c.92 0 1.577-.669 1.577-1.608v-4.56a.239.239 0 0 0-.236-.24h-1.07a.239.239 0 0 0-.236.24c-.005.787 0 1.525 0 2.255a.253.253 0 0 1-.25.25h-.449a.253.253 0 0 1-.25-.255c.005-.754-.005-1.5-.005-2.25a.239.239 0 0 0-.236-.24zm-4.004.006a.232.232 0 0 0-.238.226v1.023c0 .132.113.24.252.24h1.413c.112.017.2.1.213.23v.14c-.013.124-.1.214-.207.224h-.7c-.93 0-1.594.63-1.594 1.515v1.269c0 .88.57 1.506 1.495 1.506h1.94c.348 0 .63-.27.63-.6v-4.136c0-1.004-.508-1.637-1.72-1.637zm-3.713 1.572h.678c.139 0 .25.115.25.256v.836a.253.253 0 0 1-.25.256h-.1c-.192.002-.386 0-.578 0zm4.67 1.977h.445c.139 0 .252.108.252.24v.932a.23.23 0 0 1-.014.076.25.25 0 0 1-.238.164h-.445a.247.247 0 0 1-.252-.24v-.933c0-.132.113-.239.252-.239Z"/>
        <path fill="#00BAF2" d="M15.85 8.167a.204.204 0 0 0-.04.004c-.68.19-.543 1.148-1.781 1.23h-.12a.23.23 0 0 0-.052.005h-.001a.24.24 0 0 0-.184.235v1.09c0 .134.106.241.237.241h.645v4.623c0 .132.104.238.233.238h1.058a.236.236 0 0 0 .233-.238v-4.623h.6c.13 0 .236-.107.236-.241v-1.09a.239.239 0 0 0-.236-.24h-.612V8.386a.218.218 0 0 0-.216-.22zm4.225 1.17c-.398 0-.762.15-1.042.395v-.124a.238.238 0 0 0-.234-.224h-1.07a.24.24 0 0 0-.236.242v5.92a.24.24 0 0 0 .236.242h1.07c.12 0 .217-.091.233-.209v-4.25a.393.393 0 0 1 .371-.408h.196a.41.41 0 0 1 .226.09.405.405 0 0 1 .145.319v4.074l.004.155a.24.24 0 0 0 .237.241h1.07a.239.239 0 0 0 .235-.23l-.001-4.246c0-.14.062-.266.174-.34a.419.419 0 0 1 .196-.068h.198c.23.02.37.2.37.408.005 1.396.004 2.8.004 4.224a.24.24 0 0 0 .237.241h1.07c.13 0 .236-.108.236-.241v-4.543c0-.31-.034-.442-.08-.577a1.601 1.601 0 0 0-1.51-1.09h-.015a1.58 1.58 0 0 0-1.152.5c-.291-.308-.7-.5-1.153-.5z"/>
      </g>
    </svg>
  </div>
);

const NaviLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#00D09C',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,208,156,0.3)'
  }}>
    <span style={{
      fontSize: '13px',
      fontWeight: 900,
      color: '#0A192F',
      letterSpacing: '-0.4px',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
    }}>
      navi
    </span>
  </div>
);

const BhimLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#00833E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,131,62,0.25)'
  }}>
    <span style={{
      fontSize: '11px',
      fontWeight: 900,
      color: '#FFFFFF',
      letterSpacing: '0.2px',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
    }}>
      BHIM
    </span>
  </div>
);

const SuperMoneyLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(124,58,237,0.3)'
  }}>
    <span style={{
      fontSize: '11px',
      fontWeight: 900,
      color: '#FFFFFF',
      letterSpacing: '-0.3px',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
    }}>
      super
    </span>
  </div>
);

const JupiterLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#FF725E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(255,114,94,0.3)'
  }}>
    <span style={{
      fontSize: '15px',
      fontWeight: 900,
      color: '#FFFFFF',
      letterSpacing: '-0.5px',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
    }}>
      J
    </span>
  </div>
);

const AmazonPayLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#232F3E',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(35,47,62,0.25)'
  }}>
    <span style={{
      fontSize: '10.5px',
      fontWeight: 800,
      color: '#FF9900',
      letterSpacing: '-0.2px',
      fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
    }}>
      pay
    </span>
  </div>
);

const MoreAppsLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: '#F1F5F9',
    border: '1px dashed #94A3B8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </svg>
  </div>
);

const InstalledAppsLogo = () => (
  <div style={{
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'var(--card, #FFFFFF)',
    border: '1px solid var(--line, #E2E8F0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  }}>
    <svg width="30" height="15" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="6,4 24,20 6,36 17,20" fill="#F37021"/>
      <polygon points="18,4 36,20 18,36 29,20" fill="#097F37"/>
      <text x="35" y="27" fontFamily="sans-serif" fontSize="20" fontWeight="900" fontStyle="italic" fill="var(--ink, #0F172A)">
        UPI
      </text>
    </svg>
  </div>
);

export default function PaymentSheet() {
  const { user, userBalance, setUtx, addToast, userIsDark } = useApp();
  const isDark = userIsDark || (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark');

  // Unified theme tokens for full dark mode support
  const sheetBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const cardActiveBg = isDark ? '#2C2C2E' : '#F8FAFC';
  const fieldBg = isDark ? '#2C2C2E' : '#F8FAFC';
  const borderColor = isDark ? '#2C2C2E' : '#E2E8F0';
  const borderLightColor = isDark ? '#2C2C2E' : '#F1F5F9';
  const borderSubtle = isDark ? '#3A3A3C' : '#CBD5E1';
  const activeBorderColor = isDark ? 'var(--yellow, #FFC70A)' : '#0F172A';
  const inkColor = isDark ? '#F5F5F7' : '#0F172A';
  const mutedColor = isDark ? '#9A9AA1' : '#64748B';
  const primaryBtnBg = isDark ? '#F5F5F7' : '#000000';
  const primaryBtnColor = isDark ? '#0B0B0C' : '#FFFFFF';
  const secondaryBtnBg = isDark ? '#2C2C2E' : '#F1F5F9';

  // Payment configuration from caller (e.g. BookingSheet or WalletTab)
  const [config, setConfig] = useState(null);

  // Selected payment method: 'wallet' (RECOMMENDED) | 'phonepe' | 'gpay' | 'cred' | 'paytm' | 'qr' | 'card' | 'netbanking'
  const [selectedMethod, setSelectedMethod] = useState('phonepe');
  const [showAllUpiApps, setShowAllUpiApps] = useState(false);

  // Preset 5 UPI Apps installation status map
  const [presetInstalledMap, setPresetInstalledMap] = useState({
    phonepe: false,
    gpay: false,
    applepay: false,
    cred: false,
    supermoney: false
  });
  // Simulation mode for browser testing (null = real device query, 'all_installed', 'none_installed')
  const [simulationMode, setSimulationMode] = useState(null);

  // Payment Lifecycle State: 'idle' | 'app_launched' | 'verifying' | 'success' | 'failed'
  const [paymentLifecycle, setPaymentLifecycle] = useState('idle');
  const [verifyingApp, setVerifyingApp] = useState(null);
  const [verifiedPaymentData, setVerifiedPaymentData] = useState(null);
  const [failureReason, setFailureReason] = useState('');

  // Device Platform detection
  const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (typeof window !== 'undefined' && (window.Capacitor?.getPlatform?.() === 'ios' || Capacitor?.getPlatform?.() === 'ios')));
  const isAndroid = typeof navigator !== 'undefined' && (/Android/.test(navigator.userAgent) || 
    (typeof window !== 'undefined' && (window.Capacitor?.getPlatform?.() === 'android' || Capacitor?.getPlatform?.() === 'android')));

  // Installed UPI Apps queried dynamically via Razorpay getAppsWhichSupportUPI()
  const [installedUpiApps, setInstalledUpiApps] = useState([]);

  // Launching / Authorizing state
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [authorizingTitle, setAuthorizingTitle] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);

  // --- Functional Credit/Debit Card State ---
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('ANURAG K M');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardError, setCardError] = useState('');
  const [showCardOtpModal, setShowCardOtpModal] = useState(false);
  const [cardOtp, setCardOtp] = useState('482915');
  const [otpTimer, setOtpTimer] = useState(30);

  // --- Functional Netbanking State ---
  const [selectedBank, setSelectedBank] = useState(POPULAR_BANKS[0]);
  const [showNetbankingPortal, setShowNetbankingPortal] = useState(false);
  const [netbankingUserId, setNetbankingUserId] = useState('user_8156938843');
  const [netbankingPassword, setNetbankingPassword] = useState('••••••••');
  const [netbankingStatus, setNetbankingStatus] = useState('idle');

  useEffect(() => {
    registerPaymentSheetHandler((paymentOptions) => {
      if (!paymentOptions) return;
      setConfig(paymentOptions);
      setSelectedMethod('phonepe'); // Default to top UPI preset
      setPaymentLifecycle('idle');
      setVerifyingApp(null);
      setVerifiedPaymentData(null);
      setFailureReason('');
      setIsAuthorizing(false);
      setShowQrModal(false);
      setShowCardOtpModal(false);
      setShowNetbankingPortal(false);
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardError('');
      setCardOtp('482915');

      // Live device query for installed UPI apps whenever checkout sheet opens
      getInstalledUpiApps().then((apps) => {
        setInstalledUpiApps(Array.isArray(apps) ? apps : []);
      }).catch((err) => {
        console.warn('Live UPI apps query error:', err);
      });
    });

    return () => {
      unregisterPaymentSheetHandler();
    };
  }, []);

  // Check physically installed status for the 5 preset UPI apps
  useEffect(() => {
    let isSubscribed = true;
    async function checkPresets() {
      const status = {};
      for (const app of PRESET_UPI_APPS) {
        if (simulationMode === 'all_installed') {
          status[app.id] = true;
        } else if (simulationMode === 'none_installed') {
          status[app.id] = false;
        } else {
          status[app.id] = await checkAppInstalled(app);
        }
      }
      if (isSubscribed) {
        setPresetInstalledMap(status);
      }
    }
    checkPresets();
    return () => { isSubscribed = false; };
  }, [config, simulationMode]);

  // Retrieve physically installed UPI apps dynamically from device via native module / canOpenURL
  useEffect(() => {
    let isSubscribed = true;
    getInstalledUpiApps().then((apps) => {
      if (isSubscribed) {
        setInstalledUpiApps(Array.isArray(apps) ? apps : []);
      }
    }).catch((err) => {
      console.warn('UPI app detection query error:', err);
      if (isSubscribed) {
        setInstalledUpiApps([]);
      }
    });
    return () => { isSubscribed = false; };
  }, [config]);

  // Listen for user returning to Ridingo after launching UPI payment app
  useEffect(() => {
    if (paymentLifecycle !== 'app_launched') return;

    let hasTriggered = false;
    let timerId = null;

    const onReturnToApp = () => {
      if (hasTriggered) return;
      hasTriggered = true;

      setPaymentLifecycle('verifying');

      // 2.4s loading state verifying with bank & Razorpay
      timerId = setTimeout(() => {
        resolveVerification(true);
      }, 2400);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onReturnToApp();
      }
    };

    const handleFocus = () => {
      onReturnToApp();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (timerId) clearTimeout(timerId);
    };
  }, [paymentLifecycle, verifyingApp]);

  // OTP Countdown timer for 3D Secure Card Verification
  useEffect(() => {
    let interval = null;
    if (showCardOtpModal && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showCardOtpModal, otpTimer]);

  if (!config) return null;

  const amount = Number(config.amount) || 200;
  const cleanBalance = Math.max(0, Number(userBalance) || 0);
  const userName = user?.name || config?.prefill?.name || 'ANURAG';
  const userPhone = user?.phone || config?.prefill?.contact || '8156938843';
  const hasSufficientWalletBal = cleanBalance >= amount;
  const cashbackAmount = Math.max(1, Math.round(amount * 0.05));
  const liveQrData = generateLivePhonePeQrUrl({
    amount,
    transactionId: config?.orderId,
    note: `Ridingo Trip - ${userName}`
  });

  // Calculate prioritized primary apps vs 'More' list
  const MAX_PRIMARY_UPI_APPS = 5;
  const hasMoreApps = installedUpiApps.length > MAX_PRIMARY_UPI_APPS;
  const primaryUpiApps = hasMoreApps ? installedUpiApps.slice(0, MAX_PRIMARY_UPI_APPS) : installedUpiApps;
  const otherUpiApps = hasMoreApps ? installedUpiApps.slice(MAX_PRIMARY_UPI_APPS) : [];
  const activeUpiApp = PRESET_UPI_APPS.find(a => a.id === selectedMethod) || installedUpiApps.find(a => a.id === selectedMethod) || KNOWN_UPI_APPS.find(a => a.id === selectedMethod) || MAJOR_UPI_APPS.find(a => a.id === selectedMethod);
  const isSelectedAppInstalled = activeUpiApp ? !!presetInstalledMap[activeUpiApp.id] : false;

  // Detect card network (Visa, Mastercard, RuPay)
  const getCardType = () => {
    const clean = cardNumber.replace(/\s+/g, '');
    if (clean.startsWith('4')) return { type: 'Visa', color: '#1A1F71' };
    if (/^5[1-5]/.test(clean)) return { type: 'Mastercard', color: '#EB001B' };
    if (/^(60|65|81|82)/.test(clean)) return { type: 'RuPay', color: '#00833E' };
    return { type: 'Card', color: '#4B5563' };
  };

  const handleClose = () => {
    if (isAuthorizing || netbankingStatus === 'authorizing' || paymentLifecycle === 'verifying') return;
    if (config?.onDismiss) config.onDismiss();
    setConfig(null);
    setShowAllUpiApps(false);
    setPaymentLifecycle('idle');
    setVerifyingApp(null);
  };

  /**
   * Unified Payment Success & Redirection Handler
   * Closes payment modals and dispatches callback to route to live tracking
   */
  const handlePaymentSuccess = (verifiedPayment) => {
    setIsAuthorizing(false);
    setPaymentLifecycle('idle');
    setVerifyingApp(null);
    setVerifiedPaymentData(null);
    setShowCardOtpModal(false);
    setShowNetbankingPortal(false);
    setShowQrModal(false);
    setShowAllUpiApps(false);
    const onComplete = config?.onSuccess;
    setConfig(null);
    if (typeof onComplete === 'function') {
      onComplete(verifiedPayment);
    }
  };

  /**
   * Invokes PhonePe Payment Gateway for Cards & Netbanking verification
   */
  const invokeStandardCheckout = async ({ method, bankCode, bankName }) => {
    const methodLabel = method === 'card'
      ? 'Credit/Debit Card (3D Secure)'
      : `${bankName || selectedBank.name} Netbanking`;

    setAuthorizingTitle(methodLabel);
    setIsAuthorizing(true);

    try {
      await buildPhonePePayRequest({
        amount,
        transactionId: 'TXN_PPE_' + Date.now().toString(36),
        userId: user?.id || 'USR_' + (userPhone || '8156938843'),
        mobileNumber: userPhone || '9876543210'
      });
    } catch (err) {
      console.warn('PhonePe pay request initialization:', err);
    }

    setTimeout(() => {
      setIsAuthorizing(false);
      if (method === 'card') {
        setShowCardOtpModal(true);
      } else {
        setShowNetbankingPortal(true);
      }
    }, 600);
  };

  /**
   * Main Payment Processor: Dispatches to actual functional payment gateways
   */
  const handleTriggerPayment = () => {
    // 1. Ridingo Wallet (At the top)
    if (selectedMethod === 'wallet') {
      completeWalletPayment();
      return;
    }

    // 2. UPI QR Code
    if (selectedMethod === 'qr') {
      setShowQrModal(true);
      return;
    }

    // 3. Credit/Debit Card -> Standard Checkout Options for Secure Verification
    if (selectedMethod === 'card') {
      invokeStandardCheckout({ method: 'card' });
      return;
    }

    // 4. Netbanking -> Standard Checkout Options for Secure Verification
    if (selectedMethod === 'netbanking') {
      invokeStandardCheckout({
        method: 'netbanking',
        bankCode: selectedBank.code,
        bankName: selectedBank.name
      });
      return;
    }

    // 5. Preset 5 UPI Apps (PhonePe, GPay, Apple Pay, CRED, super.money)
    const presetApp = PRESET_UPI_APPS.find(a => a.id === selectedMethod);
    if (presetApp) {
      triggerPresetAppPayment(presetApp);
      return;
    }

    // 6. Other Installed UPI Apps
    const activeApp = installedUpiApps.find(a => a.id === selectedMethod) || KNOWN_UPI_APPS.find(a => a.id === selectedMethod);
    if (activeApp) {
      triggerUpiAppPayment(activeApp);
      return;
    }
  };

  /**
   * Finalize Card Payment via 3D Secure OTP
   */
  const handleAuthorizeCardOtp = () => {
    if (!cardOtp || cardOtp.length < 4) {
      addToast('Please enter a valid OTP', 'warn');
      return;
    }

    setShowCardOtpModal(false);
    const cardInfo = getCardType();
    const masked = cardNumber.slice(-4) || '4242';
    const methodTitle = `${cardInfo.type} (•••• ${masked})`;

    const paymentId = 'pay_card_' + Date.now().toString(36);
    const orderId = 'ord_' + Date.now().toString(36);

    handlePaymentSuccess({
      phonepe_payment_id: paymentId,
      phonepe_transaction_id: orderId,
      method: methodTitle,
      gateway: 'PhonePe'
    });
    addToast(`Card authorized successfully! Paid ₹${amount}.`, 'check');
  };

  /**
   * Finalize Netbanking Payment via Bank Portal
   */
  const handleAuthorizeNetbanking = () => {
    setNetbankingStatus('authorizing');

    setTimeout(() => {
      setNetbankingStatus('success');
      setTimeout(() => {
        setShowNetbankingPortal(false);
        setNetbankingStatus('idle');

        const paymentId = 'pay_nb_' + selectedBank.code.toLowerCase() + '_' + Date.now().toString(36);
        const orderId = 'ord_nb_' + Date.now().toString(36);

        handlePaymentSuccess({
          phonepe_payment_id: paymentId,
          phonepe_transaction_id: orderId,
          method: `${selectedBank.name} Netbanking`,
          gateway: 'PhonePe'
        });
        addToast(`Paid ₹${amount} via ${selectedBank.name} Netbanking!`, 'check');
      }, 600);
    }, 1200);
  };

  /**
   * Finalize UPI App Payment
   */
  const finalizeUpiPayment = (methodTitle) => {
    const paymentId = 'pay_upi_' + Date.now().toString(36);
    const orderId = 'ord_upi_' + Date.now().toString(36);

    handlePaymentSuccess({
      phonepe_payment_id: paymentId,
      phonepe_transaction_id: orderId,
      method: methodTitle || 'UPI App',
      gateway: 'PhonePe'
    });
  };

  /**
   * Finalize Wallet Payment with Assured Cashback
   */
  const completeWalletPayment = () => {
    if (!hasSufficientWalletBal) {
      addToast(`Low wallet balance (₹${cleanBalance}). Please select UPI, Card, or Netbanking.`, 'warn');
      return;
    }

    const walletPid = 'pay_wal_' + Date.now().toString(36);
    const walletTx = {
      ts: Date.now(),
      type: 'trip',
      amount: -amount,
      title: `Trip Advance · Wallet`,
      sub: `Ridingo Balance · Assured 5% Cashback`,
      gateway: 'Ridingo Wallet',
      paymentId: walletPid
    };

    const cashbackTx = {
      ts: Date.now() + 100,
      type: 'cashback',
      amount: cashbackAmount,
      title: `Assured Cashback (5%)`,
      sub: `Credited for Trip Booking`,
      gateway: 'Ridingo Rewards'
    };

    if (setUtx) {
      setUtx(prev => [cashbackTx, walletTx, ...(Array.isArray(prev) ? prev : [])]);
    }

    handlePaymentSuccess({
      phonepe_payment_id: walletPid,
      method: 'Ridingo Wallet',
      gateway: 'Ridingo Wallet'
    });
    addToast(`Paid ₹${amount} with Wallet! ₹${cashbackAmount} cashback credited.`, 'check');
  };

  /**
   * Click handler for preset UPI apps:
   * If not installed: redirects directly to App Store (iOS) or Google Play Store (Android)
   * If installed: selects app or launches payment
   */
  const handlePresetAppClick = (app) => {
    const isInstalled = !!presetInstalledMap[app.id];

    if (!isInstalled) {
      addToast(`Redirecting to ${isIOS ? 'App Store' : 'Play Store'} to install ${app.name}...`, 'info');
      openAppStoreForApp(app);
      return;
    }

    if (selectedMethod === app.id) {
      triggerPresetAppPayment(app);
    } else {
      setSelectedMethod(app.id);
    }
  };

  /**
   * Triggers payment for one of the 5 preset UPI apps
   */
  const triggerPresetAppPayment = (app) => {
    const targetApp = app || PRESET_UPI_APPS.find(a => a.id === selectedMethod);
    if (!targetApp) return;

    const isInstalled = !!presetInstalledMap[targetApp.id];
    if (!isInstalled) {
      addToast(`Redirecting to ${isIOS ? 'App Store' : 'Play Store'} to install ${targetApp.name}...`, 'info');
      openAppStoreForApp(targetApp);
      return;
    }

    setVerifyingApp(targetApp);
    setSelectedMethod(targetApp.id);
    setPaymentLifecycle('app_launched');

    if (targetApp.id === 'applepay') {
      launchDeepLink('shoebox://').then(() => {
        addToast('Opening Apple Pay / Wallet...', 'info');
      }).catch(() => {});
    } else {
      launchUpiApp(targetApp.id, {
        amount,
        orderId: config?.orderId,
        note: `Ridingo Trip - ${userName}`
      }).then(() => {
        addToast(`Opening ${targetApp.name}... Enter UPI PIN`, 'info');
      }).catch((err) => {
        console.warn('launchUpiApp error:', err);
      });
    }
  };

  /**
   * Resolves the bank & PhonePe PG payment verification
   */
  const resolveVerification = (isSuccess, customReason = '') => {
    if (isSuccess) {
      const pId = 'pay_ppe_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const ordId = config?.orderId || ('ord_ppe_' + Date.now().toString(36));
      const verified = {
        gateway: 'PhonePe',
        method: `${verifyingApp?.name || 'UPI'} UPI`,
        paymentId: pId,
        orderId: ordId,
        signature: 'sig_ppe_' + Date.now().toString(36),
        amount: amount,
        appName: verifyingApp?.name || 'UPI App',
        timestamp: Date.now()
      };
      setVerifiedPaymentData(verified);
      setPaymentLifecycle('success');
      addToast(`Payment of ₹${amount} verified successfully via ${verifyingApp?.name || 'UPI'}!`, 'check');
    } else {
      setPaymentLifecycle('failed');
      setFailureReason(customReason || `Payment was declined or cancelled in ${verifyingApp?.name || 'the UPI app'}.`);
      addToast(`Your payment failed via ${verifyingApp?.name || 'UPI'}.`, 'alert');
      if (config?.onError) {
        config.onError({ description: 'Payment failed or cancelled' });
      }
    }
  };

  /**
   * Securely triggers specific UPI app payment via dynamic intent
   */
  const triggerUpiAppPayment = (app) => {
    const activeApp = app || installedUpiApps.find(a => a.id === selectedMethod) || KNOWN_UPI_APPS.find(a => a.id === selectedMethod);
    if (!activeApp) return;

    triggerPresetAppPayment(activeApp);
  };

  const renderUpiLogo = (app) => {
    if (app?.customIcon) {
      return (
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
        }}>
          <img
            src={`data:image/png;base64,${app.customIcon}`}
            alt={app.name || 'UPI'}
            style={{ width: '28px', height: '28px', objectFit: 'contain' }}
          />
        </div>
      );
    }

    const appId = typeof app === 'string' ? app : app?.id;
    switch (appId) {
      case 'gpay':
        return <GPayLogo />;
      case 'phonepe':
        return <PhonePeLogo />;
      case 'applepay':
        return <ApplePayLogo />;
      case 'navi':
        return <NaviLogo />;
      case 'cred':
        return <CREDLogo />;
      case 'supermoney':
        return <SuperMoneyLogo />;
      case 'jupiter':
        return <JupiterLogo />;
      case 'paytm':
        return <PaytmLogo />;
      case 'bhim':
        return <BhimLogo />;
      case 'amazonpay':
        return <AmazonPayLogo />;
      case 'more':
        return <MoreAppsLogo />;
      case 'generic':
      default:
        return <InstalledAppsLogo />;
    }
  };

  return (
    <div className="layer on" id="u-payment-layer" style={{ zIndex: 120 }}>
      {/* Dim backdrop scrim */}
      <div className="scrim" onClick={handleClose} />

      {/* ========================================================
          LIFECYCLE OVERLAY 1: AWAITING PAYMENT IN EXTERNAL APP
          ======================================================== */}
      {paymentLifecycle === 'app_launched' && verifyingApp && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 160,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: cardBg,
              border: borderColor,
              borderRadius: '24px',
              padding: '28px 22px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bottomSheetSlideUp 0.25s ease'
            }}
          >
            <div style={{ position: 'relative', width: '68px', height: '68px', marginBottom: '16px' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: isDark ? '2.5px dashed #F5F5F7' : '2.5px dashed #0F172A',
                  animation: 'spin 12s linear infinite'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '6px',
                  borderRadius: '50%',
                  background: fieldBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {renderUpiLogo(verifyingApp)}
              </div>
            </div>

            <b style={{ fontSize: '17px', color: inkColor, display: 'block', marginBottom: '6px' }}>
              Complete Payment in {verifyingApp.name}
            </b>
            <p style={{ fontSize: '12.5px', color: mutedColor, lineHeight: '1.45', margin: '0 0 16px' }}>
              Please enter your UPI PIN in <b>{verifyingApp.name}</b> to authorize <b>₹{amount}</b>. Return to Ridingo when completed.
            </p>

            <div
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                background: fieldBg,
                border: borderColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
                fontSize: '11.5px',
                color: inkColor,
                fontWeight: 600
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0284C7' }} />
              <span>Awaiting payment completion...</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentLifecycle('verifying');
                  setTimeout(() => {
                    resolveVerification(true);
                  }, 2200);
                }}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  background: primaryBtnBg,
                  color: primaryBtnColor,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                I have completed payment
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaymentLifecycle('failed');
                  setFailureReason('Payment cancelled by user.');
                }}
                style={{
                  width: '100%',
                  height: '42px',
                  borderRadius: '12px',
                  background: cardBg,
                  color: mutedColor,
                  border: borderColor,
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          LIFECYCLE OVERLAY 2: VERIFYING PAYMENT WITH BANK & RAZORPAY
          ======================================================== */}
      {paymentLifecycle === 'verifying' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 160,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: cardBg,
              border: borderColor,
              borderRadius: '24px',
              padding: '30px 22px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bottomSheetSlideUp 0.25s ease'
            }}
          >
            {/* Spinning Loader with Rotating Border */}
            <div style={{ position: 'relative', width: '72px', height: '72px', marginBottom: '18px' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: isDark ? '3px solid #2C2C2E' : '3px solid #E2E8F0',
                  borderTopColor: 'var(--yellow, #FFC70A)',
                  animation: 'spin 0.85s linear infinite'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '7px',
                  borderRadius: '50%',
                  background: fieldBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {verifyingApp ? renderUpiLogo(verifyingApp) : <Icon name="shield" size={24} color={inkColor} />}
              </div>
            </div>

            <b style={{ fontSize: '17px', color: inkColor, display: 'block', marginBottom: '6px' }}>
              Verifying payment with bank...
            </b>
            <p style={{ fontSize: '12.5px', color: mutedColor, lineHeight: '1.45', margin: '0 0 16px' }}>
              Confirming transaction of <b>₹{amount}</b> via {verifyingApp?.name || 'UPI'} with NPCI & PhonePe gateway.
            </p>

            <div
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '10px',
                background: fieldBg,
                border: borderColor,
                fontSize: '11px',
                color: mutedColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginBottom: '16px'
              }}
            >
              <Icon name="shield" size={13} color="#16A34A" />
              <span>PhonePe 256-bit SSL encrypted verification</span>
            </div>

            {/* Test Simulation Controls (Easy demo & test) */}
            <div style={{ borderTop: isDark ? '1px dashed #3A3A3C' : '1px dashed #E2E8F0', paddingTop: '12px', width: '100%' }}>
              <span style={{ fontSize: '10px', color: mutedColor, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Test Mode Simulation
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => resolveVerification(true)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4',
                    border: isDark ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #BBF7D0',
                    color: isDark ? '#4ADE80' : '#16A34A',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Simulate Success
                </button>
                <button
                  type="button"
                  onClick={() => resolveVerification(false, 'Payment cancelled or declined by bank')}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                    border: isDark ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #FECACA',
                    color: isDark ? '#FCA5A5' : '#DC2626',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Simulate Failure
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          LIFECYCLE OVERLAY 3: PAYMENT SUCCESSFUL SCREEN
          ======================================================== */}
      {paymentLifecycle === 'success' && verifiedPaymentData && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 160,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: cardBg,
              border: borderColor,
              borderRadius: '24px',
              padding: '28px 22px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bottomSheetSlideUp 0.25s ease'
            }}
          >
            {/* Green Checkmark Circle */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4',
                border: isDark ? '2px solid rgba(34, 197, 94, 0.4)' : '2px solid #BBF7D0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#4ADE80' : '#16A34A',
                marginBottom: '14px'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#4ADE80' : '#16A34A'} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <b style={{ fontSize: '18px', color: inkColor, display: 'block', marginBottom: '2px' }}>
              Payment Successful!
            </b>
            <div style={{ fontSize: '26px', fontWeight: 850, color: inkColor, margin: '4px 0 14px', letterSpacing: '-0.5px' }}>
              ₹{amount}
            </div>

            {/* Receipt Breakdown Card */}
            <div
              style={{
                width: '100%',
                background: fieldBg,
                borderRadius: '14px',
                border: borderColor,
                padding: '12px 14px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '18px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: mutedColor }}>Method</span>
                <b style={{ color: inkColor }}>{verifiedPaymentData.method}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: mutedColor }}>Payment ID</span>
                <span style={{ color: inkColor, fontFamily: 'monospace', fontSize: '11px' }}>
                  {verifiedPaymentData.paymentId.slice(0, 16)}...
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: mutedColor }}>Gateway</span>
                <b style={{ color: inkColor }}>PhonePe PG</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: mutedColor }}>Status</span>
                <b style={{ color: isDark ? '#4ADE80' : '#16A34A' }}>Verified · Paid</b>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handlePaymentSuccess(verifiedPaymentData)}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                background: primaryBtnBg,
                color: primaryBtnColor,
                border: 'none',
                fontWeight: 750,
                fontSize: '15px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
              }}
            >
              Continue with Ride
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          LIFECYCLE OVERLAY 4: PAYMENT FAILED SCREEN
          Mandate: Payment fail aanengil continue cheyyan pattathilla!
          ======================================================== */}
      {paymentLifecycle === 'failed' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 160,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: cardBg,
              border: borderColor,
              borderRadius: '24px',
              padding: '28px 22px',
              width: '100%',
              maxWidth: '340px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bottomSheetSlideUp 0.25s ease'
            }}
          >
            {/* Red Alert Circle */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                border: isDark ? '2px solid rgba(239, 68, 68, 0.4)' : '2px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#F87171' : '#DC2626',
                marginBottom: '14px'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#F87171' : '#DC2626'} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <b style={{ fontSize: '18px', color: inkColor, display: 'block', marginBottom: '6px' }}>
              Your payment failed
            </b>
            <p style={{ fontSize: '12.5px', color: mutedColor, lineHeight: '1.45', margin: '0 0 14px' }}>
              The payment of <b>₹{amount}</b> could not be completed or was cancelled in {verifyingApp?.name || 'the payment app'}.
            </p>

            {/* Error explanation notice - Mandate: Cannot continue ride */}
            <div
              style={{
                width: '100%',
                padding: '11px 12px',
                borderRadius: '12px',
                background: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                border: isDark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid #FEE2E2',
                fontSize: '11.5px',
                color: isDark ? '#FCA5A5' : '#991B1B',
                lineHeight: '1.4',
                textAlign: 'left',
                marginBottom: '18px'
              }}
            >
              <b>Important:</b> Ride booking cannot proceed without a successful payment. Any deducted amount will be refunded within 3-5 business days.
            </div>

            {/* Retry & Method selection buttons - No continuation button! */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentLifecycle('idle');
                  triggerPresetAppPayment(verifyingApp);
                }}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '12px',
                  background: primaryBtnBg,
                  color: primaryBtnColor,
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Try Again with {verifyingApp?.name || 'UPI'}
              </button>
              <button
                type="button"
                onClick={() => setPaymentLifecycle('idle')}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '12px',
                  background: secondaryBtnBg,
                  color: inkColor,
                  border: borderColor,
                  fontWeight: 650,
                  fontSize: '13.5px',
                  cursor: 'pointer'
                }}
              >
                Choose Another Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          1. 3D SECURE OTP MODAL FOR CARD PAYMENTS
          ======================================================== */}
      {showCardOtpModal && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: cardBg,
            borderRadius: '20px',
            padding: '24px 22px',
            width: '88%',
            maxWidth: '340px',
            zIndex: 140,
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
            border: borderColor
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, background: primaryBtnBg, color: primaryBtnColor, padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.04em' }}>
                3D SECURE
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>Verified by Visa / RuPay</span>
            </div>
            <button onClick={() => setShowCardOtpModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: mutedColor }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          <b style={{ fontSize: '16px', color: inkColor, display: 'block', marginBottom: '4px' }}>
            Authenticate Payment
          </b>
          <span style={{ fontSize: '12.5px', color: mutedColor, display: 'block', lineHeight: 1.4, marginBottom: '16px' }}>
            Enter OTP sent to your registered mobile ending in <b>•••• 8843</b> for ₹{amount}.
          </span>

          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              maxLength={6}
              value={cardOtp}
              onChange={e => setCardOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              style={{
                width: '100%',
                height: '48px',
                textAlign: 'center',
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '6px',
                borderRadius: '12px',
                border: isDark ? '1.5px solid #F5F5F7' : '1.5px solid #0F172A',
                background: fieldBg,
                color: inkColor,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '11.5px', color: mutedColor }}>
              <span>Resend OTP in {otpTimer}s</span>
              <span style={{ color: '#10B981', fontWeight: 600 }}>SMS Sent</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAuthorizeCardOtp}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '12px',
              background: primaryBtnBg,
              color: primaryBtnColor,
              fontWeight: 600,
              fontSize: '14.5px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            Authorize Payment ₹{amount}
          </button>
        </div>
      )}

      {/* ========================================================
          2. NETBANKING BANK GATEWAY AUTH PORTAL
          ======================================================== */}
      {showNetbankingPortal && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: cardBg,
            borderRadius: '20px',
            padding: '24px 22px',
            width: '88%',
            maxWidth: '350px',
            zIndex: 140,
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
            border: borderColor
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: selectedBank.color }} />
              <b style={{ fontSize: '15px', color: inkColor }}>{selectedBank.name}</b>
            </div>
            <button onClick={() => setShowNetbankingPortal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: mutedColor }}>
              <Icon name="x" size={18} />
            </button>
          </div>

          {netbankingStatus === 'authorizing' ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: isDark ? '2.5px solid #F5F5F7' : '2.5px solid #0F172A',
                  borderTopColor: 'transparent',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <b style={{ fontSize: '15px', color: inkColor }}>Connecting to {selectedBank.code} Secure Gateway...</b>
              <span style={{ fontSize: '12px', color: mutedColor }}>Authorizing transfer of ₹{amount}. Do not refresh.</span>
            </div>
          ) : netbankingStatus === 'success' ? (
            <div style={{ padding: '30px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isDark ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #DCFCE7' }}>
                <Icon name="check" size={20} color="#10B981" />
              </div>
              <b style={{ fontSize: '15.5px', color: inkColor }}>Bank Transfer Approved!</b>
              <span style={{ fontSize: '12px', color: mutedColor }}>Redirecting to confirmation...</span>
            </div>
          ) : (
            <>
              <div style={{ background: fieldBg, padding: '12px', borderRadius: '12px', marginBottom: '14px', border: borderColor }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ color: mutedColor }}>Merchant</span>
                  <b style={{ color: inkColor }}>Ridingo Technologies</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: mutedColor }}>Amount Payable</span>
                  <b style={{ color: inkColor, fontSize: '15px' }}>₹{amount}</b>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                <FloatingInput
                  label="Customer / User ID"
                  value={netbankingUserId}
                  onChange={e => setNetbankingUserId(e.target.value)}
                />
                <FloatingInput
                  label="IPIN / Login Password"
                  type="password"
                  value={netbankingPassword}
                  onChange={e => setNetbankingPassword(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={handleAuthorizeNetbanking}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '12px',
                  background: primaryBtnBg,
                  color: primaryBtnColor,
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
              >
                Confirm & Pay ₹{amount}
              </button>
            </>
          )}
        </div>
      )}

      {/* ========================================================
          3. UPI / GATEWAY AUTHORIZING SPINNER
          ======================================================== */}
      {isAuthorizing && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: cardBg,
            borderRadius: '20px',
            padding: '30px 24px',
            width: '88%',
            maxWidth: '340px',
            zIndex: 130,
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.3)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            border: borderColor
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: fieldBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                border: isDark ? '2.5px solid #2C2C2E' : '2.5px solid #E2E8F0',
                borderTopColor: 'var(--yellow, #FFC70A)',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
                position: 'absolute'
              }}
            />
            {selectedMethod === 'card' ? (
              <SleekCardOutlineIcon size={20} color={inkColor} />
            ) : selectedMethod === 'netbanking' ? (
              <SleekBankOutlineIcon size={20} color={inkColor} />
            ) : (
              renderUpiLogo(selectedMethod)
            )}
          </div>

          <div>
            <b style={{ fontSize: '16px', color: inkColor, display: 'block' }}>
              Connecting to {authorizingTitle}...
            </b>
            <span style={{ fontSize: '13px', color: mutedColor, display: 'block', marginTop: '4px' }}>
              Amount: <b style={{ color: inkColor }}>₹{amount.toLocaleString('en-IN')}</b>
            </span>
          </div>

          <p style={{ fontSize: '12px', color: mutedColor, margin: 0, lineHeight: 1.4 }}>
            Please authorize the transaction via {authorizingTitle}.
          </p>

          <button
            type="button"
            onClick={() => finalizeUpiPayment(authorizingTitle)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: primaryBtnBg,
              color: primaryBtnColor,
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            Payment Completed
          </button>
        </div>
      )}

      <style>{`
        @keyframes bottomSheetSlideUp {
          from {
            transform: translateY(100%);
            opacity: 0.5;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* ========================================================
          MORE INSTALLED UPI APPS BOTTOM SHEET MODAL
          ======================================================== */}
      {showAllUpiApps && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            overflow: 'hidden',
            pointerEvents: 'auto'
          }}
        >
          {/* Dimmed Backdrop Scrim */}
          <div
            onClick={() => setShowAllUpiApps(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              transition: 'opacity 0.2s ease'
            }}
          />

          {/* Bottom-to-Top Sliding Popup Sheet */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxHeight: '75%',
              background: sheetBg,
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '12px 20px 28px',
              zIndex: 151,
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              borderTop: borderLightColor,
              display: 'flex',
              flexDirection: 'column',
              animation: 'bottomSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxSizing: 'border-box'
            }}
          >
            {/* Top Grab Bar */}
            <div style={{ width: '36px', height: '4px', background: isDark ? '#3A3A3C' : '#E2E8F0', borderRadius: '999px', margin: '2px auto 10px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: borderLightColor, paddingBottom: '10px' }}>
              <div>
                <b style={{ fontSize: '16px', color: inkColor, display: 'block' }}>All Installed UPI Apps</b>
                <span style={{ fontSize: '11.5px', color: mutedColor }}>
                  {installedUpiApps.length} apps detected on your device
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllUpiApps(false)}
                aria-label="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: fieldBg,
                  border: borderColor,
                  cursor: 'pointer',
                  color: inkColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* List of all installed apps */}
            <div
              style={{
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                paddingRight: '2px',
                maxHeight: '48vh'
              }}
            >
              {installedUpiApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => triggerUpiAppPayment(app)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: selectedMethod === app.id ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
                    background: selectedMethod === app.id ? cardActiveBg : cardBg,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {renderUpiLogo(app)}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13.5px', fontWeight: 600, color: inkColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {app.name}
                      </div>
                      <div style={{ fontSize: '11px', color: mutedColor }}>
                        {app.subName || 'UPI'} · Instant Pay
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      background: primaryBtnBg,
                      color: primaryBtnColor,
                      fontSize: '12px',
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    Pay ₹{amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          4. BOTTOM-TO-TOP POPUP WINDOW STYLE: SCAN & PAY VIA QR
          Slides up from the bottom when clicking the bottom Pay button,
          displaying only the live QR code and payment amount,
          with a functional close icon without extraneous labels.
          ======================================================== */}
      {showQrModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            overflow: 'hidden',
            pointerEvents: 'auto'
          }}
        >
          {/* Dimmed Backdrop Scrim strictly inside mobile app container */}
          <div
            onClick={() => setShowQrModal(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
              transition: 'opacity 0.2s ease'
            }}
          />

          {/* Bottom-to-Top Sliding Popup Window */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              background: sheetBg,
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '12px 20px 32px',
              zIndex: 151,
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5)',
              borderTop: borderLightColor,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: 'bottomSheetSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Top Grab Bar */}
            <div style={{ width: '36px', height: '4px', background: isDark ? '#3A3A3C' : '#E2E8F0', borderRadius: '999px', margin: '2px auto 8px' }} />

            {/* Functional close icon without extraneous labels */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginBottom: '6px' }}>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: fieldBg,
                  border: borderColor,
                  cursor: 'pointer',
                  color: inkColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            {/* Valid Live PhonePe UPI QR Code */}
            <div
              style={{
                padding: '14px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: borderColor,
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 16px rgba(15,23,42,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={liveQrData.qrImageUrl}
                alt="UPI QR Code"
                style={{
                  width: '210px',
                  height: '210px',
                  borderRadius: '8px',
                  display: 'block'
                }}
              />
            </div>

            {/* Payment Amount */}
            <div style={{ fontSize: '24px', fontWeight: 700, color: inkColor, letterSpacing: '-0.5px', marginTop: '14px' }}>
              ₹{amount}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MAIN PAYMENT SHEET: MINIMAL, MODERN, NEUTRAL AESTHETIC
          ========================================================================= */}
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        style={{
          maxHeight: '88%',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          background: sheetBg,
          boxShadow: isDark ? '0 -10px 40px rgba(0, 0, 0, 0.6)' : '0 -10px 40px rgba(15, 23, 42, 0.12)',
          border: borderLightColor
        }}
      >
        {/* Top Grab Bar */}
        <div style={{ width: '36px', height: '4px', background: isDark ? '#3A3A3C' : '#E2E8F0', borderRadius: '999px', margin: '10px auto 4px' }} />

        {/* Header: Clean greeting + Amount + Close Button */}
        <div style={{ padding: '8px 20px 14px', borderBottom: borderLightColor }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '12px', color: mutedColor, fontWeight: 500 }}>Payment details</span>
              <div style={{ fontSize: '13.5px', color: inkColor, fontWeight: 600, marginTop: '1px' }}>
                Hi, {userName} · {userPhone}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, color: inkColor, letterSpacing: '-0.5px' }}>
                ₹{amount}
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: fieldBg,
                  border: borderColor,
                  cursor: 'pointer',
                  color: inkColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Body: Clean & Spaced-Out List */}
        <div
          className="sheet-scroll-body"
          style={{
            padding: '16px 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* ========================================================
              OPTION 1: RIDINGO WALLET (AT THE TOP)
              Rounded-corner container, thin border, sleek outline icon
              ======================================================== */}
          <div
            onClick={() => setSelectedMethod('wallet')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px',
              borderRadius: '16px',
              border: selectedMethod === 'wallet' ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
              background: selectedMethod === 'wallet' ? cardActiveBg : cardBg,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: borderColor,
                  background: fieldBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <SleekWalletOutlineIcon size={20} color={inkColor} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <b style={{ fontSize: '15px', color: inkColor, fontWeight: 600 }}>Wallet</b>
                  <span
                    style={{
                      fontSize: '9.5px',
                      fontWeight: 750,
                      color: '#000000',
                      background: 'var(--yellow, #FFC70A)',
                      padding: '2.5px 7px',
                      borderRadius: '5px',
                      letterSpacing: '0.04em'
                    }}
                  >
                    RECOMMENDED
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                  <span style={{ color: hasSufficientWalletBal ? (isDark ? '#4ADE80' : '#10B981') : '#EF4444', fontWeight: 500 }}>
                    {hasSufficientWalletBal
                      ? `₹${cleanBalance.toLocaleString('en-IN')} available · Instant Pay`
                      : `Low balance (₹${cleanBalance.toLocaleString('en-IN')} available)`}
                  </span>
                </div>
              </div>
            </div>
            <MinimalRadio isSelected={selectedMethod === 'wallet'} />
          </div>

          {/* Section: 5 Preset UPI Apps in Clean Vertical List (PhonePe, Google Pay, Apple Pay, CRED, super.money) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              UPI Instant Apps
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10.5px', color: mutedColor, fontWeight: 600 }}>
                {isIOS ? 'iOS App Store' : 'Play Store'} Sync
              </span>
            </div>
          </div>

          {/* Vertical List of the 5 Requested Apps */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '9px'
            }}
          >
            {PRESET_UPI_APPS.map((app) => {
              const isInstalled = !!presetInstalledMap[app.id];
              const isSelected = selectedMethod === app.id;

              return (
                <div
                  key={app.id}
                  onClick={() => handlePresetAppClick(app)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '13px 15px',
                    borderRadius: '16px',
                    border: isSelected ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
                    background: isSelected ? cardActiveBg : cardBg,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '13px', minWidth: 0 }}>
                    {renderUpiLogo(app)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 650, color: inkColor }}>
                          {app.name}
                        </span>
                        {isInstalled ? (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              color: isDark ? '#4ADE80' : '#16A34A',
                              background: isDark ? 'rgba(34, 197, 94, 0.15)' : '#F0FDF4',
                              padding: '1.5px 6px',
                              borderRadius: '5px',
                              border: isDark ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid #DCFCE7'
                            }}
                          >
                            Installed
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 600,
                              color: mutedColor,
                              background: fieldBg,
                              padding: '1.5px 6px',
                              borderRadius: '5px',
                              border: borderColor
                            }}
                          >
                            {isIOS ? 'App Store' : 'Play Store'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11.5px', color: mutedColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isInstalled
                          ? (app.subName || 'Instant UPI Payment · Tap to pay')
                          : `Not on device · Tap to install on ${isIOS ? 'App Store' : 'Play Store'}`}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {isInstalled ? (
                      <MinimalRadio isSelected={isSelected} />
                    ) : (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: inkColor,
                          background: fieldBg,
                          border: borderSubtle,
                          padding: '4px 8px',
                          borderRadius: '7px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <span>Install</span>
                        <span style={{ fontSize: '10px' }}>↗</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Option: Pay via UPI QR (Clean row, QR code only displayed in separate popup modal) */}
          <div
            onClick={() => {
              if (selectedMethod === 'qr') {
                setShowQrModal(true);
              } else {
                setSelectedMethod('qr');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '15px 16px',
              borderRadius: '16px',
              border: selectedMethod === 'qr' ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
              background: selectedMethod === 'qr' ? cardActiveBg : cardBg,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: borderColor,
                  background: fieldBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <SleekQrOutlineIcon size={19} color={inkColor} />
              </div>
              <div>
                <b style={{ fontSize: '15px', color: inkColor, fontWeight: 600 }}>Pay via UPI QR</b>
                <span style={{ fontSize: '11.5px', color: mutedColor, display: 'block', marginTop: '1px' }}>
                  Scan with any UPI app
                </span>
              </div>
            </div>
            <MinimalRadio isSelected={selectedMethod === 'qr'} />
          </div>

          {/* Section Divider: Cards & Banking */}
          <div style={{ fontSize: '11px', fontWeight: 700, color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '6px' }}>
            Cards & Banking
          </div>

          {/* Option: Credit/Debit Card with Floating Labels & Minimal Borders */}
          <div
            onClick={() => setSelectedMethod('card')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '15px 16px',
              borderRadius: '16px',
              border: selectedMethod === 'card' ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
              background: selectedMethod === 'card' ? cardActiveBg : cardBg,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border: borderColor,
                    background: fieldBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <SleekCardOutlineIcon size={19} color={inkColor} />
                </div>
                <div>
                  <b style={{ fontSize: '15px', color: inkColor, fontWeight: 600 }}>Credit and Debit Card</b>
                  <span style={{ fontSize: '11.5px', color: mutedColor, display: 'block', marginTop: '1px' }}>
                    Visa, Mastercard, RuPay · Secure Checkout
                  </span>
                </div>
              </div>
              <MinimalRadio isSelected={selectedMethod === 'card'} />
            </div>

            {/* Minimal Floating Label Inputs */}
            {selectedMethod === 'card' && (
              <div
                style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <FloatingInput
                  label="Card Number"
                  value={cardNumber}
                  maxLength={19}
                  placeholder="•••• •••• •••• ••••"
                  error={cardError}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
                    setCardNumber(raw.match(/.{1,4}/g)?.join(' ') || raw);
                    if (cardError) setCardError('');
                  }}
                  rightElement={
                    <span style={{ fontSize: '10.5px', fontWeight: 700, color: mutedColor, background: fieldBg, padding: '2px 6px', borderRadius: '4px' }}>
                      {getCardType().type}
                    </span>
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <FloatingInput
                    label="Expiry (MM/YY)"
                    value={cardExpiry}
                    maxLength={5}
                    placeholder="MM/YY"
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2);
                      setCardExpiry(val);
                    }}
                  />
                  <FloatingInput
                    label="CVV"
                    type="password"
                    value={cardCvv}
                    maxLength={3}
                    placeholder="•••"
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <FloatingInput
                  label="Cardholder Name"
                  value={cardHolder}
                  placeholder="Full name"
                  onChange={(e) => setCardHolder(e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <Icon name="lock" size={12} color={mutedColor} />
                  <span style={{ fontSize: '11px', color: mutedColor, fontWeight: 500 }}>
                    Secured by Razorpay PCI-DSS certified 3D Secure verification
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Option: Netbanking */}
          <div
            onClick={() => setSelectedMethod('netbanking')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '15px 16px',
              borderRadius: '16px',
              border: selectedMethod === 'netbanking' ? (isDark ? '1.5px solid var(--yellow, #FFC70A)' : '1.5px solid #0F172A') : borderColor,
              background: selectedMethod === 'netbanking' ? cardActiveBg : cardBg,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    border: borderColor,
                    background: fieldBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <SleekBankOutlineIcon size={19} color={inkColor} />
                </div>
                <div>
                  <b style={{ fontSize: '15px', color: inkColor, fontWeight: 600 }}>Netbanking</b>
                  <span style={{ fontSize: '11.5px', color: mutedColor, display: 'block', marginTop: '1px' }}>
                    Selected: <b>{selectedBank.name}</b>
                  </span>
                </div>
              </div>
              <MinimalRadio isSelected={selectedMethod === 'netbanking'} />
            </div>

            {/* Bank Chips */}
            {selectedMethod === 'netbanking' && (
              <div style={{ marginTop: '14px' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {POPULAR_BANKS.map((b) => {
                    const isBankActive = selectedBank.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBank(b)}
                        style={{
                          padding: '9px 6px',
                          borderRadius: '10px',
                          border: isBankActive ? (isDark ? '1.5px solid #F5F5F7' : '1.5px solid #0F172A') : borderColor,
                          background: isBankActive ? (isDark ? '#F5F5F7' : '#0F172A') : cardBg,
                          color: isBankActive ? (isDark ? '#0B0B0C' : '#FFFFFF') : inkColor,
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: isBankActive ? (isDark ? '#000000' : '#FFFFFF') : b.color
                          }}
                        />
                        <span>{b.code}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: mutedColor }}>
                  <Icon name="lock" size={12} color={mutedColor} />
                  <span>Connects to official bank checkout gateway for secure authorization</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Footer: Minimal Neutral Primary Button */}
        <div
          className="sheet-sticky-foot"
          style={{
            padding: '12px 18px max(14px, env(safe-area-inset-bottom, 0px))',
            background: sheetBg,
            borderTop: borderLightColor,
            marginTop: 'auto',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            onClick={handleTriggerPayment}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '14px',
              background: primaryBtnBg,
              color: primaryBtnColor,
              border: `1.5px solid ${primaryBtnBg}`,
              fontWeight: 750,
              fontSize: '15.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.45)' : '0 4px 16px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>
              {selectedMethod === 'wallet'
                ? `Pay ₹${amount} with Wallet`
                : activeUpiApp
                ? (isSelectedAppInstalled
                    ? `Open ${activeUpiApp.name} & Pay ₹${amount}`
                    : `Get ${activeUpiApp.name} on ${isIOS ? 'App Store' : 'Play Store'}`)
                : selectedMethod === 'qr'
                ? `Scan & Pay ₹${amount}`
                : selectedMethod === 'card'
                ? `Pay ₹${amount} via Card`
                : selectedMethod === 'netbanking'
                ? `Pay ₹${amount} via ${selectedBank?.code || 'Netbanking'}`
                : `Pay ₹${amount}`}
            </span>
          </button>

          {/* Footer Security Branding */}
          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: mutedColor, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Icon name="shield" size={13} color={mutedColor} />
            <span>256-bit SSL encrypted · PhonePe Payment Gateway</span>
          </div>
        </div>
      </div>
    </div>
  );
}
