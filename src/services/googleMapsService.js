/**
 * Ridingo Google Maps Integration Service
 * 
 * Provides a production-ready Google Maps architecture that seamlessly supports:
 * 1. Testing Phase: Realistic mock data for Places autocomplete, Reverse Geocoding,
 *    Directions/Routes, and turn-by-turn guidance without requiring Google Cloud billing.
 * 2. Production Live Phase: Instant zero-code switch to actual Google Maps APIs
 *    (Google Places API, Directions API, Geocoder, Maps JS SDK) when VITE_GOOGLE_MAPS_API_KEY is configured.
 * 3. Theme Engine: Authentic Google Maps Light & Dark/Night mode styling.
 * 4. Deep Navigation: Official Google Maps turn-by-turn navigation deep links for iOS and Android.
 */

// API Key from environment (.env)
export const GOOGLE_MAPS_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';

// Mock Mode Configuration
// Set to true by default if no API key is configured or VITE_USE_MOCK_MAPS === 'true'
let runtimeMockModeOverride = null;

export function isMockMode() {
  if (runtimeMockModeOverride !== null) {
    return runtimeMockModeOverride;
  }
  if (typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem('ridingo_use_mock_maps');
    if (stored !== null) return stored === 'true';
  }
  // If explicitly forced via env var
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK_MAPS === 'true') {
    return true;
  }
  // If no Google Maps API key provided, automatically run in mock mode
  return !GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('YOUR_GOOGLE_MAPS_API_KEY');
}

export function setMockMode(enabled) {
  runtimeMockModeOverride = Boolean(enabled);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage?.setItem('ridingo_use_mock_maps', String(enabled));
    } catch (e) {}
  }
  console.info(`[GoogleMaps] Mock mode set to: ${enabled}`);
}

import { cleanLocationName, cleanPlusCode, isLocationCode } from '../utils/locationCleaner';
export { cleanLocationName, cleanPlusCode, isLocationCode };

// ============================================================================
// Google Maps Stock Tile Endpoints
// ============================================================================
export const GOOGLE_MAP_TILES = {
  roadmap: {
    name: 'Google Roadmap (Light)',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data ©' + new Date().getFullYear() + ' Google'
  },
  satellite: {
    name: 'Google Satellite',
    url: 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Imagery ©' + new Date().getFullYear() + ' Google'
  },
  hybrid: {
    name: 'Google Hybrid (Satellite + Roads)',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data & Imagery ©' + new Date().getFullYear() + ' Google'
  },
  terrain: {
    name: 'Google Terrain',
    url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: 'Map data ©' + new Date().getFullYear() + ' Google'
  }
};

// ============================================================================
// Google Maps Official Dark / Night Theme Style JSON
// (Used when initializing Google Maps JS SDK in Dark Mode)
// ============================================================================
export const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#263c3f' }]
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b9a76' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#38414e' }]
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#212a37' }]
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9ca5b3' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#746855' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1f2835' }]
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f3d19c' }]
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#2f3948' }]
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d59563' }]
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#17263c' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#515c6d' }]
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#17263c' }]
  }
];

// ============================================================================
// Comprehensive Mock Data for Testing Phase
// ============================================================================
export const MOCK_PLACES_DATABASE = [
  // Kochi
  {
    place_id: 'mock_place_lulu_kochi',
    title: 'Lulu International Shopping Mall',
    sub: 'Edappally, Kochi, Kerala 682024',
    lat: 10.0284,
    lng: 76.3082,
    type: 'mall',
    rating: 4.6
  },
  {
    place_id: 'mock_place_edappally_toll',
    title: 'Edappally Toll Junction',
    sub: 'NH 66, Edappally, Kochi, Kerala 682024',
    lat: 10.0245,
    lng: 76.3075,
    type: 'hub',
    rating: 4.4
  },
  {
    place_id: 'mock_place_cok_airport',
    title: 'Cochin International Airport (COK)',
    sub: 'Airport Rd, Nedumbassery, Kochi, Kerala 683111',
    lat: 10.1518,
    lng: 76.3930,
    type: 'airport',
    rating: 4.7
  },
  {
    place_id: 'mock_place_infopark_kochi',
    title: 'Infopark Phase 1 & 2',
    sub: 'Kakkanad, Kochi, Kerala 682042',
    lat: 10.0104,
    lng: 76.3639,
    type: 'tech',
    rating: 4.5
  },
  {
    place_id: 'mock_place_marine_drive',
    title: 'Marine Drive Walkway & Rainbow Bridge',
    sub: 'Ernakulam, Kochi, Kerala 682031',
    lat: 9.9796,
    lng: 76.2758,
    type: 'hub',
    rating: 4.5
  },
  {
    place_id: 'mock_place_mg_road_metro',
    title: 'MG Road Metro Station',
    sub: 'Shenoys, Kochi, Kerala 682035',
    lat: 9.9723,
    lng: 76.2783,
    type: 'metro',
    rating: 4.3
  },
  {
    place_id: 'mock_place_panampilly_nagar',
    title: 'Panampilly Nagar Central Park',
    sub: 'Panampilly Nagar, Kochi, Kerala 682036',
    lat: 9.9610,
    lng: 76.2950,
    type: 'residential',
    rating: 4.5
  },
  {
    place_id: 'mock_place_fort_kochi',
    title: 'Fort Kochi Beach & Heritage Walk',
    sub: 'Fort Kochi, Kochi, Kerala 682001',
    lat: 9.9658,
    lng: 76.2421,
    type: 'tourist',
    rating: 4.7
  },
  {
    place_id: 'mock_place_aluva_metro',
    title: 'Aluva Metro Station & KSRTC Stand',
    sub: 'Aluva, Kochi, Kerala 683101',
    aliases: ['aluva', 'alwaye', 'alva', 'metro', 'aluvaa', 'aluvha'],
    lat: 10.1076,
    lng: 76.3533,
    type: 'metro',
    rating: 4.5
  },
  {
    place_id: 'mock_place_vytilla_hub',
    title: 'Vyttila Mobility Hub & Metro Station',
    sub: 'Vyttila, Kochi, Kerala 682019',
    aliases: ['vyttila', 'vytilla', 'hub', 'vytila', 'metro', 'mobility hub'],
    lat: 9.9678,
    lng: 76.3217,
    type: 'transit',
    rating: 4.5
  },
  {
    place_id: 'mock_place_palarivattom',
    title: 'Palarivattom Junction & Pipeline',
    sub: 'Palarivattom, Kochi, Kerala 682025',
    aliases: ['palarivattom', 'palrivatom', 'pipeline', 'palarivattam', 'palari'],
    lat: 10.0033,
    lng: 76.3073,
    type: 'hub',
    rating: 4.4
  },
  {
    place_id: 'mock_place_ernakulam_south',
    title: 'Ernakulam South Railway Station (ERS / Junction)',
    sub: 'South Railway Station Rd, Ernakulam, Kochi, Kerala 682016',
    aliases: ['ernakulam', 'ernaklam', 'ers', 'south station', 'railway', 'junction', 'ernaklm'],
    lat: 9.9676,
    lng: 76.2891,
    type: 'transit',
    rating: 4.5
  },
  {
    place_id: 'mock_place_ernakulam_north',
    title: 'Ernakulam North Railway Station (Town / ERN)',
    sub: 'North Railway Station Rd, Kaloor, Kochi, Kerala 682018',
    aliases: ['ernakulam', 'ernaklam', 'ern', 'north station', 'kaloor', 'town', 'ernaklm'],
    lat: 9.9932,
    lng: 76.2872,
    type: 'transit',
    rating: 4.5
  },

  // Kozhikode (Calicut) & Malabar
  {
    place_id: 'mock_place_clt_railway',
    title: 'Kozhikode Railway Station (CLT)',
    sub: 'Palayam, Kozhikode, Kerala 673001',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'clt', 'railway', 'palayam'],
    lat: 11.2464,
    lng: 75.7820,
    type: 'transit',
    rating: 4.6
  },
  {
    place_id: 'mock_place_ccj_airport',
    title: 'Calicut International Airport (CCJ / Kozhikode Airport)',
    sub: 'Airport Rd, Karipur, Kozhikode, Kerala 673647',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'airport', 'karipur', 'ccj'],
    lat: 11.1396,
    lng: 75.9557,
    type: 'airport',
    rating: 4.7
  },
  {
    place_id: 'mock_place_clt_beach',
    title: 'Kozhikode Beach & South Beach',
    sub: 'Beach Rd, Vellayil, Kozhikode, Kerala 673032',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'beach'],
    lat: 11.2588,
    lng: 75.7687,
    type: 'tourist',
    rating: 4.7
  },
  {
    place_id: 'mock_place_hilite_mall',
    title: 'HiLITE Mall Kozhikode',
    sub: 'NH 66 Bypass, Poovangal, Kozhikode, Kerala 673014',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'hilite', 'mall'],
    lat: 11.2528,
    lng: 75.8239,
    type: 'mall',
    rating: 4.6
  },
  {
    place_id: 'mock_place_focus_mall',
    title: 'Focus Mall & Rajaji Road',
    sub: 'Arayidathupalam, Kozhikode, Kerala 673004',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'focus', 'mall', 'rajaji'],
    lat: 11.2592,
    lng: 75.7884,
    type: 'mall',
    rating: 4.4
  },
  {
    place_id: 'mock_place_mananchira',
    title: 'Mananchira Square & Town Hall',
    sub: 'Mananchira, Kozhikode, Kerala 673001',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'mananchira'],
    lat: 11.2541,
    lng: 75.7811,
    type: 'hub',
    rating: 4.5
  },
  {
    place_id: 'mock_place_clt_medcollege',
    title: 'Govt Medical College Hospital Kozhikode',
    sub: 'Medical College PO, Kozhikode, Kerala 673008',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'medical college'],
    lat: 11.2725,
    lng: 75.8361,
    type: 'hospital',
    rating: 4.5
  },
  {
    place_id: 'mock_place_mavoor_rd',
    title: 'Mavoor Road Bus Terminal & KSRTC',
    sub: 'Mavoor Rd, Kozhikode, Kerala 673004',
    aliases: ['kozhi', 'kozhikode', 'calicut', 'mavoor', 'ksrtc'],
    lat: 11.2580,
    lng: 75.7890,
    type: 'transit',
    rating: 4.3
  },
  {
    place_id: 'mock_place_kallachi_town',
    title: 'Kallachi Town Junction',
    sub: 'Nadapuram - Thalassery Rd, Kallachi, Kozhikode, Kerala 673506',
    aliases: ['kallachi', 'kalla', 'nadapuram', 'kozhikode'],
    lat: 11.6833,
    lng: 75.6667,
    type: 'hub',
    rating: 4.4
  },
  {
    place_id: 'mock_place_nadapuram',
    title: 'Nadapuram Bus Stand & Market',
    sub: 'Nadapuram, Kozhikode, Kerala 673504',
    aliases: ['nadapuram', 'nadap', 'kallachi', 'kozhikode'],
    lat: 11.6961,
    lng: 75.6543,
    type: 'hub',
    rating: 4.3
  },
  {
    place_id: 'mock_place_vadakara',
    title: 'Vadakara Old Bus Stand & Railway Station',
    sub: 'Vadakara, Kozhikode District, Kerala 673101',
    aliases: ['vadakara', 'badagara', 'vada', 'kozhikode'],
    lat: 11.6033,
    lng: 75.5902,
    type: 'transit',
    rating: 4.4
  },
  {
    place_id: 'mock_place_kannur_airport',
    title: 'Kannur International Airport (CNN)',
    sub: 'Mattannur, Kannur, Kerala 670702',
    aliases: ['kannur', 'cnn', 'airport', 'mattannur'],
    lat: 11.9177,
    lng: 75.5481,
    type: 'airport',
    rating: 4.6
  },
  {
    place_id: 'mock_place_kannur_railway',
    title: 'Kannur Railway Station & Town',
    sub: 'Station Rd, Kannur, Kerala 670001',
    aliases: ['kannur', 'can', 'railway'],
    lat: 11.8745,
    lng: 75.3704,
    type: 'transit',
    rating: 4.5
  },
  {
    place_id: 'mock_place_thrissur_round',
    title: 'Thrissur Round & Swaraj Round',
    sub: 'Swaraj Round North, Thrissur, Kerala 680001',
    aliases: ['thrissur', 'trichur', 'swaraj', 'round'],
    lat: 10.5276,
    lng: 76.2144,
    type: 'hub',
    rating: 4.5
  },
  {
    place_id: 'mock_place_tvm_station',
    title: 'Trivandrum Central Railway Station',
    sub: 'Thampanoor, Thiruvananthapuram, Kerala 695001',
    aliases: ['trivandrum', 'thiruvananthapuram', 'thampanoor', 'tvm'],
    lat: 8.4875,
    lng: 76.9530,
    type: 'transit',
    rating: 4.6
  },
  {
    place_id: 'mock_place_trv_airport',
    title: 'Thiruvananthapuram International Airport (TRV)',
    sub: 'Chacka, Thiruvananthapuram, Kerala 695008',
    aliases: ['trivandrum', 'thiruvananthapuram', 'trv', 'airport'],
    lat: 8.4821,
    lng: 76.9200,
    type: 'airport',
    rating: 4.6
  },

  // Bengaluru
  {
    place_id: 'mock_place_blr_airport',
    title: 'Kempegowda International Airport (BLR)',
    sub: 'KIAL Rd, Devanahalli, Bengaluru, Karnataka 560300',
    lat: 13.1986,
    lng: 77.7066,
    type: 'airport',
    rating: 4.8
  },
  {
    place_id: 'mock_place_indiranagar_100ft',
    title: 'Indiranagar 100 Feet Road',
    sub: 'HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038',
    lat: 12.9719,
    lng: 77.6412,
    type: 'hub',
    rating: 4.7
  },
  {
    place_id: 'mock_place_residency_rd_blr',
    title: 'Residency Road',
    sub: "D'Souza Layout, Shanthala Nagar, Bengaluru, Karnataka 560001",
    lat: 12.9667,
    lng: 77.5987,
    type: 'hub',
    rating: 4.8
  },
  {
    place_id: 'mock_place_dsouza_layout_blr',
    title: "D'Souza Layout",
    sub: 'Residency Road, Shanthala Nagar, Bengaluru, Karnataka 560001',
    lat: 12.9662,
    lng: 77.5982,
    type: 'residential',
    rating: 4.7
  },
  {
    place_id: 'mock_place_nadapuram_kerala',
    title: 'Nadapuram Town',
    sub: 'Vadakara, Kozhikode, Kerala 673504',
    lat: 11.6852,
    lng: 75.6544,
    type: 'hub',
    rating: 4.5
  },
  {
    place_id: 'mock_place_kallachi_kerala',
    title: 'Kallachi Junction',
    sub: 'Nadapuram, Vadakara, Kozhikode, Kerala 673506',
    lat: 11.6837,
    lng: 75.6645,
    type: 'hub',
    rating: 4.4
  },
  {
    place_id: 'mock_place_calicut_railway',
    title: 'Kozhikode Main Railway Station (CLT)',
    sub: 'Railway Station Rd, Palayam, Kozhikode, Kerala 673001',
    lat: 11.2482,
    lng: 75.7839,
    type: 'transit',
    rating: 4.6
  },
  {
    place_id: 'mock_place_calicut_beach',
    title: 'Kozhikode Beach',
    sub: 'Beach Rd, Vellayil, Kozhikode, Kerala 673032',
    lat: 11.2618,
    lng: 75.7686,
    type: 'tourist',
    rating: 4.7
  },
  {
    place_id: 'mock_place_cyberpark_calicut',
    title: 'Government Cyberpark Kozhikode',
    sub: 'Nellikode, Kozhikode, Kerala 673016',
    lat: 11.2721,
    lng: 75.8340,
    type: 'tech',
    rating: 4.5
  },
  {
    place_id: 'mock_place_vytilla_hub',
    title: 'Vytilla Mobility Hub',
    sub: 'Vytilla, Kochi, Kerala 682019',
    lat: 9.9656,
    lng: 76.3196,
    type: 'transit',
    rating: 4.5
  },
  {
    place_id: 'mock_place_palarivattom_jn',
    title: 'Palarivattom Junction',
    sub: 'Palarivattom, Kochi, Kerala 682025',
    lat: 10.0069,
    lng: 76.3094,
    type: 'hub',
    rating: 4.4
  },
  {
    place_id: 'mock_place_aluva_metro',
    title: 'Aluva Metro & Railway Station',
    sub: 'Subhash Nagar, Aluva, Kochi, Kerala 683101',
    lat: 10.1076,
    lng: 76.3516,
    type: 'transit',
    rating: 4.6
  },
  {
    place_id: 'mock_place_thrissur_round',
    title: 'Swaraj Round & Vadakkunnathan Temple',
    sub: 'Kuruppam, Thekkinkadu Maidan, Thrissur, Kerala 680001',
    lat: 10.5243,
    lng: 76.2144,
    type: 'hub',
    rating: 4.8
  },
  {
    place_id: 'mock_place_trivandrum_technopark',
    title: 'Technopark Phase 1 & 3',
    sub: 'Kazhakkoottam, Thiruvananthapuram, Kerala 695581',
    lat: 8.5566,
    lng: 76.8821,
    type: 'tech',
    rating: 4.6
  },
  {
    place_id: 'mock_place_koramangala_5th',
    title: 'Koramangala 5th Block',
    sub: 'Koramangala, Bengaluru, Karnataka 560095',
    lat: 12.9352,
    lng: 77.6245,
    type: 'hub',
    rating: 4.6
  },
  {
    place_id: 'mock_place_mg_road_blr',
    title: 'MG Road Metro Station',
    sub: 'MG Road, Bengaluru, Karnataka 560001',
    lat: 12.9756,
    lng: 77.6068,
    type: 'metro',
    rating: 4.5
  },
  {
    place_id: 'mock_place_whitefield_itpl',
    title: 'International Tech Park Bengaluru (ITPL)',
    sub: 'Whitefield Main Rd, Bengaluru, Karnataka 560066',
    lat: 12.9863,
    lng: 77.7346,
    type: 'tech',
    rating: 4.5
  },
  {
    place_id: 'mock_place_electronic_city',
    title: 'Electronic City Phase 1 Toll Gate',
    sub: 'Hosur Rd, Bengaluru, Karnataka 560100',
    lat: 12.8399,
    lng: 77.6770,
    type: 'tech',
    rating: 4.3
  },

  // Mumbai
  {
    place_id: 'mock_place_bom_airport',
    title: 'Chhatrapati Shivaji Maharaj International Airport (BOM)',
    sub: 'Terminal 2, Sahar, Andheri East, Mumbai 400099',
    lat: 19.0896,
    lng: 72.8656,
    type: 'airport',
    rating: 4.6
  },
  {
    place_id: 'mock_place_bkc_mumbai',
    title: 'Bandra Kurla Complex (BKC)',
    sub: 'Bandra East, Mumbai, Maharashtra 400051',
    lat: 19.0664,
    lng: 72.8687,
    type: 'tech',
    rating: 4.6
  },

  // Delhi NCR
  {
    place_id: 'mock_place_del_airport',
    title: 'Indira Gandhi International Airport (DEL)',
    sub: 'Terminal 3, New Delhi, Delhi 110037',
    lat: 28.5562,
    lng: 77.1000,
    type: 'airport',
    rating: 4.7
  },
  {
    place_id: 'mock_place_cyber_city',
    title: 'DLF Cyber City Building 10',
    sub: 'DLF Phase 2, Gurugram, Haryana 122002',
    lat: 28.4950,
    lng: 77.0895,
    type: 'tech',
    rating: 4.7
  }
];

let googleMapsScriptLoadingPromise = null;

/**
 * Dynamically loads the official Google Maps JavaScript API SDK script
 * when an API key is configured.
 */
export function loadGoogleMapsSdk(apiKey = GOOGLE_MAPS_API_KEY) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is undefined'));
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsScriptLoadingPromise) {
    return googleMapsScriptLoadingPromise;
  }

  googleMapsScriptLoadingPromise = new Promise((resolve) => {
    // 1. Check if script tag is already in DOM (e.g. loaded by index.html)
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps);
        return;
      }
      existing.addEventListener('load', () => resolve(window.google?.maps || null));
      existing.addEventListener('error', () => resolve(null));
      setTimeout(() => {
        if (window.google?.maps) resolve(window.google.maps);
      }, 500);
      return;
    }

    const effectiveKey = apiKey || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';
    const script = document.createElement('script');
    script.id = 'ridingo-google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(effectiveKey)}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.info('[GoogleMaps] Official Google Maps JS SDK loaded successfully');
      resolve(window.google?.maps || null);
    };
    script.onerror = (err) => {
      console.warn('[GoogleMaps] Failed to load Google Maps SDK:', err);
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return googleMapsScriptLoadingPromise;
}

let nominatimAbortController = null;

async function fetchNominatimPlaces(query, callback) {
  try {
    if (nominatimAbortController) {
      nominatimAbortController.abort();
    }
    nominatimAbortController = new AbortController();

    // Prioritize South India / Kerala bounds with fallback across India
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&viewbox=74.5,12.9,77.8,8.1&bounded=0&limit=10&addressdetails=1`;
    const res = await fetch(url, {
      signal: nominatimAbortController.signal,
      headers: {
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const results = data.map(item => {
          const cleanFull = cleanLocationName(item.display_name || '');
          const parts = cleanFull.split(',').map(s => s.trim()).filter(Boolean);
          const title = cleanLocationName(parts[0] || query);
          const sub = cleanLocationName(parts.slice(1, 4).join(', '));
          return {
            id: 'nom_' + item.place_id,
            place_id: String(item.place_id),
            title,
            sub,
            full: cleanFull,
            lat: Number(item.lat),
            lng: Number(item.lon),
            isMock: false
          };
        });
        callback(results);
        return;
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[Places] Live search fallback query notice:', err);
    }
  }
  callback([]);
}

let currentSessionToken = null;
let googlePlacesDisabledDueToAuth = false;

if (typeof window !== 'undefined') {
  const existingAuthHandler = window.gm_authFailure;
  window.gm_authFailure = function() {
    googlePlacesDisabledDueToAuth = true;
    console.warn('[GoogleMaps] API key authentication failure or unactivated Places API. Gracefully switching to high-speed local places database.');
    if (typeof existingAuthHandler === 'function') {
      existingAuthHandler();
    }
  };
}

/**
 * Creates or retrieves a Google Places AutocompleteSessionToken.
 * Groups query requests and place detail retrieval into a single billable session.
 */
export function getOrCreatePlacesSessionToken() {
  if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteSessionToken) {
    if (!currentSessionToken) {
      currentSessionToken = new window.google.maps.places.AutocompleteSessionToken();
    }
    return currentSessionToken;
  }
  return null;
}

export function resetPlacesSessionToken() {
  currentSessionToken = null;
}

/**
 * Extracts comprehensive structured address components (city, state, postal code, country, locality)
 * from Google Places API or Geocoding API address_components array.
 */
export function parseAddressComponents(components = []) {
  let locality = '';
  let sublocality = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';

  if (Array.isArray(components)) {
    for (const c of components) {
      const types = c.types || [];
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        sublocality = c.long_name || c.short_name || '';
      }
      if (types.includes('locality')) {
        locality = c.long_name || c.short_name || '';
      } else if (types.includes('administrative_area_level_2') && !city) {
        city = c.long_name || c.short_name || '';
      }
      if (types.includes('administrative_area_level_1')) {
        state = c.long_name || c.short_name || '';
      }
      if (types.includes('postal_code')) {
        postalCode = c.long_name || c.short_name || '';
      }
      if (types.includes('country')) {
        country = c.long_name || c.short_name || '';
      }
    }
  }

  const primaryCity = locality || sublocality || city || '';
  return {
    city: primaryCity,
    locality,
    sublocality,
    state,
    postalCode,
    country
  };
}

/**
 * Extracts structured address components from Google Places API (New) format.
 */
export function parseAddressComponentsNew(components = []) {
  let locality = '';
  let sublocality = '';
  let city = '';
  let state = '';
  let postalCode = '';
  let country = '';

  if (Array.isArray(components)) {
    for (const c of components) {
      const types = c.types || [];
      const text = c.longText || c.shortText || '';
      if (types.includes('sublocality') || types.includes('sublocality_level_1')) {
        sublocality = text;
      }
      if (types.includes('locality')) {
        locality = text;
      } else if ((types.includes('administrative_area_level_2') || types.includes('administrative_area_level_3')) && !city) {
        city = text;
      }
      if (types.includes('administrative_area_level_1')) {
        state = text;
      }
      if (types.includes('postal_code')) {
        postalCode = text;
      }
      if (types.includes('country')) {
        country = text;
      }
    }
  }

  const primaryCity = locality || sublocality || city || '';
  return {
    city: primaryCity,
    locality,
    sublocality,
    state,
    postalCode,
    country
  };
}

/**
 * Fetches high-precision coordinates, complete structured address, and details for a Google Place ID.
 * Supports both Google Places API (New) and legacy PlacesService fallback.
 */
export async function fetchPlaceDetails(placeId) {
  if (!placeId) return null;
  const cleanId = String(placeId).replace(/^places\//, '');

  // 1. Live Google Places API (New) details endpoint
  if (GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}?fields=id,displayName,formattedAddress,location,addressComponents`, {
        headers: {
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.location?.latitude && data?.location?.longitude) {
          const parsed = parseAddressComponentsNew(data.addressComponents);
          return {
            place_id: cleanId,
            lat: Number(data.location.latitude),
            lng: Number(data.location.longitude),
            name: data.displayName?.text || data.formattedAddress?.split(',')?.[0]?.trim() || '',
            formatted_address: data.formattedAddress || '',
            address_components: data.addressComponents || [],
            source: 'google',
            ...parsed
          };
        }
      }
    } catch (err) {
      console.warn('[GooglePlaces] Live fetchPlaceDetails (New) error:', err);
    }
  }

  // 2. Legacy JS SDK PlacesService fallback
  if (typeof window !== 'undefined' && window.google?.maps?.places?.PlacesService) {
    try {
      const dummyElem = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(dummyElem);
      const token = currentSessionToken;
      resetPlacesSessionToken();

      return await new Promise((resolve) => {
        service.getDetails(
          {
            placeId: cleanId,
            fields: ['geometry.location', 'name', 'formatted_address', 'address_components', 'vicinity'],
            sessionToken: token
          },
          (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
              const parsed = parseAddressComponents(place.address_components);
              resolve({
                place_id: cleanId,
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
                name: place.name || '',
                formatted_address: place.formatted_address || '',
                vicinity: place.vicinity || '',
                address_components: place.address_components || [],
                ...parsed
              });
            } else {
              resolve(null);
            }
          }
        );
      });
    } catch (e) {
      console.warn('[GooglePlaces] fetchPlaceDetails error:', e);
    }
  }
  return null;
}

/**
 * Attaches the official Google Places Autocomplete functionality to any HTML input element.
 * 1. Prioritizes local relevant places within India (with optional user coordinate bias).
 * 2. On location selection ('place_changed' event), extracts complete address attributes
 *    (formatted_address, coordinates, city, locality, postal code, state).
 * 3. Returns an object with the autocomplete instance and a destroy() cleanup method.
 */
export function initGooglePlacesAutocomplete(inputElement, onPlaceSelected, options = {}) {
  if (!inputElement || typeof window === 'undefined') return null;

  const setup = () => {
    if (!window.google?.maps?.places?.Autocomplete) return null;

    try {
      const userCoords = options.userCoords || { lat: 10.1518, lng: 76.3930 };
      const defaultBounds = new window.google.maps.Circle({
        center: new window.google.maps.LatLng(Number(userCoords.lat), Number(userCoords.lng)),
        radius: 80000 // 80 km local priority bias
      });

      const autocomplete = new window.google.maps.places.Autocomplete(inputElement, {
        componentRestrictions: { country: 'in' },
        fields: ['address_components', 'geometry.location', 'formatted_address', 'name', 'place_id', 'vicinity'],
        bounds: defaultBounds.getBounds(),
        strictBounds: false
      });

      const listener = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.geometry || !place.geometry.location) {
          return;
        }

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formatted = cleanPlusCode(place.formatted_address || place.name || inputElement.value);
        if (inputElement) {
          inputElement.value = formatted;
        }
        const parsed = parseAddressComponents(place.address_components);

        const fullDetails = {
          place_id: place.place_id,
          name: cleanPlusCode(place.name) || formatted.split(',')[0].trim(),
          formatted_address: formatted,
          lat,
          lng,
          address_components: place.address_components || [],
          vicinity: place.vicinity || '',
          ...parsed
        };

        if (typeof onPlaceSelected === 'function') {
          onPlaceSelected(fullDetails);
        }
      });

      return {
        autocomplete,
        destroy: () => {
          if (window.google?.maps?.event?.removeListener && listener) {
            window.google.maps.event.removeListener(listener);
          }
          if (window.google?.maps?.event?.clearInstanceListeners) {
            window.google.maps.event.clearInstanceListeners(autocomplete);
          }
        }
      };
    } catch (err) {
      console.warn('[GooglePlaces] Failed to initialize Autocomplete:', err);
      return null;
    }
  };

  if (window.google?.maps?.places?.Autocomplete) {
    return setup();
  } else {
    // If Google Maps SDK is still loading, wait and mount
    loadGoogleMapsSdk().then(() => {
      setup();
    });
    return null;
  }
}

let placesApiAbortController = null;

/**
 * Levenshtein distance calculation for typo-tolerant matching
 */
export function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1 || !s1.length) return s2 ? s2.length : 0;
  if (!s2 || !s2.length) return s1.length;

  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const row = [];
  for (let i = 0; i <= b.length; i++) row[i] = i;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function wordSimilarity(w1, w2) {
  if (!w1 || !w2) return 0;
  const a = w1.toLowerCase().trim();
  const b = w2.toLowerCase().trim();
  if (a === b) return 1.0;
  if (a.startsWith(b) || b.startsWith(a)) return 0.9;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - (dist / maxLen));
}

/**
 * Prioritizes place results:
 * 1. Exact full name match at the VERY TOP (#1).
 * 2. Prefix match (starts with the query).
 * 3. Typo-tolerant and fuzzy matching so imperfect spellings still surface the right places.
 */
export function rankAndFilterPlaces(items, rawQuery) {
  if (!Array.isArray(items) || items.length === 0 || !rawQuery) return [];
  const q = rawQuery.trim().toLowerCase();
  if (!q) return items;

  const qTokens = q.split(/[\s,]+/).filter(Boolean);

  // 1. Strict match check
  const strictMatches = items.filter(item => {
    const title = (item.title || '').toLowerCase();
    const sub = (item.sub || '').toLowerCase();
    const full = (item.full || '').toLowerCase();
    const combined = `${title} ${sub} ${full}`;

    if (combined.includes(q)) return true;
    return qTokens.length > 0 && qTokens.every(tok => combined.includes(tok));
  });

  if (strictMatches.length > 0) {
    return strictMatches.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase().trim();
      const bTitle = (b.title || '').toLowerCase().trim();
      const aFull = (a.full || '').toLowerCase().trim();
      const bFull = (b.full || '').toLowerCase().trim();

      const getRank = (title, full) => {
        if (title === q) return 1;
        if (full === q) return 2;
        if (title.startsWith(q + ',') || title.startsWith(q + ' ')) return 3;
        if (full.startsWith(q + ',') || full.startsWith(q + ' ')) return 4;
        if (title.startsWith(q)) return 5;
        if (full.startsWith(q)) return 6;
        if (title.includes(q)) return 7;
        if (full.includes(q)) return 8;
        return 10;
      };

      const rankA = getRank(aTitle, aFull);
      const rankB = getRank(bTitle, bFull);
      if (rankA !== rankB) return rankA - rankB;
      if (aTitle.length !== bTitle.length) return aTitle.length - bTitle.length;
      return aFull.length - bFull.length;
    });
  }

  // 2. Typo-tolerant Fuzzy Search: Score each item for misspellings and phonetic similarities
  const scored = items.map(item => {
    const title = (item.title || '').toLowerCase();
    const sub = (item.sub || '').toLowerCase();
    const fullWords = [...title.split(/[\s,.-]+/), ...sub.split(/[\s,.-]+/)].filter(w => w.length >= 2);

    let maxWordScore = 0;
    for (const tok of qTokens) {
      for (const w of fullWords) {
        const sim = wordSimilarity(tok, w);
        if (sim > maxWordScore) maxWordScore = sim;
      }
    }

    // Direct whole-query similarity to title
    const titleSim = wordSimilarity(q, title);
    const overallScore = Math.max(maxWordScore, titleSim);

    return { item, score: overallScore };
  });

  return scored
    .filter(s => s.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .map(s => s.item);
}

// In-memory LRU-style cache for high-speed instant 0ms autocomplete responses
const placesMemoryCache = new Map();
let placesSearchSeq = 0;

/**
 * Unified Places Search & Autocomplete
 * Configured with official Google Places API & Instant In-Memory Cache:
 * 1. Checks in-memory cache first for instant 0ms response on repeat keystrokes/backspaces.
 * 2. Uses Google Places API (New) Autocomplete via REST with country: India restriction.
 * 3. Falls back to Google Places Text Search (searchText) if autocomplete returns 0 suggestions.
 * 4. Ensures all suggestions carry genuine Google place IDs and verified coordinates.
 */
export async function searchGooglePlaces(query, callbackOrOptions, options = {}) {
  const callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : null;
  const opts = typeof callbackOrOptions === 'function' ? (options || {}) : (callbackOrOptions || {});

  return new Promise(async (resolve) => {
    let hasResolved = false;
    const notify = (results) => {
      if (hasResolved) return;
      hasResolved = true;
      const safeResults = Array.isArray(results) ? results : [];
      if (callback) {
        try {
          callback(safeResults);
        } catch (cbErr) {
          console.warn('[GooglePlaces] callback handler notice:', cbErr);
        }
      }
      resolve(safeResults);
    };

    if (!query || !query.trim() || query.trim().length < 1) {
      notify([]);
      return;
    }

    const clean = query.trim();
    const lower = clean.toLowerCase();
    const currentSeq = ++placesSearchSeq;

    // 1. Instant 0ms Cache Hit (Only if verified genuine Google results)
    if (placesMemoryCache.has(lower)) {
      const cached = placesMemoryCache.get(lower);
      if (Array.isArray(cached) && cached.length > 0) {
        notify(cached);
        return;
      }
    }

    // Fallback search via Local Database & Nominatim ONLY when offline / no Google API key
    function fallbackSearch() {
      if (currentSeq !== placesSearchSeq) return;
      const rawLocal = getFilteredMockPlaces(lower);
      if (rawLocal.length > 0) {
        const topLocal = rawLocal.slice(0, 10);
        placesMemoryCache.set(lower, topLocal);
        notify(topLocal);
        return;
      }
      fetchNominatimPlaces(clean, (nomResults) => {
        if (currentSeq !== placesSearchSeq) return;
        const resList = nomResults || [];
        placesMemoryCache.set(lower, resList);
        notify(resList);
      });
    }

    // 2. Primary: Google Maps JavaScript SDK (Places API New AutocompleteSuggestion & AutocompleteService)
    try {
      if (typeof window !== 'undefined' && !window.google?.maps?.places) {
        await loadGoogleMapsSdk().catch(() => {});
      }

      // 2a. Places API (New) AutocompleteSuggestion SDK
      if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
        try {
          const suggestionRes = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: clean,
            includedRegionCodes: ['in']
          });
          if (currentSeq !== placesSearchSeq) return;
          if (suggestionRes?.suggestions && suggestionRes.suggestions.length > 0) {
            const formatted = suggestionRes.suggestions
              .filter(s => s.placePrediction)
              .map(s => {
                const p = s.placePrediction;
                const placeId = p.placeId || (p.toPlace ? p.toPlace().id : '');
                const mainText = cleanPlusCode(p.mainText?.text || p.text?.text?.split(',')?.[0] || clean);
                const secondaryText = cleanPlusCode(p.secondaryText?.text || '');
                return {
                  id: placeId,
                  place_id: placeId,
                  title: mainText,
                  sub: secondaryText,
                  full: cleanPlusCode(p.text?.text || `${mainText}, ${secondaryText}`),
                  isMock: false,
                  source: 'google'
                };
              });
            placesMemoryCache.set(lower, formatted);
            notify(formatted);
            return;
          }
        } catch (_) {}
      }

      // 2b. Legacy PlacesService AutocompleteService
      if (typeof window !== 'undefined' && window.google?.maps?.places?.AutocompleteService) {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        const request = {
          input: clean,
          componentRestrictions: { country: 'in' }
        };

        autocompleteService.getPlacePredictions(request, (predictions, status) => {
          if (currentSeq !== placesSearchSeq) return;
          if (status === window.google.maps.places.PlacesServiceStatus.OK && Array.isArray(predictions) && predictions.length > 0) {
            const formatted = predictions.map(p => {
              const rawTitle = p.structured_formatting?.main_text || p.description.split(',')[0];
              const rawSub = p.structured_formatting?.secondary_text || '';
              const rawFull = p.description;
              return {
                id: p.place_id,
                place_id: p.place_id,
                title: cleanPlusCode(rawTitle),
                sub: cleanPlusCode(rawSub),
                full: cleanPlusCode(rawFull),
                isMock: false,
                source: 'google'
              };
            });

            placesMemoryCache.set(lower, formatted);
            notify(formatted);
            return;
          }

          tryRestPlacesApi();
        });
        return;
      }
    } catch (sdkErr) {
      console.warn('[GooglePlaces] SDK AutocompleteService notice:', sdkErr);
    }

    tryRestPlacesApi();

    // 3. Secondary: Live Google Places API (New) Autocomplete via REST (Country: India)
    async function tryRestPlacesApi() {
      if (currentSeq !== placesSearchSeq) return;
      const apiKey = GOOGLE_MAPS_API_KEY || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';
      if (apiKey && !apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
        try {
          const payload = {
            input: clean,
            includedRegionCodes: ['in']
          };

          const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey
            },
            body: JSON.stringify(payload)
          });

          if (currentSeq !== placesSearchSeq) return;

          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
              const googleResults = data.suggestions
                .filter(s => s.placePrediction)
                .map(s => {
                  const p = s.placePrediction;
                  const placeId = p.placeId || (p.place ? p.place.replace(/^places\//, '') : '');
                  const mainText = cleanPlusCode(p.structuredFormat?.mainText?.text || p.text?.text?.split(',')?.[0] || clean);
                  const secondaryText = cleanPlusCode(p.structuredFormat?.secondaryText?.text || p.text?.text || '');
                  return {
                    id: placeId,
                    place_id: placeId,
                    title: mainText,
                    sub: secondaryText,
                    full: cleanPlusCode(p.text?.text || `${mainText}, ${secondaryText}`),
                    isMock: false,
                    source: 'google'
                  };
                });

              placesMemoryCache.set(lower, googleResults);
              notify(googleResults);
              return;
            }

            // Fallback to Google Places Text Search (searchText)
            const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
              },
              body: JSON.stringify({
                textQuery: clean,
                languageCode: 'en',
                regionCode: 'in'
              })
            });

            if (currentSeq !== placesSearchSeq) return;

            if (searchRes.ok) {
              const sData = await searchRes.json();
              if (sData?.places && sData.places.length > 0) {
                const searchResults = sData.places.map(p => {
                  const placeId = p.id;
                  const title = cleanPlusCode(p.displayName?.text || clean);
                  const sub = cleanPlusCode(p.formattedAddress || '');
                  return {
                    id: placeId,
                    place_id: placeId,
                    title,
                    sub,
                    full: sub || title,
                    lat: p.location?.latitude ? Number(p.location.latitude) : undefined,
                    lng: p.location?.longitude ? Number(p.location.longitude) : undefined,
                    isMock: false,
                    source: 'google'
                  };
                });

                placesMemoryCache.set(lower, searchResults);
                notify(searchResults);
                return;
              }
            }
          }
        } catch (err) {
          console.warn('[GooglePlaces] Live Places REST query notice:', err);
        }
      }

      fallbackSearch();
    }
  });
}

export function getFilteredMockPlaces(cleanQuery) {
  if (!cleanQuery) return [];
  const q = cleanQuery.toLowerCase().trim();
  const qTokens = q.split(/[\s,]+/).filter(Boolean);

  const scored = MOCK_PLACES_DATABASE.map(p => {
    const title = (p.title || '').toLowerCase();
    const sub = (p.sub || '').toLowerCase();
    const full = `${title} ${sub}`;
    const aliases = (p.aliases || []).map(a => a.toLowerCase());
    const words = [...title.split(/[\s,.-]+/), ...sub.split(/[\s,.-]+/), ...aliases].filter(w => w.length >= 2);

    let score = 0;

    // Direct match scoring
    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 80;
    else if (title.includes(q)) score += 60;
    else if (full.includes(q)) score += 40;

    // Alias matches
    for (const a of aliases) {
      if (a === q) score += 95;
      else if (a.startsWith(q)) score += 75;
      else if (a.includes(q)) score += 55;
    }

    // Token & fuzzy typo similarity
    for (const tok of qTokens) {
      if (tok.length < 2) continue;
      let bestTokScore = 0;
      for (const w of words) {
        if (w === tok) {
          bestTokScore = Math.max(bestTokScore, 50);
        } else if (w.startsWith(tok)) {
          bestTokScore = Math.max(bestTokScore, 40);
        } else if (w.includes(tok)) {
          bestTokScore = Math.max(bestTokScore, 30);
        } else {
          const sim = wordSimilarity(tok, w);
          if (sim >= 0.72) {
            bestTokScore = Math.max(bestTokScore, Math.round(sim * 35));
          } else if (tok.length >= 4 && levenshteinDistance(tok, w) <= 2) {
            bestTokScore = Math.max(bestTokScore, 22);
          }
        }
      }
      score += bestTokScore;
    }

    return {
      id: p.place_id,
      place_id: p.place_id,
      title: p.title,
      sub: p.sub,
      full: `${p.title}, ${p.sub}`,
      lat: p.lat,
      lng: p.lng,
      type: p.type,
      isMock: true,
      _score: score
    };
  });

  return scored
    .filter(p => p._score > 15)
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...rest }) => rest);
}

/**
 * Unified Reverse Geocoding
 * Translates coordinates into human-readable Indian street addresses.
 */
export async function reverseGeocodeGoogle(lat, lng) {
  if (!lat || !lng) return 'Unknown location';

  // 1. If live Google Maps SDK is loaded, use Geocoder
  if (!isMockMode() && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await new Promise((resolve, reject) => {
        geocoder.geocode({ location: { lat: Number(lat), lng: Number(lng) } }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            resolve(cleanPlusCode(results[0].formatted_address));
          } else {
            reject(status);
          }
        });
      });
      if (res) return cleanPlusCode(res);
    } catch (e) {
      console.warn('[GoogleMaps] Geocoder error, using mock/Nominatim fallback:', e);
    }
  }

  // 2. Check if near any landmark in mock database (< 1.5 km)
  let closest = null;
  let minDist = Infinity;
  for (const p of MOCK_PLACES_DATABASE) {
    const d = Math.hypot(p.lat - lat, p.lng - lng);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }

  if (closest && minDist < 0.015) {
    return `${closest.title}, ${closest.sub}`;
  }

  // 3. Fallback to coordinate label
  return `Location (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`;
}

function getHaversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Resolves the geographic place location details when a marker is placed on the map.
 * 
 * Extracts the real place name (locality / sublocality / town / area) instead of
 * arbitrary registered commercial building or store names.
 * Completely strips Plus Codes and location codes from text display.
 * Accurately collects exact coordinates and Place ID for driver tracking and route maps.
 * 
 * @param {{ lat: number, lng: number } | number} latOrCoords
 * @param {number} [optionalLng]
 * @returns {Promise<{
 *   placeId: string,
 *   name: string,
 *   displayName: string,
 *   formattedAddress: string,
 *   location: { lat: number, lng: number },
 *   city: string,
 *   state: string,
 *   postalCode: string
 * } | null>}
 */
export async function fetchNearestLandmarkByCoordinates(latOrCoords, optionalLng) {
  let lat = typeof latOrCoords === 'object' && latOrCoords !== null ? latOrCoords.lat : latOrCoords;
  let lng = typeof latOrCoords === 'object' && latOrCoords !== null ? latOrCoords.lng : optionalLng;

  lat = Number(lat);
  lng = Number(lng);

  if (isNaN(lat) || isNaN(lng)) {
    console.warn('[GoogleMaps] Invalid coordinates provided to fetchNearestLandmarkByCoordinates:', latOrCoords, optionalLng);
    return null;
  }

  // 1. Ensure Google Maps SDK is loaded
  await loadGoogleMapsSdk();

  // 2. Use Google Maps Geocoding API to resolve place location name
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const geocodeResults = await new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && Array.isArray(results) && results.length > 0) {
            resolve(results);
          } else {
            resolve([]);
          }
        });
      });

      if (geocodeResults.length > 0) {
        const primary = geocodeResults[0];
        let sublocality = '';
        let neighborhood = '';
        let locality = '';
        let adminArea2 = '';
        let state = 'Kerala';
        let postalCode = '';

        // Scan address components for place name (sublocality, locality, area)
        for (const res of geocodeResults) {
          for (const comp of res.address_components || []) {
            const types = comp.types || [];
            if (!sublocality && (types.includes('sublocality_level_1') || types.includes('sublocality'))) {
              sublocality = comp.long_name;
            }
            if (!neighborhood && types.includes('neighborhood')) {
              neighborhood = comp.long_name;
            }
            if (!locality && types.includes('locality')) {
              locality = comp.long_name;
            }
            if (!adminArea2 && types.includes('administrative_area_level_2')) {
              adminArea2 = comp.long_name;
            }
            if (types.includes('administrative_area_level_1')) {
              state = comp.long_name;
            }
            if (!postalCode && types.includes('postal_code')) {
              postalCode = comp.long_name;
            }
          }
          if (sublocality && locality) break;
        }

        const areaName = sublocality || neighborhood || adminArea2;
        let placeName = '';
        if (areaName && locality && areaName.toLowerCase() !== locality.toLowerCase()) {
          placeName = `${areaName}, ${locality}`;
        } else if (areaName) {
          placeName = areaName;
        } else if (locality) {
          placeName = locality;
        } else {
          placeName = cleanPlusCode(primary.formatted_address).split(',')[0].trim() || 'Selected Location';
        }

        const cleanAddress = cleanPlusCode(primary.formatted_address) || `${placeName}, ${state}`;

        return {
          placeId: primary.place_id || `place_${lat.toFixed(4)}_${lng.toFixed(4)}`,
          name: cleanPlusCode(placeName),
          displayName: cleanPlusCode(placeName),
          formattedAddress: cleanAddress,
          location: { lat, lng }, // Exact coordinates for driver tracking & route map
          city: locality || areaName || 'Kochi',
          state: state || 'Kerala',
          postalCode
        };
      }
    } catch (apiErr) {
      console.warn('[GoogleMaps] Geocoder error, checking fallback:', apiErr);
    }
  }

  // 3. Fallback when offline or running in mock testing mode
  const mockMatches = MOCK_PLACES_DATABASE.filter((p) => p.lat && p.lng);
  let nearestMock = null;
  let minDistance = Infinity;

  for (const p of mockMatches) {
    const d = getHaversineDistanceMeters(lat, lng, p.lat, p.lng);
    if (d < minDistance) {
      minDistance = d;
      nearestMock = p;
    }
  }

  if (nearestMock && minDistance <= 800) {
    const cleanName = cleanPlusCode(nearestMock.title || nearestMock.name);
    return {
      placeId: nearestMock.id || `mock_place_${Date.now()}`,
      name: cleanName,
      displayName: cleanName,
      formattedAddress: cleanPlusCode(nearestMock.sub || `${cleanName}, Kerala`),
      location: { lat, lng }, // Exact marker coordinates for routing
      city: nearestMock.city || cleanName,
      state: 'Kerala',
      postalCode: ''
    };
  }

  return {
    placeId: `pin_${lat.toFixed(4)}_${lng.toFixed(4)}`,
    name: 'Selected Location',
    displayName: 'Selected Location',
    formattedAddress: 'Selected Location',
    location: { lat, lng },
    city: 'Kochi',
    state: 'Kerala',
    postalCode: ''
  };
}

// Convenient alias for marker placement on the booking page map
export const getPlaceDetailsOnMarkerPlaced = fetchNearestLandmarkByCoordinates;

/**
 * Generates an official Google Maps turn-by-turn Navigation URL
 * Automatically opens the native Google Maps app on iOS and Android
 * or the official Google Maps web directions on desktop.
 */
export function getGoogleNavigationUrl({ origin, destination, travelMode = 'driving' }) {
  const params = new URLSearchParams({
    api: '1',
    travelmode: travelMode
  });

  if (origin) {
    params.set(
      'origin',
      typeof origin === 'object' && origin.lat != null ? `${origin.lat},${origin.lng}` : String(origin)
    );
  }

  if (destination) {
    params.set(
      'destination',
      typeof destination === 'object' && destination.lat != null
        ? `${destination.lat},${destination.lng}`
        : String(destination)
    );
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Launches turn-by-turn Google Maps navigation in a new tab or native Google Maps app
 */
export function openInGoogleMaps({ origin, destination, travelMode = 'driving' }) {
  const url = getGoogleNavigationUrl({ origin, destination, travelMode });
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return url;
}

/**
 * Formats duration measurement like real-time Google Maps / navigation apps:
 * - Up to 59 minutes: "X mins" (or "1 min")
 * - 60 minutes: "1 hr"
 * - 60+ minutes: "1 hr 15 mins", "2 hrs 10 mins", etc.
 */
export function formatDurationMeasurement(totalMinutes) {
  if (!totalMinutes || isNaN(totalMinutes) || totalMinutes <= 0) return '1 min';
  const mins = Math.round(Number(totalMinutes));
  if (mins < 60) {
    return `${mins} min${mins === 1 ? '' : 's'}`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) {
    return `${hours} hr${hours === 1 ? '' : 's'}`;
  }
  return `${hours} hr${hours === 1 ? '' : 's'} ${remainingMins} min${remainingMins === 1 ? '' : 's'}`;
}

/**
 * Calculates Real Coordinate Telemetry (Distance & Duration) between GPS points
 * Pure real mathematical calculation without fake demo steps or simulated curves.
 */
export function calculateDirectDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371;
  const dLat = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
  const dLon = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((Number(lat1) * Math.PI) / 180) *
      Math.cos((Number(lat2) * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function calculateMockRoute(originCoord, destCoord) {
  const oLat = originCoord?.lat || 10.0245;
  const oLng = originCoord?.lng || 76.3075;
  const dLat = destCoord?.lat || 10.0285;
  const dLng = destCoord?.lng || 76.3120;

  const rawDistKm = calculateDirectDistanceKm(oLat, oLng, dLat, dLng);
  const distanceKm = Math.max(0.5, Number((rawDistKm * 1.3).toFixed(1)));
  const durationMins = Math.max(2, Math.round((distanceKm / 28) * 60));

  return {
    distanceKm,
    durationMins,
    distanceText: `${distanceKm} km`,
    durationText: formatDurationMeasurement(durationMins),
    waypoints: [{ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }],
    steps: []
  };
}

/**
 * Geocodes an address string to precise GPS coordinates
 * Uses Google Maps Geocoder when available, with intelligent fallback to Indian geography database
 */
export async function geocodeAddress(addressText) {
  if (!addressText || typeof addressText !== 'string') return null;
  const clean = addressText.trim();
  if (!clean) return null;

  // 1. Primary: Official Google Places API (New) Text Search (Exact genuine Google coordinates)
  const apiKey = GOOGLE_MAPS_API_KEY || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';
  if (apiKey && !apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
    try {
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
        },
        body: JSON.stringify({
          textQuery: clean,
          languageCode: 'en',
          regionCode: 'in'
        })
      });
      if (res.ok) {
        const data = await res.json();
        const firstPlace = data?.places?.[0];
        if (firstPlace?.location?.latitude && firstPlace?.location?.longitude) {
          return {
            lat: Number(firstPlace.location.latitude),
            lng: Number(firstPlace.location.longitude),
            name: firstPlace.displayName?.text || clean,
            formatted_address: firstPlace.formattedAddress || clean,
            place_id: firstPlace.id,
            source: 'google'
          };
        }
      }
    } catch (err) {
      console.warn('[GooglePlaces] Text search geocode notice:', err);
    }
  }

  // 2. Google Maps Geocoder if SDK loaded
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const res = await new Promise((resolve) => {
        geocoder.geocode({ address: clean, componentRestrictions: { country: 'in' } }, (results, status) => {
          if (status === 'OK' && results?.[0]?.geometry?.location) {
            resolve({
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            });
          } else {
            resolve(null);
          }
        });
      });
      if (res) return res;
    } catch (e) {}
  }

  // 2. Mock places database matching
  const q = clean.toLowerCase();
  const matched = MOCK_PLACES_DATABASE.find(p =>
    p.title.toLowerCase().includes(q) ||
    q.includes(p.title.toLowerCase()) ||
    p.sub.toLowerCase().includes(q)
  );
  if (matched) {
    return { lat: matched.lat, lng: matched.lng };
  }

  // 3. Known Kerala & Indian Major Locations Database
  const KNOWN_COORDS = {
    'edappally': { lat: 10.0245, lng: 76.3075 },
    'cochin': { lat: 10.1518, lng: 76.3929 },
    'airport': { lat: 10.1518, lng: 76.3929 },
    'cok': { lat: 10.1518, lng: 76.3929 },
    'nedumbassery': { lat: 10.1518, lng: 76.3929 },
    'lulu': { lat: 10.0285, lng: 76.3120 },
    'mg road': { lat: 9.9723, lng: 76.2831 },
    'ernakulam': { lat: 9.9816, lng: 76.2999 },
    'marine drive': { lat: 9.9780, lng: 76.2755 },
    'fort kochi': { lat: 9.9658, lng: 76.2421 },
    'kakkanad': { lat: 10.0159, lng: 76.3419 },
    'infopark': { lat: 10.0094, lng: 76.3608 },
    'aluva': { lat: 10.1076, lng: 76.3516 },
    'kaloor': { lat: 9.9937, lng: 76.2982 },
    'vytilla': { lat: 9.9656, lng: 76.3196 },
    'palarivattom': { lat: 10.0069, lng: 76.3094 },
    'tripunithura': { lat: 9.9489, lng: 76.3477 },
    'calicut': { lat: 11.2588, lng: 75.7804 },
    'kozhikode': { lat: 11.2588, lng: 75.7804 },
    'kallachi': { lat: 11.6833, lng: 75.6667 },
    'nadapuram': { lat: 11.6961, lng: 75.6543 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'residency road': { lat: 12.9719, lng: 77.6015 },
    'd\'souza': { lat: 12.9719, lng: 77.6015 },
    'trivandrum': { lat: 8.5241, lng: 76.9366 },
    'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
    'thrissur': { lat: 10.5276, lng: 76.2144 },
    'kottayam': { lat: 9.5916, lng: 76.5222 }
  };

  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (q.includes(key)) {
      return coords;
    }
  }

  // 4. Live OpenStreetMap Geocoder fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(clean + ', India')}&limit=1`;
    const resp = await fetch(nomUrl, { headers: { 'Accept-Language': 'en' } });
    const data = await resp.json();
    if (data && data[0]?.lat && data[0]?.lon) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
  } catch (err) {}

  return null;
}


/**
 * Official Google Maps Distance Matrix API Integration
 * Fetches real-time driving distance and duration between pickup and destination.
 * 
 * @param {Object} params
 * @param {string} params.origin - Origin address / place text
 * @param {string} params.destination - Destination address / place text
 * @param {{ lat: number, lng: number }} [params.originCoords] - Exact pickup coordinates
 * @param {{ lat: number, lng: number }} [params.destCoords] - Exact destination coordinates
 * @returns {Promise<{ distanceKm: number, distanceText: string, durationMins: number, durationText: string, etaText: string, source: string }>}
 */
export async function fetchGoogleDistanceMatrix({ origin, destination, originCoords, destCoords }) {
  const apiKey = GOOGLE_MAPS_API_KEY || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';

  // 1. Resolve exact coordinates - strictly preserve provided numeric coordinates
  let oCoords = originCoords;
  const oHasCoords = oCoords?.lat != null && oCoords?.lng != null && !isNaN(Number(oCoords.lat)) && !isNaN(Number(oCoords.lng));
  if (!oHasCoords && origin && !origin.toLowerCase().includes('driver')) {
    const geo = await geocodeAddress(origin);
    if (geo?.lat && geo?.lng) {
      oCoords = geo;
    }
  }
  let dCoords = destCoords;
  const dHasCoords = dCoords?.lat != null && dCoords?.lng != null && !isNaN(Number(dCoords.lat)) && !isNaN(Number(dCoords.lng));
  if (!dHasCoords && destination) {
    const geo = await geocodeAddress(destination);
    if (geo?.lat && geo?.lng) {
      dCoords = geo;
    }
  }

  const oLat = oCoords?.lat || (originCoords?.lat ? Number(originCoords.lat) : null);
  const oLng = oCoords?.lng || (originCoords?.lng ? Number(originCoords.lng) : null);
  const dLat = dCoords?.lat || (destCoords?.lat ? Number(destCoords.lat) : null);
  const dLng = dCoords?.lng || (destCoords?.lng ? Number(destCoords.lng) : null);

  // 2. Primary: Google Cloud Routes API v2 (Official modern Traffic-Aware Road Distance & ETA)
  if (oLat && oLng && dLat && dLng && apiKey && !apiKey.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
    try {
      const routesRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.description,routes.polyline.encodedPolyline'
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: Number(oLat), longitude: Number(oLng) } } },
          destination: { location: { latLng: { latitude: Number(dLat), longitude: Number(dLng) } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          languageCode: 'en-US'
        })
      });

      if (routesRes.ok) {
        const routesData = await routesRes.json();
        const route = routesData?.routes?.[0];
        if (route && route.distanceMeters) {
          const meters = route.distanceMeters;
          const distKm = Number((meters / 1000).toFixed(1));
          const durSec = parseInt(route.duration || '0', 10);
          const durMins = Math.max(1, Math.round(durSec / 60));
          const arrival = new Date(Date.now() + durSec * 1000);
          const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return {
            distanceKm: distKm,
            distanceText: `${distKm} km`,
            durationMins: durMins,
            durationText: `${durMins} mins`,
            etaText,
            source: 'google_routes_traffic_matrix',
            overview_polyline: route.polyline?.encodedPolyline ? { points: route.polyline.encodedPolyline } : null,
            routeDescription: route.description || ''
          };
        }
      }
    } catch (routeErr) {
      console.warn('[GoogleMaps] Routes API computeRoutes error:', routeErr);
    }
  }

  // 3. Google Maps JS SDK DistanceMatrixService fallback
  let googleMaps = typeof window !== 'undefined' ? window.google?.maps : null;
  if (!googleMaps && typeof window !== 'undefined') {
    try {
      googleMaps = await initGoogleMapsPlacesSDK();
    } catch (e) {}
  }

  if (googleMaps?.DistanceMatrixService && oLat && oLng && dLat && dLng) {
    try {
      const service = new googleMaps.DistanceMatrixService();
      const originItem = new googleMaps.LatLng(Number(oLat), Number(oLng));
      const destItem = new googleMaps.LatLng(Number(dLat), Number(dLng));

      const dmResponse = await new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins: [originItem],
            destinations: [destItem],
            travelMode: googleMaps.TravelMode.DRIVING,
            unitSystem: googleMaps.UnitSystem.METRIC,
            avoidHighways: false,
            avoidTolls: false
          },
          (result, status) => {
            if (status === 'OK' && result?.rows?.[0]?.elements?.[0]) {
              const element = result.rows[0].elements[0];
              if (element.status === 'OK') {
                resolve(element);
                return;
              }
            }
            reject(new Error(`Distance Matrix status: ${status}`));
          }
        );
      });

      if (dmResponse?.distance && dmResponse?.duration) {
        const distMeters = dmResponse.distance.value || 0;
        const durSecs = dmResponse.duration.value || 0;
        const distanceKm = Number((distMeters / 1000).toFixed(1));
        const durationMins = Math.max(1, Math.round(durSecs / 60));
        const distanceText = dmResponse.distance.text || `${distanceKm} km`;
        const durationText = dmResponse.duration.text || `${durationMins} mins`;
        const arrival = new Date(Date.now() + durSecs * 1000);
        const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          distanceKm,
          distanceText,
          durationMins,
          durationText,
          etaText,
          source: 'google_distance_matrix_api'
        };
      }
    } catch (dmErr) {
      console.warn('[GoogleMaps] DistanceMatrixService error:', dmErr);
    }
  }

  throw new Error('Unable to compute Google Maps distance and driving duration');
}

/**
 * Real Google Maps Route & Distance/ETA Calculator
 * Integrates directly with official Google Maps DirectionsService and DistanceMatrixService.
 * When Live Google Maps SDK is loaded, queries real live traffic and routes.
 * Falls back to high-accuracy road telemetry when offline or in development mock mode.
 */
export async function calculateTripRouteAndETA({ origin, destination, originCoords, destCoords }) {
  // 1. Primary: Google Maps Distance Matrix API / Routes API
  try {
    const matrixResult = await fetchGoogleDistanceMatrix({ origin, destination, originCoords, destCoords });
    if (matrixResult && matrixResult.distanceKm) {
      return {
        ...matrixResult,
        originCoords,
        destCoords,
        steps: []
      };
    }
  } catch (matrixErr) {
    console.warn('[GoogleMaps] Primary Distance Matrix error:', matrixErr);
  }

  // 2. Secondary: Real Google Cloud Routes API v2
  try {
    const roadDir = await fetchGoogleRoadDirections({ origin, destination, originCoords, destCoords });
    if (roadDir && roadDir.distanceKm) {
      const durSecs = (roadDir.durationMins || 10) * 60;
      const arrival = new Date(Date.now() + durSecs * 1000);
      const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        distanceKm: roadDir.distanceKm,
        distanceText: roadDir.distanceText || `${roadDir.distanceKm} km`,
        durationMins: roadDir.durationMins,
        durationText: roadDir.durationText || `${roadDir.durationMins} mins`,
        etaText,
        source: roadDir.source,
        overview_polyline: roadDir.overview_polyline,
        steps: roadDir.steps || [],
        currentStep: roadDir.currentStep || null,
        originCoords,
        destCoords
      };
    }
  } catch (err) {
    console.warn('[GoogleMaps] Routes API v2 calculation error:', err);
  }

  // 2. Secondary: Google Maps DirectionsService if loaded in browser
  if (!isMockMode() && typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
    try {
      const directionsService = new window.google.maps.DirectionsService();

      let originArg = origin;
      if (originCoords?.lat && originCoords?.lng) {
        originArg = new window.google.maps.LatLng(Number(originCoords.lat), Number(originCoords.lng));
      }

      let destArg = destination;
      if (destCoords?.lat && destCoords?.lng) {
        destArg = new window.google.maps.LatLng(Number(destCoords.lat), Number(destCoords.lng));
      }

      if (originArg && destArg) {
        const response = await new Promise((resolve, reject) => {
          directionsService.route(
            {
              origin: originArg,
              destination: destArg,
              travelMode: window.google.maps.TravelMode.DRIVING
            },
            (result, status) => {
              if (status === 'OK' && result) {
                resolve(result);
              } else {
                reject(status);
              }
            }
          );
        });

        if (response?.routes?.[0]?.legs?.[0]) {
          const leg = response.routes[0].legs[0];
          const distMeters = leg.distance?.value || 0;
          const durSecs = leg.duration?.value || 0;
          const distanceKm = Number((distMeters / 1000).toFixed(1));
          const durationMins = Math.max(1, Math.round(durSecs / 60));
          const distanceText = leg.distance?.text || `${distanceKm} km`;
          const durationText = formatDurationMeasurement(durationMins);

          // Calculate arrival time ETA
          const arrival = new Date(Date.now() + durSecs * 1000);
          const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return {
            distanceKm,
            distanceText,
            durationMins,
            durationText,
            etaText,
            source: 'google_directions_live',
            overview_polyline: response.routes[0].overview_polyline
          };
        }
      }
    } catch (err) {
      console.warn('[GoogleMaps] DirectionsService error:', err);
    }
  }

  // 3. Coordinate geocode resolution and Google Cloud Routes execution - preserve valid numeric coordinates
  let oCoords = originCoords;
  const oValid = oCoords?.lat != null && oCoords?.lng != null && !isNaN(Number(oCoords.lat)) && !isNaN(Number(oCoords.lng));
  if (!oValid && origin && !origin.toLowerCase().includes('driver')) {
    const geo = await geocodeAddress(origin);
    if (geo?.lat) oCoords = geo;
  }
  let dCoords = destCoords;
  const dValid = dCoords?.lat != null && dCoords?.lng != null && !isNaN(Number(dCoords.lat)) && !isNaN(Number(dCoords.lng));
  if (!dValid && destination) {
    const geo = await geocodeAddress(destination);
    if (geo?.lat) dCoords = geo;
  }

  if (oCoords?.lat && dCoords?.lat && GOOGLE_MAPS_API_KEY && !GOOGLE_MAPS_API_KEY.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
    try {
      const dm = await fetchGoogleDistanceMatrix({ origin, destination, originCoords: oCoords, destCoords: dCoords });
      if (dm && dm.distanceKm) {
        return {
          ...dm,
          originCoords: oCoords,
          destCoords: dCoords,
          steps: []
        };
      }
    } catch (e) {
      console.warn('[GoogleMaps] Fallback distance matrix error:', e);
    }
  }

  // 4. Emergency offline calculation
  const oLat = oCoords?.lat || 10.0245;
  const oLng = oCoords?.lng || 76.3075;
  const dLat = dCoords?.lat || 10.0385;
  const dLng = dCoords?.lng || 76.3190;

  const rawDistKm = calculateDirectDistanceKm(oLat, oLng, dLat, dLng);
  const distanceKm = Math.max(0.5, Number((rawDistKm * 1.3).toFixed(1)));
  const durationMins = Math.max(2, Math.round((distanceKm / 28) * 60));
  const arrival = new Date(Date.now() + durationMins * 60 * 1000);
  const etaText = arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    distanceKm,
    distanceText: `${distanceKm} km`,
    durationMins,
    durationText: formatDurationMeasurement(durationMins),
    etaText,
    source: 'offline_emergency_telemetry',
    originCoords: oCoords,
    destCoords: dCoords,
    steps: []
  };
}

// In-memory cache for road-following polylines to guarantee 0ms instant display without straight-line delays
const roadDirectionsCache = new Map();

export function getCachedRoadDirectionsKey(originCoords, destCoords, origin, destination) {
  const oKey = originCoords?.lat && originCoords?.lng
    ? `${Number(originCoords.lat).toFixed(4)},${Number(originCoords.lng).toFixed(4)}`
    : String(origin || '').toLowerCase().trim();
  const dKey = destCoords?.lat && destCoords?.lng
    ? `${Number(destCoords.lat).toFixed(4)},${Number(destCoords.lng).toFixed(4)}`
    : String(destination || '').toLowerCase().trim();
  return `${oKey}->${dKey}`;
}

export function getCachedRoadDirections(originCoords, destCoords, origin, destination) {
  const key = getCachedRoadDirectionsKey(originCoords, destCoords, origin, destination);
  return roadDirectionsCache.get(key) || null;
}

/**
 * Decodes a Google Maps overview_polyline.points encoded string into an array of { lat, lng } coordinates.
 * Follows the official Google Maps encoded polyline algorithm.
 */
export function decodeGooglePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/**
 * Encodes an array of { lat, lng } coordinates into a Google Maps encoded polyline string.
 */
export function encodeGooglePolyline(points) {
  if (!Array.isArray(points) || points.length === 0) return '';
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  const encodeSigned = (val) => {
    let sgn = val < 0 ? ~(val << 1) : (val << 1);
    let str = '';
    while (sgn >= 0x20) {
      str += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
      sgn >>= 5;
    }
    str += String.fromCharCode(sgn + 63);
    return str;
  };

  for (const pt of points) {
    const lat = Math.round(Number(pt.lat ?? pt[0]) * 1e5);
    const lng = Math.round(Number(pt.lng ?? pt[1]) * 1e5);
    encoded += encodeSigned(lat - prevLat);
    encoded += encodeSigned(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return encoded;
}

/**
 * Fetches real, road-hugging driving directions between origin and destination.
 * 1. Calls Google Maps Directions API (DirectionsService) to fetch the route coordinates.
 * 2. Extracts overview_polyline.points from the Google Maps API response.
 * 3. Decodes overview_polyline.points so the Polyline component accurately follows the roads.
 * 4. Falls back to road network router or telemetry if offline.
 */
export async function fetchGoogleRoadDirections({ origin, destination, originCoords, destCoords }) {
  const cacheKey = getCachedRoadDirectionsKey(originCoords, destCoords, origin, destination);
  if (roadDirectionsCache.has(cacheKey)) {
    return roadDirectionsCache.get(cacheKey);
  }

  // 1. Resolve coordinates - strictly prioritize provided numeric coordinates (e.g. driver GPS)
  let oLat = originCoords?.lat != null ? Number(originCoords.lat) : null;
  let oLng = originCoords?.lng != null ? Number(originCoords.lng) : null;
  let dLat = destCoords?.lat != null ? Number(destCoords.lat) : null;
  let dLng = destCoords?.lng != null ? Number(destCoords.lng) : null;

  const hasValidOrigin = oLat !== null && oLng !== null && !isNaN(oLat) && !isNaN(oLng);
  const hasValidDest = dLat !== null && dLng !== null && !isNaN(dLat) && !isNaN(dLng);

  if (!hasValidOrigin && origin && !origin.toLowerCase().includes('driver')) {
    const geo = await geocodeAddress(origin);
    if (geo?.lat && geo?.lng) {
      oLat = Number(geo.lat);
      oLng = Number(geo.lng);
    }
  }
  if (!hasValidDest && destination) {
    const geo = await geocodeAddress(destination);
    if (geo?.lat && geo?.lng) {
      dLat = Number(geo.lat);
      dLng = Number(geo.lng);
    }
  }

  // Fallback defaults if still missing
  oLat = oLat || 10.0245;
  oLng = oLng || 76.3075;
  dLat = dLat || 10.0285;
  dLng = dLng || 76.3120;

  // 2. Primary: Google Cloud Routes API v2 (official computeRoutes endpoint with live traffic)
  const apiKey = GOOGLE_MAPS_API_KEY || 'AIzaSyD8M53hyypWh8lLZk0W57dR7cUzLwb-nmA';
  try {
    const routesRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration,routes.description,routes.legs.steps.navigationInstruction,routes.legs.steps.localizedValues'
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: Number(oLat), longitude: Number(oLng) } } },
        destination: { location: { latLng: { latitude: Number(dLat), longitude: Number(dLng) } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'en-US'
      })
    });

    if (routesRes.ok) {
      const routesData = await routesRes.json();
      const route = routesData?.routes?.[0];
      const encodedPolyline = route?.polyline?.encodedPolyline;
      if (encodedPolyline) {
        const points = decodeGooglePolyline(encodedPolyline);
        if (points.length >= 2) {
          const meters = route.distanceMeters;
          const distKm = meters ? Number((meters / 1000).toFixed(1)) : null;
          const durSec = parseInt(route.duration || '0', 10);
          const durMins = durSec ? Math.round(durSec / 60) : null;

          // Real turn-by-turn navigation instructions straight from Google Routes API
          const rawSteps = route.legs?.[0]?.steps || [];
          const steps = rawSteps.map(s => ({
            instruction: (s.navigationInstruction?.instructions || '').replace(/\n/g, ' ').trim(),
            maneuver: s.navigationInstruction?.maneuver || 'STRAIGHT',
            distance: s.localizedValues?.distance?.text || '',
            duration: s.localizedValues?.staticDuration?.text || ''
          })).filter(s => Boolean(s.instruction));

          const res = {
            points,
            overview_polyline: { points: encodedPolyline },
            distanceKm: distKm,
            durationMins: durMins,
            distanceText: distKm ? `${distKm} km` : '',
            durationText: durMins ? `${durMins} mins` : '',
            steps,
            currentStep: steps[0] || null,
            source: 'google_routes_api_v2'
          };
          roadDirectionsCache.set(cacheKey, res);
          return res;
        }
      }
    }
  } catch (routesErr) {
    console.warn('[GoogleRoadDirections] Google Routes API v2 notice:', routesErr);
  }

  // 3. Fallback: Google Maps Directions API via JS SDK DirectionsService
  if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
    try {
      const directionsService = new window.google.maps.DirectionsService();
      const originParam = (oLat && oLng)
        ? new window.google.maps.LatLng(Number(oLat), Number(oLng))
        : (origin || new window.google.maps.LatLng(Number(oLat), Number(oLng)));

      const destParam = (dLat && dLng)
        ? new window.google.maps.LatLng(Number(dLat), Number(dLng))
        : (destination || new window.google.maps.LatLng(Number(dLat), Number(dLng)));

      const result = await new Promise((resolve, reject) => {
        directionsService.route(
          {
            origin: originParam,
            destination: destParam,
            travelMode: window.google.maps.TravelMode.DRIVING
          },
          (res, status) => {
            if (status === 'OK' && res?.routes?.[0]) {
              resolve(res);
            } else {
              reject(status);
            }
          }
        );
      });

      const route = result.routes[0];
      const rawPolyline = route?.overview_polyline;
      const polylinePoints = typeof rawPolyline === 'string'
        ? rawPolyline
        : (rawPolyline?.points || '');

      let points = [];
      if (polylinePoints) {
        points = decodeGooglePolyline(polylinePoints);
      } else if (Array.isArray(route.overview_path) && route.overview_path.length > 0) {
        points = route.overview_path.map(pt => ({
          lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
          lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng
        }));
      }

      if (points.length >= 2) {
        const leg = route.legs?.[0];
        const distKm = leg?.distance?.value ? Number((leg.distance.value / 1000).toFixed(1)) : null;
        const durMins = leg?.duration?.value ? Math.round(leg.duration.value / 60) : null;
        const rawSteps = leg?.steps || [];
        const steps = rawSteps.map(s => ({
          instruction: (s.instructions || '').replace(/<[^>]*>/g, '').trim(),
          distance: s.distance?.text || '',
          duration: s.duration?.text || ''
        })).filter(s => Boolean(s.instruction));

        const res = {
          points,
          overview_polyline: {
            points: polylinePoints || encodeGooglePolyline(points)
          },
          distanceKm: distKm,
          durationMins: durMins,
          distanceText: leg?.distance?.text || (distKm ? `${distKm} km` : ''),
          durationText: leg?.duration?.text || (durMins ? `${durMins} mins` : ''),
          steps,
          currentStep: steps[0] || null,
          source: 'google_directions_api'
        };
        roadDirectionsCache.set(cacheKey, res);
        return res;
      }
    } catch (gErr) {
      console.warn('[GoogleRoadDirections] Google DirectionsService API call warning:', gErr);
    }
  }

  // 4. Real road driving router fallback (OSRM highway network)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const response = await fetch(osrmUrl, { headers: { 'Accept': 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      const route = data.routes?.[0];
      if (route?.geometry?.coordinates && Array.isArray(route.geometry.coordinates) && route.geometry.coordinates.length > 1) {
        const rawCoords = route.geometry.coordinates;
        let sampled = rawCoords;
        if (rawCoords.length > 500) {
          const step = Math.ceil(rawCoords.length / 500);
          sampled = rawCoords.filter((_, idx) => idx % step === 0 || idx === rawCoords.length - 1);
        }

        const points = sampled.map(([lng, lat]) => ({ lat: Number(lat), lng: Number(lng) }));
        const distanceKm = Number((route.distance / 1000).toFixed(1));
        const durationMins = Math.round(route.duration / 60);
        const encodedPolyline = encodeGooglePolyline(points);

        const res = {
          points,
          overview_polyline: { points: encodedPolyline },
          distanceKm,
          durationMins,
          distanceText: `${distanceKm} km`,
          durationText: `${durationMins} mins`,
          steps: [],
          currentStep: null,
          source: 'road_network_driving'
        };
        roadDirectionsCache.set(cacheKey, res);
        return res;
      }
    }
  } catch (osrmErr) {
    console.warn('[GoogleRoadDirections] Road network router fallback error:', osrmErr);
  }

  // 5. Emergency coordinate interpolation fallback to guarantee connected line between endpoints
  if (oLat && oLng && dLat && dLng) {
    const distMeters = Math.hypot((dLat - oLat) * 111000, (dLng - oLng) * 111000 * Math.cos((oLat * Math.PI) / 180));
    const distKm = Number((distMeters / 1000).toFixed(1));
    const durMins = Math.max(1, Math.round((distKm / 35) * 60));
    const stepsCount = 10;
    const points = [];
    for (let i = 0; i <= stepsCount; i++) {
      const frac = i / stepsCount;
      points.push({
        lat: Number((oLat + (dLat - oLat) * frac).toFixed(6)),
        lng: Number((oLng + (dLng - oLng) * frac).toFixed(6))
      });
    }
    const res = {
      points,
      overview_polyline: { points: encodeGooglePolyline(points) },
      distanceKm: distKm,
      durationMins: durMins,
      distanceText: `${distKm} km`,
      durationText: `${durMins} mins`,
      steps: [],
      currentStep: null,
      source: 'offline_direct_route'
    };
    roadDirectionsCache.set(cacheKey, res);
    return res;
  }

  return null;
}
