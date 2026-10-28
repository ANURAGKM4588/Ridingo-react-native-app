import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';

/**
 * InspectionMediaModal: Full-screen mobile-style interactive media viewer.
 * Features:
 * - Pure 2-finger pinch-to-zoom and drag/pan (authentic mobile photo gallery experience)
 * - 1-finger pan when zoomed in
 * - Double-tap to quick-zoom / reset
 * - Zero zoom buttons, zero "zoom" text
 * - Clean close button and image pagination navigation
 */
export default function InspectionMediaModal({
  isOpen,
  type = 'image', // 'image' | 'video'
  images = [],
  initialIndex = 0,
  videoSrc = '',
  title = '',
  onClose
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const [activeVideoSrc, setActiveVideoSrc] = useState(videoSrc || '');

  useEffect(() => {
    setActiveVideoSrc(videoSrc || '');
  }, [videoSrc]);

  // Refs for tracking pinch & pan gestures
  const containerRef = useRef(null);
  const touchStateRef = useRef({
    initialDist: 0,
    initialScale: 1,
    initialPos: { x: 0, y: 0 },
    initialMid: { x: 0, y: 0 },
    dragStart: { x: 0, y: 0 },
    isDragging: false,
    lastTapTime: 0
  });

  // Sync index when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex]);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleSelectIndex = useCallback((newIdx) => {
    setCurrentIndex(newIdx);
    resetTransform();
  }, [resetTransform]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    const nextIdx = (currentIndex - 1 + images.length) % images.length;
    handleSelectIndex(nextIdx);
  }, [currentIndex, images.length, handleSelectIndex]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    const nextIdx = (currentIndex + 1) % images.length;
    handleSelectIndex(nextIdx);
  }, [currentIndex, images.length, handleSelectIndex]);

  // Keyboard navigation & Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (type === 'image') {
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, type, handlePrev, handleNext, onClose]);

  // Touch handlers: 2-finger pinch & drag zoom
  const handleTouchStart = (e) => {
    const ts = touchStateRef.current;

    // Double-tap detector
    const now = Date.now();
    if (e.touches.length === 1 && now - ts.lastTapTime < 280) {
      // Double tapped!
      if (scale > 1) {
        resetTransform();
      } else {
        const touch = e.touches[0];
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const offsetX = (touch.clientX - rect.left - rect.width / 2) * -1;
          const offsetY = (touch.clientY - rect.top - rect.height / 2) * -1;
          setScale(2.4);
          setPosition({ x: offsetX * 0.7, y: offsetY * 0.7 });
        } else {
          setScale(2.4);
        }
      }
      ts.lastTapTime = 0;
      return;
    }
    ts.lastTapTime = now;

    if (e.touches.length === 2) {
      // 2 fingers: initialize pinch & drag
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      ts.initialDist = dist;
      ts.initialScale = scale;
      ts.initialPos = { ...position };
      ts.initialMid = { x: midX, y: midY };
      ts.isDragging = true;
    } else if (e.touches.length === 1 && scale > 1) {
      // 1 finger pan when zoomed
      ts.isDragging = true;
      ts.dragStart = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y
      };
    }
  };

  const handleTouchMove = (e) => {
    const ts = touchStateRef.current;
    if (!ts.isDragging) return;

    if (e.touches.length === 2 && ts.initialDist > 0) {
      // 2-finger pinch & drag
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      const factor = dist / ts.initialDist;
      const nextScale = Math.min(5, Math.max(0.85, ts.initialScale * factor));

      // Also pan along with 2-finger translation
      const deltaMidX = midX - ts.initialMid.x;
      const deltaMidY = midY - ts.initialMid.y;

      setScale(nextScale);
      setPosition({
        x: ts.initialPos.x + deltaMidX,
        y: ts.initialPos.y + deltaMidY
      });
    } else if (e.touches.length === 1 && scale > 1) {
      // 1 finger pan
      setPosition({
        x: e.touches[0].clientX - ts.dragStart.x,
        y: e.touches[0].clientY - ts.dragStart.y
      });
    }
  };

  const handleTouchEnd = (e) => {
    const ts = touchStateRef.current;
    if (e.touches.length < 2) {
      ts.initialDist = 0;
    }
    if (e.touches.length === 0) {
      ts.isDragging = false;
      // Spring back if zoomed below 1x
      if (scale < 1.05) {
        resetTransform();
      }
    }
  };

  // Mouse wheel zoom support (for desktop preview testing)
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setScale((prev) => {
      const next = Math.min(5, Math.max(1, +(prev + delta).toFixed(2)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  // Desktop mouse drag support when zoomed
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    const ts = touchStateRef.current;
    ts.isDragging = true;
    ts.dragStart = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e) => {
    const ts = touchStateRef.current;
    if (!ts.isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - ts.dragStart.x,
      y: e.clientY - ts.dragStart.y
    });
  };

  const handleMouseUp = () => {
    touchStateRef.current.isDragging = false;
  };

  if (!isOpen) return null;

  const currentImg = images[currentIndex];

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        overflow: 'hidden',
        animation: 'fadeIn 0.2s ease-out',
        touchAction: 'none'
      }}
    >
      {/* Top Header Bar - Safe Area Inset & Device Notch Aware */}
      <div
        style={{
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 14px), 24px)',
          paddingBottom: '14px',
          paddingLeft: 'max(calc(env(safe-area-inset-left, 0px) + 16px), 16px)',
          paddingRight: 'max(calc(env(safe-area-inset-right, 0px) + 16px), 16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 75%, rgba(0,0,0,0) 100%)',
          boxSizing: 'border-box',
          width: '100%',
          flexShrink: 0
        }}
      >
        <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 650, letterSpacing: '0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
          {type === 'image' && images.length > 0
            ? `${currentIndex + 1} of ${images.length}`
            : title || 'Vehicle Inspection'}
        </span>

        {/* Minimal Circle Close Button with proper safe touch targets */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.22)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            touchAction: 'manipulation',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            transition: 'background 0.18s ease, transform 0.18s ease'
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>

      {/* Main Touch Viewport Stage */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: scale > 1 ? 'grab' : 'default'
        }}
      >
        {type === 'image' && currentImg && (
          <img
            src={currentImg}
            alt={`Car Inspection Photo ${currentIndex + 1}`}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
              transition: touchStateRef.current.isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'transform'
            }}
          />
        )}

        {type === 'video' && activeVideoSrc && (
          <div
            style={{
              width: '100%',
              maxWidth: '920px',
              aspectRatio: '16 / 9',
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
              transformOrigin: 'center center',
              transition: touchStateRef.current.isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#000000',
              willChange: 'transform'
            }}
          >
            <video
              key={activeVideoSrc}
              src={activeVideoSrc}
              controls
              autoPlay
              playsInline
              webkit-playsinline="true"
              preload="auto"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}

        {/* Previous Image Arrow (Subtle) */}
        {type === 'image' && images.length > 1 && scale === 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            aria-label="Previous photo"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 15
            }}
          >
            <Icon name="chevronLeft" size={22} />
          </button>
        )}

        {/* Next Image Arrow (Subtle) */}
        {type === 'image' && images.length > 1 && scale === 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            aria-label="Next photo"
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 15
            }}
          >
            <Icon name="chevronRight" size={22} />
          </button>
        )}
      </div>
    </div>
  );
}
