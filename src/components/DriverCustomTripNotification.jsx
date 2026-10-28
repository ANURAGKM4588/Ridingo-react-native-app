import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { getLocationUpToFirstComma } from '../utils/locationCleaner';
import { playNativeAlertChime, stopActiveTone } from '../services/pushNotificationService';

/**
 * DriverCustomTripNotification:
 * Modern Minimal Slide-Up Popup Modal for Incoming Trip Requests.
 * 
 * Features:
 * - Ultra-clean, minimal design with smooth countdown progress bar.
 * - Clear hero fare presentation with advance amount badge.
 * - Sleek vertical route timeline connecting pickup and drop locations.
 * - High-contrast modern action buttons (minimalist Decline + high-visibility Accept).
 * - 20s auto-hide countdown timer with sound chime & haptic feedback.
 */
export default function DriverCustomTripNotification({ trip, onAccept, onDecline, onDismiss, onExpand }) {
  const [countdown, setCountdown] = useState(20);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof document !== 'undefined') {
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (docTheme) return docTheme === 'dark';
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Track dynamic theme changes
  useEffect(() => {
    const checkTheme = () => {
      const docTheme = document.documentElement.getAttribute('data-theme');
      if (docTheme) {
        setIsDarkTheme(docTheme === 'dark');
      } else if (window.matchMedia) {
        setIsDarkTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    let mediaQuery = null;
    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', checkTheme);
    }

    return () => {
      observer.disconnect();
      if (mediaQuery) mediaQuery.removeEventListener('change', checkTheme);
    };
  }, []);

  // Audio chime & 20s Countdown Timer with auto-hide
  useEffect(() => {
    setCountdown(20);
    try {
      playNativeAlertChime('alert');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 75, 150, 75, 300]);
      }
    } catch (_) {}

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          stopActiveTone();
          if (onDismiss) {
            onDismiss(trip?.id);
          } else if (onDecline) {
            onDecline(trip?.id);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      stopActiveTone();
    };
  }, [trip?.id]);

  if (!trip) return null;

  const fare = Number(trip.fare) || 600;
  const advance = Number(trip.advance) || Math.round(fare * 0.3);
  
  // Locations cleanly extracted up to the first comma only
  const pickup = getLocationUpToFirstComma(trip.pickup || trip.from, 'Pickup Location');
  const drop = getLocationUpToFirstComma(trip.drop_loc || trip.drop || trip.to, 'Destination');
  const distance = trip.distanceText || trip.distance || '12.4 km';
  const duration = trip.durationText || trip.duration || '28 mins';
  const time = trip.time || trip.scheduled_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const progressPct = Math.max(0, Math.min(100, (countdown / 20) * 100));
  const isUrgent = countdown <= 6;
  const timerBarColor = isUrgent ? '#EF4444' : countdown <= 12 ? '#F59E0B' : '#16A34A';

  const theme = {
    bg: isDarkTheme ? '#12141A' : '#FFFFFF',
    textPrimary: isDarkTheme ? '#F8FAFC' : '#0F172A',
    textSecondary: isDarkTheme ? '#94A3B8' : '#64748B',
    border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    fieldBg: isDarkTheme ? '#1A1D24' : '#F8FAFC',
    cardBorder: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
    pillBorder: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
    handle: isDarkTheme ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    shadow: isDarkTheme
      ? '0 -20px 50px rgba(0, 0, 0, 0.9), 0 0 1px rgba(255, 255, 255, 0.1)'
      : '0 -20px 50px rgba(0, 0, 0, 0.18), 0 0 1px rgba(0, 0, 0, 0.05)'
  };

  return (
    <div
      className="driver-popup-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100010,
        background: 'rgba(0, 0, 0, 0.52)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={() => {
        if (onDismiss) {
          onDismiss(trip?.id);
        } else if (onDecline) {
          onDecline(trip?.id);
        }
      }}
    >
      <div
        className="driver-custom-bottom-popup"
        style={{
          width: '100%',
          maxWidth: '460px',
          background: theme.bg,
          borderTop: theme.border,
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          padding: '0 20px calc(20px + env(safe-area-inset-bottom, 12px))',
          boxShadow: theme.shadow,
          boxSizing: 'border-box',
          color: theme.textPrimary,
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          animation: 'slideUpFromBottom 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sleek Top Countdown Progress Line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3.5px',
            background: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: timerBarColor,
              transition: 'width 1s linear, background-color 0.3s ease',
              borderRadius: '0 2px 2px 0'
            }}
          />
        </div>

        {/* Minimal Centered Drag Indicator */}
        <div
          style={{
            width: '38px',
            height: '4px',
            borderRadius: '999px',
            background: theme.handle,
            margin: '12px auto 14px',
            cursor: 'grab'
          }}
        />

        {/* Header: Minimal Badge + Countdown Timer + Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px'
          }}
        >
          {/* Status Pill with Pulsing Live Dot */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
              border: theme.pillBorder
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#16A34A',
                boxShadow: '0 0 8px rgba(22, 163, 74, 0.6)',
                display: 'inline-block',
                animation: 'pulse 1.8s infinite'
              }}
            />
            <span
              style={{
                fontSize: '11px',
                fontWeight: 750,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: theme.textPrimary
              }}
            >
              New Ride Request
            </span>
          </div>

          {/* Right Action: Countdown Tag & Minimal Dismiss Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 750,
                padding: '3px 9px',
                borderRadius: '999px',
                background: isUrgent ? 'rgba(239, 68, 68, 0.12)' : isDarkTheme ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
                color: isUrgent ? '#EF4444' : theme.textSecondary,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.01em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Icon name="clock" size={12} />
              <span>{countdown}s</span>
            </span>

            <button
              type="button"
              onClick={() => {
                if (onDismiss) {
                  onDismiss(trip?.id);
                } else if (onDecline) {
                  onDecline(trip?.id);
                }
              }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: isDarkTheme ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                border: 'none',
                color: theme.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'transform 0.15s ease, background 0.15s ease'
              }}
              aria-label="Dismiss Notification"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        </div>

        {/* Hero Card: Fare Amount & Timing Details */}
        <div
          onClick={() => {
            if (onExpand) onExpand(trip);
          }}
          style={{
            cursor: 'pointer',
            padding: '14px 16px',
            borderRadius: '18px',
            background: theme.fieldBg,
            border: theme.cardBorder,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'background 0.15s ease'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: theme.textSecondary,
                letterSpacing: '0.05em',
                display: 'block'
              }}
            >
              Estimated Fare
            </span>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 900,
                color: '#16A34A',
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                marginTop: '2px'
              }}
            >
              ₹{fare}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '8px',
                background: '#FFC70A',
                color: '#0F172A',
                letterSpacing: '-0.01em',
                boxShadow: '0 2px 6px rgba(255, 199, 10, 0.25)'
              }}
            >
              ₹{advance} Advance
            </span>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: theme.textSecondary,
                marginTop: '5px',
                letterSpacing: '-0.01em'
              }}
            >
              {time} · {distance} ({duration})
            </div>
          </div>
        </div>

        {/* Modern Minimal Route Timeline */}
        <div
          onClick={() => {
            if (onExpand) onExpand(trip);
          }}
          style={{
            cursor: 'pointer',
            background: theme.fieldBg,
            border: theme.cardBorder,
            borderRadius: '18px',
            padding: '14px 16px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
            {/* Minimal SVG Route Connector */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                width: '12px',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#16A34A',
                  boxShadow: '0 0 6px rgba(22, 163, 74, 0.5)'
                }}
              />
              <div
                style={{
                  width: '2px',
                  flex: 1,
                  background: isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                  margin: '4px 0'
                }}
              />
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  background: '#EF4444',
                  boxShadow: '0 0 6px rgba(239, 68, 68, 0.5)'
                }}
              />
            </div>

            {/* Location Names */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pickup Location */}
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 750,
                    textTransform: 'uppercase',
                    color: theme.textSecondary,
                    letterSpacing: '0.06em',
                    display: 'block'
                  }}
                >
                  Pickup Location
                </span>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 750,
                    color: theme.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px'
                  }}
                  title={pickup}
                >
                  {pickup}
                </div>
              </div>

              {/* Destination Location */}
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 750,
                    textTransform: 'uppercase',
                    color: theme.textSecondary,
                    letterSpacing: '0.06em',
                    display: 'block'
                  }}
                >
                  Destination
                </span>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 750,
                    color: theme.textPrimary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: '1px'
                  }}
                  title={drop}
                >
                  {drop}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Minimal High-End Action Buttons */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.6fr',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Minimalist Decline Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDecline(trip.id);
            }}
            style={{
              height: '48px',
              borderRadius: '14px',
              border: isDarkTheme ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)',
              background: isDarkTheme ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
              color: '#EF4444',
              fontSize: '14px',
              fontWeight: 750,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name="x" size={14} color="#EF4444" />
            <span>Decline</span>
          </button>

          {/* Premium Accept Button */}
          <button
            type="button"
            disabled={isAccepting}
            onClick={(e) => {
              e.stopPropagation();
              if (isAccepting) return;
              setIsAccepting(true);
              onAccept(trip.id);
            }}
            style={{
              height: '48px',
              borderRadius: '14px',
              border: 'none',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 800,
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              opacity: isAccepting ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              boxShadow: '0 4px 16px rgba(22, 163, 74, 0.35)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease'
            }}
          >
            <Icon name="check" size={16} color="#FFFFFF" />
            <span>{isAccepting ? 'Accepting...' : `Accept ₹${fare}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

