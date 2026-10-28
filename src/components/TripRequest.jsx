import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { cleanLocationName } from "../utils/locationCleaner";
import "./TripRequest.css";

export const DEFAULT_SAMPLE_TRIP = {
  id: "TRP-SAMPLE-01",
  status: "LIVE REQUEST",
  type: "Hourly · 3 hr",
  cat: "hourly",
  qty: 3,
  schedule: "Today, Oct 28 · 1:00 PM",
  earnings: "₹525",
  fare: 750,
  pickupDistance: "1.2 km away",
  pickup: "Koramangala 4th Block",
  dropoff: "Koramangala 4th Block",
  drop_loc: "Koramangala 4th Block",
  distance: "0.5 km",
  distanceText: "0.5 km",
  eta: "~2 mins",
  durationText: "~2 mins",
  rider: {
    name: "Arjun Menon",
    rating: "4.9"
  },
  driver: "Arjun Menon",
  rating: "4.9",
  transmission: "Manual Transmission",
  trans: "Manual"
};

/**
 * Formats trip schedule date and time
 */
function resolveScheduleText(t) {
  if (!t) return "Today, Oct 28 · 1:00 PM";
  if (t.schedule) return t.schedule;
  if (t.scheduleDisplay && t.scheduleDisplay !== "Immediate Pickup") return t.scheduleDisplay;
  if (t.scheduledDate) {
    const time = t.scheduledTime ? ` · ${t.scheduledTime}` : "";
    return `${t.scheduledDate}${time}`;
  }
  if (t.date) {
    const time = t.time ? ` · ${t.time}` : "";
    return `${t.date}${time}`;
  }
  if (t.when_ts) {
    try {
      const dt = new Date(Number(t.when_ts));
      const now = new Date();
      const isToday = dt.toDateString() === now.toDateString();
      const timeStr = dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
      if (isToday) {
        return `Today, ${dt.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · ${timeStr}`;
      }
      return `${dt.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · ${timeStr}`;
    } catch (_) {}
  }
  return "Today, Oct 28 · 1:00 PM";
}

/**
 * Resolves category badge text (e.g. "Hourly · 3 hr")
 */
function resolveCategoryText(t) {
  if (t.type) return t.type;
  const cat = String(t.cat || "hourly").toLowerCase();
  const qty = Number(t.qty) || (cat === "daily" ? 1 : 3);

  if (cat === "hourly") return `Hourly · ${qty} hr`;
  if (cat === "daily") return `Daily · ${qty} ${qty === 1 ? "day" : "days"}`;
  if (cat === "airport") return "Airport · Pickup/Drop";
  if (cat === "outstation") return `Outstation · ${qty} ${qty === 1 ? "day" : "days"}`;
  if (cat === "event") return `Event Driver · ${qty} hr`;
  return `${cat.charAt(0).toUpperCase() + cat.slice(1)} · ${qty} hr`;
}

/**
 * TripRequest Component
 * Modern, minimal, premium mobile card for incoming driver trip requests.
 */
export default function TripRequest({
  trip = DEFAULT_SAMPLE_TRIP,
  onAccept,
  onDecline,
  waitingCount = 1,
  theme: controlledTheme,
  showThemeToggle = false,
  showHeader = true,
  className = ""
}) {
  // Sync with document or internal theme
  const [internalTheme, setInternalTheme] = useState(() => {
    if (controlledTheme) return controlledTheme;
    if (typeof document !== "undefined") {
      const docTheme = document.documentElement.getAttribute("data-theme");
      if (docTheme) return docTheme;
    }
    return "light";
  });

  useEffect(() => {
    if (controlledTheme) {
      setInternalTheme(controlledTheme);
    }
  }, [controlledTheme]);

  // Keep synced with global theme changes
  useEffect(() => {
    if (controlledTheme) return;
    const observer = new MutationObserver(() => {
      const docTheme = document.documentElement.getAttribute("data-theme");
      if (docTheme && docTheme !== internalTheme) {
        setInternalTheme(docTheme);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [controlledTheme, internalTheme]);

  const activeTheme = controlledTheme || internalTheme;

  // Resolve values from real trip object or sample
  const data = trip || DEFAULT_SAMPLE_TRIP;
  const fare = Number(data.fare) || 750;
  // 70% driver payout after 30% platform commission
  const driverEarnings = data.earnings
    ? data.earnings
    : `₹${Math.round(fare * 0.70)}`;

  const scheduleText = resolveScheduleText(data);
  const categoryText = resolveCategoryText(data);
  const pickupText = cleanLocationName(data.pickup || data.from) || "Koramangala 4th Block";
  const dropoffText = cleanLocationName(data.dropoff || data.drop_loc || data.drop || data.to) || "Koramangala 4th Block";
  const pickupDistance = data.pickupDistance || "1.2 km away";
  const distanceText = data.distanceText || data.distance || "0.5 km";
  const etaText = data.durationText
    ? (data.durationText.startsWith("~") ? data.durationText : `~${data.durationText}`)
    : (data.eta || "~2 mins");

  const riderName = data.rider?.name || data.driver || "Arjun Menon";
  const riderRating = data.rider?.rating || data.rating || "4.9";
  const transmissionText = (data.trans || data.car?.trans || data.transmission || "Manual").includes("Auto")
    ? "Automatic Transmission"
    : "Manual Transmission";

  const handleAcceptClick = () => {
    if (typeof onAccept === "function") {
      onAccept(data.id || data);
    } else {
      console.log("Accept ride clicked", data.id);
    }
  };

  const handleDeclineClick = () => {
    if (typeof onDecline === "function") {
      onDecline(data.id || data);
    } else {
      console.log("Decline ride clicked", data.id);
    }
  };

  return (
    <div className={`trip-request-wrapper theme-${activeTheme} ${className}`}>
      {showHeader && (
        <header className="trip-header">
          <h1 className="trip-title">Trip requests</h1>

          <div className="header-right">
            <span className="waiting-count">
              {waitingCount} {waitingCount === 1 ? "waiting" : "waiting"}
            </span>

            {showThemeToggle && (
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={() => {
                  const next = activeTheme === "light" ? "dark" : "light";
                  setInternalTheme(next);
                  if (typeof document !== "undefined") {
                    document.documentElement.setAttribute("data-theme", next);
                  }
                }}
                aria-label="Toggle color theme"
              >
                {activeTheme === "light" ? "☾" : "☀"}
              </button>
            )}
          </div>
        </header>
      )}

      <article className="trip-card">
        {/* Status Row */}
        <div className="status-row">
          <span className="live-status">
            <span className="live-dot" />
            LIVE REQUEST
          </span>

          <span className="hourly-badge">
            <span className="badge-icon">
              <Icon name="clock" size={13} />
            </span>
            <span>{categoryText}</span>
          </span>
        </div>

        {/* Schedule Row */}
        <div className="schedule-row">
          <span className="schedule-icon">
            <Icon name="calendar" size={18} />
          </span>

          <div className="schedule-copy">
            <span className="eyebrow">TRIP SCHEDULE</span>
            <strong>{scheduleText}</strong>
          </div>

          <span className="chevron">
            <Icon name="chevronRight" size={18} />
          </span>
        </div>

        {/* Earnings Card with Vertical Partition Bar */}
        <section className="earnings-card">
          <div className="earnings-left">
            <span className="eyebrow">DRIVER EARNINGS</span>
            <strong className="earnings-value">{driverEarnings}</strong>
          </div>

          <span className="earnings-divider" aria-hidden="true" />

          <div className="pickup-distance">
            <span className="nav-icon">
              <Icon name="navigation" size={15} />
            </span>
            <span className="distance-label">{pickupDistance}</span>
          </div>
        </section>

        {/* Route Section */}
        <section className="route-section">
          <div className="route-line" aria-hidden="true">
            <span className="route-dot pickup-dot" />
            <span className="route-dotted-line" />
            <span className="route-dot dropoff-dot" />
          </div>

          <div className="route-locations">
            <div className="location-row">
              <div className="location-content">
                <span className="pin-icon">
                  <Icon name="pin" size={16} />
                </span>
                <span className="location-text">{pickupText}</span>
              </div>
              <span className="chevron">
                <Icon name="chevronRight" size={16} />
              </span>
            </div>

            <div className="location-row">
              <div className="location-content">
                <span className="pin-icon">
                  <Icon name="pin" size={16} />
                </span>
                <span className="location-text">{dropoffText}</span>
              </div>
              <span className="chevron">
                <Icon name="chevronRight" size={16} />
              </span>
            </div>
          </div>
        </section>

        {/* Metrics Row */}
        <section className="metrics-row">
          <div className="metric">
            <span className="metric-icon">
              <Icon name="road" size={16} />
            </span>
            <div>
              <span className="eyebrow">Distance</span>
              <strong>{distanceText}</strong>
            </div>
          </div>

          <span className="metric-divider" aria-hidden="true" />

          <div className="metric">
            <span className="metric-icon">
              <Icon name="clock" size={16} />
            </span>
            <div>
              <span className="eyebrow">Est. Time</span>
              <strong>{etaText}</strong>
            </div>
          </div>
        </section>

        {/* Driver / Rider Info */}
        <div className="driver-info">
          <span className="driver-avatar">
            <Icon name="user" size={14} />
          </span>
          <span>
            {riderName} ({riderRating} Rating)
          </span>
          <span className="info-separator">·</span>
          <span>{transmissionText}</span>
        </div>

        {/* Actions */}
        <footer className="trip-actions">
          <button
            type="button"
            className="decline-btn"
            onClick={handleDeclineClick}
          >
            Decline
          </button>

          <button
            type="button"
            className="accept-btn"
            onClick={handleAcceptClick}
          >
            Accept Ride
          </button>
        </footer>
      </article>
    </div>
  );
}
