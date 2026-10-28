import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import BrandLogo from '../BrandLogo';
import {
  getLocalDriverRegistry,
  fetchDriversFromSupabase,
  approveDriverKyc,
  rejectDriverKyc,
  toggleSuspendDriver,
  registerDriverProfile,
  calculateCrmTelemetry,
  isAdminAuthenticated
} from '../../services/driverService';
import { getLocalUserRegistry } from '../../services/userService';
import { supabase } from '../../lib/supabase';
import {
  getAllBanners,
  saveOfferBanner,
  deleteOfferBanner,
  toggleBannerActive,
  SERVICE_OPTIONS,
  subscribeToOfferBanners
} from '../../services/bannerService';

// Clean minimal SVG icons (Replacing all emojis for a sleek modern UI)
const Icons = {
  Tag: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/>
      <path d="M7 7h.01"/>
    </svg>
  ),
  Image: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>
  ),
  Grid: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  SteeringWheel: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><path d="M12 2v8"/><path d="m4.93 18.07 5.66-5.66"/><path d="m19.07 18.07-5.66-5.66"/>
    </svg>
  ),
  Chart: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>
    </svg>
  ),
  Route: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a4.5 4.5 0 0 0 0-9H7a3 3 0 0 1 0-6h11"/><circle cx="18" cy="4" r="3"/>
    </svg>
  ),
  Users: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  Phone: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  ),
  Mail: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  MapPin: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  ),
  IdCard: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Close: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  ),
  User: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Car: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11.1 2 11.5 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17h10"/>
    </svg>
  )
};

export default function AdminPanel() {
  const { trips, setView, addToast } = useApp();

  // Administrator Authentication State (team.ridingo@gmail.com)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return isAdminAuthenticated();
  });
  const [loginEmail, setLoginEmail] = useState('team.ridingo@gmail.com');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const email = (loginEmail || '').trim().toLowerCase();
    const pass = (loginPass || '').trim();

    if (email !== 'team.ridingo@gmail.com') {
      setLoginError('Invalid credentials. Administrative access is restricted to team.ridingo@gmail.com.');
      setIsLoggingIn(false);
      return;
    }

    // Authenticate securely against Supabase Auth (server-side password hash verification)
    try {
      if (supabase && typeof supabase.auth?.signInWithPassword === 'function') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (!error && data?.session) {
          sessionStorage.setItem('ridingo_admin_auth', 'true');
          sessionStorage.setItem('ridingo_admin_email', email);
          setIsAuthenticated(true);
          setLoginError('');
          if (addToast) addToast('Executive administrator authenticated', 'check');
          setIsLoggingIn(false);
          return;
        }
        if (error) {
          setLoginError(error.message || 'Invalid administrative credentials. Access denied.');
          setIsLoggingIn(false);
          return;
        }
      } else {
        setLoginError('Authentication service unavailable. Please check server connection.');
        setIsLoggingIn(false);
        return;
      }
    } catch (err) {
      setLoginError(err.message || 'Authentication error occurred.');
      setIsLoggingIn(false);
      return;
    }

    setLoginError('Invalid administrative credentials. Access denied.');
    setIsLoggingIn(false);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem('ridingo_admin_auth');
    sessionStorage.removeItem('ridingo_admin_email');
    setIsAuthenticated(false);
    setLoginPass('');
    if (addToast) addToast('Logged out from Executive CRM Admin Panel', 'info');
  };

  // Active CRM Navigation Tab: 'drivers' | 'telemetry' | 'trips' | 'users'
  const [activeTab, setActiveTab] = useState('drivers');

  // Drivers sub-category tab: 'all' | 'new_registration' | 'old_registered'
  const [driverCategory, setDriverCategory] = useState('all');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drivers state
  const [drivers, setDrivers] = useState(getLocalDriverRegistry());
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(null);
  const [isAddDriverModalOpen, setIsAddDriverModalOpen] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (selectedDriver && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedDriver]);

  // New Driver Form state
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverEmail, setNewDriverEmail] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [newDriverAddress, setNewDriverAddress] = useState('');
  const [newDriverStreet, setNewDriverStreet] = useState('');
  const [newDriverCity, setNewDriverCity] = useState('Kochi');
  const [newDriverPin, setNewDriverPin] = useState('682030');
  const [newDriverDl, setNewDriverDl] = useState('');
  const [newDriverAadhar, setNewDriverAadhar] = useState('');

  // Interactive Fare Simulator state
  const [simFare, setSimFare] = useState(850);
  const [simCommission, setSimCommission] = useState(15);
  const [simTripVolume, setSimTripVolume] = useState(25);

  // Rejection modal state
  const [rejectModalDriverId, setRejectModalDriverId] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Default Banner Form Preset - Multiple Image Slots (Mobile & iPad/Tablet), Target Service & CTA Button
  const DEFAULT_BANNER_FORM = {
    imageMobile: '',
    imageTablet: '',
    imageUrl: '',
    category: 'airport',
    serviceName: 'Airport Pickup & Drop',
    cta: 'Book Now',
    ctaBgColor: '#FFFFFF',
    ctaTextColor: '#000000',
    showCta: true,
    active: true,
    order: 1
  };

  // Banner Management State
  const [banners, setBanners] = useState(getAllBanners);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerForm, setBannerForm] = useState(DEFAULT_BANNER_FORM);
  const [bannerPreviewMode, setBannerPreviewMode] = useState('mobile'); // 'mobile' | 'tablet'
  const mobileFileInputRef = useRef(null);
  const tabletFileInputRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeToOfferBanners((list) => {
      if (Array.isArray(list)) {
        setBanners(list);
      }
    });
    return unsub;
  }, []);

  const handleOpenAddBanner = () => {
    setEditingBannerId(null);
    setBannerPreviewMode('mobile');
    setBannerForm({
      ...DEFAULT_BANNER_FORM,
      order: banners.length + 1
    });
    setIsBannerModalOpen(true);
  };

  const handleOpenEditBanner = (b) => {
    setEditingBannerId(b.id);
    setBannerPreviewMode('mobile');
    const mob = b.imageMobile || b.imageUrl || '';
    const tab = b.imageTablet || b.imageUrl || '';
    setBannerForm({
      imageMobile: mob,
      imageTablet: tab,
      imageUrl: mob,
      category: b.category || 'airport',
      serviceName: b.serviceName || 'Airport Pickup & Drop',
      cta: b.cta || 'Book Now',
      ctaBgColor: b.ctaBgColor || '#FFFFFF',
      ctaTextColor: b.ctaTextColor || '#000000',
      showCta: b.showCta !== false,
      active: b.active !== false,
      order: b.order || 1
    });
    setIsBannerModalOpen(true);
  };

  const handleServiceSelect = (srvId) => {
    const srv = SERVICE_OPTIONS.find(s => s.id === srvId) || SERVICE_OPTIONS[0];
    setBannerForm(prev => ({
      ...prev,
      category: srv.id,
      serviceName: srv.name
    }));
  };

  const compressImage = (file, maxW, maxH, quality, onDone) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      if (addToast) addToast('Only JPG, PNG, and WebP images are supported', 'warn');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      if (addToast) addToast('Image size must be under 8MB', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        let targetW = w;
        let targetH = h;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          targetW = Math.round(w * ratio);
          targetH = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        onDone(compressed);
      };
      img.onerror = () => onDone(e.target.result);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleMobileImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1000, 400, 0.82, (res) => {
      setBannerForm(prev => ({
        ...prev,
        imageMobile: res,
        imageUrl: res,
        imageTablet: prev.imageTablet || res
      }));
      if (addToast) addToast('Mobile banner (1000×400) optimized & loaded!', 'check');
    });
  };

  const handleTabletImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file, 1400, 560, 0.82, (res) => {
      setBannerForm(prev => ({
        ...prev,
        imageTablet: res
      }));
      if (addToast) addToast('iPad / Tablet banner (1400×560) optimized & loaded!', 'check');
    });
  };

  const handleSaveBanner = async (e) => {
    if (e) e.preventDefault();
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    const finalMobile = bannerForm.imageMobile || bannerForm.imageUrl || bannerForm.imageTablet;
    const finalTablet = bannerForm.imageTablet || bannerForm.imageMobile || bannerForm.imageUrl;
    if (!finalMobile && !finalTablet) {
      if (addToast) addToast('Please upload or provide at least one offer banner image', 'alert');
      return;
    }
    const srv = SERVICE_OPTIONS.find(s => s.id === bannerForm.category) || SERVICE_OPTIONS[0];
    const payload = {
      ...bannerForm,
      id: editingBannerId || undefined,
      imageMobile: finalMobile,
      imageTablet: (finalTablet && finalTablet !== finalMobile) ? finalTablet : '',
      imageUrl: finalMobile,
      category: srv.id,
      serviceName: srv.name,
      headline: `${srv.name} Offer`,
      title: `${srv.name} Offer Banner`
    };
    const res = await saveOfferBanner(payload);
    setBanners(res.list);
    setIsBannerModalOpen(false);
    if (addToast) {
      addToast(editingBannerId ? 'Offer banner updated with responsive mobile/tablet assets!' : 'New responsive offer banner published to app!', 'check');
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    if (window.confirm('Are you sure you want to delete this offer banner?')) {
      const updated = await deleteOfferBanner(id);
      setBanners(updated);
      if (addToast) addToast('Offer banner removed', 'check');
    }
  };

  const handleToggleBanner = async (id) => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    const updated = await toggleBannerActive(id);
    setBanners(updated);
    if (addToast) addToast('Banner visibility toggled', 'info');
  };

  // Sync from Supabase on mount
  useEffect(() => {
    let mounted = true;
    fetchDriversFromSupabase().then(res => {
      if (mounted && Array.isArray(res)) {
        setDrivers(res);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Telemetry calculation
  const telemetry = useMemo(() => {
    return calculateCrmTelemetry(trips, drivers);
  }, [trips, drivers]);

  // Registered customer accounts
  const usersList = useMemo(() => {
    const list = getLocalUserRegistry();
    if (list.length === 0) {
      return [
        { id: 'RDU-10821', name: 'Anurag K M', email: 'anurag@ridingo.in', phone: '+91 98401 23456', city: 'Kochi', rides: 14, spent: 11900, registeredAt: '2026-08-10', status: 'active' },
        { id: 'RDU-29401', name: 'Pooja Nair', email: 'pooja.nair@gmail.com', phone: '+91 97451 89201', city: 'Thiruvananthapuram', rides: 8, spent: 6800, registeredAt: '2026-09-01', status: 'active' },
        { id: 'RDU-38910', name: 'Vishnu Das', email: 'vishnu.das@tech.in', phone: '+91 94470 19284', city: 'Kozhikode', rides: 22, spent: 18700, registeredAt: '2026-07-15', status: 'active' },
        { id: 'RDU-48192', name: 'Neha Varghese', email: 'neha.varghese@gmail.com', phone: '+91 98470 11928', city: 'Thrissur', rides: 6, spent: 5100, registeredAt: '2026-09-18', status: 'active' }
      ];
    }
    return list;
  }, []);

  // Filtered drivers
  const filteredDrivers = useMemo(() => {
    return drivers.filter(d => {
      const isNew = d.category === 'new_registration' || d.status === 'pending';
      if (driverCategory === 'new_registration' && !isNew) return false;
      if (driverCategory === 'old_registered' && isNew) return false;

      if (statusFilter !== 'all' && d.status !== statusFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        d.name?.toLowerCase().includes(q) ||
        d.id?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.pincode?.includes(q) ||
        d.dlNumber?.toLowerCase().includes(q)
      );
    });
  }, [drivers, driverCategory, statusFilter, searchQuery]);

  const newCount = useMemo(() => drivers.filter(d => d.category === 'new_registration' || d.status === 'pending').length, [drivers]);
  const oldCount = useMemo(() => drivers.filter(d => d.category === 'old_registered' || d.status === 'approved').length, [drivers]);

  // Actions
  const handleApprove = async (driverId) => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    const updated = await approveDriverKyc(driverId);
    setDrivers(updated);
    if (selectedDriver?.id === driverId) {
      setSelectedDriver(prev => ({ ...prev, category: 'old_registered', status: 'approved' }));
    }
    addToast(`Driver ${driverId} verified & activated!`, 'check');
  };

  const handleOpenRejectModal = (driverId) => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    setRejectModalDriverId(driverId);
    setRejectReasonInput('Document photo blurry / Address verification mismatch');
  };

  const handleConfirmReject = async () => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    if (!rejectModalDriverId) return;
    const reason = rejectReasonInput.trim() || 'KYC document verification failed';
    const updated = await rejectDriverKyc(rejectModalDriverId, reason);
    setDrivers(updated);
    if (selectedDriver?.id === rejectModalDriverId) {
      setSelectedDriver(prev => ({ ...prev, status: 'rejected', rejectReason: reason }));
    }
    setRejectModalDriverId(null);
    setRejectReasonInput('');
    addToast(`Driver ${rejectModalDriverId} KYC rejected.`, 'warn');
  };

  const handleToggleSuspend = async (driverId) => {
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    const updated = await toggleSuspendDriver(driverId);
    setDrivers(updated);
    if (selectedDriver?.id === driverId) {
      const found = updated.find(d => d.id === driverId);
      if (found) setSelectedDriver(found);
    }
    addToast(`Driver status updated for ${driverId}`, 'info');
  };

  const handleCreateDriverSubmit = async (e) => {
    e.preventDefault();
    if (!isAdminAuthenticated()) {
      if (addToast) addToast('Administrative authentication required', 'alert');
      setIsAuthenticated(false);
      return;
    }
    if (!newDriverName || !newDriverPhone || !newDriverEmail) {
      addToast('Please fill all mandatory driver fields', 'warn');
      return;
    }
    const created = await registerDriverProfile({
      name: newDriverName.trim(),
      phone: newDriverPhone.trim(),
      email: newDriverEmail.trim(),
      homeAddress: newDriverAddress.trim(),
      street: newDriverStreet.trim(),
      city: newDriverCity.trim(),
      pincode: newDriverPin.trim(),
      dlNumber: newDriverDl.trim().toUpperCase(),
      aadharNumber: newDriverAadhar.trim()
    });
    setDrivers(prev => [created, ...prev]);
    setIsAddDriverModalOpen(false);
    setNewDriverName('');
    setNewDriverEmail('');
    setNewDriverPhone('');
    setNewDriverDl('');
    setNewDriverAadhar('');
    setSelectedDriver(created);
    addToast(`New driver profile ${created.id} registered!`, 'check');
  };

  // Modern Minimal Design Tokens (Identical to the Reference Profile Card)
  const T = {
    canvas: '#FBFBFA',
    card: '#FFFFFF',
    surface: '#F5F6F8',
    surfaceHover: '#EEEEF2',
    border: 'rgba(0, 0, 0, 0.06)',
    borderStrong: '#E5E7EB',
    ink: '#121316',
    inkMuted: '#4B5563',
    inkDim: '#9CA3AF',
    taxi: '#FFC70A',
    taxiHover: '#F5BE00',
    taxiSoft: '#FFF8DB',
    green: '#10B981',
    greenSoft: '#ECFDF5',
    greenBorder: '#A7F3D0',
    amber: '#F59E0B',
    amberSoft: '#FFFBEB',
    amberBorder: '#FDE68A',
    red: '#EF4444',
    redSoft: '#FEF2F2',
    redBorder: '#FECACA',
    blue: '#3B82F6',
    blueSoft: '#EFF6FF',
    fontDisplay: '"Sora", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSans: '"Manrope", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
    shadowCard: '0 20px 45px -15px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.02)',
    shadowElevated: '0 24px 50px -15px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)'
  };

  // Strictly gate entire CRM Admin Panel behind verified Administrator Authentication
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        background: T.canvas,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        boxSizing: 'border-box',
        fontFamily: T.fontSans
      }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          background: T.card,
          borderRadius: '28px',
          border: `1px solid ${T.border}`,
          padding: '36px 30px',
          boxShadow: T.shadowElevated,
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <BrandLogo height={32} width={120} />
            <span style={{
              fontSize: '10px',
              fontWeight: 800,
              background: T.taxi,
              color: '#000000',
              padding: '2px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              CRM
            </span>
          </div>

          <h2 style={{ fontFamily: T.fontDisplay, fontSize: '20px', fontWeight: 800, margin: '8px 0 4px', color: T.ink }}>
            Executive Portal
          </h2>
          <p style={{ fontSize: '13px', color: T.inkMuted, margin: '0 0 24px', lineHeight: 1.4 }}>
            Enter authorized administrative credentials to access CRM KYC management and telemetry
          </p>

          <form onSubmit={handleAdminLogin} style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.ink, marginBottom: '6px' }}>
                Administrator Email
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="team.ridingo@gmail.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: T.surface
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: T.ink, marginBottom: '6px' }}>
                Admin Password
              </label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: T.surface
                }}
              />
            </div>

            {loginError && (
              <div style={{
                background: T.redSoft,
                border: `1px solid ${T.redBorder}`,
                color: T.red,
                padding: '10px 12px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: 1.4
              }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                background: T.ink,
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease'
              }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In as Administrator'}
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setView('user')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: `1px solid ${T.borderStrong}`,
                background: T.surface,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to User App
            </button>
            <button
              type="button"
              onClick={() => setView('driver')}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                border: `1px solid ${T.borderStrong}`,
                background: T.surface,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Driver App
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="admin-root-container"
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        background: T.canvas,
        color: T.ink,
        fontFamily: T.fontSans,
        WebkitFontSmoothing: 'antialiased',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overflowY: 'visible'
      }}
    >
      <style>{`
        /* ========================================================
           RESPONSIVE DESIGN SYSTEM:
           - DESKTOP (>= 1024px): Left Sidebar + Main Viewport + Desktop Header
           - VERTICAL / MOBILE / TABLET (< 1024px): Top Header only (Sidebar & Desktop Header removed)
           ======================================================== */
        .admin-root-container {
          min-height: 100vh;
          width: 100%;
          background: #F9FAFB;
          color: #121316;
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: visible;
        }

        /* 1. DESKTOP / WIDE SCREEN LAYOUT (>= 1024px) */
        @media (min-width: 1024px) {
          .admin-root-container {
            display: flex !important;
            flex-direction: row !important;
          }

          /* Hide mobile top header on desktop */
          .admin-mobile-header {
            display: none !important;
          }

          /* Show sticky left sidebar on desktop */
          .admin-sidebar {
            display: flex !important;
            flex-direction: column !important;
            width: 280px !important;
            background: #FFFFFF !important;
            border-right: 1px solid rgba(0, 0, 0, 0.06) !important;
            padding: 32px 20px !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
            position: sticky !important;
            top: 0 !important;
            height: 100vh !important;
            overflow-y: auto !important;
            transition: all 0.2s ease !important;
            z-index: 50 !important;
          }

          .admin-main-viewport {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            min-width: 0 !important;
            min-height: 100vh !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          /* Show desktop sub-header */
          .admin-header {
            display: flex !important;
            min-height: 76px !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
            background: #FFFFFF !important;
            padding: 0 36px !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-shrink: 0 !important;
            box-sizing: border-box !important;
          }

          .admin-dashboard-body {
            padding: 32px 36px !important;
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 28px !important;
            box-sizing: border-box !important;
          }

          .admin-metrics-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 20px !important;
          }

          .admin-profile-expand-body {
            display: grid !important;
            grid-template-columns: 390px 1fr !important;
            gap: 32px !important;
            padding: 0 32px 28px !important;
          }

          .admin-simulator-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 36px !important;
          }
        }

        /* 2. VERTICAL FRAME / MOBILE & TABLET LAYOUT (< 1024px) */
        @media (max-width: 1023px) {
          .admin-root-container {
            display: flex !important;
            flex-direction: column !important;
            min-height: 100vh !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }

          /* Strictly REMOVE sidebar in vertical frame */
          .admin-sidebar {
            display: none !important;
          }

          /* Strictly REMOVE desktop header in vertical frame (no duplicate header) */
          .admin-header {
            display: none !important;
          }

          /* Top Header acts as unified navigation */
          .admin-mobile-header {
            display: flex !important;
            flex-direction: column !important;
            background: #FFFFFF !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
            padding: 12px 16px 8px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }

          .admin-mobile-nav-tabs {
            display: flex !important;
            overflow-x: auto !important;
            gap: 8px !important;
            padding: 10px 0 4px !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
            width: 100% !important;
          }

          .admin-mobile-nav-tabs::-webkit-scrollbar {
            display: none !important;
          }

          /* Full width content */
          .admin-main-viewport {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          .admin-dashboard-body {
            width: 100% !important;
            padding: 18px 14px !important;
            gap: 20px !important;
            box-sizing: border-box !important;
          }

          .admin-metrics-grid {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .admin-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding-bottom: 14px !important;
          }

          .admin-toolbar > div {
            width: 100% !important;
          }

          .admin-profile-expand-card {
            border-radius: 20px !important;
            margin-bottom: 18px !important;
          }

          .admin-profile-expand-body {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
            padding: 0 16px 20px !important;
          }

          .admin-doc-grid {
            grid-template-columns: 1fr !important;
          }

          .admin-simulator-grid {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }

          .admin-driver-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 14px !important;
            padding: 16px !important;
          }

          .admin-driver-item-right {
            width: 100% !important;
            justify-content: space-between !important;
            padding-top: 10px !important;
            border-top: 1px dashed rgba(0,0,0,0.08) !important;
          }

          .admin-row-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }

          .admin-row-item > div:last-child {
            width: 100% !important;
            justify-content: space-between !important;
            padding-top: 8px !important;
            border-top: 1px dashed rgba(0,0,0,0.08) !important;
          }
        }

        /* 3. SHARED COMPONENTS STYLES */
        .admin-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 22px;
          flex-wrap: wrap;
        }

        .admin-profile-expand-card {
          background: #FFFFFF;
          border-radius: 28px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          overflow: hidden;
          box-shadow: 0 24px 50px -15px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
          width: 100%;
          box-sizing: border-box;
          animation: adminSlideDown 0.25s ease-out;
        }

        @keyframes adminSlideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .admin-profile-expand-left {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .admin-profile-expand-right {
          display: flex;
          flex-direction: column;
          gap: 16px;
          justify-content: space-between;
        }

        .admin-doc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .admin-driver-item {
          padding: 18px 24px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.15s ease;
          box-sizing: border-box;
        }

        .admin-driver-item-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .admin-row-item {
          padding: 16px 22px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-sizing: border-box;
        }
      `}</style>

      {/* Responsive Mobile Top Bar & Horizontal Tabs Header */}
      <div className="admin-mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BrandLogo height={28} width={110} />
            <span
              style={{
                fontFamily: T.fontDisplay,
                fontSize: '10px',
                fontWeight: 800,
                background: T.taxi,
                color: '#000000',
                padding: '2px 7px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              CRM
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setView('user')}
              style={{
                padding: '6px 9px',
                borderRadius: '10px',
                border: `1px solid ${T.borderStrong}`,
                background: T.card,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              User App
            </button>
            <button
              type="button"
              onClick={() => setView('driver')}
              style={{
                padding: '6px 9px',
                borderRadius: '10px',
                border: `1px solid ${T.borderStrong}`,
                background: T.card,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Driver
            </button>
            <button
              type="button"
              onClick={handleAdminLogout}
              style={{
                padding: '6px 9px',
                borderRadius: '10px',
                border: `1px solid ${T.redBorder}`,
                background: T.redSoft,
                color: T.red,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Scrollable Navigation Tabs */}
        <div className="admin-mobile-nav-tabs">
          {[
            { id: 'drivers', label: 'Drivers & KYC', badge: newCount > 0 ? `${newCount}` : null },
            { id: 'banners', label: 'Offer Banners', badge: banners.filter(b => b.active).length ? `${banners.filter(b => b.active).length} Live` : null },
            { id: 'telemetry', label: 'Revenue Engine' },
            { id: 'trips', label: 'Live Telemetry', badge: telemetry.totalTrips },
            { id: 'users', label: 'Customers', badge: usersList.length }
          ].map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setSelectedDriver(null);
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  border: active ? `1px solid ${T.ink}` : `1px solid ${T.borderStrong}`,
                  background: active ? T.ink : '#FFFFFF',
                  color: active ? '#FFFFFF' : T.ink,
                  fontSize: '12px',
                  fontWeight: active ? 700 : 500,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: active ? T.taxi : T.surfaceHover,
                      color: '#000000'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================
          LEFT SIDEBAR: MODERN MINIMAL APPAREL (LAPTOP & TABLET)
         ======================================================== */}
      <aside
        className="admin-sidebar"
        style={{
          background: T.card,
          borderRight: `1px solid ${T.border}`,
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
        <div>
          {/* Logo & Portal Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px', padding: '0 6px' }}>
            <BrandLogo height={36} width={140} />
            <span
              style={{
                fontFamily: T.fontDisplay,
                fontSize: '11.5px',
                fontWeight: 800,
                background: T.taxi,
                color: '#000000',
                padding: '4px 10px',
                borderRadius: '8px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              CRM
            </span>
          </div>

          {/* Quick Ecosystem Switcher (Matching Inset Pill Style) */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '18px',
              background: T.surface,
              border: `1px solid ${T.border}`,
              marginBottom: '26px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                App Switcher
              </span>
              <span style={{ fontSize: '11.5px', color: T.green, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.green, display: 'inline-block' }} />
                Online
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setView('user')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  background: T.card,
                  color: T.ink,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'background 0.15s ease'
                }}
              >
                <Icons.User />
                <span>User App</span>
              </button>
              <button
                type="button"
                onClick={() => setView('driver')}
                style={{
                  padding: '8px 10px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  background: T.card,
                  color: T.ink,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'background 0.15s ease'
                }}
              >
                <Icons.Car />
                <span>Driver App</span>
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ marginBottom: '8px', padding: '0 8px' }}>
            <span style={{ fontSize: '11.5px', color: T.inkDim, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Operations
            </span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { id: 'drivers', label: 'Drivers & KYC', badge: newCount > 0 ? `${newCount} New` : null },
              { id: 'banners', label: 'Offer Banners & Slides', badge: `${banners.filter(b => b.active).length} Active` },
              { id: 'telemetry', label: 'Trip Revenue Engine' },
              { id: 'trips', label: 'Live Telemetry & Trips', badge: telemetry.totalTrips },
              { id: 'users', label: 'Customer Accounts', badge: usersList.length }
            ].map(item => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setSelectedDriver(null);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderRadius: '14px',
                    border: active ? `1px solid ${T.borderStrong}` : '1px solid transparent',
                    background: active ? T.surface : 'transparent',
                    color: active ? T.ink : T.inkMuted,
                    fontSize: '15.5px',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: active ? T.taxi : T.surfaceHover,
                        color: active ? '#000000' : T.ink
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.green }} />
            <span style={{ fontSize: '12px', color: T.inkMuted, fontWeight: 600 }}>Admin Authenticated</span>
          </div>
          <div style={{ fontSize: '11.5px', color: T.inkDim, lineHeight: 1.4, marginBottom: '12px' }}>
            Executive: <strong style={{ color: T.ink }}>team.ridingo@gmail.com</strong>
          </div>
          <button
            type="button"
            onClick={handleAdminLogout}
            style={{
              width: '100%',
              padding: '9px 12px',
              borderRadius: '10px',
              border: `1px solid ${T.redBorder}`,
              background: T.redSoft,
              color: T.red,
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* ========================================================
          MAIN VIEWPORT: SPACIOUS, AIRY, UNCONGESTED
         ======================================================== */}
      <main className="admin-main-viewport" style={{ flex: 1, minWidth: 0 }}>
        {/* Top Header Bar */}
        <header
          className="admin-header"
          style={{
            borderBottom: `1px solid ${T.border}`,
            background: T.card,
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div>
            <h1 style={{ fontFamily: T.fontDisplay, fontSize: '20px', fontWeight: 800, margin: 0, color: T.ink, letterSpacing: '-0.02em' }}>
              {activeTab === 'drivers' && 'Drivers & KYC Management'}
              {activeTab === 'telemetry' && 'Trip Revenue & Financial Calculations'}
              {activeTab === 'trips' && 'Live Trips & Dispatch Telemetry'}
              {activeTab === 'users' && 'Customer Profiles & Lifetime Value'}
            </h1>
            <span style={{ fontSize: '12.5px', color: T.inkMuted, marginTop: '2px', display: 'block' }}>
              Modern Minimal CRM • Ridingo Executive Operations (Kerala Network)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeTab === 'drivers' && (
              <button
                type="button"
                onClick={() => setIsAddDriverModalOpen(true)}
                style={{
                  background: T.ink,
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  transition: 'opacity 0.15s ease'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 800 }}>+</span>
                <span>Register Driver</span>
              </button>
            )}

            {activeTab === 'banners' && (
              <button
                type="button"
                onClick={handleOpenAddBanner}
                style={{
                  background: T.taxi,
                  color: '#000000',
                  border: 'none',
                  borderRadius: '14px',
                  padding: '10px 18px',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                  transition: 'opacity 0.15s ease'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 800 }}>+</span>
                <span>Add Offer Banner</span>
              </button>
            )}

            <div
              style={{
                padding: '9px 14px',
                borderRadius: '14px',
                background: T.surface,
                border: `1px solid ${T.border}`,
                fontSize: '12.5px',
                fontWeight: 600,
                color: T.inkMuted,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icons.Calendar />
              <span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Body Content */}
        <div className="admin-dashboard-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* ========================================================
              EXECUTIVE METRIC CARDS (AIRY, SPACIOUS, HIGH-CONTRAST)
             ======================================================== */}
          <section
            className="admin-metrics-grid"
            style={{
              display: 'grid',
              gap: '20px'
            }}
          >
            {/* Gross GMV */}
            <div
              style={{
                padding: '24px 26px',
                borderRadius: '24px',
                background: T.card,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Gross Trip Volume (GMV)
                </span>
                <span style={{ fontSize: '11px', color: T.green, fontWeight: 800, background: T.greenSoft, padding: '2px 8px', borderRadius: '6px' }}>
                  +18.4%
                </span>
              </div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: '28px', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', margin: '4px 0' }}>
                ₹{telemetry.totalGmv.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                Total cumulative booking value
              </span>
            </div>

            {/* Platform Revenue (15%) */}
            <div
              style={{
                padding: '24px 26px',
                borderRadius: '24px',
                background: T.card,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Platform Net (15%)
                </span>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: T.taxiSoft, color: '#855D00' }}>
                  15% Take-Rate
                </span>
              </div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: '28px', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', margin: '4px 0' }}>
                ₹{telemetry.netCommission.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                Retained platform revenue
              </span>
            </div>

            {/* Driver Payouts (85%) */}
            <div
              style={{
                padding: '24px 26px',
                borderRadius: '24px',
                background: T.card,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Driver Payouts (85%)
                </span>
                <span style={{ fontSize: '11px', color: T.green, fontWeight: 800, background: T.greenSoft, padding: '2px 8px', borderRadius: '6px' }}>
                  Settled
                </span>
              </div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: '28px', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', margin: '4px 0' }}>
                ₹{telemetry.driverPayouts.toLocaleString('en-IN')}
              </div>
              <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                Settled to verified partner drivers
              </span>
            </div>

            {/* Completed Trips */}
            <div
              style={{
                padding: '24px 26px',
                borderRadius: '24px',
                background: T.card,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: T.inkMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Completed Trips
                </span>
                <span style={{ fontSize: '11px', color: T.blue, fontWeight: 800, background: T.blueSoft, padding: '2px 8px', borderRadius: '6px' }}>
                  100% Fulfilled
                </span>
              </div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: '28px', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', margin: '4px 0' }}>
                {telemetry.completedCount} / {telemetry.totalTrips || 184}
              </div>
              <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                {telemetry.completionRate}% fulfillment rate
              </span>
            </div>
          </section>

          {/* ========================================================
              TAB 1: DRIVERS REGISTRY & PROFILE CARDS
             ======================================================== */}
          {activeTab === 'drivers' && (
            <div>
              {/* Segmented Controls & Search Toolbar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '22px',
                  marginBottom: '16px',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                {/* Segmented Category Pill */}
                <div
                  style={{
                    display: 'flex',
                    background: T.surface,
                    padding: '5px',
                    borderRadius: '16px',
                    border: `1px solid ${T.border}`
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setDriverCategory('all');
                      setSelectedDriver(null);
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: driverCategory === 'all' ? T.card : 'transparent',
                      color: driverCategory === 'all' ? T.ink : T.inkMuted,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: driverCategory === 'all' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>All Drivers</span>
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: '999px',
                        background: driverCategory === 'all' ? T.surfaceHover : T.card,
                        color: T.ink,
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {drivers.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDriverCategory('new_registration');
                      setSelectedDriver(null);
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: driverCategory === 'new_registration' ? T.card : 'transparent',
                      color: driverCategory === 'new_registration' ? T.ink : T.inkMuted,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: driverCategory === 'new_registration' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>New Registration</span>
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: '999px',
                        background: T.amberSoft,
                        color: T.amber,
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {newCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDriverCategory('old_registered');
                      setSelectedDriver(null);
                    }}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '12px',
                      border: 'none',
                      background: driverCategory === 'old_registered' ? T.card : 'transparent',
                      color: driverCategory === 'old_registered' ? T.ink : T.inkMuted,
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: driverCategory === 'old_registered' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>Verified Drivers</span>
                    <span
                      style={{
                        padding: '1px 8px',
                        borderRadius: '999px',
                        background: T.greenSoft,
                        color: T.green,
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {oldCount}
                    </span>
                  </button>
                </div>

                {/* Filter and Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: '12px', color: T.inkDim, display: 'flex' }}>
                      <Icons.Search />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by ID, Name, PIN, Mobile..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{
                        padding: '11px 16px 11px 36px',
                        borderRadius: '14px',
                        border: `1px solid ${T.borderStrong}`,
                        background: T.card,
                        color: T.ink,
                        fontSize: '13px',
                        minWidth: '270px',
                        outline: 'none',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    style={{
                      padding: '11px 16px',
                      borderRadius: '14px',
                      border: `1px solid ${T.borderStrong}`,
                      background: T.card,
                      color: T.ink,
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              {/* ========================================================
                  EXPANDED DRIVER PROFILE CARD IN LANDSCAPE SIZE
                  (Laptop & Tablet: Full Landscape 2-Column Grid; Mobile: Strict Vertical Single Column)
                 ======================================================== */}
              {selectedDriver && (
                <div ref={cardRef} className="admin-profile-expand-card">
                  {/* Top Scenic Sky & Clouds Full-Bleed Banner */}
                  <div
                    style={{
                      height: '135px',
                      position: 'relative',
                      background: 'linear-gradient(180deg, #A8C7DF 0%, #C3DAED 45%, #DFEDF7 80%, #EFF6FC 100%)',
                      backgroundImage: 'radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 50%), radial-gradient(ellipse at 25% 60%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 45%), linear-gradient(180deg, #99C3E3 0%, #BFE0F7 60%, #E3F1FC 100%)',
                      padding: '16px 24px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Top Left: Driver ID Pill + Landscape Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 800,
                          background: 'rgba(255, 255, 255, 0.92)',
                          backdropFilter: 'blur(8px)',
                          color: '#121316',
                          padding: '5px 12px',
                          borderRadius: '999px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {selectedDriver.id}
                      </span>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          background: 'rgba(255, 255, 255, 0.75)',
                          backdropFilter: 'blur(8px)',
                          color: '#4B5563',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                        <span>Expanded Landscape Dossier</span>
                      </span>
                    </div>

                    {/* Top Right: Status / Follow Pill & Close */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedDriver.status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleApprove(selectedDriver.id)}
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            background: '#FFFFFF',
                            color: '#121316',
                            padding: '6px 14px',
                            borderRadius: '999px',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 3px 12px rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <span>Approve Partner</span>
                          <span style={{ fontSize: '13px', fontWeight: 800 }}>+</span>
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            background: '#FFFFFF',
                            color: selectedDriver.status === 'approved' ? '#047857' : '#B91C1C',
                            padding: '6px 14px',
                            borderRadius: '999px',
                            boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Icons.Check />
                          <span>{selectedDriver.status === 'approved' ? 'Verified Partner' : 'Suspended'}</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedDriver(null)}
                        title="Close Profile"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.9)',
                          backdropFilter: 'blur(8px)',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#121316',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          transition: 'transform 0.15s ease'
                        }}
                      >
                        <Icons.Close />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: 2-Column Landscape on Laptop & Tablet, Vertical on Mobile */}
                  <div className="admin-profile-expand-body">
                    {/* Left Column: Avatar, exp bar, Name, Bio, Stats, Quick Contact */}
                    <div className="admin-profile-expand-left">
                      {/* Avatar with Rainbow Iridescent Ring */}
                      <div style={{ marginTop: '-44px', position: 'relative', marginBottom: '10px' }}>
                        <div
                          style={{
                            width: '92px',
                            height: '92px',
                            borderRadius: '50%',
                            background: 'conic-gradient(from 180deg at 50% 50%, #FFC70A 0deg, #10B981 72deg, #06B6D4 144deg, #3B82F6 216deg, #8B5CF6 288deg, #EC4899 330deg, #FFC70A 360deg)',
                            padding: '3.5px',
                            boxShadow: '0 8px 24px -4px rgba(0,0,0,0.12)'
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '50%',
                              border: '3px solid #FFFFFF',
                              overflow: 'hidden',
                              background: '#FFFFFF',
                              boxSizing: 'border-box'
                            }}
                          >
                            {selectedDriver.avatar ? (
                              <img
                                src={selectedDriver.avatar}
                                alt={selectedDriver.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 800, background: '#F4F5F7' }}>
                                {selectedDriver.name?.[0] || 'D'}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Exp Multi-color Spectrum Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>exp.</span>
                        <div style={{ display: 'flex', gap: '2.5px', alignItems: 'center' }}>
                          {['#8B5CF6', '#6366F1', '#3B82F6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#E5E7EB', '#E5E7EB'].map((color, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '4px',
                                height: '10px',
                                borderRadius: '2px',
                                background: idx < (selectedDriver.status === 'approved' ? 7 : 3) ? color : '#E5E7EB'
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Driver Name & Role */}
                      <b style={{ fontFamily: T.fontDisplay, fontSize: '21px', fontWeight: 800, color: '#121316', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
                        {selectedDriver.name}
                      </b>
                      <p style={{ fontSize: '12.5px', color: '#4B5563', margin: '0 0 16px', lineHeight: 1.45, maxWidth: '320px' }}>
                        {selectedDriver.category === 'new_registration'
                          ? 'New partner applicant • Verification in progress for Kerala driver network.'
                          : 'Ridingo Executive Driver focusing on safety, punctuality & premium rider comfort.'}
                      </p>

                      {/* 3-Column Stats Container */}
                      <div
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: '#F5F6F8',
                          borderRadius: '20px',
                          padding: '14px 10px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          textAlign: 'center',
                          marginBottom: '16px'
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: T.fontDisplay, fontSize: '17px', fontWeight: 800, color: '#121316', letterSpacing: '-0.02em' }}>
                            {selectedDriver.tripsCompleted || (selectedDriver.status === 'approved' ? 184 : 0)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, marginTop: '2px' }}>
                            Trips
                          </div>
                        </div>

                        <div style={{ borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB' }}>
                          <div style={{ fontFamily: T.fontDisplay, fontSize: '17px', fontWeight: 800, color: '#121316', letterSpacing: '-0.02em' }}>
                            {selectedDriver.rating ? `${selectedDriver.rating}` : '5.0'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, marginTop: '2px' }}>
                            Rating
                          </div>
                        </div>

                        <div>
                          <div style={{ fontFamily: T.fontDisplay, fontSize: '17px', fontWeight: 800, color: '#121316', letterSpacing: '-0.02em' }}>
                            {selectedDriver.totalEarnings
                              ? `₹${(selectedDriver.totalEarnings / 1000).toFixed(0)}K`
                              : (selectedDriver.status === 'approved' ? '₹68K' : '₹0')}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, marginTop: '2px' }}>
                            Earnings
                          </div>
                        </div>
                      </div>

                      {/* Quick Contact Buttons Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
                        <a
                          href={`tel:${selectedDriver.phone}`}
                          title={`Call ${selectedDriver.phone}`}
                          style={{
                            flex: 1,
                            minWidth: '90px',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: '#121316',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <Icons.Phone />
                          <span>Call</span>
                        </a>

                        <a
                          href={`mailto:${selectedDriver.email}`}
                          title={`Email ${selectedDriver.email}`}
                          style={{
                            flex: 1,
                            minWidth: '90px',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: '#121316',
                            textDecoration: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <Icons.Mail />
                          <span>Email</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => alert(`Address: ${selectedDriver.homeAddress}, ${selectedDriver.street}, ${selectedDriver.city} - PIN: ${selectedDriver.pincode}`)}
                          title={`PIN: ${selectedDriver.pincode}`}
                          style={{
                            flex: 1,
                            minWidth: '90px',
                            padding: '8px 12px',
                            borderRadius: '12px',
                            background: '#FFFFFF',
                            border: '1px solid #E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            color: '#121316',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 600,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          <Icons.MapPin />
                          <span>PIN</span>
                        </button>
                      </div>
                    </div>

                    {/* Right Column: Address, Compliance Documents & Decisions */}
                    <div className="admin-profile-expand-right">
                      {/* Full Address & PIN Container */}
                      <div
                        style={{
                          background: '#F9FAFB',
                          borderRadius: '18px',
                          border: '1px solid #EAEAEA',
                          padding: '16px 20px',
                          textAlign: 'left',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                            Full Residential Address & Kerala Jurisdiction
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 800, background: '#FFF8DB', color: '#855D00', padding: '3px 9px', borderRadius: '6px' }}>
                            PIN: {selectedDriver.pincode || '682030'}
                          </span>
                        </div>
                        <div style={{ color: '#121316', fontSize: '13px', lineHeight: 1.45, fontWeight: 500 }}>
                          {selectedDriver.homeAddress ? `${selectedDriver.homeAddress}, ${selectedDriver.street}` : 'TC 14/820, Silver Cascade, Vazhuthacaud'}, {selectedDriver.city}, {selectedDriver.state || 'Kerala'}
                        </div>
                      </div>

                      {/* Compliance Document Cards (Driving Licence & Aadhaar) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                            Verified Compliance Documents (Tap to inspect)
                          </span>
                          <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>
                            2/2 Uploaded
                          </span>
                        </div>

                        <div className="admin-doc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {/* Driving Licence */}
                          <div
                            onClick={() => selectedDriver.dlPhoto && setIsPhotoPreviewOpen(selectedDriver.dlPhoto)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '16px',
                              background: '#FFFFFF',
                              border: '1px solid #E5E7EB',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10.5px', color: '#6B7280', fontWeight: 700 }}>Driving Licence</span>
                              <span style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 600 }}>Inspect &rarr;</span>
                            </div>
                            <b style={{ fontSize: '12.5px', color: '#121316', display: 'block', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedDriver.dlNumber || 'KL-07-20160049281'}
                            </b>
                            {selectedDriver.dlPhoto ? (
                              <img src={selectedDriver.dlPhoto} alt="DL" style={{ width: '100%', height: '76px', borderRadius: '10px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ height: '76px', borderRadius: '10px', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6B7280' }}>Document Preview</div>
                            )}
                          </div>

                          {/* Aadhaar Card */}
                          <div
                            onClick={() => selectedDriver.aadharPhoto && setIsPhotoPreviewOpen(selectedDriver.aadharPhoto)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '16px',
                              background: '#FFFFFF',
                              border: '1px solid #E5E7EB',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '10.5px', color: '#6B7280', fontWeight: 700 }}>Aadhaar Card</span>
                              <span style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 600 }}>Inspect &rarr;</span>
                            </div>
                            <b style={{ fontSize: '12.5px', color: '#121316', display: 'block', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {selectedDriver.aadharNumber || '4829 1928 4719'}
                            </b>
                            {selectedDriver.aadharPhoto ? (
                              <img src={selectedDriver.aadharPhoto} alt="Aadhaar" style={{ width: '100%', height: '76px', borderRadius: '10px', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ height: '76px', borderRadius: '10px', background: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#6B7280' }}>Card Preview</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Primary Action Controls */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                        {selectedDriver.status !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleApprove(selectedDriver.id)}
                            style={{
                              width: '100%',
                              background: '#10B981',
                              color: '#FFFFFF',
                              border: 'none',
                              borderRadius: '14px',
                              padding: '12px',
                              fontWeight: 700,
                              fontSize: '13.5px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              boxShadow: '0 3px 12px rgba(16, 185, 129, 0.25)'
                            }}
                          >
                            <Icons.Check />
                            <span>Approve KYC & Activate Driver</span>
                          </button>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenRejectModal(selectedDriver.id)}
                            style={{
                              background: '#FEF2F2',
                              color: '#EF4444',
                              border: '1px solid #FECACA',
                              borderRadius: '12px',
                              padding: '11px',
                              fontWeight: 700,
                              fontSize: '12.5px',
                              cursor: 'pointer'
                            }}
                          >
                            Reject KYC
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSuspend(selectedDriver.id)}
                            style={{
                              background: '#F4F5F7',
                              color: '#121316',
                              border: '1px solid #E5E7EB',
                              borderRadius: '12px',
                              padding: '11px',
                              fontWeight: 600,
                              fontSize: '12.5px',
                              cursor: 'pointer'
                            }}
                          >
                            {selectedDriver.status === 'suspended' ? 'Re-activate Partner' : 'Suspend Account'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Drivers Registry Table / Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredDrivers.length === 0 ? (
                  <div
                    style={{
                      padding: '64px 24px',
                      textAlign: 'center',
                      background: T.card,
                      borderRadius: '24px',
                      border: `1px solid ${T.border}`
                    }}
                  >
                    <b style={{ fontSize: '16px', color: T.ink, display: 'block' }}>No driver records found</b>
                    <p style={{ fontSize: '13px', color: T.inkMuted, margin: '6px 0 0' }}>
                      {searchQuery ? 'Try clearing your search query.' : 'Newly registered drivers will appear here.'}
                    </p>
                  </div>
                ) : (
                  filteredDrivers.map(drv => {
                    const isSelected = selectedDriver?.id === drv.id;
                    const isPending = drv.status === 'pending' || drv.category === 'new_registration';
                    return (
                      <div
                        key={drv.id}
                        className="admin-driver-item"
                        onClick={() => setSelectedDriver(drv)}
                        style={{
                          background: isSelected ? '#FFFCF0' : T.card,
                          border: isSelected ? `2px solid ${T.taxi}` : `1px solid ${T.border}`,
                          boxShadow: T.shadowCard
                        }}
                      >
                        {/* Driver Left Identity */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              background: T.surface,
                              overflow: 'hidden',
                              border: `1px solid ${T.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '17px',
                              flexShrink: 0
                            }}
                          >
                            {drv.avatar ? (
                              <img src={drv.avatar} alt={drv.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              drv.name?.[0] || 'D'
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <b style={{ fontSize: '15.5px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {drv.name}
                              </b>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: T.surface,
                                  color: T.ink,
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {drv.id}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: T.inkMuted, flexWrap: 'wrap' }}>
                              <span>{drv.phone}</span>
                              <span>{drv.city} (PIN: <strong style={{ color: T.ink }}>{drv.pincode}</strong>)</span>
                            </div>
                          </div>
                        </div>

                        {/* Driver Right Status & Action */}
                        <div className="admin-driver-item-right">
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '4px 10px',
                              borderRadius: '8px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background:
                                drv.status === 'approved' ? T.greenSoft :
                                drv.status === 'pending' ? T.amberSoft :
                                T.redSoft,
                              color:
                                drv.status === 'approved' ? T.green :
                                drv.status === 'pending' ? T.amber :
                                T.red,
                              border: `1px solid ${
                                drv.status === 'approved' ? T.greenBorder :
                                drv.status === 'pending' ? T.amberBorder :
                                T.redBorder
                              }`
                            }}
                          >
                            {drv.status === 'pending' ? 'Pending Review' : drv.status}
                          </span>

                          {isPending && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprove(drv.id);
                              }}
                              style={{
                                background: T.green,
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '10px',
                                padding: '7px 14px',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2)'
                              }}
                            >
                              Approve
                            </button>
                          )}

                          <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? T.ink : T.inkDim }}>
                            {isSelected ? 'Expanded ▲' : 'View ▶'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: TRIP FINANCIAL CALCULATIONS & SIMULATOR
             ======================================================== */}
          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div
                style={{
                  background: T.card,
                  borderRadius: '24px',
                  border: `1px solid ${T.border}`,
                  padding: '32px',
                  boxShadow: T.shadowCard
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div>
                    <h2 style={{ fontFamily: T.fontDisplay, fontSize: '19px', fontWeight: 800, margin: '0 0 4px', color: T.ink }}>
                      Interactive Tariff & Revenue Simulator
                    </h2>
                    <span style={{ fontSize: '13px', color: T.inkMuted }}>
                      Calculate Gross Booking Volume, 15% Platform Commission, and Driver Take-Home
                    </span>
                  </div>
                  <span style={{ padding: '6px 14px', borderRadius: '10px', background: T.taxiSoft, color: '#855D00', fontSize: '12px', fontWeight: 800 }}>
                    15% Standard Fee
                  </span>
                </div>

                <div className="admin-simulator-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '36px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: T.ink }}>Average Trip Fare</span>
                        <b style={{ fontSize: '14.5px', color: T.ink }}>₹{simFare}</b>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="5000"
                        step="50"
                        value={simFare}
                        onChange={e => setSimFare(Number(e.target.value))}
                        style={{ width: '100%', accentColor: T.taxi }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: T.inkDim, marginTop: '4px' }}>
                        <span>₹200 (Short City Ride)</span>
                        <span>₹5,000 (Intercity / Airport Transfer)</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: T.ink }}>Platform Commission Rate (%)</span>
                        <b style={{ fontSize: '14.5px', color: T.ink }}>{simCommission}%</b>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        step="1"
                        value={simCommission}
                        onChange={e => setSimCommission(Number(e.target.value))}
                        style={{ width: '100%', accentColor: T.taxi }}
                      />
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 600, color: T.ink }}>Daily Trips per Driver</span>
                        <b style={{ fontSize: '14.5px', color: T.ink }}>{simTripVolume} trips/day</b>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={simTripVolume}
                        onChange={e => setSimTripVolume(Number(e.target.value))}
                        style={{ width: '100%', accentColor: T.taxi }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      background: T.surface,
                      borderRadius: '20px',
                      padding: '28px',
                      border: `1px solid ${T.border}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
                        Per-Ride Revenue Breakdown
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: T.inkMuted }}>Gross Booking Fare:</span>
                          <b style={{ color: T.ink }}>₹{simFare}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: '#855D00', fontWeight: 600 }}>Ridingo Commission ({simCommission}%):</span>
                          <b style={{ color: '#855D00' }}>+ ₹{Math.round(simFare * (simCommission / 100))}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ color: T.green, fontWeight: 600 }}>Driver Partner Share ({100 - simCommission}%):</span>
                          <b style={{ color: T.green }}>₹{Math.round(simFare * ((100 - simCommission) / 100))}</b>
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${T.borderStrong}`, paddingTop: '18px', marginTop: '18px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Monthly Net Platform Revenue
                          </span>
                          <div style={{ fontFamily: T.fontDisplay, fontSize: '26px', fontWeight: 800, color: T.ink, letterSpacing: '-0.02em', marginTop: '2px' }}>
                            ₹{Math.round(simFare * (simCommission / 100) * simTripVolume * 30).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <span style={{ fontSize: '11.5px', color: T.green, fontWeight: 700, background: T.greenSoft, padding: '5px 12px', borderRadius: '8px' }}>
                          Projected
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: LIVE TRIPS & DISPATCH
             ======================================================== */}
          {activeTab === 'trips' && (
            <div
              style={{
                background: T.card,
                borderRadius: '24px',
                border: `1px solid ${T.border}`,
                padding: '28px',
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                <div>
                  <h2 style={{ fontFamily: T.fontDisplay, fontSize: '19px', fontWeight: 800, margin: '0 0 4px', color: T.ink }}>
                    Live Trips & Dispatch Feed
                  </h2>
                  <span style={{ fontSize: '13px', color: T.inkMuted }}>
                    Real-time ride telemetry recorded across Kochi and Thiruvananthapuram
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.green, background: T.greenSoft, padding: '5px 12px', borderRadius: '8px' }}>
                  Real-time Sync
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {trips.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: T.inkMuted }}>
                    No trips logged currently. Book rides from User App to test telemetry.
                  </div>
                ) : (
                  trips.map(trip => (
                    <div
                      key={trip.id}
                      className="admin-row-item"
                      style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink }}>
                          <Icons.Car />
                        </div>
                        <div>
                          <b style={{ fontSize: '14.5px', color: T.ink }}>Trip #{trip.id}</b>
                          <div style={{ fontSize: '12.5px', color: T.inkMuted, marginTop: '2px' }}>
                            <span>{trip.pickup || 'Kakkanad Infopark'}</span> &rarr; <span>{trip.drop || 'Cochin Airport (COK)'}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <b style={{ fontSize: '15px', color: T.ink }}>₹{trip.fare || 650}</b>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: T.greenSoft, color: T.green }}>
                          Completed
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 4: CUSTOMER ACCOUNTS DIRECTORY
             ======================================================== */}
          {activeTab === 'users' && (
            <div
              style={{
                background: T.card,
                borderRadius: '24px',
                border: `1px solid ${T.border}`,
                padding: '28px',
                boxShadow: T.shadowCard
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
                <div>
                  <h2 style={{ fontFamily: T.fontDisplay, fontSize: '19px', fontWeight: 800, margin: '0 0 4px', color: T.ink }}>
                    Customer Profiles & Lifetime Value (LTV)
                  </h2>
                  <span style={{ fontSize: '13px', color: T.inkMuted }}>
                    Registered riders synced across User App, Google Auth & Supabase
                  </span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: T.blue, background: T.blueSoft, padding: '5px 12px', borderRadius: '8px' }}>
                  {usersList.length} Active Riders
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {usersList.map(usr => (
                  <div
                    key={usr.id}
                    className="admin-row-item"
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.border}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: T.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '15px', color: T.ink }}>
                        {usr.name?.[0] || 'U'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <b style={{ fontSize: '14.5px', color: T.ink }}>{usr.name}</b>
                          <span style={{ fontSize: '11px', color: T.inkMuted, background: T.card, padding: '2px 7px', borderRadius: '6px' }}>{usr.id}</span>
                        </div>
                        <div style={{ fontSize: '12.5px', color: T.inkMuted, marginTop: '2px' }}>
                          <span>{usr.phone}</span> • <span>{usr.email}</span> • <span>{usr.city || 'Kochi'}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: T.inkDim, textTransform: 'uppercase', display: 'block' }}>Rides</span>
                        <b style={{ fontSize: '14px', color: T.ink }}>{usr.rides || 1} completed</b>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: T.inkDim, textTransform: 'uppercase', display: 'block' }}>LTV Spend</span>
                        <b style={{ fontSize: '15px', color: T.green }}>₹{(usr.spent || 650).toLocaleString('en-IN')}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 5: OFFER BANNERS & SLIDES (MARKETING & NAVIGATION)
             ======================================================== */}
          {activeTab === 'banners' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header Box */}
              <div
                style={{
                  background: T.card,
                  borderRadius: '24px',
                  border: `1px solid ${T.border}`,
                  padding: '28px 32px',
                  boxShadow: T.shadowCard,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '20px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h2 style={{ fontFamily: T.fontDisplay, fontSize: '20px', fontWeight: 800, margin: 0, color: T.ink }}>
                      Offer Banners & Promotional Slides
                    </h2>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: '999px',
                        background: T.greenSoft,
                        color: T.green,
                        fontSize: '11px',
                        fontWeight: 800
                      }}
                    >
                      {banners.filter(b => b.active).length} Running Live
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: T.inkMuted, margin: 0, maxWidth: '650px', lineHeight: 1.45 }}>
                    Upload banner slides, assign promotional discounts, and choose which service booking page users navigate to when tapping the banner in the User App.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddBanner}
                  style={{
                    background: T.taxi,
                    color: '#000000',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '12px 22px',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(255, 199, 10, 0.35)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '16px', fontWeight: 900 }}>+</span>
                  <span>Create Offer Banner Slide</span>
                </button>
              </div>

              {/* Banners Grid / List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {banners.map((b, idx) => {
                  const srv = SERVICE_OPTIONS.find(s => s.id === b.category) || SERVICE_OPTIONS[0];
                  return (
                    <div
                      key={b.id || idx}
                      style={{
                        background: T.card,
                        borderRadius: '20px',
                        border: `1px solid ${b.active ? T.borderStrong : T.border}`,
                        padding: '20px 24px',
                        boxShadow: T.shadowCard,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '20px',
                        opacity: b.active ? 1 : 0.65,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Left: Thumbnail Preview & Content */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0, flex: 1 }}>
                        {/* Slide Thumbnail */}
                        <div
                          style={{
                            width: '110px',
                            height: '70px',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            flexShrink: 0,
                            background: (b.imageMobile || b.imageUrl || b.imageTablet)
                              ? `url(${b.imageMobile || b.imageUrl || b.imageTablet}) center/cover no-repeat`
                              : (b.bgGradient || 'linear-gradient(135deg, #0A0F1D 0%, #1E293B 100%)'),
                            border: '1px solid rgba(0,0,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                          }}
                        >
                          {!(b.imageMobile || b.imageUrl || b.imageTablet) && (
                            <span style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 800, textTransform: 'uppercase', opacity: 0.8 }}>
                              {b.tag || 'Slide'}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: srv.color,
                                color: '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 10px',
                                borderRadius: '999px',
                                letterSpacing: '0.02em',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <span>➔</span>
                              <span>Target: {srv.name}</span>
                            </span>
                            <span style={{ fontSize: '11.5px', color: T.inkMuted, fontWeight: 600 }}>• Slide #{idx + 1}</span>

                            {/* Responsive Assets Badges */}
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: T.surfaceHover, color: T.ink }}>
                              📱 Mobile: {b.imageMobile || b.imageUrl ? '✓ 1000px' : 'Pending'}
                            </span>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: T.surfaceHover, color: b.imageTablet ? T.green : T.inkMuted }}>
                              📱 iPad/Tablet: {b.imageTablet ? '✓ 1400px' : 'Auto-Scaled'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', color: T.ink, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              CTA Button:
                              <strong
                                style={{
                                  color: b.ctaTextColor || '#000000',
                                  background: b.ctaBgColor || '#FFFFFF',
                                  padding: '3px 10px',
                                  borderRadius: '8px',
                                  border: `1px solid ${T.borderStrong}`,
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
                                }}
                              >
                                "{b.cta || 'Book Now'}"
                              </strong>
                            </span>
                            <span style={{ fontSize: '12px', color: T.inkMuted }}>
                              Tapping opens <strong>{srv.name}</strong> booking modal directly
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleBanner(b.id)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${b.active ? T.greenBorder : T.borderStrong}`,
                            background: b.active ? T.greenSoft : T.surface,
                            color: b.active ? T.green : T.inkMuted,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {b.active ? '● Live on App' : '○ Paused'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditBanner(b)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '10px',
                            border: `1px solid ${T.borderStrong}`,
                            background: T.card,
                            color: T.ink,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(b.id)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${T.redBorder}`,
                            background: T.redSoft,
                            color: T.red,
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================
          DOCUMENT PHOTO ZOOM MODAL
         ======================================================== */}
      {isPhotoPreviewOpen && (
        <div
          onClick={() => setIsPhotoPreviewOpen(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card,
              borderRadius: '24px',
              padding: '20px',
              maxWidth: '650px',
              width: '100%',
              boxShadow: T.shadowElevated,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '14px', color: T.ink }}>Document Inspection Preview</b>
              <button
                type="button"
                onClick={() => setIsPhotoPreviewOpen(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMuted, display: 'flex' }}
              >
                <Icons.Close />
              </button>
            </div>
            <img
              src={isPhotoPreviewOpen}
              alt="KYC Document Preview"
              style={{ width: '100%', height: 'auto', maxHeight: '70vh', objectFit: 'contain', borderRadius: '16px' }}
            />
          </div>
        </div>
      )}

      {/* ========================================================
          REJECT KYC REASON MODAL
         ======================================================== */}
      {rejectModalDriverId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
        >
          <div
            style={{
              background: T.card,
              borderRadius: '24px',
              padding: '28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: T.shadowElevated,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <b style={{ fontSize: '16px', color: T.red }}>Reject Driver KYC</b>
              <button
                type="button"
                onClick={() => setRejectModalDriverId(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMuted, display: 'flex' }}
              >
                <Icons.Close />
              </button>
            </div>
            <p style={{ fontSize: '13px', color: T.inkMuted, margin: 0, lineHeight: 1.45 }}>
              Specify the compliance reason for rejecting partner <strong>{rejectModalDriverId}</strong>. The driver will receive an automated notification to re-upload documents.
            </p>
            <textarea
              rows={3}
              value={rejectReasonInput}
              onChange={e => setRejectReasonInput(e.target.value)}
              placeholder="Enter rejection reason..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                borderRadius: '14px',
                border: `1px solid ${T.borderStrong}`,
                fontFamily: T.fontSans,
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setRejectModalDriverId(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  background: T.surface,
                  color: T.ink,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                style={{
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: T.red,
                  color: '#FFFFFF',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD NEW DRIVER MODAL (CRM MINIMAL APPAREL)
         ======================================================== */}
      {isAddDriverModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '24px'
          }}
        >
          <form
            onSubmit={handleCreateDriverSubmit}
            style={{
              background: T.card,
              borderRadius: '26px',
              padding: '30px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: T.shadowElevated,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontFamily: T.fontDisplay, fontSize: '18px', fontWeight: 800, margin: 0, color: T.ink }}>
                  Register New Driver Profile
                </h3>
                <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                  Creates an executive driver partner record in the local and Supabase registry
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDriverModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMuted, display: 'flex' }}
              >
                <Icons.Close />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Arun Madhavan"
                  value={newDriverName}
                  onChange={e => setNewDriverName(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 94471 28392"
                    value={newDriverPhone}
                    onChange={e => setNewDriverPhone(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="driver@gmail.com"
                    value={newDriverEmail}
                    onChange={e => setNewDriverEmail(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                  Door / Flat / Residential Address
                </label>
                <input
                  type="text"
                  placeholder="TC 14/820, Silver Cascade"
                  value={newDriverAddress}
                  onChange={e => setNewDriverAddress(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    City
                  </label>
                  <input
                    type="text"
                    value={newDriverCity}
                    onChange={e => setNewDriverCity(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    PIN Code (6-digit)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={newDriverPin}
                    onChange={e => setNewDriverPin(e.target.value.replace(/\D/g, ''))}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px', fontWeight: 700 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    Driving License No.
                  </label>
                  <input
                    type="text"
                    placeholder="KL-07-20190038291"
                    value={newDriverDl}
                    onChange={e => setNewDriverDl(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: T.inkMuted, textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '5px', letterSpacing: '0.04em' }}>
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    placeholder="4829 1928 4719"
                    value={newDriverAadhar}
                    onChange={e => setNewDriverAadhar(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '11px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, outline: 'none', fontSize: '13px' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                onClick={() => setIsAddDriverModalOpen(false)}
                style={{
                  padding: '11px 20px',
                  borderRadius: '12px',
                  border: `1px solid ${T.borderStrong}`,
                  background: T.surface,
                  color: T.ink,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '11px 22px',
                  borderRadius: '12px',
                  border: 'none',
                  background: T.taxi,
                  color: '#000000',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(255, 199, 10, 0.3)'
                }}
              >
                Register & Verify Driver
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================
          OFFER BANNER CREATE & EDIT MODAL
         ======================================================== */}
      {isBannerModalOpen && (
        <div
          onClick={() => setIsBannerModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.card,
              borderRadius: '26px',
              padding: '28px 32px',
              maxWidth: '740px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: T.shadowElevated,
              display: 'flex',
              flexDirection: 'column',
              gap: '22px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.border}`, paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: T.fontDisplay, fontSize: '19px', fontWeight: 800, margin: '0 0 4px', color: T.ink }}>
                  {editingBannerId ? 'Edit Responsive Offer Banner Slide' : 'Create Responsive Offer Banner Slide'}
                </h3>
                <span style={{ fontSize: '12.5px', color: T.inkMuted }}>
                  Upload responsive graphics for mobile phones & tablets/iPads, assign target service, and configure CTA button.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.inkMuted, display: 'flex', padding: '6px' }}
              >
                <Icons.Close />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* 1. RESPONSIVE MULTI-IMAGE UPLOADING (Mobile Phones & iPads/Tablets) */}
              <div style={{ background: T.surface, padding: '20px 22px', borderRadius: '20px', border: `1px solid ${T.border}` }}>
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 850, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      1. Upload Banner Graphics (Mobile & Tablet)
                    </label>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: T.inkDim, background: T.card, padding: '3px 9px', borderRadius: '8px', border: `1px solid ${T.borderStrong}` }}>
                      Aspect Ratio: 2.5:1
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: T.inkMuted, marginTop: '3px', display: 'block' }}>
                    Upload separate image sizes to ensure flawless resolution on mobile smartphones and iPads/tablets without cropping.
                  </span>
                </div>

                {/* Hidden File Inputs */}
                <input
                  type="file"
                  ref={mobileFileInputRef}
                  accept="image/*"
                  onChange={handleMobileImageUpload}
                  style={{ display: 'none' }}
                />
                <input
                  type="file"
                  ref={tabletFileInputRef}
                  accept="image/*"
                  onChange={handleTabletImageUpload}
                  style={{ display: 'none' }}
                />

                {/* 2-Slot Grid: Mobile Phone + iPad/Tablet */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  
                  {/* SLOT A: 📱 Mobile Phone Graphic */}
                  <div
                    style={{
                      background: T.card,
                      borderRadius: '16px',
                      border: `1.5px solid ${bannerForm.imageMobile ? T.borderStrong : T.border}`,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px' }}>📱</span>
                        <b style={{ fontSize: '12.5px', color: T.ink }}>Mobile Phone Banner</b>
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: bannerForm.imageMobile ? T.greenSoft : T.surfaceHover,
                          color: bannerForm.imageMobile ? T.green : T.inkMuted
                        }}
                      >
                        {bannerForm.imageMobile ? '✓ 1000×400 Ready' : '1000 × 400 px'}
                      </span>
                    </div>

                    {bannerForm.imageMobile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '2.5 / 1',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: `1px solid ${T.borderStrong}`,
                            background: '#090D1A',
                            position: 'relative'
                          }}
                        >
                          <img
                            src={bannerForm.imageMobile}
                            alt="Mobile Banner Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => mobileFileInputRef.current?.click()}
                            style={{
                              flex: 1,
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: `1px solid ${T.borderStrong}`,
                              background: T.surface,
                              color: T.ink,
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Replace Mobile Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setBannerForm(prev => ({ ...prev, imageMobile: '', imageUrl: prev.imageTablet || '' }))}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: `1px solid ${T.redBorder}`,
                              background: T.redSoft,
                              color: T.red,
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          onClick={() => mobileFileInputRef.current?.click()}
                          style={{
                            border: `2px dashed ${T.borderStrong}`,
                            borderRadius: '12px',
                            padding: '22px 14px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: T.surface,
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px', color: T.inkMuted }}>
                            <Icons.Image />
                          </div>
                          <b style={{ fontSize: '12.5px', color: T.ink, display: 'block' }}>
                            Upload Mobile Graphic
                          </b>
                          <span style={{ fontSize: '11px', color: T.inkDim, marginTop: '2px', display: 'block' }}>
                            Recommended: 1000 × 400 px (Max 3.5MB)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="url"
                            placeholder="Or paste mobile image URL..."
                            value={bannerForm.imageMobile}
                            onChange={e => {
                              const val = e.target.value;
                              setBannerForm(prev => ({ ...prev, imageMobile: val, imageUrl: val, imageTablet: prev.imageTablet || val }));
                            }}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: `1px solid ${T.borderStrong}`,
                              fontSize: '11.5px',
                              outline: 'none',
                              background: T.card
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SLOT B: 📱 iPad & Tablet Graphic */}
                  <div
                    style={{
                      background: T.card,
                      borderRadius: '16px',
                      border: `1.5px solid ${bannerForm.imageTablet ? T.borderStrong : T.border}`,
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px' }}>📱</span>
                        <b style={{ fontSize: '12.5px', color: T.ink }}>iPad & Tablet Banner</b>
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: bannerForm.imageTablet ? T.greenSoft : T.surfaceHover,
                          color: bannerForm.imageTablet ? T.green : T.inkMuted
                        }}
                      >
                        {bannerForm.imageTablet ? '✓ 1400×560 Ready' : '1400 × 560 px'}
                      </span>
                    </div>

                    {bannerForm.imageTablet ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '2.5 / 1',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: `1px solid ${T.borderStrong}`,
                            background: '#090D1A',
                            position: 'relative'
                          }}
                        >
                          <img
                            src={bannerForm.imageTablet}
                            alt="iPad/Tablet Banner Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => tabletFileInputRef.current?.click()}
                            style={{
                              flex: 1,
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: `1px solid ${T.borderStrong}`,
                              background: T.surface,
                              color: T.ink,
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Replace Tablet Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setBannerForm(prev => ({ ...prev, imageTablet: '' }))}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              border: `1px solid ${T.redBorder}`,
                              background: T.redSoft,
                              color: T.red,
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div
                          onClick={() => tabletFileInputRef.current?.click()}
                          style={{
                            border: `2px dashed ${T.borderStrong}`,
                            borderRadius: '12px',
                            padding: '22px 14px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: T.surface,
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px', color: T.inkMuted }}>
                            <Icons.Image />
                          </div>
                          <b style={{ fontSize: '12.5px', color: T.ink, display: 'block' }}>
                            Upload iPad / Tablet Graphic
                          </b>
                          <span style={{ fontSize: '11px', color: T.inkDim, marginTop: '2px', display: 'block' }}>
                            Recommended: 1400 × 560 px (Auto-scales mobile if empty)
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="url"
                            placeholder="Or paste tablet image URL..."
                            value={bannerForm.imageTablet}
                            onChange={e => setBannerForm(prev => ({ ...prev, imageTablet: e.target.value }))}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '8px 10px',
                              borderRadius: '10px',
                              border: `1px solid ${T.borderStrong}`,
                              fontSize: '11.5px',
                              outline: 'none',
                              background: T.card
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* 2. TARGET SERVICE NAVIGATION SELECTOR (User's primary requirement) */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                  2. Select Target Service (Navigates to this service booking page when clicked)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {SERVICE_OPTIONS.map(srv => {
                    const isSelected = bannerForm.category === srv.id;
                    return (
                      <div
                        key={srv.id}
                        onClick={() => handleServiceSelect(srv.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: isSelected ? `2px solid ${srv.color}` : `1px solid ${T.borderStrong}`,
                          background: isSelected ? `${srv.color}15` : T.card,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '16px' }}>
                            {srv.id === 'airport' ? '✈️' : srv.id === 'hourly' ? '⏱️' : srv.id === 'daily' ? '☀️' : srv.id === 'outstation' ? '🛣️' : '🌙'}
                          </span>
                          {isSelected && (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: srv.color }} />
                          )}
                        </div>
                        <b style={{ fontSize: '13px', color: isSelected ? srv.color : T.ink, lineHeight: 1.25 }}>
                          {srv.name}
                        </b>
                        <span style={{ fontSize: '11px', color: T.inkMuted }}>
                          {srv.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. CTA BUTTON CONFIGURATION */}
              <div style={{ background: T.surface, padding: '16px 20px', borderRadius: '18px', border: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                      3. CTA Button on Image (Book Now / Claim Now)
                    </label>
                    <span style={{ fontSize: '11.5px', color: T.inkMuted }}>
                      Select which action button is displayed directly on the banner
                    </span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, color: T.ink }}>
                    <input
                      type="checkbox"
                      checked={bannerForm.showCta !== false}
                      onChange={e => setBannerForm(prev => ({ ...prev, showCta: e.target.checked }))}
                      style={{ accentColor: T.taxi, width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <span>Show CTA Button</span>
                  </label>
                </div>

                {bannerForm.showCta !== false && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Quick 1-Tap Selectors: Book Now vs Claim Now */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setBannerForm(prev => ({ ...prev, cta: 'Book Now' }))}
                        style={{
                          flex: '1 1 140px',
                          padding: '11px 18px',
                          borderRadius: '12px',
                          border: bannerForm.cta === 'Book Now' ? `2px solid ${T.taxi}` : `1.5px solid ${T.borderStrong}`,
                          background: bannerForm.cta === 'Book Now' ? '#FFFBEB' : T.card,
                          color: bannerForm.cta === 'Book Now' ? '#000000' : T.ink,
                          fontSize: '13px',
                          fontWeight: bannerForm.cta === 'Book Now' ? 850 : 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: bannerForm.cta === 'Book Now' ? '0 2px 8px rgba(255, 199, 10, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '15px' }}>⚡</span>
                        <span>Book Now</span>
                        {bannerForm.cta === 'Book Now' && (
                          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 900 }}>✓</span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setBannerForm(prev => ({ ...prev, cta: 'Claim Now' }))}
                        style={{
                          flex: '1 1 140px',
                          padding: '11px 18px',
                          borderRadius: '12px',
                          border: bannerForm.cta === 'Claim Now' ? `2px solid ${T.taxi}` : `1.5px solid ${T.borderStrong}`,
                          background: bannerForm.cta === 'Claim Now' ? '#FFFBEB' : T.card,
                          color: bannerForm.cta === 'Claim Now' ? '#000000' : T.ink,
                          fontSize: '13px',
                          fontWeight: bannerForm.cta === 'Claim Now' ? 850 : 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: bannerForm.cta === 'Claim Now' ? '0 2px 8px rgba(255, 199, 10, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontSize: '15px' }}>🎁</span>
                        <span>Claim Now</span>
                        {bannerForm.cta === 'Claim Now' && (
                          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 900 }}>✓</span>
                        )}
                      </button>
                    </div>

                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>
                        Custom Button Text (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Book Now or Claim Now"
                        value={bannerForm.cta}
                        onChange={e => setBannerForm(prev => ({ ...prev, cta: e.target.value }))}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, fontSize: '13px', outline: 'none', background: T.card }}
                      />
                    </div>

                    {/* CTA Button Color Selection Feature */}
                    <div style={{ marginTop: '4px', paddingTop: '14px', borderTop: `1px solid ${T.border}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                        <label style={{ fontSize: '11.5px', fontWeight: 800, color: T.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Button Color Selection (Theme & Branding)
                        </label>
                        <span style={{ fontSize: '11px', color: T.inkMuted }}>
                          Pick preset palette or customize background & text
                        </span>
                      </div>

                      {/* Quick Color Presets */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { id: 'white', label: 'Classic White', bg: '#FFFFFF', text: '#000000', border: 'rgba(0,0,0,0.15)' },
                          { id: 'yellow', label: 'Taxi Yellow', bg: '#FFC70A', text: '#000000', border: 'transparent' },
                          { id: 'green', label: 'Emerald Green', bg: '#10B981', text: '#FFFFFF', border: 'transparent' },
                          { id: 'blue', label: 'Electric Blue', bg: '#3B82F6', text: '#FFFFFF', border: 'transparent' },
                          { id: 'amber', label: 'Sunset Amber', bg: '#F59E0B', text: '#000000', border: 'transparent' },
                          { id: 'red', label: 'Crimson Red', bg: '#EF4444', text: '#FFFFFF', border: 'transparent' },
                          { id: 'violet', label: 'Royal Violet', bg: '#8B5CF6', text: '#FFFFFF', border: 'transparent' },
                          { id: 'dark', label: 'Deep Obsidian', bg: '#0F172A', text: '#FFFFFF', border: 'rgba(255,255,255,0.2)' }
                        ].map(preset => {
                          const isSelected = (bannerForm.ctaBgColor || '#FFFFFF').toUpperCase() === preset.bg.toUpperCase() &&
                                             (bannerForm.ctaTextColor || '#000000').toUpperCase() === preset.text.toUpperCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setBannerForm(prev => ({
                                ...prev,
                                ctaBgColor: preset.bg,
                                ctaTextColor: preset.text
                              }))}
                              style={{
                                padding: '7px 10px',
                                borderRadius: '10px',
                                border: isSelected ? `2px solid ${T.taxi}` : `1px solid ${T.borderStrong}`,
                                background: isSelected ? `${T.taxi}15` : T.card,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: preset.bg,
                                  border: `1.5px solid ${preset.border || 'rgba(0,0,0,0.15)'}`,
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  color: preset.text,
                                  fontWeight: 900
                                }}
                              >
                                {isSelected ? '✓' : ''}
                              </span>
                              <span style={{ fontSize: '11.5px', fontWeight: isSelected ? 800 : 650, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {preset.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom Color Pickers (Background & Text) + Live Button Preview */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'center' }}>
                        {/* 1. Background Color Picker */}
                        <div style={{ background: T.card, padding: '10px 12px', borderRadius: '12px', border: `1px solid ${T.borderStrong}` }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Button Background
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="color"
                              value={bannerForm.ctaBgColor || '#FFFFFF'}
                              onChange={e => setBannerForm(prev => ({ ...prev, ctaBgColor: e.target.value }))}
                              style={{
                                width: '34px',
                                height: '34px',
                                padding: 0,
                                borderRadius: '8px',
                                border: `1px solid ${T.borderStrong}`,
                                cursor: 'pointer',
                                background: 'none'
                              }}
                              title="Pick custom button background color"
                            />
                            <input
                              type="text"
                              value={bannerForm.ctaBgColor || '#FFFFFF'}
                              onChange={e => setBannerForm(prev => ({ ...prev, ctaBgColor: e.target.value }))}
                              placeholder="#FFFFFF"
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: `1px solid ${T.borderStrong}`,
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                outline: 'none',
                                background: T.surface,
                                color: T.ink,
                                fontWeight: 700
                              }}
                            />
                          </div>
                        </div>

                        {/* 2. Text / Icon Color Picker */}
                        <div style={{ background: T.card, padding: '10px 12px', borderRadius: '12px', border: `1px solid ${T.borderStrong}` }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Button Text & Icon
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="color"
                              value={bannerForm.ctaTextColor || '#000000'}
                              onChange={e => setBannerForm(prev => ({ ...prev, ctaTextColor: e.target.value }))}
                              style={{
                                width: '34px',
                                height: '34px',
                                padding: 0,
                                borderRadius: '8px',
                                border: `1px solid ${T.borderStrong}`,
                                cursor: 'pointer',
                                background: 'none'
                              }}
                              title="Pick custom button text/icon color"
                            />
                            <input
                              type="text"
                              value={bannerForm.ctaTextColor || '#000000'}
                              onChange={e => setBannerForm(prev => ({ ...prev, ctaTextColor: e.target.value }))}
                              placeholder="#000000"
                              style={{
                                flex: 1,
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: `1px solid ${T.borderStrong}`,
                                fontSize: '12px',
                                fontFamily: 'monospace',
                                outline: 'none',
                                background: T.surface,
                                color: T.ink,
                                fontWeight: 700
                              }}
                            />
                          </div>
                        </div>

                        {/* 3. Live Preview of Resulting CTA Button */}
                        <div style={{ background: T.card, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${T.borderStrong}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: T.inkMuted, textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                            Button Preview
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span
                              style={{
                                fontSize: '12px',
                                fontWeight: 800,
                                color: bannerForm.ctaTextColor || '#000000',
                                background: bannerForm.ctaBgColor || '#FFFFFF',
                                padding: '6px 16px',
                                borderRadius: '999px',
                                boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: `1px solid ${bannerForm.ctaBgColor === '#FFFFFF' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)'}`
                              }}
                            >
                              <span>{bannerForm.cta || 'Book Now'}</span>
                              <span style={{ fontSize: '11px' }}>➔</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. LIVE IN-APP PREVIEW (Device Switcher: Mobile Phone vs iPad/Tablet) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: T.inkMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Live App Appearance Preview
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: T.surface, padding: '3px', borderRadius: '10px', border: `1px solid ${T.border}` }}>
                    <button
                      type="button"
                      onClick={() => setBannerPreviewMode('mobile')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '7px',
                        border: 'none',
                        background: bannerPreviewMode === 'mobile' ? T.card : 'transparent',
                        color: bannerPreviewMode === 'mobile' ? T.ink : T.inkMuted,
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        boxShadow: bannerPreviewMode === 'mobile' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      📱 Mobile Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setBannerPreviewMode('tablet')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '7px',
                        border: 'none',
                        background: bannerPreviewMode === 'tablet' ? T.card : 'transparent',
                        color: bannerPreviewMode === 'tablet' ? T.ink : T.inkMuted,
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        boxShadow: bannerPreviewMode === 'tablet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                      }}
                    >
                      📱 iPad / Tablet Preview
                    </button>
                  </div>
                </div>

                {(() => {
                  const previewImg = bannerPreviewMode === 'tablet'
                    ? (bannerForm.imageTablet || bannerForm.imageMobile || bannerForm.imageUrl)
                    : (bannerForm.imageMobile || bannerForm.imageUrl || bannerForm.imageTablet);

                  return (
                    <div
                      style={{
                        maxWidth: bannerPreviewMode === 'mobile' ? '410px' : '100%',
                        margin: '0 auto',
                        position: 'relative',
                        aspectRatio: '2.5 / 1',
                        minHeight: '144px',
                        maxHeight: '230px',
                        borderRadius: '24px',
                        overflow: 'hidden',
                        border: '1.5px solid rgba(255, 255, 255, 0.25)',
                        background: previewImg ? '#090D1A' : 'linear-gradient(135deg, #061A15 0%, #0D2C24 45%, #0B1929 100%)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
                      }}
                    >
                      {previewImg ? (
                        <img
                          src={previewImg}
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                      ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px' }}>
                          Upload an image above to see live preview
                        </div>
                      )}

                      {/* Gradient Scrim */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)',
                          pointerEvents: 'none'
                        }}
                      />

                      {/* Floating Bottom-Right CTA Button (Only Book Now / Claim Now) */}
                      {bannerForm.showCta !== false && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '12px',
                            right: '14px',
                            zIndex: 2
                          }}
                        >
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 800,
                              color: bannerForm.ctaTextColor || '#000000',
                              background: bannerForm.ctaBgColor || '#FFFFFF',
                              padding: '5px 14px',
                              borderRadius: '999px',
                              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}
                          >
                            <span>{bannerForm.cta || 'Book Now'}</span>
                            <span style={{ fontSize: '11px' }}>➔</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: `1px solid ${T.border}`, paddingTop: '16px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  style={{
                    padding: '11px 20px',
                    borderRadius: '12px',
                    border: `1px solid ${T.borderStrong}`,
                    background: T.surface,
                    color: T.ink,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '11px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    background: T.taxi,
                    color: '#000000',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 199, 10, 0.35)'
                  }}
                >
                  {editingBannerId ? 'Update & Publish to App' : 'Save & Publish to App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
