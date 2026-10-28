/**
 * bannerService.js
 *
 * Centralized Offer Banner Management Service for Ridingo Ecosystem.
 * Connects the CRM Admin Panel (ridingo.in/admin) with the User App home tab.
 * Supports image slide uploads, discount badges, promo codes, and
 * direct service navigation (Hourly, Full Day, Airport, Outstation, Events).
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY } from '../lib/supabase';
import { isAdminAuthenticated } from './driverService';

export const LOCAL_BANNERS_KEY = 'ridingo_offer_banners_v4';
export const BANNERS_EVENT_KEY = 'ridingo_banners_updated';

export const SERVICE_OPTIONS = [
  {
    id: 'airport',
    name: 'Airport Pickup & Drop',
    category: 'airport',
    icon: 'plane',
    tag: 'RIDINGO · AIRPORT',
    color: '#10B981',
    description: 'Terminal pickup or drop with live flight delay tracking'
  },
  {
    id: 'hourly',
    name: 'Hourly City Driver',
    category: 'hourly',
    icon: 'hourly',
    tag: 'RIDINGO · DRIVER',
    color: '#F59E0B',
    description: 'City errands, meetings & shopping in your own vehicle'
  },
  {
    id: 'daily',
    name: 'Full Day Hire',
    category: 'daily',
    icon: 'sun',
    tag: 'RIDINGO · FULL DAY',
    color: '#3B82F6',
    description: '10 hours / day for all-day city hospital, client or personal trips'
  },
  {
    id: 'outstation',
    name: 'Outstation Highway Trip',
    category: 'outstation',
    icon: 'route',
    tag: 'RIDINGO · HIGHWAY',
    color: '#8B5CF6',
    description: 'Multi-day hill stations, family tours & interstate road journeys'
  },
  {
    id: 'event',
    name: 'Night & Events Driver',
    category: 'event',
    icon: 'moon',
    tag: 'RIDINGO · NIGHT',
    color: '#EC4899',
    description: 'Late night parties, wedding events & safe return cabin service'
  }
];

export const DEFAULT_SEED_BANNERS = [
  {
    "id": "banner-welcome-1",
    "order": 1,
    "title": "Flat ₹150 OFF On First Ride",
    "headline": "Flat ₹150 OFF",
    "sub": "On Your First Chauffeur Booking",
    "tag": "WELCOME OFFER",
    "tagBg": "#10B981",
    "brandTag": "RIDINGO · EXCLUSIVE",
    "category": "hourly",
    "serviceName": "Hourly City Driver",
    "cta": "Claim ₹150 OFF",
    "promoCode": "RIDE150",
    "icon": "hourly",
    "active": true,
    "showCta": false,
    "gradient": "linear-gradient(135deg, #064E3B 0%, #047857 50%, #10B981 100%)",
    "imageUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23047857%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2310B981%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23F59E0B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23FBBF24%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g1)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22520%22%20cy%3D%2250%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22480%22%20cy%3D%22180%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG1)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%23000000%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWELCOME%20OFFER%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EFlat%20%E2%82%B9150%20OFF%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23D1FAE5%22%3EOn%20Your%20First%20Chauffeur%20Booking%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23A7F3D0%22%3EVerified%20expert%20drivers%20%C2%B7%20Free%20cancellation%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23065F46%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20RIDE150%3C%2Ftext%3E%0A%20%20%3C!--%20Car%20Silhouette%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(430%2C%2068)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2252%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2C60%20L35%2C30%20L85%2C30%20L108%2C60%20L120%2C62%20L120%2C78%20L112%2C78%20A13%2C13%200%200%2C1%2086%2C78%20L34%2C78%20A13%2C13%200%200%2C1%208%2C78%20L0%2C78%20L0%2C62%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2238%2C36%2057%2C36%2057%2C56%2026%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2263%2C36%2083%2C36%2096%2C56%2063%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageMobile": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23047857%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2310B981%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23F59E0B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23FBBF24%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g1)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22520%22%20cy%3D%2250%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22480%22%20cy%3D%22180%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG1)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%23000000%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWELCOME%20OFFER%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EFlat%20%E2%82%B9150%20OFF%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23D1FAE5%22%3EOn%20Your%20First%20Chauffeur%20Booking%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23A7F3D0%22%3EVerified%20expert%20drivers%20%C2%B7%20Free%20cancellation%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23065F46%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20RIDE150%3C%2Ftext%3E%0A%20%20%3C!--%20Car%20Silhouette%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(430%2C%2068)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2252%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2C60%20L35%2C30%20L85%2C30%20L108%2C60%20L120%2C62%20L120%2C78%20L112%2C78%20A13%2C13%200%200%2C1%2086%2C78%20L34%2C78%20A13%2C13%200%200%2C1%208%2C78%20L0%2C78%20L0%2C62%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2238%2C36%2057%2C36%2057%2C56%2026%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2263%2C36%2083%2C36%2096%2C56%2063%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageTablet": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23047857%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2310B981%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG1%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23F59E0B%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23FBBF24%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g1)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22520%22%20cy%3D%2250%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22480%22%20cy%3D%22180%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG1)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%23000000%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWELCOME%20OFFER%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EFlat%20%E2%82%B9150%20OFF%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23D1FAE5%22%3EOn%20Your%20First%20Chauffeur%20Booking%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23A7F3D0%22%3EVerified%20expert%20drivers%20%C2%B7%20Free%20cancellation%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23065F46%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20RIDE150%3C%2Ftext%3E%0A%20%20%3C!--%20Car%20Silhouette%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(430%2C%2068)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2252%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M14%2C60%20L35%2C30%20L85%2C30%20L108%2C60%20L120%2C62%20L120%2C78%20L112%2C78%20A13%2C13%200%200%2C1%2086%2C78%20L34%2C78%20A13%2C13%200%200%2C1%208%2C78%20L0%2C78%20L0%2C62%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2221%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%229%22%20fill%3D%22%23064E3B%22%2F%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2299%22%20cy%3D%2278%22%20r%3D%224%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2238%2C36%2057%2C36%2057%2C56%2026%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2263%2C36%2083%2C36%2096%2C56%2063%2C56%22%20fill%3D%22%23064E3B%22%20opacity%3D%220.55%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E"
  },
  {
    "id": "banner-airport-2",
    "order": 2,
    "title": "Airport Transfers From ₹599",
    "headline": "Airport From ₹599",
    "sub": "Direct Terminal Pickup & Drop",
    "tag": "AIRPORT SPECIAL",
    "tagBg": "#3B82F6",
    "brandTag": "RIDINGO · AIRPORT",
    "category": "airport",
    "serviceName": "Airport Pickup & Drop",
    "cta": "Book Airport Cab",
    "promoCode": "FLYSAFE",
    "icon": "airport",
    "active": true,
    "showCta": false,
    "gradient": "linear-gradient(135deg, #0F172A 0%, #1E3A8A 50%, #2563EB 100%)",
    "imageUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%230F172A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2240%25%22%20stop-color%3D%22%231E3A8A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%232563EB%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%2338BDF8%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2360A5FA%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g2)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG2)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%230F172A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EAIRPORT%20SPECIAL%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EAirport%20From%20%E2%82%B9599%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23BAE6FD%22%3EDirect%20Terminal%20Pickup%20%26%20Drop%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%2393C5FD%22%3EZero%20surge%20pricing%20%C2%B7%20Free%2045-min%20delay%20wait%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%231E3A8A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20FLYSAFE%3C%2Ftext%3E%0A%20%20%3C!--%20Airplane%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M65%2C12%20L52%2C48%20L10%2C54%20L10%2C64%20L52%2C62%20L52%2C90%20L40%2C100%20L40%2C108%20L65%2C102%20L90%2C108%20L90%2C100%20L78%2C90%20L78%2C62%20L120%2C64%20L120%2C54%20L78%2C48%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M30%2C112%20L100%2C112%22%20stroke%3D%22%2338BDF8%22%20stroke-width%3D%223%22%20stroke-dasharray%3D%226%2C4%22%20stroke-linecap%3D%22round%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageMobile": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%230F172A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2240%25%22%20stop-color%3D%22%231E3A8A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%232563EB%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%2338BDF8%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2360A5FA%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g2)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG2)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%230F172A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EAIRPORT%20SPECIAL%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EAirport%20From%20%E2%82%B9599%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23BAE6FD%22%3EDirect%20Terminal%20Pickup%20%26%20Drop%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%2393C5FD%22%3EZero%20surge%20pricing%20%C2%B7%20Free%2045-min%20delay%20wait%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%231E3A8A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20FLYSAFE%3C%2Ftext%3E%0A%20%20%3C!--%20Airplane%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M65%2C12%20L52%2C48%20L10%2C54%20L10%2C64%20L52%2C62%20L52%2C90%20L40%2C100%20L40%2C108%20L65%2C102%20L90%2C108%20L90%2C100%20L78%2C90%20L78%2C62%20L120%2C64%20L120%2C54%20L78%2C48%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M30%2C112%20L100%2C112%22%20stroke%3D%22%2338BDF8%22%20stroke-width%3D%223%22%20stroke-dasharray%3D%226%2C4%22%20stroke-linecap%3D%22round%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageTablet": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%230F172A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2240%25%22%20stop-color%3D%22%231E3A8A%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%232563EB%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG2%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%2338BDF8%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%2360A5FA%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g2)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22145%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG2)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22106%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%230F172A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EAIRPORT%20SPECIAL%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EAirport%20From%20%E2%82%B9599%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23BAE6FD%22%3EDirect%20Terminal%20Pickup%20%26%20Drop%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%2393C5FD%22%3EZero%20surge%20pricing%20%C2%B7%20Free%2045-min%20delay%20wait%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%231E3A8A%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20FLYSAFE%3C%2Ftext%3E%0A%20%20%3C!--%20Airplane%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M65%2C12%20L52%2C48%20L10%2C54%20L10%2C64%20L52%2C62%20L52%2C90%20L40%2C100%20L40%2C108%20L65%2C102%20L90%2C108%20L90%2C100%20L78%2C90%20L78%2C62%20L120%2C64%20L120%2C54%20L78%2C48%20Z%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.95%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M30%2C112%20L100%2C112%22%20stroke%3D%22%2338BDF8%22%20stroke-width%3D%223%22%20stroke-dasharray%3D%226%2C4%22%20stroke-linecap%3D%22round%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E"
  },
  {
    "id": "banner-outstation-3",
    "order": 3,
    "title": "Outstation Chauffeurs from ₹1,499/day",
    "headline": "Outstation Chauffeurs",
    "sub": "Munnar, Alleppey & Wayanad Trips",
    "tag": "WEEKEND GETAWAY",
    "tagBg": "#8B5CF6",
    "brandTag": "RIDINGO · HIGHWAY",
    "category": "outstation",
    "serviceName": "Outstation Highway Trip",
    "cta": "Explore Trips",
    "promoCode": "TRIP20",
    "icon": "outstation",
    "active": true,
    "showCta": false,
    "gradient": "linear-gradient(135deg, #2E1065 0%, #581C87 50%, #7C3AED 100%)",
    "imageUrl": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%232E1065%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23581C87%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%237C3AED%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23C084FC%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23E879F9%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g3)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22155%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG3)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22111%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%232E1065%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWEEKEND%20GETAWAY%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EOutstation%20Chauffeurs%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23E9D5FF%22%3EMunnar%2C%20Alleppey%20%26%20Wayanad%20Trips%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23DDD6FE%22%3EExperienced%20highway%20drivers%20from%20%E2%82%B91%2C499%2Fday%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23581C87%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20TRIP20%3C%2Ftext%3E%0A%20%20%3C!--%20Mountains%20%26%20highway%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2215%2C92%2050%2C38%2075%2C70%2095%2C44%20120%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.4%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2235%2C92%2065%2C48%2085%2C76%20100%2C56%20122%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.9%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M55%2C92%20L65%2C70%20L75%2C92%20Z%22%20fill%3D%22%232E1065%22%20opacity%3D%220.7%22%2F%3E%0A%20%20%20%20%3Cline%20x1%3D%2265%22%20y1%3D%2274%22%20x2%3D%2265%22%20y2%3D%2288%22%20stroke%3D%22%23E9D5FF%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%223%2C2%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageMobile": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%232E1065%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23581C87%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%237C3AED%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23C084FC%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23E879F9%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g3)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22155%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG3)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22111%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%232E1065%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWEEKEND%20GETAWAY%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EOutstation%20Chauffeurs%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23E9D5FF%22%3EMunnar%2C%20Alleppey%20%26%20Wayanad%20Trips%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23DDD6FE%22%3EExperienced%20highway%20drivers%20from%20%E2%82%B91%2C499%2Fday%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23581C87%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20TRIP20%3C%2Ftext%3E%0A%20%20%3C!--%20Mountains%20%26%20highway%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2215%2C92%2050%2C38%2075%2C70%2095%2C44%20120%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.4%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2235%2C92%2065%2C48%2085%2C76%20100%2C56%20122%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.9%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M55%2C92%20L65%2C70%20L75%2C92%20Z%22%20fill%3D%22%232E1065%22%20opacity%3D%220.7%22%2F%3E%0A%20%20%20%20%3Cline%20x1%3D%2265%22%20y1%3D%2274%22%20x2%3D%2265%22%20y2%3D%2288%22%20stroke%3D%22%23E9D5FF%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%223%2C2%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E",
    "imageTablet": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20240%22%20width%3D%22100%25%22%20height%3D%22100%25%22%3E%0A%20%20%3Cdefs%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22g3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%22100%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%232E1065%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%2250%25%22%20stop-color%3D%22%23581C87%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%237C3AED%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%3ClinearGradient%20id%3D%22badgeG3%22%20x1%3D%220%25%22%20y1%3D%220%25%22%20x2%3D%22100%25%22%20y2%3D%220%25%22%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23C084FC%22%2F%3E%0A%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23E879F9%22%2F%3E%0A%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%3C%2Fdefs%3E%0A%20%20%3Crect%20width%3D%22600%22%20height%3D%22240%22%20rx%3D%2224%22%20fill%3D%22url(%23g3)%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22510%22%20cy%3D%2255%22%20r%3D%22110%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.06%22%2F%3E%0A%20%20%3Ccircle%20cx%3D%22470%22%20cy%3D%22185%22%20r%3D%2270%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.05%22%2F%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%2224%22%20width%3D%22155%22%20height%3D%2226%22%20rx%3D%2213%22%20fill%3D%22url(%23badgeG3)%22%2F%3E%0A%20%20%3Ctext%20x%3D%22111%22%20y%3D%2242%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2211%22%20font-weight%3D%22900%22%20fill%3D%22%232E1065%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%221%22%3EWEEKEND%20GETAWAY%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%2294%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2230%22%20font-weight%3D%22900%22%20fill%3D%22%23ffffff%22%3EOutstation%20Chauffeurs%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22126%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2215%22%20font-weight%3D%22600%22%20fill%3D%22%23E9D5FF%22%3EMunnar%2C%20Alleppey%20%26%20Wayanad%20Trips%3C%2Ftext%3E%0A%20%20%3Ctext%20x%3D%2234%22%20y%3D%22152%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22400%22%20fill%3D%22%23DDD6FE%22%3EExperienced%20highway%20drivers%20from%20%E2%82%B91%2C499%2Fday%3C%2Ftext%3E%0A%20%20%3Crect%20x%3D%2234%22%20y%3D%22174%22%20width%3D%22138%22%20height%3D%2234%22%20rx%3D%2217%22%20fill%3D%22%23ffffff%22%2F%3E%0A%20%20%3Ctext%20x%3D%22103%22%20y%3D%22196%22%20font-family%3D%22-apple-system%2C%20BlinkMacSystemFont%2C%20'Segoe%20UI'%2C%20Roboto%2C%20sans-serif%22%20font-size%3D%2212.5%22%20font-weight%3D%22900%22%20fill%3D%22%23581C87%22%20text-anchor%3D%22middle%22%20letter-spacing%3D%220.5%22%3ECODE%3A%20TRIP20%3C%2Ftext%3E%0A%20%20%3C!--%20Mountains%20%26%20highway%20graphic%20--%3E%0A%20%20%3Cg%20transform%3D%22translate(435%2C%2060)%22%3E%0A%20%20%20%20%3Ccircle%20cx%3D%2265%22%20cy%3D%2255%22%20r%3D%2256%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.12%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2215%2C92%2050%2C38%2075%2C70%2095%2C44%20120%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.4%22%2F%3E%0A%20%20%20%20%3Cpolygon%20points%3D%2235%2C92%2065%2C48%2085%2C76%20100%2C56%20122%2C92%22%20fill%3D%22%23ffffff%22%20opacity%3D%220.9%22%2F%3E%0A%20%20%20%20%3Cpath%20d%3D%22M55%2C92%20L65%2C70%20L75%2C92%20Z%22%20fill%3D%22%232E1065%22%20opacity%3D%220.7%22%2F%3E%0A%20%20%20%20%3Cline%20x1%3D%2265%22%20y1%3D%2274%22%20x2%3D%2265%22%20y2%3D%2288%22%20stroke%3D%22%23E9D5FF%22%20stroke-width%3D%222%22%20stroke-dasharray%3D%223%2C2%22%2F%3E%0A%20%20%3C%2Fg%3E%0A%3C%2Fsvg%3E"
  }
];

const DEMO_BANNER_IDS = new Set([
  'banner-airport-1',
  'banner-hourly-2',
  'banner-outstation-3',
  'airport-cashback',
  'hourly-discount',
  'outstation-discount'
]);

/**
 * Fetch all banners from localStorage or defaults
 */
export function getAllBanners() {
  if (typeof window === 'undefined') return DEFAULT_SEED_BANNERS;
  try {
    const raw = localStorage.getItem(LOCAL_BANNERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(DEFAULT_SEED_BANNERS));
      return DEFAULT_SEED_BANNERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const realBanners = parsed.filter(b => !DEMO_BANNER_IDS.has(b.id));
      if (realBanners.length > 0) {
        return realBanners.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    }
    localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(DEFAULT_SEED_BANNERS));
    return DEFAULT_SEED_BANNERS;
  } catch (e) {
    console.error('[BannerService] Failed to read banners:', e);
    return DEFAULT_SEED_BANNERS;
  }
}

/**
 * Get active running banners displayed on the User App
 */
export function getActiveOfferBanners() {
  const all = getAllBanners();
  const active = all.filter(b => b.active !== false);
  return active.length > 0 ? active : DEFAULT_SEED_BANNERS;
}

/**
 * Save / Update a banner
 */
export async function saveOfferBanner(bannerData) {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Administrative authentication required to create or modify offer banners.');
  }

  const all = getAllBanners();
  const isNew = !bannerData.id;
  const id = bannerData.id || `banner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Find service config
  const srv = SERVICE_OPTIONS.find(s => s.id === bannerData.category) || SERVICE_OPTIONS[0];

  const imageMobile = bannerData.imageMobile || bannerData.imageUrl || '';
  const imageTablet = bannerData.imageTablet || imageMobile;

  const banner = {
    ...bannerData,
    id,
    imageMobile,
    imageTablet,
    imageUrl: imageMobile || imageTablet,
    category: bannerData.category || srv.category,
    serviceName: srv.name,
    title: bannerData.title || `${srv.name} Banner`,
    headline: bannerData.headline || srv.name,
    cta: bannerData.cta || 'Book Now',
    ctaBgColor: bannerData.ctaBgColor || '#FFFFFF',
    ctaTextColor: bannerData.ctaTextColor || '#000000',
    showCta: bannerData.showCta !== false,
    active: bannerData.active !== false,
    order: typeof bannerData.order === 'number' ? bannerData.order : all.length + 1,
    tagBg: srv.color,
    tagColor: '#FFFFFF',
    icon: srv.icon,
    updatedAt: new Date().toISOString()
  };

  let updatedList;
  if (isNew) {
    updatedList = [...all, { ...banner, createdAt: new Date().toISOString() }];
  } else {
    updatedList = all.map(b => (b.id === id ? { ...b, ...banner } : b));
  }

  // Sort by order
  updatedList.sort((a, b) => (a.order || 0) - (b.order || 0));

  // Save local
  try {
    localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error('[BannerService] LocalStorage save error:', e);
  }

  // Broadcast event for live updates
  broadcastBannersUpdated(updatedList);

  // Attempt sync to Supabase
  try {
    if (supabase) {
      await supabase.from('profiles').update({
        name: 'RIDINGO_OFFER_BANNERS',
        preferences: { banners: updatedList },
        updated_at: new Date().toISOString()
      }).eq('phone', '+919999999999').catch(() => {});
      await supabase.from('offer_banners').upsert(banner, { onConflict: 'id' }).catch(() => {});
    }
  } catch (err) {
    // Non-blocking fallback
  }

  return { success: true, banner, list: updatedList };
}

/**
 * Delete a banner
 */
export async function deleteOfferBanner(id) {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Administrative authentication required to delete offer banners.');
  }

  const all = getAllBanners();
  const updatedList = all.filter(b => b.id !== id);

  try {
    localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error('[BannerService] LocalStorage delete error:', e);
  }

  broadcastBannersUpdated(updatedList);

  try {
    if (supabase) {
      await supabase.from('profiles').update({
        name: 'RIDINGO_OFFER_BANNERS',
        preferences: { banners: updatedList },
        updated_at: new Date().toISOString()
      }).eq('phone', '+919999999999').catch(() => {});
      await supabase.from('offer_banners').delete().eq('id', id).catch(() => {});
    }
  } catch (err) {}

  return updatedList;
}

/**
 * Toggle banner active state
 */
export async function toggleBannerActive(id) {
  if (!isAdminAuthenticated()) {
    throw new Error('Unauthorized: Administrative authentication required to toggle banner status.');
  }

  const all = getAllBanners();
  const updatedList = all.map(b => (b.id === id ? { ...b, active: !b.active } : b));

  try {
    localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(updatedList));
  } catch (e) {
    console.error('[BannerService] LocalStorage toggle error:', e);
  }

  broadcastBannersUpdated(updatedList);

  try {
    if (supabase) {
      await supabase.from('profiles').update({
        name: 'RIDINGO_OFFER_BANNERS',
        preferences: { banners: updatedList },
        updated_at: new Date().toISOString()
      }).eq('phone', '+919999999999').catch(() => {});
    }
  } catch (err) {}

  return updatedList;
}

/**
 * Broadcast banner update to all tabs/windows
 */
function broadcastBannersUpdated(banners) {
  if (typeof window === 'undefined') return;

  // Window custom event
  window.dispatchEvent(new CustomEvent(BANNERS_EVENT_KEY, { detail: banners }));

  // BroadcastChannel for cross-tab instant sync
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('ridingo_banner_sync');
      bc.postMessage({ type: 'BANNERS_UPDATED', banners });
      bc.close();
    }
  } catch (e) {}
}

/**
 * Hook or subscriber for reactive banner updates with real-time cloud sync
 */
export function subscribeToOfferBanners(callback) {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e) => {
    if (e.detail) callback(e.detail);
  };

  const handleStorage = (e) => {
    if (e.key === LOCAL_BANNERS_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed) && parsed.length > 0) callback(parsed);
      } catch (err) {}
    }
  };

  let bc = null;
  try {
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel('ridingo_banner_sync');
      bc.onmessage = (event) => {
        if (event?.data?.type === 'BANNERS_UPDATED' && event.data.banners) {
          callback(event.data.banners);
        }
      };
    }
  } catch (e) {}

  // Immediately invoke with active local/seed banners
  try {
    const initial = getActiveOfferBanners();
    if (Array.isArray(initial) && initial.length > 0) {
      callback(initial);
    }
  } catch (e) {}

  // Fetch real-time cloud banners from Supabase REST & client
  const fetchCloudBanners = async () => {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

      if (!SUPABASE_URL || !SUPABASE_KEY) return;

      // Query by unique name identifier (safe against URL-encoding issues with phone + sign)
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?name=eq.RIDINGO_OFFER_BANNERS&select=preferences`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      if (res.ok) {
        const rows = await res.json();
        const banners = rows?.[0]?.preferences?.banners;
        if (Array.isArray(banners) && banners.length > 0) {
          const cleanBanners = banners.filter(b => !DEMO_BANNER_IDS.has(b.id));
          if (cleanBanners.length > 0) {
            try {
              localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(cleanBanners));
            } catch (e) {}
            callback(cleanBanners);
            return;
          }
        }
      }
    } catch (err) {
      // Direct REST failed or timed out, attempt supabase-js client fallback
    }

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('name', 'RIDINGO_OFFER_BANNERS')
          .single();
        if (!error && data?.preferences?.banners && Array.isArray(data.preferences.banners) && data.preferences.banners.length > 0) {
          const cleanBanners = data.preferences.banners.filter(b => !DEMO_BANNER_IDS.has(b.id));
          if (cleanBanners.length > 0) {
            try {
              localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(cleanBanners));
            } catch (e) {}
            callback(cleanBanners);
          }
        }
      }
    } catch (e) {}
  };

  // Immediate cloud fetch
  fetchCloudBanners();

  // Supabase Realtime channel subscription for instant pushes from Admin Panel
  let realtimeChannel = null;
  try {
    if (supabase && typeof supabase.channel === 'function') {
      realtimeChannel = supabase
        .channel('ridingo-banner-realtime-sub')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: 'name=eq.RIDINGO_OFFER_BANNERS'
          },
          (payload) => {
            const banners = payload?.new?.preferences?.banners;
            if (Array.isArray(banners) && banners.length > 0) {
              const cleanBanners = banners.filter(b => !DEMO_BANNER_IDS.has(b.id));
              if (cleanBanners.length > 0) {
                try {
                  localStorage.setItem(LOCAL_BANNERS_KEY, JSON.stringify(cleanBanners));
                } catch (e) {}
                callback(cleanBanners);
              }
            }
          }
        )
        .subscribe();
    }
  } catch (err) {
    console.warn('[BannerService] Realtime channel subscription notice:', err);
  }

  // Periodic polling every 20 seconds to guarantee live freshness across network changes
  const pollTimer = setInterval(fetchCloudBanners, 20000);

  // Re-fetch immediately when app comes into foreground / window focus
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      fetchCloudBanners();
    }
  };

  window.addEventListener(BANNERS_EVENT_KEY, handleCustomEvent);
  window.addEventListener('storage', handleStorage);
  window.addEventListener('focus', fetchCloudBanners);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    window.removeEventListener(BANNERS_EVENT_KEY, handleCustomEvent);
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('focus', fetchCloudBanners);
    document.removeEventListener('visibilitychange', handleVisibility);
    clearInterval(pollTimer);
    if (bc) bc.close();
    if (realtimeChannel && typeof realtimeChannel.unsubscribe === 'function') {
      realtimeChannel.unsubscribe().catch(() => {});
    }
  };
}
