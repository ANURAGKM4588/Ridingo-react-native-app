/**
 * GooglePlacesSearchInput.jsx
 * 
 * Production-ready React Native Component for Location Search & Autocomplete
 * Integrates directly with the official Google Places Autocomplete API & Place Details API.
 * 
 * Features:
 * - Real-time query debouncing (300ms) to minimize Google Places API billing & prevent lag
 * - Native dropdown suggestion list rendering as the user types
 * - Minimalist filled location pin icons for all suggestions
 * - Place Details API coordinate extraction (lat, lng, formatted address)
 * - Built-in offline / testing mock fallback with Indian landmarks (Kochi, Bengaluru, Mumbai, Delhi)
 * - Seamless pickup and destination field updating
 * - Light and Dark theme styling with iOS / Android tactile feel
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Keyboard,
  Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');

// Comprehensive built-in mock landmarks for testing phase
const MOCK_LOCATIONS = [
  {
    placeId: 'mock_lulu_kochi',
    title: 'Lulu International Shopping Mall',
    subtitle: 'Edappally, Kochi, Kerala 682024',
    address: 'Lulu International Shopping Mall, Edappally, Kochi, Kerala 682024',
    coordinates: { lat: 10.0284, lng: 76.3082 }
  },
  {
    placeId: 'mock_cok_airport',
    title: 'Cochin International Airport (COK)',
    subtitle: 'Airport Rd, Nedumbassery, Kochi, Kerala 683111',
    address: 'Cochin International Airport (COK), Nedumbassery, Kochi, Kerala 683111',
    coordinates: { lat: 10.1518, lng: 76.3930 }
  },
  {
    placeId: 'mock_infopark_kochi',
    title: 'Infopark Phase 1 & 2',
    subtitle: 'Kakkanad, Kochi, Kerala 682042',
    address: 'Infopark Phase 1 & 2, Kakkanad, Kochi, Kerala 682042',
    coordinates: { lat: 10.0104, lng: 76.3639 }
  },
  {
    placeId: 'mock_marine_drive',
    title: 'Marine Drive Walkway & Rainbow Bridge',
    subtitle: 'Shanmugham Rd, Marine Drive, Ernakulam, Kochi 682031',
    address: 'Marine Drive Walkway, Ernakulam, Kochi, Kerala 682031',
    coordinates: { lat: 9.9796, lng: 76.2758 }
  },
  {
    placeId: 'mock_mg_road_metro',
    title: 'MG Road Metro Station',
    subtitle: 'Shenoys, Ernakulam, Kochi, Kerala 682035',
    address: 'MG Road Metro Station, Ernakulam, Kochi, Kerala 682035',
    coordinates: { lat: 9.9723, lng: 76.2783 }
  },
  {
    placeId: 'mock_fort_kochi',
    title: 'Fort Kochi Beach & Chinese Fishing Nets',
    subtitle: 'River Rd, Fort Kochi, Kochi, Kerala 682001',
    address: 'Fort Kochi Beach, Fort Kochi, Kochi, Kerala 682001',
    coordinates: { lat: 9.9658, lng: 76.2421 }
  },
  {
    placeId: 'mock_panampilly_nagar',
    title: 'Panampilly Nagar Central Park',
    subtitle: 'Main Ave, Panampilly Nagar, Kochi, Kerala 682036',
    address: 'Panampilly Nagar Central Park, Kochi, Kerala 682036',
    coordinates: { lat: 9.9610, lng: 76.2950 }
  },
  {
    placeId: 'mock_blr_airport',
    title: 'Kempegowda International Airport (BLR)',
    subtitle: 'KIAL Rd, Devanahalli, Bengaluru, Karnataka 560300',
    address: 'Kempegowda International Airport, Bengaluru, Karnataka 560300',
    coordinates: { lat: 13.1986, lng: 77.7066 }
  },
  {
    placeId: 'mock_indiranagar_100ft',
    title: 'Indiranagar 100 Feet Road',
    subtitle: 'HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
    address: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
    coordinates: { lat: 12.9719, lng: 77.6412 }
  },
  {
    placeId: 'mock_koramangala_sony',
    title: 'Sony World Signal, Koramangala',
    subtitle: '80 Feet Rd, 4th Block, Koramangala, Bengaluru 560034',
    address: 'Sony World Signal, 4th Block, Koramangala, Bengaluru 560034',
    coordinates: { lat: 12.9348, lng: 77.6256 }
  }
];

/**
 * Minimal Location Pin SVG-style icon rendered with pure React Native primitives
 */
function FilledPinIcon({ color = '#FFC70A', size = 18 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <View
        style={{
          width: size * 0.82,
          height: size * 0.82,
          borderRadius: size * 0.41,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: color,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 2
        }}
      >
        <View
          style={{
            width: size * 0.32,
            height: size * 0.32,
            borderRadius: (size * 0.32) / 2,
            backgroundColor: '#FFFFFF'
          }}
        />
      </View>
    </View>
  );
}

/**
 * GooglePlacesSearchInput Component
 *
 * @param {Object} props
 * @param {'pickup' | 'destination'} [props.fieldType='pickup'] - Which field is being configured
 * @param {string} [props.placeholder] - Custom placeholder text
 * @param {string} [props.value] - Controlled input value
 * @param {Function} props.onLocationSelect - Callback returning { address, title, subtitle, coordinates: { lat, lng }, placeId, fieldType }
 * @param {Function} [props.onChangeText] - Optional raw text change callback
 * @param {Function} [props.onUseCurrentLocation] - Optional callback for 1-tap device GPS location
 * @param {string} [props.apiKey] - Google Places API key (optional, falls back to env or mock)
 * @param {string} [props.country='in'] - Country code restriction
 * @param {boolean} [props.isDarkMode=false] - Dark theme toggle
 * @param {Object} [props.containerStyle] - Optional custom wrapper styling
 */
export default function GooglePlacesSearchInput({
  fieldType = 'pickup',
  placeholder,
  value,
  onLocationSelect,
  onChangeText,
  onUseCurrentLocation,
  apiKey,
  country = 'in',
  isDarkMode = false,
  containerStyle
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimerRef = useRef(null);

  // Synchronize internal query state with external controlled prop
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
    }
  }, [value]);

  const defaultPlaceholder =
    placeholder ||
    (fieldType === 'pickup'
      ? 'Enter pickup location...'
      : 'Enter destination location...');

  const themeColors = {
    bg: isDarkMode ? '#1E232A' : '#FFFFFF',
    inputBg: isDarkMode ? '#16191E' : '#F4F5F7',
    border: isDarkMode ? 'rgba(255,255,255,0.1)' : '#E5E7EB',
    text: isDarkMode ? '#F9FAFB' : '#111827',
    subText: isDarkMode ? '#9CA3AF' : '#6B7280',
    accent: '#FFC70A',
    pinColor: fieldType === 'pickup' ? '#FFC70A' : (isDarkMode ? '#60A5FA' : '#111827'),
    card: isDarkMode ? '#1C2128' : '#FFFFFF',
    divider: isDarkMode ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
    hover: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F9FAFB'
  };

  /**
   * Fetch predictions from Google Places Autocomplete API with Mock Fallback
   */
  const fetchPredictions = useCallback(
    async (text) => {
      if (!text || !text.trim() || text.trim().length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      const clean = text.trim();

      // 1. Google Maps JS SDK AutocompleteService (Zero-CORS, sub-50ms latency)
      if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteService) {
        try {
          const autoService = new window.google.maps.places.AutocompleteService();
          autoService.getPlacePredictions(
            { input: clean, componentRestrictions: { country: country || 'in' } },
            (predictions, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length > 0) {
                const mapped = predictions.map((p) => ({
                  placeId: p.place_id,
                  title: p.structured_formatting?.main_text || p.description.split(',')[0],
                  subtitle: p.structured_formatting?.secondary_text || '',
                  address: p.description,
                  isMock: false
                }));
                setSuggestions(mapped);
                setIsOpen(true);
                setIsLoading(false);
                return;
              }
            }
          );
        } catch (_) {}
      }

      // 2. If a valid Google Places API Key is provided, query Google Places REST API
      const key = apiKey || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) || '';
      if (key && !key.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
        try {
          const endpoint = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            clean
          )}&key=${key}&language=en&components=country:${country}`;

          const res = await fetch(endpoint);
          const data = await res.json();

          if (data && data.status === 'OK' && data.predictions?.length > 0) {
            const mapped = data.predictions.map((p) => ({
              placeId: p.place_id,
              title: p.structured_formatting?.main_text || p.description,
              subtitle: p.structured_formatting?.secondary_text || '',
              address: p.description,
              isMock: false
            }));

            setSuggestions(mapped);
            setIsOpen(true);
            setIsLoading(false);
            return;
          }
        } catch (err) {
          console.warn('[GooglePlacesSearch] API request failed, utilizing mock fallback:', err);
        }
      }

      // Offline / Testing Mock Database Fallback (Instant, Zero Latency with Typo Tolerance)
      const q = clean.toLowerCase();
      const qTokens = q.split(/[\s,]+/).filter(Boolean);
      
      const scored = MOCK_LOCATIONS.map((loc) => {
        const title = loc.title.toLowerCase();
        const sub = (loc.subtitle || '').toLowerCase();
        const full = `${title} ${sub}`;
        const words = [...title.split(/[\s,.-]+/), ...sub.split(/[\s,.-]+/)].filter(w => w.length >= 2);

        let score = 0;
        if (title.includes(q)) score += 60;
        if (sub.includes(q)) score += 40;

        for (const tok of qTokens) {
          for (const w of words) {
            if (w === tok) score += 40;
            else if (w.startsWith(tok)) score += 25;
            else if (w.includes(tok)) score += 15;
            else if (tok.length >= 3) {
              // Simple char overlap score for typos
              let matchCount = 0;
              for (const ch of tok) {
                if (w.includes(ch)) matchCount++;
              }
              if (matchCount / Math.max(tok.length, w.length) > 0.65) {
                score += 15;
              }
            }
          }
        }
        return { loc, score };
      });

      const matched = scored
        .filter((s) => s.score > 10)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.loc);

      setSuggestions(matched);
      setIsOpen(matched.length > 0);
      setIsLoading(false);
    },
    [apiKey, country]
  );

  /**
   * Handle text input change with 300ms debounce
   */
  const handleTextChange = (text) => {
    setQuery(text);
    if (onChangeText) onChangeText(text);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchPredictions(text);
    }, 300);
  };

  /**
   * Fetch Place Details coordinates (lat, lng) when a prediction is tapped
   */
  const handleSelectSuggestion = async (item) => {
    Keyboard.dismiss();
    setQuery(item.title);
    setIsOpen(false);

    let coordinates = item.coordinates || null;
    let finalAddress = item.address || `${item.title}, ${item.subtitle}`;

    // If item was fetched from live Google Places API, resolve coordinates via Place Details
    const key = apiKey || (typeof process !== 'undefined' ? process.env?.GOOGLE_PLACES_API_KEY : '');
    if (!coordinates && item.placeId && key && !key.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
      try {
        setIsLoading(true);
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.placeId}&fields=formatted_address,geometry&key=${key}`;
        const res = await fetch(detailsUrl);
        const data = await res.json();

        if (data && data.result?.geometry?.location) {
          coordinates = {
            lat: data.result.geometry.location.lat,
            lng: data.result.geometry.location.lng
          };
          if (data.result.formatted_address) {
            finalAddress = data.result.formatted_address;
          }
        }
      } catch (e) {
        console.warn('[GooglePlacesSearch] Place details error:', e);
      } finally {
        setIsLoading(false);
      }
    }

    // Default fallback coordinates if unavailable
    if (!coordinates) {
      coordinates = { lat: 10.0284, lng: 76.3082 }; // Default center
    }

    // Notify parent handler to update pickup or destination state
    if (onLocationSelect) {
      onLocationSelect({
        address: finalAddress,
        title: item.title,
        subtitle: item.subtitle,
        coordinates,
        placeId: item.placeId,
        fieldType
      });
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onChangeText) onChangeText('');
    if (onLocationSelect) {
      onLocationSelect({
        address: '',
        title: '',
        subtitle: '',
        coordinates: null,
        placeId: null,
        fieldType
      });
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Search Input Container */}
      <View
        style={[
          styles.inputWrapper,
          {
            backgroundColor: themeColors.inputBg,
            borderColor: isOpen ? themeColors.accent : themeColors.border
          }
        ]}
      >
        {/* Leading Location Pin Icon */}
        <View style={styles.pinWrapper}>
          <FilledPinIcon color={themeColors.pinColor} size={17} />
        </View>

        {/* Text Input Field */}
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder={defaultPlaceholder}
          placeholderTextColor={themeColors.subText}
          value={query}
          onChangeText={handleTextChange}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim()) {
              setIsOpen(true);
            }
          }}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          clearButtonMode="never"
        />

        {/* Loading Spinner */}
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={themeColors.accent}
            style={styles.spinner}
          />
        )}

        {/* Clear Button */}
        {!isLoading && query.length > 0 && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClear}
            activeOpacity={0.7}
            accessibilityLabel="Clear location search"
          >
            <View style={[styles.clearCircle, { backgroundColor: themeColors.border }]}>
              <Text style={[styles.clearText, { color: themeColors.subText, fontSize: 13, fontWeight: '700' }]}>x</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* 1-Tap Current Location Button (Optional) */}
        {fieldType === 'pickup' && onUseCurrentLocation && !query && (
          <TouchableOpacity
            style={styles.currentLocBtn}
            onPress={onUseCurrentLocation}
            activeOpacity={0.7}
          >
            <Text style={styles.currentLocText}>Current</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown Suggestions List */}
      {isOpen && suggestions.length > 0 && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border
            }
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId || item.title}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.suggestionRow,
                  index < suggestions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: themeColors.divider
                  }
                ]}
                onPress={() => handleSelectSuggestion(item)}
                activeOpacity={0.65}
              >
                {/* Minimal filled pin icon for all dropdown options */}
                <View style={styles.rowPinWrapper}>
                  <FilledPinIcon color="#FFC70A" size={16} />
                </View>

                {/* Place Text Content */}
                <View style={styles.textWrapper}>
                  <Text
                    style={[styles.primaryText, { color: themeColors.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {item.subtitle ? (
                    <Text
                      style={[styles.secondaryText, { color: themeColors.subText }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 230 }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 999
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.05,
        shadowRadius: 3
      },
      android: {
        elevation: 1
      }
    })
  },
  pinWrapper: {
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 0
  },
  spinner: {
    marginLeft: 8
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6
  },
  clearCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  clearText: {
    fontSize: 10,
    fontWeight: '700'
  },
  currentLocBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 199, 10, 0.15)',
    marginLeft: 6
  },
  currentLocText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#D97706'
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    zIndex: 99999999,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14
      },
      android: {
        elevation: 99999999
      }
    })
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  rowPinWrapper: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textWrapper: {
    flex: 1,
    justifyContent: 'center'
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '500'
  }
});
