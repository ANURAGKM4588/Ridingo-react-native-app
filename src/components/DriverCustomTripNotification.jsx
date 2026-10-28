import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { getLocationUpToFirstComma } from '../utils/locationCleaner';
import { playNativeAlertChime, stopActiveTone } from '../services/pushNotificationService';

/**
 * DriverCustomTripNotification:
 * Redesigned Incoming Trip Request Popup matching the reference design exactly.
 * Supports both Light and Dark themes with 100% faithful styling.
 *
 * @param {Object} props
 * @param {Object} props.trip - Incoming trip request data
 * @param {Function} props.onAccept - Accept trip callback
 * @param {Function} props.onDecline - Decline trip callback
 * @param {Function} props.onDismiss - Minimize/dismiss popup callback
 * @param {Function} props.onExpand - Expand trip details callback
 * @param {'light'|'dark'} [props.themeOverride] - Optional manual theme override
 */
export default function DriverCustomTripNotification({
  trip,
  onAccept,
  onDecline,
  onDismiss,
  onExpand,
  themeOverride
}) {
  const [countdown, setCountdown] = useState(15);
  const [isAccepting, setIsAccepting] = useState(false);

  // Determine active theme strictly aligned with Driver App theme preference
  const computeIsDark = () => {
    if (themeOverride === 'dark') return true;
    if (themeOverride === 'light') return false;
    try {
      const driverPref = localStorage.getItem('ridingo_driver_theme') || 'light';
      if (driverPref === 'dark') return true;
      if (driverPref === 'light') return false;
      if (driverPref === 'system' && typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return true;
      }
    } catch (_) {}
    if (typeof document !== 'undefined') {
      const docTheme = document.documentElement.getAttribute('data-theme') || document.body?.getAttribute('data-theme');
      if (docTheme === 'dark') return true;
      if (docTheme === 'light') return false;
    }
    return false;
  };

  const [isDarkTheme, setIsDarkTheme] = useState(computeIsDark);

  // Synchronize theme changes in real-time
  useEffect(() => {
    const handleThemeChange = () => {
      setIsDarkTheme(computeIsDark());
    };

    handleThemeChange();

    let observer = null;
    if (typeof document !== 'undefined') {
      observer = new MutationObserver(handleThemeChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      }
    }

    let mediaQuery = null;
    if (typeof window !== 'undefined' && window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener?.('change', handleThemeChange);
    }

    return () => {
      if (observer) observer.disconnect();
      if (mediaQuery) mediaQuery.removeEventListener?.('change', handleThemeChange);
    };
  }, [themeOverride]);

  // Audio chime & 15s Countdown Timer with auto-hide
  useEffect(() => {
    setCountdown(15);
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

  const fare = Number(trip.fare) || 750;
  const advance = Number(trip.advance) || Math.round(fare * 0.3);

  // Locations cleanly extracted up to the first comma only
  const pickup = getLocationUpToFirstComma(trip.pickup || trip.from, 'Pickup Location');
  const drop = getLocationUpToFirstComma(trip.drop_loc || trip.drop || trip.to, 'Destination');
  const distance = trip.distanceText || trip.distance || '4 km';
  const duration = trip.durationText || trip.duration || '15 mins';

  // Format time (e.g., "04:41 PM")
  const formatTime = () => {
    if (trip.time) return trip.time;
    if (trip.scheduled_time) return trip.scheduled_time;
    try {
      const ts = trip.when_ts || Date.now();
      return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (_) {
      return '04:41 PM';
    }
  };
  const time = formatTime();

  return (
    <div
      className="driver-popup-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100010,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0 12px max(14px, env(safe-area-inset-bottom, 14px))',
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
        className="driver-trip-request-popup-card"
        style={{
          width: '100%',
          maxWidth: '430px',
          background: isDarkTheme ? '#111317' : '#FFFFFF',
          borderRadius: '28px',
          padding: '12px 16px 16px',
          boxShadow: isDarkTheme
            ? '0 -16px 48px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255, 255, 255, 0.08)'
            : '0 -12px 40px rgba(0, 0, 0, 0.14), 0 0 1px rgba(0, 0, 0, 0.06)',
          border: isDarkTheme ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.05)',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-body, "Manrope", sans-serif)',
          userSelect: 'none',
          position: 'relative',
          animation: 'bottomSheetPopIn 0.26s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Top Grab Handle */}
        <div
          style={{
            width: '40px',
            height: '4px',
            borderRadius: '999px',
            background: isDarkTheme ? '#374151' : '#D1D5DB',
            margin: '0 auto 12px'
          }}
        />

        {/* Header Row: Badge on Left, Timer & Close X on Right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}
        >
          {/* Badge: ● NEW RIDE REQUEST */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '999px',
              background: isDarkTheme ? '#0A2518' : '#E8F8F0',
              color: isDarkTheme ? '#34D399' : '#047857',
              fontSize: '11.5px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10B981',
                display: 'inline-block',
                flexShrink: 0
              }}
            />
            <span>NEW RIDE REQUEST</span>
          </div>

          {/* Right Group: 15s Timer Pill + Circle Close Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Countdown Timer Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: isDarkTheme ? '#1F242D' : '#F3F4F6',
                color: isDarkTheme ? '#E5E7EB' : '#374151',
                fontSize: '12.5px',
                fontWeight: 700
              }}
            >
              <Icon name="clock" size={13.5} />
              <span>{countdown}s</span>
            </div>

            {/* Circular Close Button (X) */}
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
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isDarkTheme ? '#1F242D' : '#F3F4F6',
                color: isDarkTheme ? '#9CA3AF' : '#4B5563',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                transition: 'opacity 0.15s ease'
              }}
              aria-label="Close"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        </div>

        {/* Section 1: Estimated Fare Card */}
        <div
          onClick={() => {
            if (onExpand) onExpand(trip);
          }}
          style={{
            background: isDarkTheme ? '#181B22' : '#F5F6F8',
            borderRadius: '18px',
            padding: '14px 16px',
            marginBottom: '12px',
            cursor: 'pointer'
          }}
        >
          {/* Top Row: Label & Advance Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: isDarkTheme ? '#9CA3AF' : '#6B7280',
                letterSpacing: '0.04em'
              }}
            >
              ESTIMATED FARE
            </span>

            {/* Advance Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#FFC70A',
                color: '#000000',
                borderRadius: '8px',
                padding: '4px 9px',
                fontSize: '11.5px',
                fontWeight: 800,
                letterSpacing: '-0.01em'
              }}
            >
              <Icon name="wallet" size={13.5} />
              <span>₹{advance} Advance</span>
            </div>
          </div>

          {/* Bottom Row: Large Green Fare & Time / Distance Subtitle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between'
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#00C265',
                letterSpacing: '-0.02em',
                lineHeight: 1.1
              }}
            >
              ₹{fare}
            </div>

            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: isDarkTheme ? '#9CA3AF' : '#4B5563'
              }}
            >
              {time} · {distance} ({duration})
            </div>
          </div>
        </div>

        {/* Section 2: Locations & Route Card */}
        <div
          onClick={() => {
            if (onExpand) onExpand(trip);
          }}
          style={{
            background: isDarkTheme ? '#181B22' : '#F5F6F8',
            borderRadius: '18px',
            padding: '16px',
            marginBottom: '16px',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
            {/* Left Vertical Timeline Indicator */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '5px 0',
                width: '10px',
                flexShrink: 0
              }}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#10B981',
                  display: 'block'
                }}
              />
              <div
                style={{
                  width: '0',
                  height: '24px',
                  borderLeft: isDarkTheme ? '2px dashed #374151' : '2px dashed #CBD5E1',
                  margin: '4px 0'
                }}
              />
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#EF4444',
                  display: 'block'
                }}
              />
            </div>

            {/* Location Details Column */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              {/* Pickup Location Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <Icon name="pin" size={17} color={isDarkTheme ? '#E5E7EB' : '#111827'} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: isDarkTheme ? '#9CA3AF' : '#6B7280',
                        letterSpacing: '0.04em',
                        display: 'block',
                        lineHeight: 1.2
                      }}
                    >
                      PICKUP LOCATION
                    </span>
                    <div
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 800,
                        color: isDarkTheme ? '#FFFFFF' : '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                        lineHeight: 1.25
                      }}
                      title={pickup}
                    >
                      {pickup}
                    </div>
                  </div>
                </div>
                <Icon name="chevronRight" size={15} color={isDarkTheme ? '#6B7280' : '#9CA3AF'} />
              </div>

              {/* Destination Location Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <Icon name="pin" size={17} color={isDarkTheme ? '#E5E7EB' : '#111827'} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: isDarkTheme ? '#9CA3AF' : '#6B7280',
                        letterSpacing: '0.04em',
                        display: 'block',
                        lineHeight: 1.2
                      }}
                    >
                      DESTINATION
                    </span>
                    <div
                      style={{
                        fontSize: '14.5px',
                        fontWeight: 800,
                        color: isDarkTheme ? '#FFFFFF' : '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: '2px',
                        lineHeight: 1.25
                      }}
                      title={drop}
                    >
                      {drop}
                    </div>
                  </div>
                </div>
                <Icon name="chevronRight" size={15} color={isDarkTheme ? '#6B7280' : '#9CA3AF'} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Action Buttons (Decline & Accept) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.35fr',
            gap: '12px',
            width: '100%'
          }}
        >
          {/* Decline Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDecline(trip.id);
            }}
            style={{
              height: '52px',
              borderRadius: '16px',
              border: isDarkTheme ? '1.5px solid #7F1D1D' : '1.5px solid #FCA5A5',
              background: isDarkTheme ? '#201416' : '#FFF5F5',
              color: isDarkTheme ? '#EF4444' : '#DC2626',
              fontSize: '15px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name="x" size={15} color={isDarkTheme ? '#EF4444' : '#DC2626'} />
            <span>Decline</span>
          </button>

          {/* Accept Button */}
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
              height: '52px',
              borderRadius: '16px',
              border: 'none',
              background: isDarkTheme ? '#00C265' : '#161922',
              color: '#FFFFFF',
              fontSize: '15.5px',
              fontWeight: 800,
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              opacity: isAccepting ? 0.75 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isDarkTheme
                ? '0 6px 20px rgba(0, 194, 101, 0.4)'
                : '0 4px 14px rgba(22, 25, 34, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name="check" size={17} color="#FFFFFF" />
            <span>{isAccepting ? 'Accepting...' : `Accept ₹${fare}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
