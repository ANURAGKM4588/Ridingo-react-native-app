import React, { useState, useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import Icon from './Icon';
import { useApp } from '../context/AppContext';
import { getDeviceLocation, reverseGeocode, getCachedDeviceLocation } from '../lib/deviceLocation';
import { getCurrentDevicePosition } from '../services/nativeLocationService';
import { GOOGLE_MAP_TILES, cleanPlusCode, fetchNearestLandmarkByCoordinates } from '../services/googleMapsService';

/**
 * Minimalist Box Design Style for Google Maps (Light Mode)
 * Matches reference design (Image 2):
 * - Clean off-white background (#F4F7FA)
 * - Accurate geometric building footprint boxes (#DFE5EC)
 * - Main roads & flyovers prioritized in slate-blue (#C8D7E5) with subtle borders
 * - Water (rivers, canals) in crisp, vibrant sky cyan (#82DCF8)
 * - Metro (M) and bus transit landmarks preserved
 * - Commercial junk / POIs (restaurants, clothing stores, ads) completely removed
 */
const MINIMALIST_BOX_LIGHT_STYLE = [
  // 1. Remove commercial & unwanted POI clutter
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'poi.government', stylers: [{ visibility: 'simplified' }] },

  // 2. Retain essential transit landmarks (Metro stations, bus stops)
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },

  // 3. Water: Clean, refreshing sky cyan matching reference
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#82DCF8' }, { visibility: 'on' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#0369A1' }] },

  // 4. Ground / Landscape: Minimalist off-white
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#F4F7FA' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EAF0F4' }] },

  // 5. Minimalist 2D/3D building boxes: Accurate geometric blocks
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#DFE5EC' }, { visibility: 'on' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#D0D8E2' }, { weight: 0.5 }, { visibility: 'on' }] },
  { featureType: 'building', elementType: 'geometry', stylers: [{ color: '#DFE5EC' }, { visibility: 'on' }] },

  // 6. Roads: Prioritize main roads, flyovers, highways
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#C8D7E5' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#B5C7D8' }, { weight: 1.2 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#DCE5EE' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#CAD5E0' }, { weight: 0.8 }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#E2E8F0' }, { weight: 0.5 }] },

  // 7. Road labels: Legible dark slate
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }, { weight: 3 }] },
  { featureType: 'road.highway', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },

  // 8. Administrative
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#CBD5E1' }, { weight: 1 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#0F172A' }] }
];

/**
 * Minimalist Box Design Style for Google Maps (Dark Mode)
 * Logically mirrors the light mode:
 * - Deep slate background (#131924)
 * - Accurate geometric building footprint boxes in dark slate (#1E2638) with subtle outline
 * - Main roads & flyovers highlighted in slate-blue (#2A3C59)
 * - Water (rivers, canals) in vibrant electric sapphire/cyan (#0E3B66)
 * - Transit landmarks preserved, commercial junk removed
 */
const MINIMALIST_BOX_DARK_STYLE = [
  // 1. Remove commercial POI clutter
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },

  // 2. Retain essential transit landmarks
  { featureType: 'transit', elementType: 'all', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },

  // 3. Water: Deep electric sapphire/cyan
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E3B66' }, { visibility: 'on' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#38BDF8' }] },

  // 4. Ground / Landscape: Deep slate dark
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#131924' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#171E2C' }] },

  // 5. Minimalist 2D/3D building boxes: Geometric dark blocks
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#1E2638' }, { visibility: 'on' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#2B374E' }, { weight: 0.6 }, { visibility: 'on' }] },
  { featureType: 'building', elementType: 'geometry', stylers: [{ color: '#1E2638' }, { visibility: 'on' }] },

  // 6. Roads: Prioritized with glowing slate blue
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2A3C59' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#415A82' }, { weight: 1.2 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#202E44' }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: '#324768' }, { weight: 0.8 }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#172233' }] },
  { featureType: 'road.local', elementType: 'geometry.stroke', stylers: [{ color: '#25354D' }, { weight: 0.5 }] },

  // 7. Labels
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#0D121B' }, { weight: 3 }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#F1F5F9' }] }
];

export default function MapPickerModal({ isOpen, onClose, onSelect, targetField = 'pickup', initialCoords = null }) {
  const { userThemeVal, addToast } = useApp() || {};
  const isDark = userThemeVal === 'dark';

  const label = targetField === 'pickup' ? 'Pickup Location' : 'Destination';

  const [selectedAddr, setSelectedAddr] = useState(() => {
    const cached = getCachedDeviceLocation();
    return cleanPlusCode(cached?.address) || 'Selected Location';
  });

  const [coordsInfo, setCoordsInfo] = useState(() => {
    const cached = getCachedDeviceLocation();
    const cleanAddr = cleanPlusCode(cached?.address) || 'Selected Location';
    return {
      lat: cached?.lat || 10.0275,
      lng: cached?.lng || 76.3080,
      accuracy: cached?.accuracy || null,
      name: cleanAddr.split(',')[0].trim() || 'Selected Location',
      address: cleanAddr
    };
  });

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const containerRef = useRef(null);
  const mapEngineRef = useRef(null); // 'google' or 'leaflet'
  const googleMapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Reverse geocode center location
  const geocodeCenter = useCallback(
    async (centerLat, centerLng) => {
      setIsGeocoding(true);
      try {
        const placeData = await fetchNearestLandmarkByCoordinates(centerLat, centerLng);

        if (placeData && placeData.name) {
          const cleanPlaceName = cleanPlusCode(placeData.name);
          const cleanAddress = cleanPlusCode(placeData.formattedAddress || placeData.name);

          setCoordsInfo({
            lat: centerLat,
            lng: centerLng,
            placeId: placeData.placeId,
            name: cleanPlaceName,
            address: cleanAddress,
            city: placeData.city || cleanPlaceName.split(',')[0].trim(),
            state: placeData.state || 'Kerala',
            postalCode: placeData.postalCode || ''
          });

          setSelectedAddr(cleanAddress);
        } else {
          const addr = await reverseGeocode(centerLat, centerLng);
          const cleanAddr = cleanPlusCode(addr) || 'Selected Location';
          setSelectedAddr(cleanAddr);
          setCoordsInfo({
            lat: centerLat,
            lng: centerLng,
            name: cleanAddr.split(',')[0].trim() || 'Selected Location',
            address: cleanAddr,
            city: 'Kochi',
            state: 'Kerala'
          });
        }
      } catch (err) {
        console.warn('Geocoding error:', err);
        setSelectedAddr('Selected Location');
      } finally {
        setIsGeocoding(false);
      }
    },
    []
  );

  // Initialize Map
  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;

    const cachedLoc = (initialCoords && initialCoords.lat && initialCoords.lng)
      ? { lat: Number(initialCoords.lat), lng: Number(initialCoords.lng), accuracy: 15, address: initialCoords.address || '' }
      : (getCachedDeviceLocation() || {
          lat: 10.0275,
          lng: 76.3080,
          accuracy: 25,
          address: 'Current Location'
        });

    const initialLat = cachedLoc.lat;
    const initialLng = cachedLoc.lng;
    const initialAddr = cleanPlusCode(cachedLoc.address) || 'Selected Location';

    setCoordsInfo({
      lat: initialLat,
      lng: initialLng,
      accuracy: cachedLoc.accuracy,
      name: initialAddr.split(',')[0].trim() || 'Selected Location',
      address: initialAddr
    });
    setSelectedAddr(initialAddr);

    const initTimer = setTimeout(() => {
      if (!containerRef.current) return;

      const activeStyles = isDark ? MINIMALIST_BOX_DARK_STYLE : MINIMALIST_BOX_LIGHT_STYLE;

      // 1. Try Native Google Maps JS SDK (Official vector minimalist rendering)
      if (window.google && window.google.maps && window.google.maps.Map) {
        try {
          const gMap = new window.google.maps.Map(containerRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: 17,
            disableDefaultUI: true,
            gestureHandling: 'greedy',
            styles: activeStyles,
            backgroundColor: isDark ? '#131924' : '#F4F7FA'
          });

          gMap.addListener('dragstart', () => {
            setIsDragging(true);
          });

          gMap.addListener('dragend', () => {
            setIsDragging(false);
            const center = gMap.getCenter();
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              geocodeCenter(center.lat(), center.lng());
            }, 180);
          });

          gMap.addListener('idle', () => {
            setIsDragging(false);
          });

          gMap.addListener('click', (e) => {
            if (!e.latLng) return;
            gMap.panTo(e.latLng);
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              geocodeCenter(e.latLng.lat(), e.latLng.lng());
            }, 100);
          });

          googleMapRef.current = gMap;
          mapEngineRef.current = 'google';
          return;
        } catch (e) {
          console.warn('[MapPickerModal] Google Maps JS fallback to Leaflet:', e);
        }
      }

      // 2. Fallback: Leaflet with Google Maps Roadmap Tiles
      if (!leafletMapRef.current && containerRef.current) {
        const lMap = L.map(containerRef.current, {
          center: [initialLat, initialLng],
          zoom: 17,
          zoomControl: false,
          attributionControl: false
        });

        const googleCfg = GOOGLE_MAP_TILES.roadmap;
        L.tileLayer(googleCfg.url, {
          subdomains: googleCfg.subdomains,
          maxZoom: 20,
          attribution: googleCfg.attribution
        }).addTo(lMap);

        lMap.on('movestart', () => {
          setIsDragging(true);
        });

        lMap.on('moveend', () => {
          setIsDragging(false);
          const center = lMap.getCenter();
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            geocodeCenter(center.lat, center.lng);
          }, 180);
        });

        lMap.on('click', (e) => {
          if (!e.latlng) return;
          lMap.panTo([e.latlng.lat, e.latlng.lng], { animate: true, duration: 0.25 });
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(() => {
            geocodeCenter(e.latlng.lat, e.latlng.lng);
          }, 100);
        });

        leafletMapRef.current = lMap;
        mapEngineRef.current = 'leaflet';

        requestAnimationFrame(() => {
          if (leafletMapRef.current) leafletMapRef.current.invalidateSize();
        });
      }
    }, 60);

    // Fast non-blocking real device GPS refresh on map open
    getCurrentDevicePosition({ enableHighAccuracy: true, timeout: 6000, maximumAge: 5000 })
      .then((pos) => {
        if (isCancelled || !pos || !pos.coords) return;
        const { latitude, longitude } = pos.coords;
        if (!latitude || !longitude) return;

        if (!initialCoords?.lat) {
          if (mapEngineRef.current === 'google' && googleMapRef.current) {
            googleMapRef.current.panTo({ lat: latitude, lng: longitude });
          } else if (leafletMapRef.current) {
            leafletMapRef.current.panTo([latitude, longitude], { animate: false });
          }
          geocodeCenter(latitude, longitude);
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
      clearTimeout(initTimer);
      clearTimeout(debounceTimerRef.current);

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      googleMapRef.current = null;
      mapEngineRef.current = null;
    };
  }, [isOpen, geocodeCenter, isDark]);

  // Dynamically update Google Map styles when theme changes
  useEffect(() => {
    if (mapEngineRef.current === 'google' && googleMapRef.current) {
      googleMapRef.current.setOptions({
        styles: isDark ? MINIMALIST_BOX_DARK_STYLE : MINIMALIST_BOX_LIGHT_STYLE,
        backgroundColor: isDark ? '#131924' : '#F4F7FA'
      });
    }
  }, [isDark]);

  // Recenter GPS Button
  const handleDetectCurrentLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setGpsError(null);

    try {
      const pos = await getCurrentDevicePosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
      if (pos && pos.coords) {
        const { latitude, longitude } = pos.coords;
        if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude)) {
          // Smoothly pan map to real device position
          if (mapEngineRef.current === 'google' && googleMapRef.current) {
            googleMapRef.current.panTo({ lat: latitude, lng: longitude });
            googleMapRef.current.setZoom(17);
          } else if (leafletMapRef.current) {
            leafletMapRef.current.setView([latitude, longitude], 17, { animate: true });
          }

          // Trigger geocoding at the exact current position
          geocodeCenter(latitude, longitude);

          if (addToast) {
            addToast('Centered to current location', 'check');
          }
        } else {
          throw new Error('Invalid GPS coordinates received from device');
        }
      } else {
        throw new Error('Device location unavailable');
      }
    } catch (err) {
      console.warn('GPS recenter error:', err);
      const msg = err?.message || 'Could not detect device GPS. Please check location permissions.';
      setGpsError(msg);
      if (addToast) {
        addToast(msg, 'alert');
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Zoom In
  const handleZoomIn = () => {
    if (mapEngineRef.current === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 17) + 1);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.zoomIn();
    }
  };

  // Zoom Out
  const handleZoomOut = () => {
    if (mapEngineRef.current === 'google' && googleMapRef.current) {
      googleMapRef.current.setZoom((googleMapRef.current.getZoom() || 17) - 1);
    } else if (leafletMapRef.current) {
      leafletMapRef.current.zoomOut();
    }
  };

  const handleConfirm = () => {
    onSelect(cleanPlusCode(selectedAddr), coordsInfo);
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('map-picker-open');
      return () => {
        document.body.classList.remove('map-picker-open');
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="map-picker-scrim"
      style={{
        zIndex: 999999,
        background: isDark ? '#0A0A0B' : '#FFFFFF',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* 1. Header (Matching Reference Image 2: top drag handle, outline pin, clean typography) */}
      <div
        className="map-picker-head"
        style={{
          background: isDark ? '#1C1C1E' : '#FFFFFF',
          borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          paddingTop: 'max(calc(env(safe-area-inset-top, 0px) + 12px), 52px)',
          paddingBottom: '14px',
          paddingLeft: '18px',
          paddingRight: '18px',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Subtle top drag handle bar */}
        <div
          style={{
            width: '38px',
            height: '4px',
            borderRadius: '2px',
            background: isDark ? '#3F3F46' : '#CBD5E1',
            margin: '0 auto 10px'
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {/* Left: Outline Location Pin Icon & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDark ? '#FFFFFF' : '#0F172A'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            <div>
              <b
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  display: 'block',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2
                }}
              >
                Choose {label}
              </b>
              <span
                style={{
                  fontSize: '12px',
                  color: isDark ? '#94A3B8' : '#64748B',
                  display: 'block',
                  marginTop: '2px',
                  fontWeight: 500
                }}
              >
                Move map or tap to place the pin
              </span>
            </div>
          </div>

          {/* Right: Round Minimalist Close Button */}
          <button
            className="iconbtn"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: isDark ? '#27272A' : '#F8FAFC',
              color: isDark ? '#FFFFFF' : '#0F172A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #E2E8F0',
              transition: 'all 0.15s ease'
            }}
          >
            <Icon name="x" size={17} />
          </button>
        </div>
      </div>

      {/* 2. Full-View Minimalist Box Map Container */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          background: isDark ? '#131924' : '#F4F7FA'
        }}
      >
        <div
          ref={containerRef}
          className={`map-picker-container ${isDark ? 'gmap-dark-minimal' : 'gmap-light-minimal'}`}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />

        {/* 3. Center Radar Target & Pin (Exact Match of Reference Image 2) */}
        {/* Ground Radar Target Ring */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '92px',
            height: '92px',
            borderRadius: '50%',
            background: isDark ? 'rgba(56, 189, 248, 0.18)' : 'rgba(37, 99, 235, 0.18)',
            border: isDark ? '1.5px solid rgba(56, 189, 248, 0.45)' : '1.5px solid rgba(37, 99, 235, 0.45)',
            pointerEvents: 'none',
            zIndex: 890,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
        >
          {/* Inner blue ring with white center dot */}
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#2563EB',
              border: '3px solid #FFFFFF',
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
            }}
          />
        </div>

        {/* Interactive Centered Red Pin */}
        <div
          className={`map-center-pin-wrap ${isDragging ? 'pin-lifted' : ''}`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: isDragging ? 'translate(-50%, -115%) scale(1.06)' : 'translate(-50%, -100%) scale(1)',
            pointerEvents: 'none',
            zIndex: 900,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <svg width="38" height="50" viewBox="0 0 24 34" fill="none">
            <path
              d="M12 0C5.37 0 0 5.37 0 12c0 8.5 12 22 12 22s12-13.5 12-22c0-6.63-5.37-12-12-12z"
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="1.2"
            />
            <circle cx="12" cy="11.5" r="4.2" fill="#FFFFFF" />
            <circle cx="12" cy="11.5" r="2.2" fill="#2563EB" />
          </svg>
          <div
            style={{
              width: '10px',
              height: '4px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.3)',
              margin: '-2px auto 0',
              opacity: isDragging ? 0.2 : 0.6,
              transform: isDragging ? 'scale(1.4)' : 'scale(1)',
              transition: 'all 0.18s ease'
            }}
          />
        </div>

        {/* 4. Right Floating Controls (GPS Recenter & Stacked Zoom Buttons matching Image 2) */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            zIndex: 950
          }}
        >
          {/* Circular GPS Recenter Button */}
          <button
            type="button"
            onClick={handleDetectCurrentLocation}
            disabled={isLocating}
            title="Recenter on My Location"
            aria-label="Recenter on My Location"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isDark ? '#1C1C1E' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isLocating ? 'wait' : 'pointer',
              color: isDark ? '#FFFFFF' : '#0F172A',
              transition: 'all 0.15s ease',
              opacity: isLocating ? 0.75 : 1
            }}
          >
            {isLocating ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="7" />
                <line x1="12" y1="1" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="1" y1="12" x2="5" y2="12" />
                <line x1="19" y1="12" x2="23" y2="12" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" />
              </svg>
            )}
          </button>

          {/* Stacked Zoom Controls (+ / −) */}
          <div
            style={{
              width: '42px',
              borderRadius: '14px',
              background: isDark ? '#1C1C1E' : '#FFFFFF',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <button
              type="button"
              onClick={handleZoomIn}
              title="Zoom In"
              aria-label="Zoom In"
              style={{
                width: '42px',
                height: '40px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isDark ? '#FFFFFF' : '#0F172A',
                fontSize: '20px',
                fontWeight: 600,
                transition: 'background 0.15s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <div style={{ height: '1px', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', width: '100%' }} />
            <button
              type="button"
              onClick={handleZoomOut}
              title="Zoom Out"
              aria-label="Zoom Out"
              style={{
                width: '42px',
                height: '40px',
                border: 'none',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isDark ? '#FFFFFF' : '#0F172A',
                fontSize: '20px',
                fontWeight: 600,
                transition: 'background 0.15s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 5. Footer Bottom Sheet (Selected Location - Matching Image 2) */}
      <div
        className="map-picker-foot"
        style={{
          background: isDark ? '#1C1C1E' : '#FFFFFF',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          boxShadow: isDark ? '0 -8px 30px rgba(0, 0, 0, 0.45)' : '0 -8px 30px rgba(0, 0, 0, 0.08)',
          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
          paddingTop: '14px',
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 20px), 26px)',
          position: 'relative',
          zIndex: 20
        }}
      >
        {/* Center Drag Handle Bar */}
        <div
          style={{
            width: '38px',
            height: '4px',
            borderRadius: '2px',
            background: isDark ? '#3F3F46' : '#CBD5E1',
            margin: '0 auto 12px'
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: isDark ? '#94A3B8' : '#64748B',
                letterSpacing: '0.06em'
              }}
            >
              SELECTED LOCATION
            </span>
            {isGeocoding && (
              <span style={{ fontSize: '11px', color: '#00D09C', fontWeight: 600 }}>
                Updating location...
              </span>
            )}
          </div>

          {/* Place Name (Prominent & Bold) */}
          <div
            style={{
              fontSize: '20px',
              fontWeight: 850,
              color: isDark ? '#FFFFFF' : '#0F172A',
              marginBottom: '3px',
              lineHeight: 1.25,
              letterSpacing: '-0.02em'
            }}
          >
            {coordsInfo.name || 'Selected Location'}
          </div>

          {/* Clean Readable Address */}
          <div
            className="map-picker-addr"
            style={{
              color: isDark ? '#94A3B8' : '#64748B',
              fontSize: '13px',
              fontWeight: 500,
              lineHeight: 1.4
            }}
          >
            {selectedAddr}
          </div>
        </div>

        {/* Action Button: Confirm Location */}
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              width: '100%',
              height: '52px',
              borderRadius: '18px',
              background: isDark ? '#FFFFFF' : '#0E1626',
              color: isDark ? '#0B0B0C' : '#FFFFFF',
              fontSize: '16px',
              fontWeight: 750,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: isDark ? '0 4px 14px rgba(255,255,255,0.1)' : '0 4px 14px rgba(14, 22, 38, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Confirm Location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
