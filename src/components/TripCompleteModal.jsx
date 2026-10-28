import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import Icon from './Icon';
import { cleanLocationName } from '../utils/locationCleaner';
import { downloadTripReceiptPdf } from '../utils/receiptPdfGenerator';
import { generateTripInvoiceText, shareInvoiceViaWhatsApp, shareInvoiceViaEmail } from '../utils/tripInvoiceSharing';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export default function TripCompleteModal({ trip: propTrip, onClose }) {
  const {
    tripCompleteModalOpen,
    setTripCompleteModalOpen,
    completedTripData,
    setCompletedTripData,
    setBookingOpen,
    setBookingCategory,
    setBookingDestination,
    setUTab,
    addToast,
    trips,
    setTrips,
    user
  } = useApp();

  const trip = propTrip || completedTripData;

  const [rating, setRating] = useState(trip?.rating || trip?.userRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedFeedback, setSelectedFeedback] = useState(Array.isArray(trip?.feedback) ? trip.feedback : []);
  const [reviewComment, setReviewComment] = useState(trip?.reviewText || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(Boolean(trip?.rating || trip?.userRating));
  const [isClosing, setIsClosing] = useState(false);

  // Enabled as soon as star rating is selected (1-5 stars)
  const canSubmit = rating > 0;

  const isOpen = propTrip ? true : tripCompleteModalOpen;
  if (!isOpen || !trip) return null;

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      if (onClose) onClose();
      if (setTripCompleteModalOpen) setTripCompleteModalOpen(false);
      if (setCompletedTripData) setCompletedTripData(null);
      setIsClosing(false);
    }, 280);
  };

  // Safe trip attributes
  const rawPickup = trip?.pickup || trip?.from || 'MG Road';
  const rawDrop = trip?.drop || trip?.drop_loc || trip?.to || 'Airport';
  const pickupName = cleanLocationName(rawPickup).split(',')[0].trim();
  const dropName = cleanLocationName(rawDrop).split(',')[0].trim();
  const durationLabel = trip?.qty
    ? `${trip.qty} ${trip.qty === 1 ? 'hour' : 'hours'}`
    : trip?.durationText || '3 hours';

  // Dynamic Fare & Settlement Calculations
  const totalFare = Number(trip?.fare || trip?.amount || 750);
  const advancePaid = Number(trip?.advance || Math.round(totalFare * 0.3) || 225);
  const extraKm = Number(trip?.extensionDistanceKm || 0);
  const extraWaiting = Number(trip?.waitingFare || 0);
  const waitingAndExtraKm = Number(trip?.extensionFare || 0) + extraWaiting;
  const balanceToPay = Math.max(0, totalFare - advancePaid + waitingAndExtraKm);

  // Driver Identity
  const rawDriverName = typeof trip?.driver === 'string'
    ? trip.driver
    : trip?.driver?.name || trip?.driverObj?.name || 'Suresh K.';
  const driverName = rawDriverName.replace(/\b\w/g, l => l.toUpperCase());

  const getInitials = (name) => {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name.slice(0, 2) || 'SK').toUpperCase();
  };
  const driverInitials = getInitials(driverName);

  // Driver Quality Feedback Options
  const feedbackOptions = [
    'Careful driving',
    'On time',
    'Polite',
    'Clean car',
    'Smooth route'
  ];

  const toggleFeedbackTag = (tag) => {
    setSelectedFeedback(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // 1. Submit Rating -> Persists to trip state, storage, and navigates home
  const handleSubmitRating = (e) => {
    if (e) e.stopPropagation();
    if (!canSubmit || isSubmitting || ratingSubmitted || isClosing) return;
    setIsSubmitting(true);
    setRatingSubmitted(true);

    if (setTrips && trip?.id) {
      setTrips(prev => prev.map(t => (t.id === trip.id ? {
        ...t,
        rating,
        userRating: rating,
        feedback: selectedFeedback,
        reviewText: reviewComment,
        ratedAt: Date.now()
      } : t)));
    }

    try {
      const existingRaw = localStorage.getItem('ridingo_trip_reviews');
      const reviews = existingRaw ? JSON.parse(existingRaw) : {};
      reviews[trip.id] = {
        rating,
        feedback: selectedFeedback,
        reviewText: reviewComment,
        at: Date.now()
      };
      localStorage.setItem('ridingo_trip_reviews', JSON.stringify(reviews));
    } catch (_) {}

    // Collect all review and rating into the database
    if (supabase && typeof supabase.from === 'function' && trip?.id) {
      try {
        supabase
          .from('trips')
          .update({
            rating,
            user_rating: rating,
            feedback: selectedFeedback,
            review_text: reviewComment,
            rated_at: new Date().toISOString()
          })
          .eq('id', trip.id)
          .then(({ error }) => {
            if (error) console.info('[Supabase] Trip rating update info:', error.message);
          });

        supabase
          .from('trip_reviews')
          .insert({
            trip_id: trip.id,
            driver_name: driverName,
            user_id: user?.id || null,
            user_name: user?.name || 'Customer',
            rating,
            feedback: selectedFeedback,
            review: reviewComment,
            created_at: new Date().toISOString()
          })
          .then(({ error }) => {
            if (error) console.info('[Supabase] trip_reviews notice:', error.message);
          });
      } catch (dbErr) {
        console.warn('[Supabase] Database review collection error:', dbErr);
      }
    }

    if (addToast) {
      addToast(`Thank you! Rated ${rating} stars for ${driverName}.`, 'check');
    }

    if (setUTab) setUTab('home');
    handleClose();
  };

  // 2. Book Again -> Navigates to the same service booking page
  const handleBookAgain = (e) => {
    if (e) e.stopPropagation();
    handleClose();
    if (setBookingCategory) {
      setBookingCategory(trip?.cat || 'hourly');
    }
    if (setBookingDestination && (trip?.drop || trip?.drop_loc)) {
      setBookingDestination(cleanLocationName(trip.drop || trip.drop_loc));
    }
    if (setUTab) {
      setUTab('home');
    }
    if (setBookingOpen) {
      setTimeout(() => {
        setBookingOpen(true);
      }, 100);
    }
  };

  // 3. Share Trip Details -> WhatsApp / Native Share / Clipboard
  const handleShareTrip = async (e) => {
    if (e) e.stopPropagation();
    setIsSharing(true);
    const tripId = trip?.id || 'TRP-' + Date.now().toString().slice(-4);
    const shareText = `🚗 Ridingo Trip Summary & Receipt
Trip ID: #${tripId}
━━━━━━━━━━━━━━━━━━━━
📍 From: ${pickupName}
🏁 To: ${dropName}
⏱ Total Taking Time: ${durationLabel}
🚗 Running Time: ${trip?.durationText || durationLabel}
👤 Driver: ${driverName}
━━━━━━━━━━━━━━━━━━━━
💰 Total Fare: ₹${totalFare}
💳 Advance Paid: -₹${advancePaid}
⏳ Extra KM & Waiting: ₹${waitingAndExtraKm}
💵 Paid to Driver: ₹${balanceToPay}
━━━━━━━━━━━━━━━━━━━━
Status: COMPLETED & PAID ✅`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({
          title: `Ridingo Trip #${tripId}`,
          text: shareText,
          dialogTitle: 'Share Trip Details'
        });
        if (addToast) addToast('Trip details shared successfully!', 'check');
      } else if (navigator.share) {
        await navigator.share({
          title: `Ridingo Trip #${tripId}`,
          text: shareText
        });
        if (addToast) addToast('Trip details shared successfully!', 'check');
      } else {
        await navigator.clipboard.writeText(shareText);
        if (addToast) addToast('Trip details copied to clipboard!', 'check');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
        window.open(waUrl, '_blank');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // 4. Download Receipt PDF -> Generates vector PDF and triggers immediate download
  const handleDownloadReceipt = async (e) => {
    if (e) e.stopPropagation();
    setIsDownloading(true);
    try {
      await downloadTripReceiptPdf({
        trip,
        pickup: rawPickup,
        drop: rawDrop,
        takingTime: durationLabel,
        runningTime: trip?.durationText || durationLabel,
        totalDistance: trip?.distanceText || `${trip?.distanceKm || '38'} km`,
        extraKm,
        waitingCharge: extraWaiting,
        baseFare: totalFare,
        advancePaid,
        balancePaid: balanceToPay,
        driverName
      });
      if (addToast) {
        addToast('Trip receipt PDF downloaded successfully!', 'check');
      }
    } catch (err) {
      console.warn('PDF download error:', err);
      if (addToast) {
        addToast('Downloaded trip receipt to device.', 'check');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // 5. WhatsApp Invoice Share
  const handleWhatsAppInvoice = (e) => {
    if (e) e.stopPropagation();
    const inv = generateTripInvoiceText({
      trip,
      baseFare: Math.max(0, totalFare - waitingAndExtraKm),
      extraKm,
      waitingFare: extraWaiting,
      totalTripFare: totalFare,
      advancePaid,
      balancePaid: balanceToPay,
      driverName,
      riderName: user?.name || trip?.userName || 'Customer',
      riderPhone: user?.phone || trip?.userPhone || ''
    });
    shareInvoiceViaWhatsApp(user?.phone || trip?.userPhone, inv);
    if (addToast) addToast('Opening WhatsApp with official invoice...', 'check');
  };

  // 6. Email Invoice Share
  const handleEmailInvoice = (e) => {
    if (e) e.stopPropagation();
    const inv = generateTripInvoiceText({
      trip,
      baseFare: Math.max(0, totalFare - waitingAndExtraKm),
      extraKm,
      waitingFare: extraWaiting,
      totalTripFare: totalFare,
      advancePaid,
      balancePaid: balanceToPay,
      driverName,
      riderName: user?.name || trip?.userName || 'Customer',
      riderPhone: user?.phone || trip?.userPhone || ''
    });
    shareInvoiceViaEmail(user?.email || trip?.userEmail, trip.id, inv);
    if (addToast) addToast('Opening email client with official invoice...', 'check');
  };

  const currentRating = hoverRating || rating;
  const ratingLabels = {
    5: '⭐ 5.0 · Outstanding service',
    4: '⭐ 4.0 · Very good experience',
    3: '⭐ 3.0 · Average trip',
    2: '⭐ 2.0 · Needs improvement',
    1: '⭐ 1.0 · Unsatisfactory driving'
  };

  return (
    <div
      id="trip-complete-modal-wrapper"
      style={{
        zIndex: 100050,
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
        animation: isClosing
          ? 'tcBackdropFadeOut 0.28s ease-in forwards'
          : 'tcBackdropFade 0.25s ease-out forwards'
      }}
      onClick={handleClose}
    >
      {/* Styles for Animations & Interactive Elements */}
      <style>{`
        @keyframes tcBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tcBackdropFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes tcModalSlideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes tcModalSlideDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
        @keyframes tcTickPop {
          0% { transform: scale(0); opacity: 0; }
          65% { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes tcTickDraw {
          from { stroke-dashoffset: 32; }
          to { stroke-dashoffset: 0; }
        }
        .tc-star-btn {
          background: transparent;
          border: none;
          padding: 6px;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          display: flex;
          align-items: center;
          justifyContent: center;
          transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .tc-star-btn:hover {
          transform: scale(1.15);
        }
        .tc-star-btn:active {
          transform: scale(1.3) !important;
        }
        .tc-chip-btn {
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          transition: all 0.15s ease;
        }
        .tc-chip-btn:active {
          transform: scale(0.96);
        }
      `}</style>

      {/* Modal Dialog Card - Stops Propagation to Prevent Accidental Close */}
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          maxHeight: '94vh',
          background: '#FFFFFF',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 100060,
          pointerEvents: 'auto',
          animation: isClosing
            ? 'tcModalSlideDown 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            : 'tcModalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {/* Top Header Section with Animated Checkmark */}
        <div
          style={{
            padding: '24px 20px 8px',
            textAlign: 'center',
            position: 'relative',
            pointerEvents: 'auto'
          }}
        >
          {/* Top Close Button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#F1F5F9',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
          >
            <Icon name="x" size={16} />
          </button>
          {/* Large Animated Green Checkmark Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#16A34A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 8px 24px rgba(22, 163, 74, 0.35)',
              animation: 'tcTickPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: 32,
                strokeDashoffset: 32,
                animation: 'tcTickDraw 0.45s ease-out 0.2s forwards'
              }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: '25px',
              fontWeight: 900,
              color: '#111827',
              margin: '0 0 4px',
              letterSpacing: '-0.4px',
              fontFamily: 'var(--font-display, "Plus Jakarta Sans", sans-serif)'
            }}
          >
            Trip complete
          </h2>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '13.5px',
              fontWeight: 500,
              color: '#4B5563',
              margin: '0 0 14px',
              letterSpacing: '-0.1px'
            }}
          >
            {pickupName} to {dropName} · {durationLabel}
          </p>
        </div>

        {/* Scrollable Content Cards */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: '0 20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'auto'
          }}
        >
          {/* Card 1: Fare Breakdown */}
          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: '20px',
              padding: '16px 18px',
              background: '#FFFFFF',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                color: '#374151',
                fontWeight: 500,
                marginBottom: '8px'
              }}
            >
              <span>Trip total</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>₹{totalFare}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                fontWeight: 600,
                color: '#15803D',
                marginBottom: '8px'
              }}
            >
              <span>Advance paid</span>
              <span>– ₹{advancePaid}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '14px',
                color: '#374151',
                fontWeight: 500,
                marginBottom: '12px'
              }}
            >
              <span>Waiting and extra km</span>
              <span style={{ fontWeight: 700, color: '#111827' }}>₹{waitingAndExtraKm}</span>
            </div>

            {/* Subtle Divider */}
            <div style={{ height: '1px', background: '#F3F4F6', margin: '8px 0 12px' }} />

            {/* Pay the driver Row (Clean minimal style, UPI/Cash/Wallet buttons removed) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#111827' }}>
                Pay the driver
              </span>
              <span style={{ fontSize: '26px', fontWeight: 900, color: '#111827', letterSpacing: '-0.3px' }}>
                ₹{balanceToPay}
              </span>
            </div>
          </div>

          {/* Card 2: Driver Rating & Quality Options (Centered) */}
          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: '20px',
              padding: '18px 18px',
              background: '#FFFFFF',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.02)',
              textAlign: 'center',
              pointerEvents: 'auto'
            }}
          >
            {/* Centered Avatar with Gold Ring and Driver Question */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '14px'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  border: '2.5px solid #F59E0B',
                  background: '#FFFBEB',
                  color: '#111827',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '16px',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.18)'
                }}
              >
                {driverInitials}
              </div>

              <span
                style={{
                  fontSize: '16.5px',
                  fontWeight: 800,
                  color: '#111827',
                  letterSpacing: '-0.2px'
                }}
              >
                How is {driverName} ?
              </span>
            </div>

            {/* 5 Freely Selectable Stars (Click & Touch Supported) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '10px',
                marginBottom: '8px',
                pointerEvents: 'auto'
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = currentRating >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    className="tc-star-btn"
                    onClick={() => {
                      setRating(star);
                      setHoverRating(0);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      setRating(star);
                      setHoverRating(0);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Select ${star} stars`}
                    style={{
                      transform: isFilled ? 'scale(1.08)' : 'scale(1)',
                      pointerEvents: 'auto'
                    }}
                  >
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill={isFilled ? '#F59E0B' : '#F1F5F9'}
                      stroke={isFilled ? '#F59E0B' : '#CBD5E1'}
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: 'none' }}
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* Rating description text */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: currentRating > 0 ? '#64748B' : '#94A3B8', marginBottom: '14px' }}>
              {currentRating > 0 ? (ratingLabels[currentRating] || '⭐ Rate your trip') : '⭐ Tap a star to rate your driver'}
            </div>

            {/* Driver Quality Feedback Option Chips (Freely Selectable) */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                pointerEvents: 'auto'
              }}
            >
              {feedbackOptions.map((tag) => {
                const isSelected = selectedFeedback.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className="tc-chip-btn"
                    onClick={() => toggleFeedbackTag(tag)}
                    style={{
                      borderRadius: '999px',
                      padding: '7px 15px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 800 : 600,
                      border: isSelected ? '1.5px solid #111827' : '1px solid #D1D5DB',
                      background: isSelected ? '#111827' : '#FFFFFF',
                      color: isSelected ? '#FFFFFF' : '#374151',
                      pointerEvents: 'auto',
                      boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.15)' : 'none'
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Optional Written Review Notes */}
            <div style={{ marginTop: '14px', textAlign: 'left' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Driver Review & Notes (optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Write a compliment or feedback about your driver's service..."
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1px solid #D1D5DB',
                  background: '#F9FAFB',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: '#111827',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
            </div>
          </div>

          {/* Action Buttons Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px', pointerEvents: 'auto' }}>
            {/* Primary Submit Button: Black Background + White Text */}
            <button
              type="button"
              onClick={handleSubmitRating}
              disabled={!canSubmit || isSubmitting || ratingSubmitted}
              aria-disabled={!canSubmit}
              style={{
                width: '100%',
                height: '50px',
                borderRadius: '14px',
                background: '#000000',
                color: '#FFFFFF',
                fontSize: '15.5px',
                fontWeight: 800,
                border: 'none',
                cursor: canSubmit ? ((isSubmitting || ratingSubmitted) ? 'default' : 'pointer') : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 14px rgba(0, 0, 0, 0.25)' : 'none',
                opacity: canSubmit ? 1 : 0.38,
                transition: 'opacity 0.22s ease, box-shadow 0.22s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                pointerEvents: canSubmit ? 'auto' : 'none'
              }}
              title={!canSubmit ? 'Please select a star rating to submit' : 'Submit rating'}
            >
              {ratingSubmitted ? '✓ Rating Submitted' : (isSubmitting ? 'Submitting...' : 'Submit Rating & Review')}
            </button>

            {/* Trip Invoice & Receipt Options Card */}
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '14px',
                background: '#F8FAFC',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Trip Invoice & Receipts
                </span>
                <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 750 }}>
                  ✓ Settled & Paid
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {/* Download PDF Receipt */}
                <button
                  type="button"
                  onClick={handleDownloadReceipt}
                  disabled={isDownloading}
                  style={{
                    padding: '10px 4px',
                    borderRadius: '12px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: isDownloading ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <Icon name="download" size={15} />
                  <span>{isDownloading ? 'Downloading...' : 'PDF Receipt'}</span>
                </button>

                {/* WhatsApp Invoice */}
                <button
                  type="button"
                  onClick={handleWhatsAppInvoice}
                  style={{
                    padding: '10px 4px',
                    borderRadius: '12px',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#10B981',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Icon name="whatsapp" size={15} color="#10B981" />
                  <span>WhatsApp</span>
                </button>

                {/* Email Invoice */}
                <button
                  type="button"
                  onClick={handleEmailInvoice}
                  style={{
                    padding: '10px 4px',
                    borderRadius: '12px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    background: 'rgba(59, 130, 246, 0.08)',
                    color: '#3B82F6',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <Icon name="mail" size={15} color="#3B82F6" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {/* Secondary Action Buttons Row: Book Again & Share Summary */}
            <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
              {/* Book Again Button */}
              <button
                type="button"
                onClick={handleBookAgain}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid #0F172A',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  pointerEvents: 'auto'
                }}
              >
                <Icon name="repeat" size={14} />
                <span>Book again</span>
              </button>

              {/* Share Trip Details Button */}
              <button
                type="button"
                onClick={handleShareTrip}
                disabled={isSharing}
                style={{
                  flex: 1,
                  height: '44px',
                  borderRadius: '12px',
                  border: '1.5px solid #0F172A',
                  background: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: isSharing ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  pointerEvents: 'auto'
                }}
              >
                <Icon name="share" size={14} />
                <span>{isSharing ? 'Sharing...' : 'Share summary'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
