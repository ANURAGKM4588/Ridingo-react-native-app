import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import {
  AVAILABLE_TUNES,
  getSelectedCustomTune,
  setSelectedCustomTune,
  playCustomTone
} from '../utils/audioTones';
import { searchGooglePlaces } from '../services/googleMapsService';

export default function ProfileTab() {
  const {
    user,
    updateUserProfile,
    userTheme,
    setUserTheme,
    logout,
    addToast,
    openLegal,
    setView,
    savedHomeLoc,
    savedWorkLoc,
    savedPlacesLoc,
    updateSavedLocation
  } = useApp();

  // Active Minimal Modal:
  // null | 'editProfile' | 'editLocation' | 'sos' | 'temp' | 'lang' | 'concierge' | 'notif_alerts' | 'notif_whatsapp' | 'notif_promo' | 'app_biometric' | 'app_haptic'
  const [activeModal, setActiveModal] = useState(null);
  const [mountNode, setMountNode] = useState(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const node = document.querySelector('#col-u .inner') || document.body;
      setMountNode(node);
    }
  }, []);

  // Form states for modals
  const [editName, setEditName] = useState(user?.name || 'Arjun Menon');
  const [editPhone, setEditPhone] = useState(user?.phone || '+91 98401 23456');
  const [editEmail, setEditEmail] = useState(user?.email || 'arjun.menon@example.com');
  const [editAvatar, setEditAvatar] = useState(user?.avatar || '');
  const [customTune, setCustomTune] = useState(getSelectedCustomTune());
  const fileInputRef = useRef(null);

  // Saved Location editing state
  const [editingLocType, setEditingLocType] = useState(null); // 'home' | 'work' | 'saved'
  const [editingLocAddress, setEditingLocAddress] = useState('');
  const [locSuggestions, setLocSuggestions] = useState([]);

  const handleOpenEditLocation = (type) => {
    setEditingLocType(type);
    const curVal = type === 'home' ? (savedHomeLoc || '') : type === 'work' ? (savedWorkLoc || '') : (savedPlacesLoc || '');
    setEditingLocAddress(curVal);
    setLocSuggestions([]);
    setActiveModal('editLocation');
  };

  const handleLocInputChange = async (val) => {
    setEditingLocAddress(val);
    if (!val || val.trim().length < 2) {
      setLocSuggestions([]);
      return;
    }
    try {
      const results = await searchGooglePlaces(val);
      setLocSuggestions(results || []);
    } catch (_) {
      setLocSuggestions([]);
    }
  };

  const handleSelectLocSuggestion = (item) => {
    const full = item.title + (item.sub ? `, ${item.sub}` : '');
    setEditingLocAddress(full);
    setLocSuggestions([]);
  };

  const handleSaveLocationSetting = (e) => {
    if (e) e.preventDefault();
    const val = editingLocAddress.trim();
    if (!val) {
      addToast('Please enter an address or choose from suggestions', 'warn');
      return;
    }
    if (updateSavedLocation) {
      updateSavedLocation(editingLocType, val);
    }
    const label = editingLocType === 'home' ? 'Home' : editingLocType === 'work' ? 'Work' : 'Saved Place';
    addToast(`${label} address updated: ${val.split(',')[0]}`, 'check');
    setActiveModal(null);
  };

  const handleClearLocationSetting = () => {
    if (updateSavedLocation) {
      updateSavedLocation(editingLocType, '');
    }
    const label = editingLocType === 'home' ? 'Home' : editingLocType === 'work' ? 'Work' : 'Saved Place';
    addToast(`${label} address removed`, 'info');
    setActiveModal(null);
  };

  useEffect(() => {
    if (activeModal === 'editProfile') {
      setEditName(user?.name || 'Arjun Menon');
      setEditPhone(user?.phone || '+91 98401 23456');
      setEditEmail(user?.email || 'arjun.menon@example.com');
      setEditAvatar(user?.avatar || '');
    }
  }, [activeModal, user]);

  const handleAvatarFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast('Image size should be under 5MB', 'warn');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditAvatar(event.target.result);
      addToast('Profile picture selected! Tap Save to apply.', 'check');
    };
    reader.readAsDataURL(file);
  };

  // SOS Contacts modal state
  const [sosList, setSosList] = useState(
    user?.sosContacts || [
      { name: 'Priya Menon', relation: 'Spouse', phone: '+91 98401 98765' },
      { name: 'Vijay Menon', relation: 'Brother', phone: '+91 98401 87654' }
    ]
  );
  const [newSosName, setNewSosName] = useState('');
  const [newSosRelation, setNewSosRelation] = useState('');
  const [newSosPhone, setNewSosPhone] = useState('');

  // AC Preferences modal state
  const [acTemp, setAcTemp] = useState(user?.acTemp || '22°C');
  const [acMode, setAcMode] = useState(user?.acMode || 'Chill');
  const [acPrecool, setAcPrecool] = useState(user?.acPrecool ?? true);

  // Language modal state
  const [selectedLangs, setSelectedLangs] = useState(user?.languages || ['English', 'Hindi', 'Malayalam']);

  // Direct toggle handlers with instant state and storage persistence
  const handleToggle = (key, val, label) => {
    updateUserProfile({ [key]: val });
    addToast(`${label}: ${val ? 'Enabled' : 'Disabled'}`, 'check');
    if (key === 'haptic' && val && navigator.vibrate) {
      try { navigator.vibrate(50); } catch (e) {}
    }
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      addToast('Please enter your full name', 'warn');
      return;
    }
    updateUserProfile({
      name: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      avatar: editAvatar
    });
    setActiveModal(null);
    addToast('Profile & contact details updated', 'check');
  };

  const handleAddSos = (e) => {
    e.preventDefault();
    if (!newSosName.trim() || !newSosPhone.trim()) {
      addToast('Please enter contact name and phone number', 'warn');
      return;
    }
    const updated = [
      ...sosList,
      { name: newSosName.trim(), relation: newSosRelation.trim() || 'Family', phone: newSosPhone.trim() }
    ];
    setSosList(updated);
    updateUserProfile({ sosContacts: updated });
    setNewSosName('');
    setNewSosRelation('');
    setNewSosPhone('');
    addToast(`Added emergency contact ${newSosName.trim()}`, 'check');
  };

  const handleDeleteSos = (idx) => {
    const updated = sosList.filter((_, i) => i !== idx);
    setSosList(updated);
    updateUserProfile({ sosContacts: updated });
    addToast('Emergency contact removed', 'info');
  };

  const handleSaveAc = () => {
    updateUserProfile({
      acTemp,
      acMode,
      acPrecool
    });
    setActiveModal(null);
    addToast(`Cabin preferences saved: ${acTemp} (${acMode})`, 'check');
  };

  const handleToggleLang = (lang) => {
    let next;
    if (selectedLangs.includes(lang)) {
      if (selectedLangs.length === 1) {
        addToast('Please keep at least one preferred language', 'warn');
        return;
      }
      next = selectedLangs.filter(l => l !== lang);
    } else {
      next = [...selectedLangs, lang];
    }
    setSelectedLangs(next);
    updateUserProfile({ languages: next });
  };

  const portalTarget = mountNode || (typeof document !== 'undefined' ? (document.querySelector('#col-u .inner') || document.body) : null);

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* 1. Header */}
      <div className="section-header stagger-1" style={{ marginBottom: '16px' }}>
        <div>
          <div className="eyebrow">Owner Settings</div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Profile &amp; Account
          </h2>
        </div>
      </div>

      {/* 2. User Profile Card */}
      <div className="card prof-card stagger-2" style={{ padding: '16px', borderRadius: '20px', marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={() => setActiveModal('editProfile')}
          >
            {/* Avatar with Camera badge */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  background: 'var(--yellow)',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 800,
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  border: '2px solid var(--surface)'
                }}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name || 'User'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <img
                    src="/app_icon.png"
                    alt="Ridingo"
                    onError={(e) => { e.currentTarget.src = '/App icon.png'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#111827',
                  border: '2px solid var(--card)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                onClick={(e) => { e.stopPropagation(); setActiveModal('editProfile'); }}
                title="Change Photo & Details"
              >
                <Icon name="camera" size={11} />
              </div>
            </div>

            {/* User Meta */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <b style={{ fontSize: '17px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25 }}>
                  {user?.name || 'Arjun Menon'}
                </b>
                {(user?.id || user?.userId) && (
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16A34A', background: 'rgba(22, 163, 74, 0.12)', padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.04em' }}>
                    {user.userId || user.id}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '3px', display: 'block', wordBreak: 'break-all' }}>
                {user?.phone ? user.phone : ''}{user?.phone && user?.email ? ' · ' : ''}{user?.email ? user.email : ''}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveModal('editProfile')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 8px',
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--ink)',
              cursor: 'pointer'
            }}
          >
            Edit
          </button>
        </div>

        {/* Verified Owner & Vehicle Info */}
        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                background: 'rgba(34, 197, 94, 0.14)',
                color: '#16A34A',
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center'
              }}
            >
              Verified Owner
            </span>
            <span style={{ fontSize: '12.5px', color: 'var(--muted)', fontWeight: 500 }}>
              Member since 2024
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 SAVED PLACES & ADDRESSES */}
      <div className="prof-section-title stagger-2">Saved Places &amp; Addresses</div>
      <div className="card stagger-2" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '20px' }}>
        {/* Home Location */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpenEditLocation('home')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', flexShrink: 0 }}>
              <Icon name="home" size={16} />
            </div>
            <div className="prof-set-info" style={{ flex: 1, minWidth: 0 }}>
              <b className="prof-set-title">Home Address</b>
              <span className="prof-set-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {savedHomeLoc ? savedHomeLoc : 'Not configured · Tap to set'}
              </span>
            </div>
          </div>
          <div className="prof-set-action-btn">
            <span>{savedHomeLoc ? 'Edit' : 'Add'}</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>

        {/* Work Location */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpenEditLocation('work')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <div className="prof-set-info" style={{ flex: 1, minWidth: 0 }}>
              <b className="prof-set-title">Work Address</b>
              <span className="prof-set-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {savedWorkLoc ? savedWorkLoc : 'Not configured · Tap to set'}
              </span>
            </div>
          </div>
          <div className="prof-set-action-btn">
            <span>{savedWorkLoc ? 'Edit' : 'Add'}</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>

        {/* Saved Places */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => handleOpenEditLocation('saved')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F172A', flexShrink: 0 }}>
              <Icon name="star" size={16} />
            </div>
            <div className="prof-set-info" style={{ flex: 1, minWidth: 0 }}>
              <b className="prof-set-title">Saved Places</b>
              <span className="prof-set-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {savedPlacesLoc ? savedPlacesLoc : 'Frequent destinations & favorites'}
              </span>
            </div>
          </div>
          <div className="prof-set-action-btn">
            <span>{savedPlacesLoc ? 'Edit' : 'Add'}</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>
      </div>

      {/* 3. SAFETY & SECURITY */}
      <div className="prof-section-title stagger-3">Safety &amp; Security</div>
      <div className="card stagger-3" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '20px' }}>
        {/* Emergency SOS Contacts */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('sos')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Emergency SOS Contacts</b>
            <span className="prof-set-sub">
              {sosList.length} contacts configured ({sosList[0]?.name || 'Priya Menon'})
            </span>
          </div>
          <div className="prof-set-action-btn">
            <span>Manage ({sosList.length})</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>
      </div>

      {/* 4. RIDE PREFERENCES */}
      <div className="prof-section-title stagger-4">Ride Preferences</div>
      <div className="card stagger-4" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '20px' }}>
        {/* Cabin Temperature & AC */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('temp')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Cabin Temperature &amp; AC</b>
            <span className="prof-set-sub">{acTemp} ({acMode}) · {acPrecool ? 'Pre-cool on' : 'Standard'}</span>
          </div>
          <div className="prof-set-action-btn">
            <span>{acTemp}</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>

        {/* Driver Language */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('lang')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Driver Language</b>
            <span className="prof-set-sub">{selectedLangs.join(', ')}</span>
          </div>
          <div className="prof-set-action-btn">
            <span>{selectedLangs.length} Langs</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>
      </div>

      {/* 5. NOTIFICATIONS */}
      <div className="prof-section-title stagger-5">Notifications</div>
      <div className="card stagger-5" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '20px' }}>
        {/* Trip Status Alerts */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('notif_alerts')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Trip Status Alerts</b>
            <span className="prof-set-sub">Push alerts when driver is assigned &amp; arrives</span>
          </div>
          <button
            type="button"
            className={`ios-toggle ${user?.notif !== false ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle('notif', user?.notif === false, 'Trip Status Alerts'); }}
            aria-label="Toggle Trip Status Alerts"
          >
            <span className="ios-toggle-thumb" />
          </button>
        </div>

        {/* WhatsApp Booking Slip */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('notif_whatsapp')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">WhatsApp Booking Slip</b>
            <span className="prof-set-sub">Receive driver license &amp; tracking on WhatsApp</span>
          </div>
          <button
            type="button"
            className={`ios-toggle ${user?.whatsapp !== false ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle('whatsapp', user?.whatsapp === false, 'WhatsApp Booking Slip'); }}
            aria-label="Toggle WhatsApp Booking Slip"
          >
            <span className="ios-toggle-thumb" />
          </button>
        </div>

        {/* Rewards & Cashbacks */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('notif_promo')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Rewards &amp; Cashbacks</b>
            <span className="prof-set-sub">Alerts when trip cashback is added to wallet</span>
          </div>
          <button
            type="button"
            className={`ios-toggle ${user?.promo !== false ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle('promo', user?.promo === false, 'Rewards & Cashback Alerts'); }}
            aria-label="Toggle Rewards & Cashbacks"
          >
            <span className="ios-toggle-thumb" />
          </button>
        </div>
      </div>

      {/* POP UP CUSTOM TUNE */}
      <div className="prof-section-title stagger-5">Pop up Custom Tune</div>
      <div className="card stagger-5" style={{ padding: '16px', borderRadius: '18px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <b className="prof-set-title" style={{ fontSize: '15px' }}>Pop up Alert Sound</b>
            <div className="prof-set-sub" style={{ marginTop: '2px' }}>
              Choose a minimal, copyright-free sound for booking alerts and pop-up notifications
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={customTune}
              onChange={(e) => {
                const val = e.target.value;
                setCustomTune(val);
                setSelectedCustomTune(val);
                playCustomTone(val);
                addToast(`Pop up tune set to ${AVAILABLE_TUNES.find(t => t.id === val)?.name || val}`, 'check');
              }}
              style={{
                flex: 1,
                height: '44px',
                padding: '0 12px',
                borderRadius: '10px',
                border: '1.5px solid var(--line)',
                background: 'var(--field)',
                color: 'var(--ink)',
                fontSize: '14px',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              {AVAILABLE_TUNES.map(tune => (
                <option key={tune.id} value={tune.id}>
                  {tune.name} ({tune.description.split('(')[1]?.replace(')', '') || 'Minimal'})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                playCustomTone(customTune);
              }}
              style={{
                height: '44px',
                padding: '0 16px',
                background: '#000000',
                color: '#FFFFFF',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Play
            </button>
          </div>
        </div>
      </div>

      {/* 6. APP & PRIVACY */}
      <div className="prof-section-title stagger-6">App &amp; Privacy</div>
      <div className="card stagger-6" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '20px' }}>
        {/* Biometric / App Lock */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('app_biometric')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Biometric / App Lock</b>
            <span className="prof-set-sub">Require Face ID or Fingerprint before booking</span>
          </div>
          <button
            type="button"
            className={`ios-toggle ${user?.biometric !== false ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle('biometric', user?.biometric === false, 'Biometric Lock'); }}
            aria-label="Toggle Biometric Lock"
          >
            <span className="ios-toggle-thumb" />
          </button>
        </div>

        {/* Haptic Feedback */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('app_haptic')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Haptic Feedback</b>
            <span className="prof-set-sub">Subtle vibrations on taps and alerts</span>
          </div>
          <button
            type="button"
            className={`ios-toggle ${user?.haptic !== false ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleToggle('haptic', user?.haptic === false, 'Haptic Feedback'); }}
            aria-label="Toggle Haptic Feedback"
          >
            <span className="ios-toggle-thumb" />
          </button>
        </div>

        {/* Terms of Service */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => openLegal && openLegal('terms')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Terms of Service</b>
            <span className="prof-set-sub">Driver transit rules, eligibility &amp; service agreement</span>
          </div>
          <div className="prof-set-action-btn">
            <span>View</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>

        {/* Privacy Policy */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => openLegal && openLegal('privacy')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">Privacy Policy</b>
            <span className="prof-set-sub">Data encryption, number masking &amp; location handling</span>
          </div>
          <div className="prof-set-action-btn">
            <span>View</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>

        {/* Appearance */}
        <div className="prof-set-row" style={{ display: 'block', padding: '14px 0' }}>
          <b className="prof-set-title" style={{ marginBottom: '10px' }}>
            Appearance
          </b>
          <div className="ios-seg-control" role="group" aria-label="Appearance">
            {[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`ios-seg-btn ${userTheme === mode ? 'on' : ''}`}
                onClick={() => setUserTheme(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 7. HELP & SUPPORT */}
      <div className="prof-section-title stagger-6">Help &amp; Support</div>
      <div className="card stagger-6" style={{ padding: '0 16px', borderRadius: '18px', marginBottom: '22px' }}>
        {/* 24/7 Helpline */}
        <div
          className="prof-set-row"
          style={{ cursor: 'pointer' }}
          onClick={() => setActiveModal('concierge')}
        >
          <div className="prof-set-info">
            <b className="prof-set-title">24/7 Helpline</b>
            <span className="prof-set-sub">Dedicated roadside, trip &amp; account assistance</span>
          </div>
          <div className="prof-set-action-btn">
            <span>Call Free</span>
            <Icon name="chevronRight" size={15} />
          </div>
        </div>
      </div>

      {/* 8. Footer: App Version & Sign Out Button */}
      <div className="stagger-6" style={{ textAlign: 'center', padding: '16px 0 12px', width: '100%' }}>
        <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
          Ridingo for Car Owners · v2.4.2
        </p>
        <button
          type="button"
          onClick={logout}
          style={{
            width: '100%',
            height: '50px',
            borderRadius: '16px',
            background: '#DC2626',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'transform 0.15s ease'
          }}
        >
          <Icon name="logout" size={18} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ==========================================================
          MINIMAL INTERACTIVE SETTING POPUP (CENTERED ON CURRENT VIEW)
         ========================================================== */}
      {activeModal && portalTarget && createPortal(
        <div
          style={{
            position: portalTarget === document.body ? 'fixed' : 'absolute',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.58)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fade 0.2s ease',
            borderRadius: portalTarget === document.body ? 0 : '48px',
            overflow: 'hidden'
          }}
        >
          {/* Backdrop dismiss click */}
          <div
            style={{ position: 'absolute', inset: 0 }}
            onClick={() => setActiveModal(null)}
          />

          <div
            className="apple-page-enter"
            style={{
              position: 'relative',
              background: 'var(--surface)',
              borderRadius: '24px',
              border: '1px solid var(--line)',
              width: '100%',
              maxWidth: '350px',
              maxHeight: '85%',
              overflowY: 'auto',
              padding: '18px 20px 22px',
              boxShadow: '0 20px 48px rgba(0, 0, 0, 0.4)',
              zIndex: 2,
              WebkitOverflowScrolling: 'touch',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxSizing: 'border-box'
            }}
          >
            {/* Header: Title + Minimal Close Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--ink)' }}>
                {activeModal === 'editProfile' && 'Edit Profile & Details'}
                {activeModal === 'editLocation' && `Edit ${editingLocType === 'home' ? 'Home' : editingLocType === 'work' ? 'Work' : 'Saved Place'} Address`}
                {activeModal === 'sos' && 'Emergency SOS Contacts'}
                {activeModal === 'temp' && 'Cabin Climate & AC'}
                {activeModal === 'lang' && 'Driver Languages'}
                {activeModal === 'notif_alerts' && 'Trip Status Alerts'}
                {activeModal === 'notif_whatsapp' && 'WhatsApp Trip Slip'}
                {activeModal === 'notif_promo' && 'Rewards & Cashbacks'}
                {activeModal === 'app_biometric' && 'Biometric / App Lock'}
                {activeModal === 'app_haptic' && 'Haptic Feedback'}
                {activeModal === 'concierge' && '24/7 Ridingo Support'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  color: 'var(--muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  flexShrink: 0
                }}
                aria-label="Close"
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            {/* MODAL: EDIT SAVED LOCATION */}
            {activeModal === 'editLocation' && (
              <form onSubmit={handleSaveLocationSetting} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.4 }}>
                  Set your {editingLocType === 'home' ? 'Home' : editingLocType === 'work' ? 'Work' : 'Saved Place'} address for instant 1-tap bookings on the home screen.
                </p>

                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginBottom: '5px' }}>
                    {editingLocType === 'home' ? 'Home Address' : editingLocType === 'work' ? 'Work Address' : 'Saved Place Address'}
                  </label>
                  <input
                    type="text"
                    value={editingLocAddress}
                    onChange={(e) => handleLocInputChange(e.target.value)}
                    placeholder={editingLocType === 'home' ? 'e.g., 14 Anna Nagar, Chennai' : editingLocType === 'work' ? 'e.g., Cyber Park, OMR, Chennai' : 'e.g., Phoenix Marketcity'}
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--line)',
                      background: 'var(--field)',
                      color: 'var(--ink)',
                      fontSize: '14px',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />

                  {/* Location suggestions dropdown */}
                  {locSuggestions.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 99999,
                        marginTop: '4px',
                        background: 'var(--surface)',
                        border: '1px solid var(--line)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}
                    >
                      {locSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectLocSuggestion(item)}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: idx < locSuggestions.length - 1 ? '1px solid var(--line)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                          </svg>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.title}
                            </div>
                            {item.sub && (
                              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.sub}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  {(editingLocType === 'home' ? savedHomeLoc : editingLocType === 'work' ? savedWorkLoc : savedPlacesLoc) && (
                    <button
                      type="button"
                      onClick={handleClearLocationSetting}
                      style={{
                        height: '42px',
                        padding: '0 14px',
                        borderRadius: '12px',
                        background: 'transparent',
                        border: '1.5px solid #EF4444',
                        color: '#EF4444',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Remove
                    </button>
                  )}
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      height: '42px',
                      borderRadius: '12px',
                      background: 'var(--solid)',
                      color: 'var(--on-solid)',
                      border: 'none',
                      fontSize: '13.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                    }}
                  >
                    Save Address
                  </button>
                </div>
              </form>
            )}

            {/* MODAL 1: EDIT PROFILE */}
            {activeModal === 'editProfile' && (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                  <div style={{ position: 'relative' }}>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: 'var(--yellow)',
                        color: '#111827',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        fontWeight: 800,
                        overflow: 'hidden',
                        border: '3px solid var(--surface)',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                        cursor: 'pointer'
                      }}
                      title="Tap to change photo"
                    >
                      {editAvatar ? (
                        <img src={editAvatar} alt="Profile Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (editName ? editName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AM')
                      )}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileSelect}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(250, 204, 21, 0.18)',
                        border: '1px solid var(--yellow)',
                        color: 'var(--ink)',
                        padding: '5px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {editAvatar ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {editAvatar && (
                      <button
                        type="button"
                        onClick={() => { setEditAvatar(''); addToast('Photo removed', 'info'); }}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--line)',
                          color: '#EF4444',
                          padding: '5px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1.5px solid var(--line)', background: 'var(--card)', padding: '0 12px', fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1.5px solid var(--line)', background: 'var(--card)', padding: '0 12px', fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={e => setEditEmail(e.target.value)}
                    style={{ width: '100%', height: '44px', borderRadius: '12px', border: '1.5px solid var(--line)', background: 'var(--card)', padding: '0 12px', fontSize: '14px', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ height: '46px', borderRadius: '14px', background: 'var(--yellow)', color: '#111827', border: 'none', fontSize: '14.5px', fontWeight: 700, cursor: 'pointer', marginTop: '4px' }}
                >
                  Save Profile Details
                </button>
              </form>
            )}

            {/* MODAL 2: SOS CONTACTS */}
            {activeModal === 'sos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0, lineHeight: 1.35 }}>
                  Trusted emergency contacts who receive your live vehicle tracking link &amp; instant alerts.
                </p>

                {/* List of contacts - compact & cleanly fitted without vertical scroll */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {sosList.slice(0, 2).map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '10px',
                        background: 'var(--card)',
                        border: '1px solid var(--line)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Icon name="user" size={14} color="var(--ink)" />
                        <div>
                          <b style={{ fontSize: '12.5px', color: 'var(--ink)' }}>{c.name}</b>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>({c.relation} · {c.phone})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSos(idx)}
                        style={{ color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new contact form - perfectly fitted without scroll */}
                <form onSubmit={handleAddSos} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '6px', borderTop: '1px solid var(--line)' }}>
                  <b style={{ fontSize: '11.5px', color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Add Contact</b>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={newSosName}
                      onChange={e => setNewSosName(e.target.value)}
                      style={{ height: '36px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--card)', padding: '0 10px', fontSize: '12.5px', outline: 'none', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }}
                    />
                    <input
                      type="text"
                      placeholder="Relation (e.g. Spouse)"
                      value={newSosRelation}
                      onChange={e => setNewSosRelation(e.target.value)}
                      style={{ height: '36px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--card)', padding: '0 10px', fontSize: '12.5px', outline: 'none', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <input
                    type="tel"
                    placeholder="Mobile Number (+91 98765 43210)"
                    value={newSosPhone}
                    onChange={e => setNewSosPhone(e.target.value)}
                    style={{ height: '36px', borderRadius: '9px', border: '1px solid var(--line)', background: 'var(--card)', padding: '0 10px', fontSize: '12.5px', outline: 'none', color: 'var(--ink)', width: '100%', boxSizing: 'border-box' }}
                  />
                  <button
                    type="submit"
                    className="btn"
                    style={{ height: '38px', borderRadius: '10px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', marginTop: '2px', width: '100%', boxSizing: 'border-box' }}
                  >
                    + Add Emergency Contact
                  </button>
                </form>
              </div>
            )}

            {/* MODAL 3: CABIN TEMPERATURE & AC */}
            {activeModal === 'temp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  Drivers configure your vehicle's air conditioning to these settings upon arrival.
                </p>

                {/* Temp selector */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                    Target Temperature
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {['18°C', '20°C', '22°C', '24°C', '26°C'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAcTemp(t)}
                        style={{
                          height: '38px',
                          borderRadius: '10px',
                          border: acTemp === t ? '2px solid var(--yellow)' : '1px solid var(--line)',
                          background: acTemp === t ? 'var(--yellow)' : 'var(--card)',
                          color: acTemp === t ? '#111827' : 'var(--ink)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          padding: 0,
                          lineHeight: '1'
                        }}
                      >
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode selector */}
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                    AC Mode
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {['Chill', 'Normal', 'Eco', 'Fan'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAcMode(m)}
                        style={{
                          height: '36px',
                          borderRadius: '10px',
                          border: acMode === m ? '1.5px solid var(--solid)' : '1px solid var(--line)',
                          background: acMode === m ? 'var(--solid)' : 'var(--card)',
                          color: acMode === m ? 'var(--on-solid)' : 'var(--muted)',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          textAlign: 'center',
                          padding: 0,
                          lineHeight: '1'
                        }}
                      >
                        <span>{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-cool toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>Auto Pre-cool Cabin</b>
                    <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>Turn on AC 5 mins before arrival</span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${acPrecool ? 'on' : ''}`}
                    onClick={() => setAcPrecool(!acPrecool)}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveAc}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--yellow)', color: '#111827', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Save Climate Preferences
                </button>
              </div>
            )}

            {/* MODAL 4: DRIVER LANGUAGES */}
            {activeModal === 'lang' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  Select the languages you prefer your assigned driver to communicate in.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {['English', 'Hindi', 'Malayalam', 'Tamil', 'Kannada', 'Telugu', 'Bengali', 'Marathi'].map(lang => {
                    const active = selectedLangs.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleToggleLang(lang)}
                        style={{
                          height: '38px',
                          borderRadius: '10px',
                          border: active ? '2px solid var(--yellow)' : '1px solid var(--line)',
                          background: active ? 'rgba(255, 199, 10, 0.15)' : 'var(--card)',
                          color: active ? 'var(--ink)' : 'var(--muted)',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 10px'
                        }}
                      >
                        <span>{lang}</span>
                        {active && <Icon name="check" size={14} color="var(--on-yellow)" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    addToast(`Updated languages: ${selectedLangs.join(', ')}`, 'check');
                  }}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--yellow)', color: '#111827', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm Languages
                </button>
              </div>
            )}

            {/* MODAL 5: TRIP STATUS ALERTS */}
            {activeModal === 'notif_alerts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Receive prompt push notifications when your driver is assigned, begins travel, arrives at your car, and ends the booking.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>Push Notifications</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      {user?.notif !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${user?.notif !== false ? 'on' : ''}`}
                    onClick={() => handleToggle('notif', user?.notif === false, 'Trip Status Alerts')}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* MODAL 6: WHATSAPP BOOKING SLIP */}
            {activeModal === 'notif_whatsapp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Receive your driver's verified commercial badge, pre-ride vehicle inspection report, and live GPS tracking link on WhatsApp.
                </p>

                <div style={{ fontSize: '12.5px', color: 'var(--ink)', padding: '10px 12px', borderRadius: '12px', background: 'rgba(37, 211, 102, 0.12)', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
                  Linked WhatsApp: <b>{user?.phone || '+91 98401 23456'}</b>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>WhatsApp Updates</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      {user?.whatsapp !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${user?.whatsapp !== false ? 'on' : ''}`}
                    onClick={() => handleToggle('whatsapp', user?.whatsapp === false, 'WhatsApp Booking Slip')}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* MODAL 7: REWARDS & CASHBACKS */}
            {activeModal === 'notif_promo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Get real-time alerts whenever driver cashbacks, wallet vouchers, and seasonal member perks are added to your account.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>Cashback &amp; Perk Alerts</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      {user?.promo !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${user?.promo !== false ? 'on' : ''}`}
                    onClick={() => handleToggle('promo', user?.promo === false, 'Rewards & Cashback Alerts')}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* MODAL 8: BIOMETRIC / APP LOCK */}
            {activeModal === 'app_biometric' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Require Face ID or Fingerprint authentication before confirming any driver booking or accessing vehicle telemetry.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>Biometric Security</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      {user?.biometric !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${user?.biometric !== false ? 'on' : ''}`}
                    onClick={() => handleToggle('biometric', user?.biometric === false, 'Biometric Lock')}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* MODAL 9: HAPTIC FEEDBACK */}
            {activeModal === 'app_haptic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
                  Subtle sensory vibrations when selecting pickup pins, adjusting cabin AC, and tapping confirmation switches.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.vibrate) {
                      try { navigator.vibrate([40, 50, 40]); } catch (e) {}
                    }
                    addToast('Haptic pulse tested', 'check');
                  }}
                  style={{
                    height: '40px',
                    borderRadius: '12px',
                    background: 'var(--card)',
                    border: '1px solid var(--line)',
                    color: 'var(--ink)',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Test Vibration
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1px solid var(--line)' }}>
                  <div>
                    <b style={{ fontSize: '13.5px', color: 'var(--ink)' }}>Tactile Vibrations</b>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      {user?.haptic !== false ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`ios-toggle ${user?.haptic !== false ? 'on' : ''}`}
                    onClick={() => handleToggle('haptic', user?.haptic === false, 'Haptic Feedback')}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="btn"
                  style={{ height: '44px', borderRadius: '12px', background: 'var(--solid)', color: 'var(--on-solid)', border: 'none', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            )}

            {/* MODAL 10: 24/7 RIDINGO SUPPORT */}
            {activeModal === 'concierge' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '12.5px', color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
                  Dedicated roadside assistance, live driver dispatching, and 24/7 account support desk.
                </p>

                {/* Helpline Phone Number Card */}
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(22, 163, 74, 0.12)', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="phone" size={18} color="#16A34A" />
                    </span>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block' }}>
                        24/7 Helpline
                      </span>
                      <b style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>
                        8156938843
                      </b>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addToast('Calling 8156938843...', 'info');
                      window.location.href = 'tel:8156938843';
                    }}
                    style={{ height: '36px', padding: '0 14px', borderRadius: '10px', background: '#16A34A', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span>Call</span>
                  </button>
                </div>

                {/* Email Support Card */}
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--card)', border: '1.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="mail" size={18} color="#2563EB" />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block' }}>
                        Support Email
                      </span>
                      <b style={{ fontSize: '13px', fontWeight: 750, color: 'var(--ink)', wordBreak: 'break-all', display: 'block' }}>
                        support.ridingo@gmail.com
                      </b>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addToast('Opening mail to support.ridingo@gmail.com...', 'info');
                      window.location.href = 'mailto:support.ridingo@gmail.com';
                    }}
                    style={{ height: '36px', padding: '0 12px', borderRadius: '10px', background: '#2563EB', color: '#FFFFFF', border: 'none', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Email
                  </button>
                </div>

                {/* WhatsApp Chat Button */}
                <button
                  type="button"
                  onClick={() => {
                    addToast('Opening WhatsApp Support...', 'check');
                    window.open('https://wa.me/918156938843?text=Hi%20Ridingo%20Support,%20I%20need%20assistance', '_blank');
                  }}
                  style={{ height: '42px', borderRadius: '12px', background: '#25D366', color: '#FFFFFF', border: 'none', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <span>WhatsApp Chat (8156938843)</span>
                </button>
              </div>
            )}
          </div>
        </div>,
        portalTarget
      )}
    </div>
  );
}
