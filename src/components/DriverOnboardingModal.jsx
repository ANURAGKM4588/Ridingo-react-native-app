import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import BrandLogo from './BrandLogo';
import Icon from './Icon';
import { sendOtp, verifyOtp, formatIndianPhone } from '../services/authOtpService';
import { performNativeGoogleSignIn } from '../services/nativeGoogleAuth';
import { registerDriverProfile, checkDriverExists } from '../services/driverService';
import { validateUploadFile, ALLOWED_DOCUMENT_MIME_TYPES } from '../services/secureStorageService.js';

export default function DriverOnboardingModal() {
  const {
    driverOnboardingOpen,
    setDriverOnboardingOpen,
    driverPartner,
    driverTheme,
    loginDriverDemo,
    loginDriverWithDetails,
    openLegal,
    addToast
  } = useApp();

  const isDarkTheme = driverTheme === 'dark';

  // Tab: 'signin' | 'register'
  const [activeTab, setActiveTab] = useState('signin');
  // Step: 'form' | 'driver_kyc' | 'otp'
  const [step, setStep] = useState('form');

  // Delivery channel: 'phone'
  const [otpMethod, setOtpMethod] = useState('phone');

  // Terms agreement state (starts unchecked)
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [termsWarning, setTermsWarning] = useState(false);

  // Loading & timer states
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [unregisteredMobile, setUnregisteredMobile] = useState('');
  const [kycWarning, setKycWarning] = useState(null);

  // OTP Verification state & feedback
  const [otpStatus, setOtpStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [isShaking, setIsShaking] = useState(false);

  // Sign In fields
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  // Register - Basic Details
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');

  // Register - Driver Document & KYC Details
  const [dlNumber, setDlNumber] = useState('');
  const [dlPhoto, setDlPhoto] = useState(null);
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharPhoto, setAadharPhoto] = useState(null);
  const [homeAddress, setHomeAddress] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('Kerala'); // Auto-filled to Kerala
  const [nationality, setNationality] = useState('India'); // Auto-filled to India

  // Hidden File Input Refs
  const dlInputRef = useRef(null);
  const aadharInputRef = useRef(null);

  // Refs for OTP inputs
  const otpInputRefs = useRef([]);

  // Reset to Sign-In page whenever driver onboarding opens (e.g. on logout)
  useEffect(() => {
    if (driverOnboardingOpen) {
      setActiveTab('signin');
      setStep('form');
      setOtp(['', '', '', '', '', '']);
      setOtpStatus('idle');
      setOtpError(null);
      setKycWarning(null);
    }
  }, [driverOnboardingOpen]);

  // Keyboard open/close frame responsiveness
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const isKb = window.visualViewport.height < (window.innerHeight - 130);
        setIsKeyboardVisible(isKb);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      }
    };
  }, []);

  // Resend countdown timer
  useEffect(() => {
    let timer;
    if (step === 'otp' && resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown(c => c - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [step, resendCountdown]);

  if (!driverOnboardingOpen) return null;

  const handleFileUpload = (e, setPhotoState, label) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadFile(file, {
      allowedMimeTypes: ALLOWED_DOCUMENT_MIME_TYPES,
      maxSizeBytes: 10 * 1024 * 1024
    });

    if (!validation.valid) {
      addToast(validation.error, 'warn');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPhotoState(event.target.result);
      addToast(`${label} attached successfully`, 'check');
    };
    reader.readAsDataURL(file);
  };

  const getTargetIdentifier = (method = 'phone', tab = activeTab) => {
    if (tab === 'register') {
      return regMobile;
    }
    return phone;
  };

  const handleSendOtp = async (methodToUse = 'phone') => {
    setOtpError(null);
    setOtpStatus('idle');
    setIsShaking(false);
    const rawId = getTargetIdentifier('phone', activeTab);
    if (!rawId || rawId.replace(/\D/g, '').length < 10) {
      addToast('Please enter a valid 10-digit mobile number', 'warn');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await sendOtp({
        method: 'phone',
        identifier: rawId
      });
      setSendingOtp(false);
      setOtpStatus('idle');
      setIsShaking(false);
      setOtpMethod('phone');
      setStep('otp');
      setResendCountdown(30);
      setOtp(['', '', '', '', '', '']);

      addToast(res.message || `Verification code sent to ${rawId}`, 'check');

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setSendingOtp(false);
      setOtpError(err.message || 'Failed to send OTP. Please try again.');
      addToast(err.message || 'Failed to send OTP. Please try again.', 'warn');
    }
  };

  const handleSignInSubmit = async (e) => {
    e.preventDefault();
    if (!agreedTerms) {
      setTermsWarning(true);
      addToast('Please accept the Terms of Service & Privacy Policy to proceed', 'warn');
      return;
    }
    setTermsWarning(false);
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      const msg = 'Please enter a valid 10-digit mobile number';
      setOtpError(msg);
      addToast(msg, 'warn');
      return;
    }

    setSendingOtp(true);
    setOtpError(null);
    setUnregisteredMobile('');
    try {
      const check = await checkDriverExists({ phone: cleanPhone });
      if (!check.exists) {
        setSendingOtp(false);
        const errMsg = 'This number is not registered, please create an account';
        setOtpError(errMsg);
        setUnregisteredMobile(cleanPhone);
        addToast(errMsg, 'warn');
        return;
      }
    } catch (checkErr) {
      console.warn('Check driver exists error:', checkErr);
    }
    setSendingOtp(false);
    handleSendOtp('phone');
  };

  // Step 1: Basic Register Form submit -> Navigate to Registration KYC Filling Form Page
  const handleRegisterBasicSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) {
      addToast('Please enter your First Name', 'warn');
      return;
    }
    if (!lastName.trim()) {
      addToast('Please enter your Last Name', 'warn');
      return;
    }
    const cleanMobile = regMobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length < 10 || !/^[6-9]\d{9}$/.test(cleanMobile)) {
      addToast('Please enter a valid 10-digit Indian mobile number', 'warn');
      return;
    }
    const cleanEmail = (regEmail || email).trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      addToast('Please enter a valid email address (e.g. driver@example.com)', 'warn');
      return;
    }

    try {
      const check = await checkDriverExists({ phone: cleanMobile, email: cleanEmail });
      if (check.exists) {
        const field = check.matchedField === 'both' ? 'mobile number and email' : (check.matchedField === 'email' ? 'email address' : 'mobile number');
        addToast(`An account is already registered with this ${field}. Only one account is allowed per driver partner. Please sign in instead.`, 'warn');
        setPhone(cleanMobile);
        setEmail(cleanEmail);
        setActiveTab('signin');
        return;
      }
    } catch (e) {
      console.warn('Driver check error:', e);
    }

    setKycWarning(null);
    setStep('driver_kyc');
  };

  // Step 2: Driver Document & KYC Filling Form Submit -> Sends Mobile OTP directly
  const handleKycFormSubmit = async (e) => {
    e.preventDefault();
    setKycWarning(null);

    if (!dlNumber.trim()) {
      const msg = 'Please enter your Driving Licence Number';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }
    const cleanAadhaar = aadharNumber.replace(/\D/g, '');
    if (cleanAadhaar.length < 12) {
      const msg = 'Please enter a valid 12-digit Aadhaar number';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }
    if (!homeAddress.trim()) {
      const msg = 'Please enter your Home Address';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }
    if (!street.trim()) {
      const msg = 'Please enter your Street / Locality';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }
    if (!city.trim()) {
      const msg = 'Please enter your City';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }
    const cleanPin = pincode.replace(/\D/g, '');
    if (cleanPin.length < 6) {
      const msg = 'Please enter a valid 6-digit Postal PIN Code';
      setKycWarning(msg);
      addToast(msg, 'warn');
      return;
    }

    // Trigger Firebase Mobile Phone OTP verification directly
    setSendingOtp(true);
    try {
      const res = await sendOtp({
        method: 'phone',
        identifier: regMobile
      });
      setSendingOtp(false);
      setStep('otp');
      setResendCountdown(30);
      setOtp(['', '', '', '', '', '']);
      addToast(res.message || `Verification code sent to ${regMobile}`, 'check');
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      setSendingOtp(false);
      addToast(err.message || 'Failed to send SMS OTP code', 'warn');
    }
  };

  const handleOtpChange = (index, value) => {
    if (otpStatus !== 'idle') {
      setOtpStatus('idle');
      setOtpError(null);
    }

    const cleanChars = value.trim().replace(/[^a-zA-Z0-9]/g, '');
    if (cleanChars.length > 1) {
      const newOtp = [...otp];
      for (let i = 0; i < cleanChars.length && (index + i) < 6; i++) {
        newOtp[index + i] = cleanChars[i];
      }
      setOtp(newOtp);
      const nextIdx = Math.min(index + cleanChars.length, 5);
      otpInputRefs.current[nextIdx]?.focus();
      return;
    }

    const char = cleanChars.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const raw = e.clipboardData.getData('text');
    if (!raw) return;
    const cleaned = raw.trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
    if (!cleaned) return;

    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < cleaned.length; i++) {
      newOtp[i] = cleaned[i];
    }
    setOtp(newOtp);
    setOtpStatus('idle');
    setOtpError(null);

    const targetIdx = Math.min(cleaned.length, 5);
    setTimeout(() => {
      otpInputRefs.current[targetIdx]?.focus();
    }, 20);
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    const token = otp.join('');
    if (token.length !== 6) {
      setOtpStatus('error');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 450);
      const channelLabel = 'mobile';
      const msg = `Please enter the complete 6-digit verification code sent to your ${channelLabel}`;
      setOtpError(msg);
      addToast(msg, 'warn');
      return;
    }

    const currentId = getTargetIdentifier('phone', activeTab);
    setVerifyingOtp(true);
    setOtpError(null);

    try {
      const res = await verifyOtp({
        method: 'phone',
        identifier: currentId,
        token
      });
      setVerifyingOtp(false);
      setOtpStatus('success');

      setTimeout(async () => {
        if (activeTab === 'register') {
          const cleanEmail = (regEmail || email).trim().toLowerCase();
          const createdDriver = await registerDriverProfile({
            name: `${firstName.trim()} ${lastName.trim()}`.trim() || 'Driver Partner',
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: cleanEmail,
            phone: regMobile.trim(),
            dlNumber: dlNumber.trim().toUpperCase(),
            dlPhoto: dlPhoto || null,
            aadharNumber: aadharNumber.replace(/\D/g, ''),
            aadharPhoto: aadharPhoto || null,
            homeAddress: homeAddress.trim(),
            street: street.trim(),
            city: city.trim(),
            pincode: pincode.trim(),
            state: state.trim() || 'Kerala',
            nationality: nationality.trim() || 'India',
            avatar: dlPhoto || null,
            category: 'new_registration',
            status: 'pending'
          });

          if (createdDriver.alreadyRegistered) {
            addToast(createdDriver.message, 'warn');
            setPhone(regMobile.trim());
            setEmail(cleanEmail);
            setActiveTab('signin');
            setStep('form');
            setOtpStatus('idle');
            return;
          }

          loginDriverWithDetails({
            ...createdDriver,
            authMethod: 'phone_otp',
            supabaseUser: res.user,
            isAuthenticated: true
          });
        } else {
          loginDriverWithDetails({
            name: res.user?.user_metadata?.full_name || 'Ravi Kumar',
            phone: phone.trim(),
            email: '',
            authMethod: 'phone_otp',
            supabaseUser: res.user,
            isAuthenticated: true
          });
        }
        setOtpStatus('idle');
        addToast('Verified successfully! Welcome to Ridingo Driver Portal.', 'check');
      }, 650);
    } catch (err) {
      setVerifyingOtp(false);
      setOtpStatus('error');
      setIsShaking(true);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => {
        setIsShaking(false);
        otpInputRefs.current[0]?.focus();
      }, 450);

      const channelLabel = otpMethod === 'phone' ? 'mobile' : 'email';
      const errorMsg = `Please enter the correct verification code sent to your ${channelLabel}`;
      setOtpError(errorMsg);
      addToast(errorMsg, 'warn');
    }
  };

  const handleGoogleSignIn = async () => {
    // 1. Native iOS / Android device
    if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
      setIsGoogleLoading(true);
      try {
        const gUser = await performNativeGoogleSignIn();
        if (gUser && gUser.email) {
          loginDriverWithDetails({
            name: gUser.name || `${gUser.firstName || ''} ${gUser.lastName || ''}`.trim() || 'Driver Partner',
            email: gUser.email,
            avatar: gUser.avatar || null,
            googleId: gUser.id || null,
            idToken: gUser.idToken || null,
            authMethod: 'google',
            isAuthenticated: true
          });
          addToast(`Welcome to Driver Portal, ${gUser.name || 'Partner'}!`, 'check');
          return;
        }
      } catch (err) {
        console.warn('Google Sign-In error:', err);
        const isCancelled = err?.message?.toLowerCase()?.includes('cancel') ||
                            err?.message?.toLowerCase()?.includes('abort') ||
                            err?.code === '12501' || err?.code === 12501;
        if (!isCancelled) {
          addToast(err?.message || 'Google Sign-In was cancelled.', 'warn');
        }
        return;
      } finally {
        setIsGoogleLoading(false);
      }
    }

    // 2. Web browser preview fallback -> Open interactive Google Account Chooser
    setShowGooglePicker(true);
  };

  const handleSelectGoogleAccount = (acc) => {
    setShowGooglePicker(false);
    loginDriverWithDetails({
      name: acc.name,
      email: acc.email,
      avatar: acc.avatar,
      authMethod: 'google',
      isAuthenticated: true
    });
    addToast(`Signed in with Google as ${acc.name}!`, 'check');
  };

  const fieldStyle = {
    width: '100%',
    height: '48px',
    borderRadius: '14px',
    background: 'var(--card)',
    border: '1.5px solid var(--line)',
    padding: '0 12px',
    fontSize: '14.5px',
    fontWeight: 600,
    color: 'var(--ink)',
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--muted)',
    display: 'block'
  };

  const uploadBoxStyle = {
    borderRadius: '14px',
    border: '1.5px dashed var(--line)',
    background: 'var(--card)',
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  };

  return (
    <div
      id="d-ob-screen"
      className="ob-screen"
      style={{
        position: 'absolute', inset: 0, zIndex: 5000, background: 'var(--surface)', isolation: 'isolate',
        display: 'flex', flexDirection: 'column', borderRadius: '48px',
        paddingTop: isKeyboardVisible && step === 'otp'
          ? 'max(14px, env(safe-area-inset-top, 0px))'
          : 'max(40px, calc(env(safe-area-inset-top, 0px) + 28px))',
        paddingBottom: isKeyboardVisible && step === 'otp'
          ? '10px'
          : 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 20px))',
        paddingLeft: 'max(20px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(20px, env(safe-area-inset-right, 0px))',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        transition: 'padding 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {driverPartner && (
        <button
          type="button"
          onClick={() => setDriverOnboardingOpen(false)}
          style={{
            position: 'absolute', top: 'max(16px, calc(env(safe-area-inset-top, 0px) + 12px))', right: '18px', zIndex: 10,
            background: 'var(--card)', border: '1px solid var(--line)', width: '36px', height: '36px',
            borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          aria-label="Close"
        >
          <Icon name="x" size={16} />
        </button>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: isKeyboardVisible && step === 'otp' ? 'flex-start' : 'center',
        alignItems: 'center',
        maxWidth: '380px',
        margin: '0 auto',
        width: '100%',
        padding: isKeyboardVisible && step === 'otp' ? '0 4px' : '6px 4px',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* Brand Header - Matching User App exact design */}
        <div style={{
          textAlign: 'center',
          marginBottom: isKeyboardVisible && step === 'otp' ? '10px' : '18px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          transition: 'margin-bottom 0.2s ease'
        }}>
          <BrandLogo
            height={isKeyboardVisible && step === 'otp' ? 34 : 44}
            width={isKeyboardVisible && step === 'otp' ? 136 : 176}
            center={true}
            isDriver={true}
            style={{
              margin: isKeyboardVisible && step === 'otp' ? '0 auto 8px auto' : '0 auto 12px auto',
              display: 'flex',
              justifyContent: 'center',
              transition: 'all 0.2s ease'
            }}
          />

          <h1 style={{
            fontSize: isKeyboardVisible && step === 'otp' ? '20px' : '23px',
            fontWeight: 800,
            color: 'var(--ink)',
            margin: isKeyboardVisible && step === 'otp' ? '0 0 3px 0' : '0 0 5px 0',
            textAlign: 'center',
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
            transition: 'all 0.2s ease'
          }}>
            {step === 'otp'
              ? 'Verify with OTP'
              : step === 'driver_kyc'
              ? 'Driver Registration'
              : activeTab === 'signin'
              ? 'Welcome to Ridingo'
              : 'Register'}
          </h1>
          <p style={{
            fontSize: isKeyboardVisible && step === 'otp' ? '12.5px' : '13.5px',
            color: 'var(--muted)',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: '320px'
          }}>
            {step === 'otp'
              ? 'Enter the 6-digit verification code sent to your mobile'
              : step === 'driver_kyc'
              ? 'Please submit your licence, Aadhaar & address details'
              : activeTab === 'signin'
              ? 'Sign in or register with your mobile number'
              : 'Join the Ridingo driver partner network'}
          </p>
        </div>

        {/* Tabs - Only shown when on initial form step */}
        {step === 'form' && (
          <div className="auth-tab-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'signin'}
              onClick={() => { setActiveTab('signin'); setStep('form'); }}
              className={'auth-tab-btn ' + (activeTab === 'signin' ? 'active' : '')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'register'}
              onClick={() => { setActiveTab('register'); setStep('form'); }}
              className={'auth-tab-btn ' + (activeTab === 'register' ? 'active' : '')}
            >
              Register
            </button>
          </div>
        )}

        {/* ========================================================
            STEP: OTP VERIFICATION
           ======================================================== */}
        {step === 'otp' ? (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: isKeyboardVisible ? '10px' : '16px', width: '100%', transition: 'gap 0.2s ease' }}>
            {/* Target Channel Destination Indicator */}
            <div
              style={{
                background: 'var(--field)',
                border: '1px solid var(--line)',
                borderRadius: '14px',
                padding: isKeyboardVisible ? '8px 12px' : '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                transition: 'padding 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon name="phone" size={18} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    SMS Code Sent To
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--ink)' }}>
                    {formatIndianPhone(getTargetIdentifier('phone', activeTab))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(activeTab === 'register' ? 'driver_kyc' : 'form')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                Edit
              </button>
            </div>

            {/* 6-Digit OTP Box Grid */}
            <div className={`otp-grid-wrap ${isShaking ? 'shake' : ''}`}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  id={'d-otp-box-' + i}
                  ref={el => (otpInputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={handleOtpPaste}
                  onFocus={() => setIsKeyboardVisible(true)}
                  onBlur={() => {
                    setTimeout(() => {
                      if (!document.activeElement?.classList?.contains('otp-digit-box')) {
                        setIsKeyboardVisible(false);
                      }
                    }, 150);
                  }}
                  className={`otp-digit-box ${d ? 'filled' : ''} ${otpStatus === 'success' ? 'success' : otpStatus === 'error' ? 'error' : ''}`}
                />
              ))}
            </div>

            {/* Error Message */}
            {otpError && (
              <div className="otp-error-banner">
                <Icon name="alert-circle" size={14} color="#EF4444" />
                <span>{otpError}</span>
              </div>
            )}

            {/* Verify Button */}
            <button
              type="submit"
              disabled={verifyingOtp}
              className="btn"
              style={{
                height: isKeyboardVisible ? '44px' : '48px',
                borderRadius: '14px',
                background: isDarkTheme ? '#FFFFFF' : '#000000',
                color: isDarkTheme ? '#000000' : '#FFFFFF',
                border: isDarkTheme ? '1.5px solid #FFFFFF' : '1.5px solid #000000',
                fontSize: '15px',
                fontWeight: 700,
                cursor: verifyingOtp ? 'not-allowed' : 'pointer',
                boxShadow: isDarkTheme ? '0 4px 16px rgba(255,255,255,0.15)' : '0 4px 14px rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: isKeyboardVisible ? '2px' : '4px',
                opacity: verifyingOtp ? 0.7 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {verifyingOtp ? 'Verifying Code...' : 'Verify & Enter Dashboard'}
            </button>

            {/* Resend OTP Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
              {resendCountdown > 0 ? (
                <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
                  Resend code in <strong style={{ color: 'var(--ink)' }}>{resendCountdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendOtp('phone')}
                  disabled={sendingOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }}
                >
                  {sendingOtp ? 'Sending...' : 'Resend OTP'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setStep(activeTab === 'register' ? 'driver_kyc' : 'form')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                margin: '0 auto',
                padding: '4px 12px'
              }}
            >
              &larr; Back to {activeTab === 'signin' ? 'Sign In' : 'Registration Form'}
            </button>
          </form>

        ) : activeTab === 'signin' ? (
          /* ========================================================
             SIGN IN FORM: MATCHING ATTACHED IMAGE EXACTLY
             ======================================================== */
          <form onSubmit={handleSignInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            {/* Mobile Number Input */}
            <div>
              <label style={labelStyle}>
                Mobile Number
              </label>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', height: '48px', borderRadius: '14px', background: 'var(--card)', border: '1.5px solid var(--line)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <span style={{ padding: '0 12px', fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)', borderRight: '1px solid var(--line)', height: '100%', display: 'flex', alignItems: 'center', background: 'var(--field)', flexShrink: 0 }}>IN +91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Enter 10-digit mobile number"
                    style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '0 12px', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '0.04em' }}
                    required
                  />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '5px' }}>
                  We'll send a 6-digit verification code to your mobile.
                </div>
              </div>
            </div>

            {/* Terms and Conditions Checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '9px',
                cursor: 'pointer',
                userSelect: 'none',
                marginTop: '2px',
                marginBottom: '2px'
              }}
            >
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={e => {
                  setAgreedTerms(e.target.checked);
                  if (e.target.checked) setTermsWarning(false);
                }}
                style={{
                  marginTop: '2px',
                  width: '17px',
                  height: '17px',
                  borderRadius: '4px',
                  accentColor: isDarkTheme ? '#FFFFFF' : '#000000',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '12px', lineHeight: 1.45 }}>
                I agree to Ridingo's{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openLegal && openLegal('terms');
                  }}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: 'inherit',
                    textDecoration: 'underline', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Terms of Service
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openLegal && openLegal('privacy');
                  }}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: 'inherit',
                    textDecoration: 'underline', color: 'var(--ink)', fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Privacy Policy
                </button>
              </span>
            </label>

            {/* Terms Warning Feedback */}
            {termsWarning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#EF4444', fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Please accept the terms and conditions to proceed</span>
              </div>
            )}

            {/* OTP Error Feedback */}
            {otpError && (
              <div
                style={{
                  background: 'rgba(234, 67, 53, 0.1)',
                  border: '1px solid rgba(234, 67, 53, 0.35)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  color: '#d93025',
                  lineHeight: 1.45,
                  fontWeight: 600,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="alert-circle" size={14} color="#d93025" />
                  <span>{otpError}</span>
                </div>
                {unregisteredMobile && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegMobile(unregisteredMobile);
                      setPhone(unregisteredMobile);
                      setActiveTab('register');
                      setOtpError(null);
                      setUnregisteredMobile('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--ink)',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      textAlign: 'left',
                      padding: '2px 0 0 22px'
                    }}
                  >
                    Click here to register driver with +91 {unregisteredMobile} →
                  </button>
                )}
              </div>
            )}

            {/* Continue with OTP Button */}
            <button
              type="submit"
              disabled={sendingOtp}
              className="btn"
              style={{
                height: '48px',
                borderRadius: '14px',
                background: isDarkTheme ? '#FFFFFF' : '#000000',
                color: isDarkTheme ? '#000000' : '#FFFFFF',
                border: isDarkTheme ? '1.5px solid #FFFFFF' : '1.5px solid #000000',
                fontSize: '15px',
                fontWeight: 700,
                cursor: sendingOtp ? 'not-allowed' : 'pointer',
                boxShadow: isDarkTheme ? '0 4px 16px rgba(255,255,255,0.15)' : '0 4px 14px rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '4px',
                opacity: sendingOtp ? 0.7 : 1
              }}
            >
              {sendingOtp ? 'Sending OTP Code...' : 'Continue with OTP'}
            </button>

            {/* Instant Demo Access Button */}
            <button
              type="button"
              className="btn"
              onClick={loginDriverDemo}
              style={{
                height: '46px',
                borderRadius: '14px',
                background: 'var(--card, #FFFFFF)',
                color: 'var(--ink, #000000)',
                border: '1.5px solid var(--line, #000000)',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Icon name="zap" size={15} color="var(--yellow)" />
              <span>Instant Demo Access (Ravi)</span>
            </button>
          </form>

        ) : step === 'form' ? (
          /* ========================================================
             STEP 1: REGISTER INITIAL VIEW (First/Last Name, Mobile, Email)
             ======================================================== */
          <form onSubmit={handleRegisterBasicSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
              <div>
                <label style={labelStyle}>Full Name / First *</label>
                <input
                  type="text"
                  placeholder="Ravi"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name *</label>
                <input
                  type="text"
                  placeholder="Kumar"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  style={fieldStyle}
                  required
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Mobile Number *</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '48px', borderRadius: '14px', background: 'var(--card)', border: '1.5px solid var(--line)', overflow: 'hidden' }}>
                <span style={{ padding: '0 12px', fontSize: '13.5px', fontWeight: 800, color: 'var(--ink)', borderRight: '1px solid var(--line)', height: '100%', display: 'flex', alignItems: 'center', background: 'var(--field)', flexShrink: 0 }}>IN +91</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={regMobile}
                  onChange={e => setRegMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '0 12px', fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Email Address *</label>
              <div style={{ display: 'flex', alignItems: 'center', height: '48px', borderRadius: '14px', background: 'var(--card)', border: '1.5px solid var(--line)', overflow: 'hidden' }}>
                <input
                  type="email"
                  placeholder="e.g. driver@example.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  style={{ flex: 1, height: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '0 14px', fontSize: '14.5px', fontWeight: 600, color: 'var(--ink)' }}
                  required
                />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Only one driver partner account is allowed per email and mobile number.
              </div>
            </div>

            <button
              type="submit"
              className="btn"
              style={{
                height: '48px',
                borderRadius: '14px',
                background: isDarkTheme ? '#FFFFFF' : '#000000',
                color: isDarkTheme ? '#000000' : '#FFFFFF',
                border: isDarkTheme ? '1.5px solid #FFFFFF' : '1.5px solid #000000',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isDarkTheme ? '0 4px 16px rgba(255,255,255,0.15)' : '0 4px 14px rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '4px'
              }}
            >
              Register Now &rarr;
            </button>
          </form>

        ) : (
          /* ========================================================
             STEP 2: DRIVER REGISTRATION KYC DETAILS FILLING FORM
             ======================================================== */
          <form onSubmit={handleKycFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px', width: '100%' }}>
            {/* Driving Licence Number */}
            <div>
              <label style={labelStyle}>Driving Licence No. *</label>
              <input
                type="text"
                placeholder="KL-07-20160049281"
                value={dlNumber}
                onChange={e => {
                  setDlNumber(e.target.value.toUpperCase());
                  if (kycWarning) setKycWarning(null);
                }}
                style={{ ...fieldStyle, letterSpacing: '0.04em' }}
                required
              />
            </div>

            {/* Driving Licence Photo Upload */}
            <div>
              <label style={labelStyle}>Licence Photo</label>
              <input
                type="file"
                ref={dlInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e, setDlPhoto, 'Driving Licence')}
              />
              <div
                style={uploadBoxStyle}
                onClick={() => dlInputRef.current?.click()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {dlPhoto ? (
                    <img
                      src={dlPhoto}
                      alt="Licence Preview"
                      style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--line)' }}
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--field)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="file-text" size={18} color="var(--ink)" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                      {dlPhoto ? 'Licence Photo Attached' : 'Upload Licence Photo'}
                    </b>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                      {dlPhoto ? 'Tap to change photo' : 'JPG, PNG or PDF (Max 12MB)'}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: dlPhoto ? '#16A34A' : 'var(--ink)' }}>
                  {dlPhoto ? 'Change' : 'Upload'}
                </span>
              </div>
            </div>

            {/* Aadhaar Number */}
            <div>
              <label style={labelStyle}>Aadhaar Card No. *</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={14}
                placeholder="XXXX XXXX 1234"
                value={aadharNumber}
                onChange={e => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 12);
                  const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                  setAadharNumber(formatted);
                  if (kycWarning) setKycWarning(null);
                }}
                style={{ ...fieldStyle, letterSpacing: '0.06em' }}
                required
              />
            </div>

            {/* Aadhaar Card Image Upload */}
            <div>
              <label style={labelStyle}>Aadhaar Card Image</label>
              <input
                type="file"
                ref={aadharInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => handleFileUpload(e, setAadharPhoto, 'Aadhaar Card')}
              />
              <div
                style={uploadBoxStyle}
                onClick={() => aadharInputRef.current?.click()}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  {aadharPhoto ? (
                    <img
                      src={aadharPhoto}
                      alt="Aadhaar Preview"
                      style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--line)' }}
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--field)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="shield" size={18} color="var(--ink)" />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: '13px', color: 'var(--ink)', display: 'block' }}>
                      {aadharPhoto ? 'Aadhaar Card Attached' : 'Upload Aadhaar Image'}
                    </b>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>
                      {aadharPhoto ? 'Tap to change photo' : 'Front / e-Aadhaar copy'}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: aadharPhoto ? '#16A34A' : 'var(--ink)' }}>
                  {aadharPhoto ? 'Change' : 'Upload'}
                </span>
              </div>
            </div>

            {/* Home Address */}
            <div>
              <label style={labelStyle}>Home Address *</label>
              <input
                type="text"
                placeholder="House name, Flat / Building No."
                value={homeAddress}
                onChange={e => {
                  setHomeAddress(e.target.value);
                  if (kycWarning) setKycWarning(null);
                }}
                style={fieldStyle}
                required
              />
            </div>

            {/* Street */}
            <div>
              <label style={labelStyle}>Street / Locality *</label>
              <input
                type="text"
                placeholder="Main Road / Street"
                value={street}
                onChange={e => {
                  setStreet(e.target.value);
                  if (kycWarning) setKycWarning(null);
                }}
                style={fieldStyle}
                required
              />
            </div>

            {/* City & PIN Code */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
              <div>
                <label style={labelStyle}>City *</label>
                <input
                  type="text"
                  placeholder="Kochi"
                  value={city}
                  onChange={e => {
                    setCity(e.target.value);
                    if (kycWarning) setKycWarning(null);
                  }}
                  style={fieldStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>PIN Code *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="682030"
                  value={pincode}
                  onChange={e => {
                    setPincode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (kycWarning) setKycWarning(null);
                  }}
                  style={{ ...fieldStyle, letterSpacing: '0.06em' }}
                  required
                />
              </div>
            </div>

            {/* State (Auto-filled Kerala) & Nationality (Auto-filled India) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
              <div>
                <label style={labelStyle}>
                  State <span style={{ textTransform: 'none', color: '#16A34A' }}>• Auto</span>
                </label>
                <input
                  type="text"
                  value={state}
                  readOnly
                  style={{ ...fieldStyle, background: 'var(--field)', color: 'var(--ink)' }}
                />
              </div>
              <div>
                <label style={labelStyle}>
                  Nationality <span style={{ textTransform: 'none', color: '#16A34A' }}>• Auto</span>
                </label>
                <input
                  type="text"
                  value={nationality}
                  readOnly
                  style={{ ...fieldStyle, background: 'var(--field)', color: 'var(--ink)' }}
                />
              </div>
            </div>

            {/* Minimal Warning Message if required fields are not filled */}
            {kycWarning && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#EF4444',
                  fontWeight: 600,
                  marginTop: '4px',
                  marginBottom: '2px',
                  lineHeight: 1.4
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{kycWarning}</span>
              </div>
            )}

            {/* Submit and OTP button */}
            <button
              type="submit"
              disabled={sendingOtp}
              className="btn"
              style={{
                height: '48px',
                borderRadius: '14px',
                background: isDarkTheme ? '#FFFFFF' : '#000000',
                color: isDarkTheme ? '#000000' : '#FFFFFF',
                border: isDarkTheme ? '1.5px solid #FFFFFF' : '1.5px solid #000000',
                fontSize: '15px',
                fontWeight: 700,
                cursor: sendingOtp ? 'not-allowed' : 'pointer',
                boxShadow: isDarkTheme ? '0 4px 16px rgba(255,255,255,0.15)' : '0 4px 14px rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '6px',
                opacity: sendingOtp ? 0.7 : 1
              }}
            >
              {sendingOtp ? 'Sending Mobile OTP...' : 'Submit & Verify Mobile OTP →'}
            </button>

            <button
              type="button"
              onClick={() => setStep('form')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
                margin: '2px auto 0 auto',
                padding: '4px 12px'
              }}
            >
              &larr; Back to basic details
            </button>
          </form>
        )}

        {/* Social login - Only shown on initial form step */}
        {step === 'form' && (
          <div style={{ width: '100%', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>or continue with</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
            </div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '14px',
                background: 'var(--card)',
                border: '1.5px solid var(--line)',
                color: 'var(--ink)',
                fontSize: '14.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>{isGoogleLoading ? 'Connecting Google...' : 'Continue with Google'}</span>
            </button>
          </div>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginTop: '18px', lineHeight: 1.45, maxWidth: '300px' }}>
          By continuing, you agree to Ridingo's{' '}
          <span
            onClick={() => openLegal && openLegal('terms')}
            style={{ textDecoration: 'underline', color: 'var(--ink)', cursor: 'pointer' }}
          >
            Partner Terms
          </span> &amp;{' '}
          <span
            onClick={() => openLegal && openLegal('privacy')}
            style={{ textDecoration: 'underline', color: 'var(--ink)', cursor: 'pointer' }}
          >
            Privacy Policy
          </span>
        </p>
      </div>

      {/* Google Account Chooser Modal (Browser Preview Fallback) */}
      {showGooglePicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setShowGooglePicker(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              borderRadius: '24px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <b style={{ fontSize: '16px', color: 'var(--ink)' }}>Choose an account</b>
              </div>
              <button
                type="button"
                onClick={() => setShowGooglePicker(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
              to continue to <strong style={{ color: 'var(--ink)' }}>Ridingo Driver Portal</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'Ravi Kumar', email: 'ravi.driver@gmail.com', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
                { name: 'Arjun Menon', email: 'arjun.driver@gmail.com', avatar: null }
              ].map((acc, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectGoogleAccount(acc)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    border: '1.5px solid var(--line)',
                    background: 'var(--card)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--ink)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', overflow: 'hidden' }}>
                    {acc.avatar ? <img src={acc.avatar} alt={acc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : acc.name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)', display: 'block' }}>{acc.name}</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>{acc.email}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
