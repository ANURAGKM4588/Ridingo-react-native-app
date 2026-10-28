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

export const LOCAL_BANNERS_KEY = 'ridingo_offer_banners_v5';
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
    "imageUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDY0RTNCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMDQ3ODU3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzEwQjk4MSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRjU5RTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZCQkYyNCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMSkiLz4KICA8Y2lyY2xlIGN4PSI1MjAiIGN5PSI1MCIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDgwIiBjeT0iMTgwIiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzEpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDAwMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VMQ09NRSBPRkZFUjwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iOTQiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI2ZmZmZmZiI+RmxhdCDigrkxNTAgT0ZGPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0QxRkFFNSI+T24gWW91ciBGaXJzdCBDaGF1ZmZldXIgQm9va2luZzwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0E3RjNEMCI+VmVyaWZpZWQgZXhwZXJ0IGRyaXZlcnMgwrcgRnJlZSBjYW5jZWxsYXRpb248L3RleHQ+CiAgPHJlY3QgeD0iMzQiIHk9IjE3NCIgd2lkdGg9IjEzOCIgaGVpZ2h0PSIzNCIgcng9IjE3IiBmaWxsPSIjZmZmZmZmIi8+CiAgPHRleHQgeD0iMTAzIiB5PSIxOTYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMi41IiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDY1RjQ2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5DT0RFOiBSSURFMTUwPC90ZXh0PgogIDwhLS0gQ2FyIFNpbGhvdWV0dGUgZ3JhcGhpYyAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MzAsIDY4KSI+CiAgICA8Y2lyY2xlIGN4PSI2NSIgY3k9IjUyIiByPSI1NiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4xMiIvPgogICAgPHBhdGggZD0iTTE0LDYwIEwzNSwzMCBMODUsMzAgTDEwOCw2MCBMMTIwLDYyIEwxMjAsNzggTDExMiw3OCBBMTMsMTMgMCAwLDEgODYsNzggTDM0LDc4IEExMywxMyAwIDAsMSA4LDc4IEwwLDc4IEwwLDYyIFoiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOTUiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iMzgsMzYgNTcsMzYgNTcsNTYgMjYsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iNjMsMzYgODMsMzYgOTYsNTYgNjMsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICA8L2c+Cjwvc3ZnPg==",
    "imageMobile": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDY0RTNCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMDQ3ODU3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzEwQjk4MSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRjU5RTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZCQkYyNCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMSkiLz4KICA8Y2lyY2xlIGN4PSI1MjAiIGN5PSI1MCIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDgwIiBjeT0iMTgwIiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzEpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDAwMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VMQ09NRSBPRkZFUjwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iOTQiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI2ZmZmZmZiI+RmxhdCDigrkxNTAgT0ZGPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0QxRkFFNSI+T24gWW91ciBGaXJzdCBDaGF1ZmZldXIgQm9va2luZzwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0E3RjNEMCI+VmVyaWZpZWQgZXhwZXJ0IGRyaXZlcnMgwrcgRnJlZSBjYW5jZWxsYXRpb248L3RleHQ+CiAgPHJlY3QgeD0iMzQiIHk9IjE3NCIgd2lkdGg9IjEzOCIgaGVpZ2h0PSIzNCIgcng9IjE3IiBmaWxsPSIjZmZmZmZmIi8+CiAgPHRleHQgeD0iMTAzIiB5PSIxOTYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMi41IiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDY1RjQ2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5DT0RFOiBSSURFMTUwPC90ZXh0PgogIDwhLS0gQ2FyIFNpbGhvdWV0dGUgZ3JhcGhpYyAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MzAsIDY4KSI+CiAgICA8Y2lyY2xlIGN4PSI2NSIgY3k9IjUyIiByPSI1NiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4xMiIvPgogICAgPHBhdGggZD0iTTE0LDYwIEwzNSwzMCBMODUsMzAgTDEwOCw2MCBMMTIwLDYyIEwxMjAsNzggTDExMiw3OCBBMTMsMTMgMCAwLDEgODYsNzggTDM0LDc4IEExMywxMyAwIDAsMSA4LDc4IEwwLDc4IEwwLDYyIFoiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOTUiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iMzgsMzYgNTcsMzYgNTcsNTYgMjYsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iNjMsMzYgODMsMzYgOTYsNTYgNjMsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICA8L2c+Cjwvc3ZnPg==",
    "imageTablet": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDY0RTNCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjMDQ3ODU3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzEwQjk4MSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMSIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjRjU5RTBCIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZCQkYyNCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMSkiLz4KICA8Y2lyY2xlIGN4PSI1MjAiIGN5PSI1MCIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDgwIiBjeT0iMTgwIiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzEpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDAwMDAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VMQ09NRSBPRkZFUjwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iOTQiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzMCIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iI2ZmZmZmZiI+RmxhdCDigrkxNTAgT0ZGPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0QxRkFFNSI+T24gWW91ciBGaXJzdCBDaGF1ZmZldXIgQm9va2luZzwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0E3RjNEMCI+VmVyaWZpZWQgZXhwZXJ0IGRyaXZlcnMgwrcgRnJlZSBjYW5jZWxsYXRpb248L3RleHQ+CiAgPHJlY3QgeD0iMzQiIHk9IjE3NCIgd2lkdGg9IjEzOCIgaGVpZ2h0PSIzNCIgcng9IjE3IiBmaWxsPSIjZmZmZmZmIi8+CiAgPHRleHQgeD0iMTAzIiB5PSIxOTYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMi41IiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMDY1RjQ2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMC41Ij5DT0RFOiBSSURFMTUwPC90ZXh0PgogIDwhLS0gQ2FyIFNpbGhvdWV0dGUgZ3JhcGhpYyAtLT4KICA8ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg0MzAsIDY4KSI+CiAgICA8Y2lyY2xlIGN4PSI2NSIgY3k9IjUyIiByPSI1NiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4xMiIvPgogICAgPHBhdGggZD0iTTE0LDYwIEwzNSwzMCBMODUsMzAgTDEwOCw2MCBMMTIwLDYyIEwxMjAsNzggTDExMiw3OCBBMTMsMTMgMCAwLDEgODYsNzggTDM0LDc4IEExMywxMyAwIDAsMSA4LDc4IEwwLDc4IEwwLDYyIFoiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOTUiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9IjIxIiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjkiIGZpbGw9IiMwNjRFM0IiLz4KICAgIDxjaXJjbGUgY3g9Ijk5IiBjeT0iNzgiIHI9IjQiIGZpbGw9IiNmZmZmZmYiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iMzgsMzYgNTcsMzYgNTcsNTYgMjYsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iNjMsMzYgODMsMzYgOTYsNTYgNjMsNTYiIGZpbGw9IiMwNjRFM0IiIG9wYWNpdHk9IjAuNTUiLz4KICA8L2c+Cjwvc3ZnPg=="
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
    "imageUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMEYxNzJBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNDAlIiBzdG9wLWNvbG9yPSIjMUUzQThBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzI1NjNFQiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzhCREY4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzYwQTVGQSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMikiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzIpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMEYxNzJBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+QUlSUE9SVCBTUEVDSUFMPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5BaXJwb3J0IEZyb20g4oK5NTk5PC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0JBRTZGRCI+RGlyZWN0IFRlcm1pbmFsIFBpY2t1cCAmIERyb3A8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjE1MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyLjUiIGZvbnQtd2VpZ2h0PSI0MDAiIGZpbGw9IiM5M0M1RkQiPlplcm8gc3VyZ2UgcHJpY2luZyDCtyBGcmVlIDQ1LW1pbiBkZWxheSB3YWl0PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzFFM0E4QSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogRkxZU0FGRTwvdGV4dD4KICA8IS0tIEFpcnBsYW5lIGdyYXBoaWMgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDM1LCA2MCkiPgogICAgPGNpcmNsZSBjeD0iNjUiIGN5PSI1NSIgcj0iNTYiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuMTIiLz4KICAgIDxwYXRoIGQ9Ik02NSwxMiBMNTIsNDggTDEwLDU0IEwxMCw2NCBMNTIsNjIgTDUyLDkwIEw0MCwxMDAgTDQwLDEwOCBMNjUsMTAyIEw5MCwxMDggTDkwLDEwMCBMNzgsOTAgTDc4LDYyIEwxMjAsNjQgTDEyMCw1NCBMNzgsNDggWiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC45NSIvPgogICAgPHBhdGggZD0iTTMwLDExMiBMMTAwLDExMiIgc3Ryb2tlPSIjMzhCREY4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1kYXNoYXJyYXk9IjYsNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPC9nPgo8L3N2Zz4=",
    "imageMobile": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMEYxNzJBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNDAlIiBzdG9wLWNvbG9yPSIjMUUzQThBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzI1NjNFQiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzhCREY4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzYwQTVGQSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMikiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzIpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMEYxNzJBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+QUlSUE9SVCBTUEVDSUFMPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5BaXJwb3J0IEZyb20g4oK5NTk5PC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0JBRTZGRCI+RGlyZWN0IFRlcm1pbmFsIFBpY2t1cCAmIERyb3A8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjE1MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyLjUiIGZvbnQtd2VpZ2h0PSI0MDAiIGZpbGw9IiM5M0M1RkQiPlplcm8gc3VyZ2UgcHJpY2luZyDCtyBGcmVlIDQ1LW1pbiBkZWxheSB3YWl0PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzFFM0E4QSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogRkxZU0FGRTwvdGV4dD4KICA8IS0tIEFpcnBsYW5lIGdyYXBoaWMgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDM1LCA2MCkiPgogICAgPGNpcmNsZSBjeD0iNjUiIGN5PSI1NSIgcj0iNTYiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuMTIiLz4KICAgIDxwYXRoIGQ9Ik02NSwxMiBMNTIsNDggTDEwLDU0IEwxMCw2NCBMNTIsNjIgTDUyLDkwIEw0MCwxMDAgTDQwLDEwOCBMNjUsMTAyIEw5MCwxMDggTDkwLDEwMCBMNzgsOTAgTDc4LDYyIEwxMjAsNjQgTDEyMCw1NCBMNzgsNDggWiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC45NSIvPgogICAgPHBhdGggZD0iTTMwLDExMiBMMTAwLDExMiIgc3Ryb2tlPSIjMzhCREY4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1kYXNoYXJyYXk9IjYsNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPC9nPgo8L3N2Zz4=",
    "imageTablet": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMEYxNzJBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iNDAlIiBzdG9wLWNvbG9yPSIjMUUzQThBIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzI1NjNFQiIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMiIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMzhCREY4Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzYwQTVGQSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMikiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE0NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzIpIi8+CiAgPHRleHQgeD0iMTA2IiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMEYxNzJBIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+QUlSUE9SVCBTUEVDSUFMPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5BaXJwb3J0IEZyb20g4oK5NTk5PC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSIxMjYiIGZvbnQtZmFtaWx5PSItYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsICdTZWdvZSBVSScsIFJvYm90bywgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNSIgZm9udC13ZWlnaHQ9IjYwMCIgZmlsbD0iI0JBRTZGRCI+RGlyZWN0IFRlcm1pbmFsIFBpY2t1cCAmIERyb3A8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjE1MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyLjUiIGZvbnQtd2VpZ2h0PSI0MDAiIGZpbGw9IiM5M0M1RkQiPlplcm8gc3VyZ2UgcHJpY2luZyDCtyBGcmVlIDQ1LW1pbiBkZWxheSB3YWl0PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzFFM0E4QSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogRkxZU0FGRTwvdGV4dD4KICA8IS0tIEFpcnBsYW5lIGdyYXBoaWMgLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNDM1LCA2MCkiPgogICAgPGNpcmNsZSBjeD0iNjUiIGN5PSI1NSIgcj0iNTYiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuMTIiLz4KICAgIDxwYXRoIGQ9Ik02NSwxMiBMNTIsNDggTDEwLDU0IEwxMCw2NCBMNTIsNjIgTDUyLDkwIEw0MCwxMDAgTDQwLDEwOCBMNjUsMTAyIEw5MCwxMDggTDkwLDEwMCBMNzgsOTAgTDc4LDYyIEwxMjAsNjQgTDEyMCw1NCBMNzgsNDggWiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC45NSIvPgogICAgPHBhdGggZD0iTTMwLDExMiBMMTAwLDExMiIgc3Ryb2tlPSIjMzhCREY4IiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1kYXNoYXJyYXk9IjYsNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+CiAgPC9nPgo8L3N2Zz4="
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
    "imageUrl": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMkUxMDY1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjNTgxQzg3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzdDM0FFRCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjQzA4NEZDIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0U4NzlGOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMykiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE1NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzMpIi8+CiAgPHRleHQgeD0iMTExIiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMkUxMDY1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VFS0VORCBHRVRBV0FZPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5PdXRzdGF0aW9uIENoYXVmZmV1cnM8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjEyNiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjRTlENUZGIj5NdW5uYXIsIEFsbGVwcGV5ICYgV2F5YW5hZCBUcmlwczwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0RERDZGRSI+RXhwZXJpZW5jZWQgaGlnaHdheSBkcml2ZXJzIGZyb20g4oK5MSw0OTkvZGF5PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzU4MUM4NyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogVFJJUDIwPC90ZXh0PgogIDwhLS0gTW91bnRhaW5zICYgaGlnaHdheSBncmFwaGljIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzNSwgNjApIj4KICAgIDxjaXJjbGUgY3g9IjY1IiBjeT0iNTUiIHI9IjU2IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjEyIi8+CiAgICA8cG9seWdvbiBwb2ludHM9IjE1LDkyIDUwLDM4IDc1LDcwIDk1LDQ0IDEyMCw5MiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cG9seWdvbiBwb2ludHM9IjM1LDkyIDY1LDQ4IDg1LDc2IDEwMCw1NiAxMjIsOTIiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOSIvPgogICAgPHBhdGggZD0iTTU1LDkyIEw2NSw3MCBMNzUsOTIgWiIgZmlsbD0iIzJFMTA2NSIgb3BhY2l0eT0iMC43Ii8+CiAgICA8bGluZSB4MT0iNjUiIHkxPSI3NCIgeDI9IjY1IiB5Mj0iODgiIHN0cm9rZT0iI0U5RDVGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDIiLz4KICA8L2c+Cjwvc3ZnPg==",
    "imageMobile": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMkUxMDY1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjNTgxQzg3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzdDM0FFRCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjQzA4NEZDIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0U4NzlGOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMykiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE1NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzMpIi8+CiAgPHRleHQgeD0iMTExIiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMkUxMDY1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VFS0VORCBHRVRBV0FZPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5PdXRzdGF0aW9uIENoYXVmZmV1cnM8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjEyNiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjRTlENUZGIj5NdW5uYXIsIEFsbGVwcGV5ICYgV2F5YW5hZCBUcmlwczwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0RERDZGRSI+RXhwZXJpZW5jZWQgaGlnaHdheSBkcml2ZXJzIGZyb20g4oK5MSw0OTkvZGF5PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzU4MUM4NyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogVFJJUDIwPC90ZXh0PgogIDwhLS0gTW91bnRhaW5zICYgaGlnaHdheSBncmFwaGljIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzNSwgNjApIj4KICAgIDxjaXJjbGUgY3g9IjY1IiBjeT0iNTUiIHI9IjU2IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjEyIi8+CiAgICA8cG9seWdvbiBwb2ludHM9IjE1LDkyIDUwLDM4IDc1LDcwIDk1LDQ0IDEyMCw5MiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cG9seWdvbiBwb2ludHM9IjM1LDkyIDY1LDQ4IDg1LDc2IDEwMCw1NiAxMjIsOTIiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOSIvPgogICAgPHBhdGggZD0iTTU1LDkyIEw2NSw3MCBMNzUsOTIgWiIgZmlsbD0iIzJFMTA2NSIgb3BhY2l0eT0iMC43Ii8+CiAgICA8bGluZSB4MT0iNjUiIHkxPSI3NCIgeDI9IjY1IiB5Mj0iODgiIHN0cm9rZT0iI0U5RDVGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDIiLz4KICA8L2c+Cjwvc3ZnPg==",
    "imageTablet": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2MDAgMjQwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZzMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMkUxMDY1Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjNTgxQzg3Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzdDM0FFRCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iYmFkZ2VHMyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjQzA4NEZDIi8+CiAgICAgIDxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0U4NzlGOSIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjYwMCIgaGVpZ2h0PSIyNDAiIHJ4PSIyNCIgZmlsbD0idXJsKCNnMykiLz4KICA8Y2lyY2xlIGN4PSI1MTAiIGN5PSI1NSIgcj0iMTEwIiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjA2Ii8+CiAgPGNpcmNsZSBjeD0iNDcwIiBjeT0iMTg1IiByPSI3MCIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC4wNSIvPgogIDxyZWN0IHg9IjM0IiB5PSIyNCIgd2lkdGg9IjE1NSIgaGVpZ2h0PSIyNiIgcng9IjEzIiBmaWxsPSJ1cmwoI2JhZGdlRzMpIi8+CiAgPHRleHQgeD0iMTExIiB5PSI0MiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjExIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjMkUxMDY1IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBsZXR0ZXItc3BhY2luZz0iMSI+V0VFS0VORCBHRVRBV0FZPC90ZXh0PgogIDx0ZXh0IHg9IjM0IiB5PSI5NCIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjMwIiBmb250LXdlaWdodD0iOTAwIiBmaWxsPSIjZmZmZmZmIj5PdXRzdGF0aW9uIENoYXVmZmV1cnM8L3RleHQ+CiAgPHRleHQgeD0iMzQiIHk9IjEyNiIgZm9udC1mYW1pbHk9Ii1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjE1IiBmb250LXdlaWdodD0iNjAwIiBmaWxsPSIjRTlENUZGIj5NdW5uYXIsIEFsbGVwcGV5ICYgV2F5YW5hZCBUcmlwczwvdGV4dD4KICA8dGV4dCB4PSIzNCIgeT0iMTUyIiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjQwMCIgZmlsbD0iI0RERDZGRSI+RXhwZXJpZW5jZWQgaGlnaHdheSBkcml2ZXJzIGZyb20g4oK5MSw0OTkvZGF5PC90ZXh0PgogIDxyZWN0IHg9IjM0IiB5PSIxNzQiIHdpZHRoPSIxMzgiIGhlaWdodD0iMzQiIHJ4PSIxNyIgZmlsbD0iI2ZmZmZmZiIvPgogIDx0ZXh0IHg9IjEwMyIgeT0iMTk2IiBmb250LWZhbWlseT0iLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIuNSIgZm9udC13ZWlnaHQ9IjkwMCIgZmlsbD0iIzU4MUM4NyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgbGV0dGVyLXNwYWNpbmc9IjAuNSI+Q09ERTogVFJJUDIwPC90ZXh0PgogIDwhLS0gTW91bnRhaW5zICYgaGlnaHdheSBncmFwaGljIC0tPgogIDxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDQzNSwgNjApIj4KICAgIDxjaXJjbGUgY3g9IjY1IiBjeT0iNTUiIHI9IjU2IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjEyIi8+CiAgICA8cG9seWdvbiBwb2ludHM9IjE1LDkyIDUwLDM4IDc1LDcwIDk1LDQ0IDEyMCw5MiIgZmlsbD0iI2ZmZmZmZiIgb3BhY2l0eT0iMC40Ii8+CiAgICA8cG9seWdvbiBwb2ludHM9IjM1LDkyIDY1LDQ4IDg1LDc2IDEwMCw1NiAxMjIsOTIiIGZpbGw9IiNmZmZmZmYiIG9wYWNpdHk9IjAuOSIvPgogICAgPHBhdGggZD0iTTU1LDkyIEw2NSw3MCBMNzUsOTIgWiIgZmlsbD0iIzJFMTA2NSIgb3BhY2l0eT0iMC43Ii8+CiAgICA8bGluZSB4MT0iNjUiIHkxPSI3NCIgeDI9IjY1IiB5Mj0iODgiIHN0cm9rZT0iI0U5RDVGRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtZGFzaGFycmF5PSIzLDIiLz4KICA8L2c+Cjwvc3ZnPg=="
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
