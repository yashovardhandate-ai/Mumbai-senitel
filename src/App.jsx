import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, X, ThumbsUp, ThumbsDown, Loader2, MapPin, Bell, BellOff, CheckCircle2, Phone, Search, Map as MapIcon, BookOpen, Camera, Locate, Share2, Flag } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

const LEAFLET_CSS_ID = "leaflet-css";
const LEAFLET_JS_ID = "leaflet-js";
const FONT_LINK_ID = "sentinel-fonts";
const VOTER_NAME_KEY = "sentinel_voter_name";
const OWNED_REPORTS_KEY = "sentinel_owned_reports";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

// Push subscription keys arrive as base64url strings but the browser wants
// raw bytes.
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToB64(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Ask the browser for the user's location once, so we only alert them about
// incidents near them. Resolves to null if they decline -- that's fine, they
// just get every alert instead.
function getPositionOrNull() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

function getOwnedReports() {
  try {
    return JSON.parse(localStorage.getItem(OWNED_REPORTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveOwnedReport(incidentId, token) {
  const owned = getOwnedReports();
  owned[incidentId] = token;
  localStorage.setItem(OWNED_REPORTS_KEY, JSON.stringify(owned));
}

function genToken() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "tok-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}

const MUMBAI_CENTER = [19.076, 72.8777];

function ensureFonts() {
  if (document.getElementById(FONT_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_LINK_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
  document.head.appendChild(link);
}

function ensureLeaflet() {
  return new Promise((resolve) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const css = document.createElement("link");
      css.id = LEAFLET_CSS_ID;
      css.rel = "stylesheet";
      css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(css);
    }
    if (!document.getElementById(LEAFLET_JS_ID)) {
      const script = document.createElement("script");
      script.id = LEAFLET_JS_ID;
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = () => resolve(window.L);
      document.head.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.L) {
          clearInterval(check);
          resolve(window.L);
        }
      }, 100);
    }
  });
}

const CATEGORIES = [
  { id: "traffic", label: "Traffic Jam", emoji: "🚗", color: "#C9862B" },
  { id: "blockage", label: "Blockage", emoji: "🚧", color: "#B8562F" },
  { id: "fire", label: "Fire", emoji: "🔥", color: "#C13B3B" },
  { id: "flood", label: "Flood / Disaster", emoji: "🌊", color: "#2E6E8E" },
  { id: "other", label: "Other Issue", emoji: "⚠️", color: "#6B6558" },
];

const catInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[4];

const CONTACT_CATEGORIES = [
  { id: "police", label: "Police", color: "#3B5F7D", emoji: "🚓" },
  { id: "fire", label: "Fire", color: "#C13B3B", emoji: "🚒" },
  { id: "medical", label: "Medical", color: "#4A9A5A", emoji: "🏥" },
  { id: "bmc", label: "BMC / Civic", color: "#C9862B", emoji: "🏛️" },
  { id: "pwd", label: "PWD / CPWD", color: "#8B6BAE", emoji: "🛠️" },
  { id: "other", label: "Other", color: "#6B6F7A", emoji: "📍" },
];

const contactCatInfo = (id) => CONTACT_CATEGORIES.find((c) => c.id === id) || CONTACT_CATEGORIES[5];

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function expiresIn(iso) {
  const expiresAt = new Date(iso).getTime() + 24 * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) return "expiring now";
  const hrs = Math.floor(remainingMs / 3600000);
  if (hrs < 1) return "expires in <1h";
  return `expires in ${hrs}h`;
}

function Header({ view, onViewChange, onReportClick, alertCount, onClearAlerts, pushState, onTogglePush }) {
  return (
    <div className="header-bar">
      <div className="header-left">
        <button className="header-logo-btn" onClick={() => onViewChange("home")}>
          <AlertTriangle size={20} strokeWidth={2.2} color="#C13B3B" />
          <span className="header-title">Mumbai Sentinel</span>
        </button>
        <div className="view-toggle">
          <button
            className={"view-toggle-btn" + (view === "map" ? " view-toggle-btn--active" : "")}
            onClick={() => onViewChange("map")}
          >
            <MapIcon size={13} strokeWidth={2.2} /> Map
          </button>
          <button
            className={"view-toggle-btn" + (view === "directory" ? " view-toggle-btn--active" : "")}
            onClick={() => onViewChange("directory")}
          >
            <BookOpen size={13} strokeWidth={2.2} /> Directory
          </button>
        </div>
      </div>
      <div className="header-right">
        {alertCount > 0 && (
          <button className="alert-badge" onClick={onClearAlerts}>
            <Bell size={13} strokeWidth={2.2} />
            {alertCount} new
          </button>
        )}
        {pushSupported() && (
          <button
            className={"notify-btn" + (pushState === "on" ? " notify-btn--on" : "")}
            onClick={onTogglePush}
            disabled={pushState === "busy"}
            title={pushState === "on" ? "Alerts on — tap to turn off" : "Get alerts for incidents near you"}
          >
            {pushState === "busy" ? (
              <Loader2 size={15} className="spin" />
            ) : pushState === "on" ? (
              <Bell size={15} strokeWidth={2.2} />
            ) : (
              <BellOff size={15} strokeWidth={2.2} />
            )}
            <span className="notify-btn-label">{pushState === "on" ? "Alerts on" : "Get alerts"}</span>
          </button>
        )}
        <button className="report-btn" onClick={onReportClick}>
          <AlertTriangle size={15} strokeWidth={2.2} />
          Report incident
        </button>
      </div>
    </div>
  );
}

function CategoryFilterBar({ active, onToggle }) {
  return (
    <div className="cat-filter-bar">
      {CATEGORIES.map((c) => (
        <button
          key={c.id}
          className={"cat-chip" + (active.has(c.id) ? " cat-chip--active" : "")}
          onClick={() => onToggle(c.id)}
          style={active.has(c.id) ? { borderColor: c.color, color: c.color } : undefined}
        >
          <span>{c.emoji}</span> {c.label}
        </button>
      ))}
    </div>
  );
}

function NamePrompt({ onConfirm, onCancel }) {
  const [name, setName] = useState("");
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h2 className="modal-title">Your name</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>
        <p className="privacy-note" style={{ marginTop: 0 }}>
          We ask once so votes are tied to a real person, not anonymous clicks.
          Your browser will remember it after this.
        </p>
        <input
          className="field-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onConfirm(name.trim())}
        />
        <div className="modal-actions">
          <button className="btn-primary" disabled={!name.trim()} onClick={() => onConfirm(name.trim())}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function IncidentList({ incidents, onSelect, onVote, onResolve, selectedId, myVotes, ownedIds }) {
  if (incidents.length === 0) {
    return <div className="empty-list">No incidents reported in this view yet.</div>;
  }
  const sorted = [...incidents].sort((a, b) => {
    const scoreA = (a.upvotes || 0) - (a.downvotes || 0);
    const scoreB = (b.upvotes || 0) - (b.downvotes || 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return (
    <div className="incident-list">
      {sorted.map((inc) => {
        const c = catInfo(inc.category);
        const score = (inc.upvotes || 0) - (inc.downvotes || 0);
        const myVote = myVotes[inc.id];
        const isOwned = ownedIds.has(inc.id);
        return (
          <div
            key={inc.id}
            className={"incident-card" + (selectedId === inc.id ? " incident-card--active" : "")}
            onClick={() => onSelect(inc)}
          >
            <div className="incident-card-top">
              <span className="incident-emoji">{c.emoji}</span>
              <span className="incident-cat" style={{ color: c.color }}>{c.label}</span>
              <span className="incident-time">{timeAgo(inc.created_at)}</span>
            </div>
            <p className="incident-desc">{inc.description}</p>
            {inc.photo_url && <img src={inc.photo_url} alt="" className="incident-photo" />}
            <div className="incident-card-foot">
              <button
                className={"vote-btn" + (myVote === "up" ? " vote-btn--active-up" : "")}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(inc.id, "up");
                }}
              >
                <ThumbsUp size={13} strokeWidth={2.2} />
              </button>
              <span className={"vote-score" + (score < 0 ? " vote-score--neg" : "")}>{score}</span>
              <button
                className={"vote-btn" + (myVote === "down" ? " vote-btn--active-down" : "")}
                onClick={(e) => {
                  e.stopPropagation();
                  onVote(inc.id, "down");
                }}
              >
                <ThumbsDown size={13} strokeWidth={2.2} />
              </button>
              <span className="reporter-name">— {inc.reporter_name}</span>
            </div>
            <div className="incident-card-bottom">
              <span className="expiry-label">{expiresIn(inc.created_at)}</span>
              {isOwned && (
                <button
                  className="resolve-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve(inc.id);
                  }}
                >
                  <CheckCircle2 size={12} strokeWidth={2.2} />
                  Mark resolved
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const REPORT_REASONS = [
  { id: "number_dead", label: "Number doesn't connect" },
  { id: "number_wrong", label: "Wrong number / someone else" },
  { id: "address_wrong", label: "Address is wrong" },
  { id: "moved_closed", label: "Office moved or closed" },
  { id: "other", label: "Something else" },
];

function ReportContactModal({ contact, onCancel, onDone }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (!reason) return;
    setSaving(true);
    setErr(null);
    try {
      const { error } = await supabase.from("contact_reports").insert([
        {
          contact_id: contact.id,
          contact_name: contact.name,
          reason,
          details: details.trim() || null,
        },
      ]);
      if (error) throw error;
      onDone();
    } catch (e) {
      setErr("Couldn't send: " + (e?.message || e));
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Report incorrect details</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="report-target">{contact.name}</p>

        <label className="field-label">What's wrong?</label>
        <div className="reason-chips">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={"reason-chip" + (reason === r.id ? " reason-chip--active" : "")}
              onClick={() => setReason(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="rc-details">Details (optional)</label>
        <textarea
          id="rc-details"
          className="field-textarea"
          rows={2}
          placeholder="e.g. the correct number is..."
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />

        {err && <p className="photo-error">{err}</p>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} type="button">Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={!reason || saving} type="button">
            {saving ? <Loader2 size={14} className="spin" /> : null}
            {saving ? "Sending…" : "Send report"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Directory({ contacts, loading }) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const [reporting, setReporting] = useState(null);
  const [thanksFor, setThanksFor] = useState(null);

  const filtered = (contacts || []).filter((c) => {
    const matchesCat = activeCat === "all" || c.category === activeCat;
    const matchesSearch =
      !search.trim() ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.area || "").toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="directory">
      <div className="directory-search-row">
        <div className="directory-search">
          <Search size={14} strokeWidth={2.2} />
          <input
            placeholder="Search by name or area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="cat-filter-bar">
        <button
          className={"cat-chip" + (activeCat === "all" ? " cat-chip--active" : "")}
          onClick={() => setActiveCat("all")}
          style={activeCat === "all" ? { borderColor: "#EDEBE4", color: "#EDEBE4" } : undefined}
        >
          All
        </button>
        {CONTACT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={"cat-chip" + (activeCat === c.id ? " cat-chip--active" : "")}
            onClick={() => setActiveCat(c.id)}
            style={activeCat === c.id ? { borderColor: c.color, color: c.color } : undefined}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="directory-list">
        {loading ? (
          <div className="loading-overlay" style={{ position: "static", height: 200 }}>
            <Loader2 size={16} className="spin" /> Loading directory…
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-list">No contacts match this search.</div>
        ) : (
          filtered.map((c) => {
            const cat = contactCatInfo(c.category);
            return (
              <div className="contact-card" key={c.id}>
                <div className="contact-card-top">
                  <span className="contact-cat-badge" style={{ color: cat.color, borderColor: cat.color }}>
                    {cat.label}
                  </span>
                  {c.area && <span className="contact-area">{c.area}</span>}
                </div>
                <h3 className="contact-name">{c.name}</h3>
                {c.address && <p className="contact-address">{c.address}</p>}
                <div className="contact-phones">
                  {c.phone.split(",").map((p, i) => (
                    <a key={i} href={`tel:${p.trim()}`} className="contact-phone-btn">
                      <Phone size={12} strokeWidth={2.2} />
                      {p.trim()}
                    </a>
                  ))}
                </div>
                <div className="contact-card-foot">
                  {thanksFor === c.id ? (
                    <span className="report-thanks">
                      <CheckCircle2 size={12} strokeWidth={2.2} /> Thanks — we'll check this
                    </span>
                  ) : (
                    <button className="report-link" onClick={() => setReporting(c)} type="button">
                      <Flag size={11} strokeWidth={2.2} /> Report incorrect
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {reporting && (
        <ReportContactModal
          contact={reporting}
          onCancel={() => setReporting(null)}
          onDone={() => {
            setThanksFor(reporting.id);
            setReporting(null);
          }}
        />
      )}
    </div>
  );
}

function OfficeLayerToggles({ activeLayers, onToggle, isOpen, onOpenChange, contactsWithLocation }) {
  const countFor = (catId) => contactsWithLocation.filter((c) => c.category === catId).length;
  return (
    <div className="layer-panel">
      <button className="layer-panel-toggle" onClick={() => onOpenChange(!isOpen)}>
        <MapIcon size={13} strokeWidth={2.2} />
        Office pins
      </button>
      {isOpen && (
        <div className="layer-panel-body">
          {CONTACT_CATEGORIES.map((c) => (
            <div className="layer-row" key={c.id}>
              <span className="layer-row-label">
                <span>{c.emoji}</span> {c.label}
                <span className="layer-row-count">{countFor(c.id)}</span>
              </span>
              <button
                className={"toggle-switch" + (activeLayers.has(c.id) ? " toggle-switch--on" : "")}
                onClick={() => onToggle(c.id)}
                style={activeLayers.has(c.id) ? { background: c.color } : undefined}
                aria-label={`Toggle ${c.label} pins`}
              >
                <span className="toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HomeScreen({ onReport, onGoToMap, onGoToDirectory }) {
  const bgMapRef = useRef(null);
  const bgMapInstance = useRef(null);

  useEffect(() => {
    let cancelled = false;
    ensureLeaflet().then((L) => {
      if (cancelled || bgMapInstance.current || !bgMapRef.current) return;
      const map = L.map(bgMapRef.current, {
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
      }).setView(MUMBAI_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      bgMapInstance.current = map;
      setTimeout(() => map.invalidateSize(), 100);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="home-screen">
      <div ref={bgMapRef} className="home-map-bg" />
      <div className="home-overlay" />
      <div className="home-content">
        <div className="home-title-box">
          <AlertTriangle size={30} strokeWidth={2.2} color="#C13B3B" />
          <h1 className="home-title">Mumbai Sentinel</h1>
        </div>
        <div className="home-tagline-box">
          <p className="home-tagline">Report incidents anytime, anywhere — Mumbai's own incident reporting network.</p>
        </div>
        <div className="home-actions">
          <button className="home-btn home-btn--primary" onClick={onReport}>
            <AlertTriangle size={16} strokeWidth={2.2} />
            Report Incident
          </button>
          <button className="home-btn home-btn--secondary" onClick={onGoToMap}>
            <MapIcon size={16} strokeWidth={2.2} />
            Go to Map
          </button>
          <button className="home-btn home-btn--secondary" onClick={onGoToDirectory}>
            <BookOpen size={16} strokeWidth={2.2} />
            Go to Directory
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ pendingLocation, onCancel, onSubmit, onRequestPin }) {
  const [category, setCategory] = useState("traffic");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const fileInputRef = useRef(null);

  const canSubmit = pendingLocation && description.trim() && name.trim() && phone.trim().length >= 7;

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("incident-photos").upload(path, file);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("incident-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      setPhotoError("Couldn't upload photo: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await onSubmit({
      category,
      description: description.trim(),
      reporter_name: name.trim(),
      reporter_phone: phone.trim(),
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      photo_url: photoUrl,
    });
    setSaving(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Report an incident</h2>
          <button className="icon-btn" onClick={onCancel} aria-label="Cancel">
            <X size={18} />
          </button>
        </div>

        <label className="field-label">Location</label>
        {pendingLocation ? (
          <div className="location-chip">
            <MapPin size={14} strokeWidth={2.2} />
            {pendingLocation.lat.toFixed(4)}, {pendingLocation.lng.toFixed(4)}
            <button className="location-change" onClick={onRequestPin}>change</button>
          </div>
        ) : (
          <button className="location-pick-btn" onClick={onRequestPin}>
            <MapPin size={14} strokeWidth={2.2} />
            Tap to drop a pin on the map
          </button>
        )}

        <label className="field-label">Category</label>
        <div className="cat-select-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={"cat-select" + (category === c.id ? " cat-select--active" : "")}
              style={category === c.id ? { borderColor: c.color, color: c.color } : undefined}
              onClick={() => setCategory(c.id)}
              type="button"
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="r-desc">What's happening?</label>
        <textarea
          id="r-desc"
          className="field-textarea"
          placeholder="Brief description of the incident"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />

        <label className="field-label">Photo (optional)</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handlePhotoSelect}
        />
        {photoUrl ? (
          <div className="photo-preview">
            <img src={photoUrl} alt="incident" />
            <button className="photo-remove" onClick={() => setPhotoUrl(null)} type="button">
              <X size={14} /> Remove
            </button>
          </div>
        ) : (
          <button
            className="photo-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            type="button"
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? <Loader2 size={15} className="spin" /> : <Camera size={15} strokeWidth={2.2} />}
            {uploadingPhoto ? "Uploading…" : "Add a photo"}
          </button>
        )}
        {photoError && <p className="photo-error">{photoError}</p>}

        <div className="field-row">
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="r-name">Your name</label>
            <input
              id="r-name"
              className="field-input"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label" htmlFor="r-phone">Phone number</label>
            <input
              id="r-phone"
              className="field-input"
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>
        </div>
        <p className="privacy-note">
          Your name and number help others trust the report. Only your name is shown publicly — not your phone number.
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} type="button">Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={!canSubmit || saving} type="button">
            {saving ? <Loader2 size={15} className="spin" /> : null}
            {saving ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const pinModeRef = useRef(false);

  const [incidents, setIncidents] = useState(null);
  const [myVotes, setMyVotes] = useState({});
  const [activeCats, setActiveCats] = useState(new Set(CATEGORIES.map((c) => c.id)));
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(null);
  const [pinMode, setPinMode] = useState(false);
  const [error, setError] = useState(null);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [voterName, setVoterName] = useState(null);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [pendingVote, setPendingVote] = useState(null);
  const [ownedIds, setOwnedIds] = useState(new Set());
  const [view, setView] = useState("home");
  const [contacts, setContacts] = useState(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [officeLayers, setOfficeLayers] = useState(new Set());
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const contactMarkersRef = useRef({});
  const lastSeenRef = useRef(Date.now());

  useEffect(() => {
    ensureFonts();
    const saved = localStorage.getItem(VOTER_NAME_KEY);
    if (saved) setVoterName(saved);
    setOwnedIds(new Set(Object.keys(getOwnedReports())));
  }, []);

  useEffect(() => {
    setContactsLoading(true);
    supabase
      .from("contacts")
      .select("*")
      .order("category", { ascending: true })
      .then(({ data, error: err }) => {
        setContactsLoading(false);
        if (err) {
          setError("Couldn't load directory: " + err.message);
          setContacts([]);
          return;
        }
        setContacts(data);
      });
  }, []);

  const loadIncidents = useCallback(async (isPoll) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data, error: err } = await supabase
      .from("incidents")
      .select("*, votes(voter_name, direction)")
      .eq("resolved", false)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });
    if (err) {
      setError("Couldn't load incidents: " + err.message);
      setIncidents([]);
      return;
    }
    const withCounts = data.map((inc) => ({
      ...inc,
      upvotes: inc.votes.filter((v) => v.direction === "up").length,
      downvotes: inc.votes.filter((v) => v.direction === "down").length,
    }));
    setIncidents((prev) => {
      if (isPoll && prev) {
        const newOnes = withCounts.filter(
          (inc) => !prev.some((old) => old.id === inc.id) && new Date(inc.created_at) > lastSeenRef.current
        );
        if (newOnes.length > 0) setNewAlertCount((n) => n + newOnes.length);
      }
      return withCounts;
    });

    if (voterName) {
      const votes = {};
      withCounts.forEach((inc) => {
        const mine = inc.votes.find((v) => v.voter_name === voterName);
        if (mine) votes[inc.id] = mine.direction;
      });
      setMyVotes(votes);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterName]);

  useEffect(() => {
    loadIncidents(false);
    const interval = setInterval(() => loadIncidents(true), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voterName]);

  useEffect(() => {
    let cancelled = false;
    ensureLeaflet().then((L) => {
      if (cancelled || mapInstance.current || !mapRef.current) return;
      const map = L.map(mapRef.current, { zoomControl: true }).setView(MUMBAI_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      mapInstance.current = map;
      map.on("click", (e) => {
        if (!pinModeRef.current) return;
        setPendingLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
        setPinMode(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view === "map" && mapInstance.current) {
      setTimeout(() => mapInstance.current.invalidateSize(), 50);
    }
  }, [view]);

  useEffect(() => {
    pinModeRef.current = pinMode;
    if (mapRef.current) mapRef.current.style.cursor = pinMode ? "crosshair" : "";
  }, [pinMode]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.L || !incidents) return;
    const L = window.L;
    Object.values(markersRef.current).forEach((m) => map.removeLayer(m));
    markersRef.current = {};
    incidents
      .filter((inc) => activeCats.has(inc.category))
      .forEach((inc) => {
        const c = catInfo(inc.category);
        const icon = L.divIcon({
          html: `<div style="font-size:22px; transform: translate(-50%, -100%);">${c.emoji}</div>`,
          className: "",
          iconSize: [0, 0],
        });
        const marker = L.marker([inc.lat, inc.lng], { icon }).addTo(map);
        marker.on("click", () => setSelectedId(inc.id));
        markersRef.current[inc.id] = marker;
      });
  }, [incidents, activeCats]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.L) return;
    const L = window.L;
    if (markersRef.current.__pending) {
      map.removeLayer(markersRef.current.__pending);
      delete markersRef.current.__pending;
    }
    if (pendingLocation) {
      const icon = L.divIcon({
        html: `<div style="font-size:26px; transform: translate(-50%, -100%);">📍</div>`,
        className: "",
        iconSize: [0, 0],
      });
      markersRef.current.__pending = L.marker([pendingLocation.lat, pendingLocation.lng], { icon }).addTo(map);
    }
  }, [pendingLocation]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.L || !contacts) return;
    const L = window.L;
    Object.values(contactMarkersRef.current).forEach((m) => map.removeLayer(m));
    contactMarkersRef.current = {};
    contacts
      .filter((c) => c.lat != null && c.lng != null && officeLayers.has(c.category))
      .forEach((c) => {
        const cat = contactCatInfo(c.category);
        const icon = L.divIcon({
          html: `<div style="font-size:20px; transform: translate(-50%, -100%);">${cat.emoji}</div>`,
          className: "",
          iconSize: [0, 0],
        });
        const marker = L.marker([c.lat, c.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<strong>${c.name}</strong><br/>${c.address || ""}<br/>${c.phone
            .split(",")
            .map((p) => `<a href="tel:${p.trim()}">${p.trim()}</a>`)
            .join(" · ")}`
        );
        contactMarkersRef.current[c.id] = marker;
      });
  }, [contacts, officeLayers]);

  const toggleOfficeLayer = (catId) => {
    setOfficeLayers((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const [pushState, setPushState] = useState("off");

  // On load, check whether this browser is already subscribed.
  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "on" : "off"))
      .catch(() => {});
  }, []);

  const handleTogglePush = async () => {
    if (!pushSupported()) return;
    setPushState("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();

      // Already subscribed -> turn alerts off.
      if (existing) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", existing.endpoint);
        await existing.unsubscribe();
        setPushState("off");
        return;
      }

      if (!VAPID_PUBLIC_KEY) {
        setError("Alerts aren't configured yet (missing VAPID key).");
        setPushState("off");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Alerts need notification permission. You can enable it in browser settings.");
        setPushState("off");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const pos = await getPositionOrNull();
      const json = sub.toJSON();

      const { error: err } = await supabase.from("push_subscriptions").upsert(
        {
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? bufToB64(sub.getKey("p256dh")),
          auth: json.keys?.auth ?? bufToB64(sub.getKey("auth")),
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
          radius_km: 5,
        },
        { onConflict: "endpoint" }
      );
      if (err) throw err;

      setPushState("on");
    } catch (e) {
      setError("Couldn't set up alerts: " + (e?.message || e));
      setPushState("off");
    }
  };

  const [locating, setLocating] = useState(false);
  const userMarkerRef = useRef(null);

  const handleLocateMe = () => {
    if (!navigator.geolocation || !mapInstance.current) {
      setError("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        const map = mapInstance.current;
        const L = window.L;
        map.setView([latitude, longitude], 15);
        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);
        const icon = L.divIcon({
          html: `<div style="font-size:22px; transform: translate(-50%, -50%);">📍</div>`,
          className: "",
          iconSize: [0, 0],
        });
        userMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(map);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Check location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleCat = (id) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReportClick = () => {
    setModalOpen(true);
    setPendingLocation(null);
  };

  const handleRequestPin = () => setPinMode(true);

  const handleSubmitReport = async (data) => {
    const id = "inc-" + Date.now();
    const ownerToken = genToken();
    const { error: err } = await supabase
      .from("incidents")
      .insert([{ id, ...data, resolved: false, owner_token: ownerToken }]);
    if (err) {
      setError("Couldn't submit: " + err.message);
      return;
    }
    saveOwnedReport(id, ownerToken);
    setOwnedIds((prev) => new Set(prev).add(id));
    setModalOpen(false);
    setPendingLocation(null);
    lastSeenRef.current = Date.now();
    await loadIncidents(false);

    // Notify nearby subscribers. Deliberately not awaited-on-failure: if the
    // push service is down or not set up, the report itself still stands.
    supabase.functions
      .invoke("send-push", { body: { incident: { id, ...data } } })
      .catch(() => {});
  };

  const handleResolve = async (incidentId) => {
    const owned = getOwnedReports();
    const token = owned[incidentId];
    if (!token) return;
    const { error: err } = await supabase
      .from("incidents")
      .update({ resolved: true })
      .eq("id", incidentId)
      .eq("owner_token", token);
    if (err) {
      setError("Couldn't mark resolved: " + err.message);
      return;
    }
    setIncidents((prev) => prev.filter((inc) => inc.id !== incidentId));
  };

  const castVote = async (incidentId, direction, name) => {
    const { error: err } = await supabase
      .from("votes")
      .upsert(
        { incident_id: incidentId, voter_name: name, direction },
        { onConflict: "incident_id,voter_name" }
      );
    if (err) {
      setError("Couldn't register your vote: " + err.message);
      return;
    }
    await loadIncidents(false);
  };

  const handleVote = (incidentId, direction) => {
    if (!voterName) {
      setPendingVote({ incidentId, direction });
      setNamePromptOpen(true);
      return;
    }
    castVote(incidentId, direction, voterName);
  };

  const handleNameConfirm = (name) => {
    localStorage.setItem(VOTER_NAME_KEY, name);
    setVoterName(name);
    setNamePromptOpen(false);
    if (pendingVote) {
      castVote(pendingVote.incidentId, pendingVote.direction, name);
      setPendingVote(null);
    }
  };

  const selectedIncident = incidents && incidents.find((i) => i.id === selectedId);
  const visibleIncidents = incidents ? incidents.filter((inc) => activeCats.has(inc.category)) : [];

  return (
    <div className="app-root">
      <style>{`
        * { box-sizing: border-box; }
        .app-root { height: 100vh; display: flex; flex-direction: column; background: #1A1D24; color: #EDEBE4; font-family: 'Inter', sans-serif; overflow: hidden; }
        .header-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #14161B; border-bottom: 1px solid #2A2E38; flex-shrink: 0; }
        .header-left { display: flex; align-items: center; gap: 8px; }
        .header-logo-btn { display: inline-flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 2px; }
        .header-title { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
        .header-right { display: flex; align-items: center; gap: 10px; }
        .alert-badge { display: inline-flex; align-items: center; gap: 5px; background: #C13B3B; color: #fff; font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 999px; font-family: 'IBM Plex Mono', monospace; border: none; cursor: pointer; }
        .notify-btn { display: inline-flex; align-items: center; gap: 6px; background: transparent; color: #8A8E9A; border: 1px solid #3A3E4A; border-radius: 6px; padding: 7px 12px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .notify-btn:hover { border-color: #6B6F7A; color: #EDEBE4; }
        .notify-btn--on { border-color: #4A9A5A; color: #4A9A5A; }
        .notify-btn:disabled { opacity: 0.6; cursor: default; }
        @media (max-width: 600px) { .notify-btn-label { display: none; } }
        .report-btn { display: inline-flex; align-items: center; gap: 6px; background: #C13B3B; color: #fff; border: none; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .report-btn:hover { background: #a83030; }
        .cat-filter-bar { display: flex; gap: 6px; padding: 10px 16px; background: #14161B; border-bottom: 1px solid #2A2E38; overflow-x: auto; flex-shrink: 0; }
        .cat-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; padding: 5px 11px; border-radius: 999px; border: 1px solid #3A3E4A; background: transparent; color: #8A8E9A; cursor: pointer; white-space: nowrap; }
        .cat-chip--active { font-weight: 600; background: rgba(255,255,255,0.04); }
        .body-layout { flex: 1; display: flex; min-height: 0; }
        .map-container { flex: 1; position: relative; min-width: 0; }
        .sidebar { width: 340px; flex-shrink: 0; background: #14161B; border-left: 1px solid #2A2E38; display: flex; flex-direction: column; overflow: hidden; }
        .sidebar-header { padding: 12px 16px 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #6B6F7A; font-family: 'IBM Plex Mono', monospace; }
        .incident-list { overflow-y: auto; flex: 1; padding: 0 12px 12px; }
        .incident-card { background: #1E212A; border: 1px solid #2A2E38; border-radius: 8px; padding: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s ease; }
        .incident-card:hover { border-color: #4A4E5A; }
        .incident-card--active { border-color: #C9862B; }
        .incident-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
        .incident-emoji { font-size: 15px; }
        .incident-cat { font-size: 11.5px; font-weight: 600; }
        .incident-time { margin-left: auto; font-size: 10.5px; color: #6B6F7A; font-family: 'IBM Plex Mono', monospace; }
        .incident-desc { font-size: 13.5px; line-height: 1.5; color: #C8C6C0; margin: 0 0 8px; }
        .incident-photo { width: 100%; height: auto; max-height: 160px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; display: block; }
        .photo-upload-btn { display: inline-flex; align-items: center; gap: 6px; background: #14161B; border: 1px dashed #4A4E5A; border-radius: 6px; padding: 10px 14px; color: #8A8E9A; cursor: pointer; font-size: 13px; width: 100%; justify-content: center; }
        .photo-upload-btn:hover { border-color: #6B6F7A; color: #EDEBE4; }
        .photo-preview { position: relative; }
        .photo-preview img { width: 100%; height: auto; max-height: 200px; object-fit: cover; border-radius: 6px; display: block; }
        .photo-remove { position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; gap: 4px; background: rgba(20,22,27,0.85); border: none; border-radius: 5px; padding: 5px 9px; color: #fff; font-size: 11.5px; cursor: pointer; }
        .photo-error { font-size: 11.5px; color: #C13B3B; margin: 6px 0 0; }
        .contact-card-foot { margin-top: 10px; padding-top: 8px; border-top: 1px solid #2A2E38; display: flex; justify-content: flex-end; }
        .report-link { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: #C13B3B; font-size: 11.5px; font-weight: 600; cursor: pointer; padding: 2px 4px; }
        .report-link:hover { color: #E05252; text-decoration: underline; }
        .report-thanks { display: inline-flex; align-items: center; gap: 5px; color: #4A9A5A; font-size: 11.5px; }
        .report-modal { max-width: 420px; }
        .report-target { font-size: 14px; font-weight: 600; color: #EDEBE4; margin: 0 0 14px; }
        .reason-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 6px; }
        .reason-chip { background: #14161B; border: 1px solid #3A3E4A; border-radius: 14px; padding: 6px 12px; font-size: 12px; color: #8A8E9A; cursor: pointer; }
        .reason-chip:hover { border-color: #6B6F7A; color: #EDEBE4; }
        .reason-chip--active { border-color: #C13B3B; color: #C13B3B; background: rgba(193,59,59,0.08); }
        .incident-card-foot { display: flex; align-items: center; gap: 6px; }
        .vote-btn { background: none; border: 1px solid #3A3E4A; border-radius: 5px; padding: 3px 6px; color: #8A8E9A; cursor: pointer; display: flex; align-items: center; }
        .vote-btn:hover { border-color: #6B6F7A; color: #EDEBE4; }
        .vote-btn--active-up { border-color: #4A9A5A; color: #4A9A5A; }
        .vote-btn--active-down { border-color: #C13B3B; color: #C13B3B; }
        .vote-score { font-size: 12px; font-weight: 600; font-family: 'IBM Plex Mono', monospace; min-width: 16px; text-align: center; }
        .vote-score--neg { color: #C13B3B; }
        .reporter-name { margin-left: auto; font-size: 11px; color: #6B6F7A; }
        .incident-card-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #2A2E38; }
        .expiry-label { font-size: 10.5px; color: #6B6F7A; font-family: 'IBM Plex Mono', monospace; }
        .resolve-btn { display: inline-flex; align-items: center; gap: 4px; background: none; border: 1px solid #4A9A5A; border-radius: 5px; padding: 3px 8px; font-size: 11px; font-weight: 600; color: #4A9A5A; cursor: pointer; }
        .resolve-btn:hover { background: rgba(74,154,90,0.1); }
        .empty-list { padding: 2rem 1rem; text-align: center; color: #6B6F7A; font-size: 13px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
        .modal { background: #1E212A; border: 1px solid #2A2E38; border-radius: 12px; padding: 20px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .modal-title { font-size: 17px; font-weight: 700; margin: 0; }
        .icon-btn { background: none; border: none; color: #8A8E9A; cursor: pointer; padding: 4px; }
        .icon-btn:hover { color: #EDEBE4; }
        .field-label { display: block; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #8A8E9A; margin: 12px 0 5px; }
        .field-input, .field-textarea { width: 100%; font-family: 'Inter', sans-serif; font-size: 14.5px; padding: 9px 11px; border: 1px solid #3A3E4A; border-radius: 6px; background: #14161B; color: #EDEBE4; }
        .field-input:focus, .field-textarea:focus { outline: 2px solid #C9862B; outline-offset: 1px; }
        .field-textarea { resize: vertical; line-height: 1.5; }
        .field-row { display: flex; gap: 10px; }
        .cat-select-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .cat-select { font-size: 12px; padding: 6px 10px; border-radius: 6px; border: 1px solid #3A3E4A; background: #14161B; color: #8A8E9A; cursor: pointer; }
        .cat-select--active { font-weight: 600; }
        .location-chip { display: inline-flex; align-items: center; gap: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; background: #14161B; border: 1px solid #3A3E4A; border-radius: 6px; padding: 7px 10px; color: #C8C6C0; }
        .location-change { margin-left: auto; background: none; border: none; color: #C9862B; font-size: 12px; cursor: pointer; text-decoration: underline; }
        .location-pick-btn { display: inline-flex; align-items: center; gap: 6px; width: 100%; background: #14161B; border: 1px dashed #4A4E5A; border-radius: 6px; padding: 10px; color: #8A8E9A; cursor: pointer; font-size: 13px; }
        .privacy-note { font-size: 11px; color: #6B6F7A; line-height: 1.5; margin: 10px 0 0; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        .btn-secondary, .btn-primary { font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .btn-secondary { background: transparent; border: 1px solid #3A3E4A; color: #8A8E9A; }
        .btn-primary { background: #C13B3B; border: 1px solid #C13B3B; color: #fff; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-toast { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: #C13B3B; color: #fff; padding: 8px 14px; border-radius: 6px; font-size: 12.5px; z-index: 500; max-width: 80%; text-align: center; }
        .locate-btn { position: absolute; bottom: 16px; right: 16px; z-index: 500; width: 44px; height: 44px; border-radius: 50%; background: #1E212A; border: 1px solid #3A3E4A; color: #EDEBE4; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .locate-btn:hover { border-color: #6B6F7A; }
        .locate-btn:disabled { opacity: 0.6; }
        .pin-banner { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: #C9862B; color: #14161B; padding: 8px 10px 8px 16px; border-radius: 999px; font-size: 12.5px; font-weight: 600; z-index: 500; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 10px; }
        .pin-banner-cancel { background: rgba(20,22,27,0.15); border: none; border-radius: 999px; padding: 4px 10px; font-size: 11.5px; font-weight: 600; color: #14161B; cursor: pointer; }
        .loading-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: #1A1D24; color: #8A8E9A; font-size: 13px; gap: 8px; }
        .view-toggle { display: flex; gap: 2px; background: #1E212A; border-radius: 6px; padding: 2px; margin-left: 12px; }
        .view-toggle-btn { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: #8A8E9A; font-size: 12px; font-weight: 600; padding: 5px 10px; border-radius: 5px; cursor: pointer; }
        .view-toggle-btn--active { background: #2A2E38; color: #EDEBE4; }
        .directory-body { flex: 1; overflow-y: auto; background: #1A1D24; }
        .directory { max-width: 720px; margin: 0 auto; padding: 16px; }
        .directory-search-row { margin-bottom: 10px; }
        .directory-search { display: flex; align-items: center; gap: 8px; background: #1E212A; border: 1px solid #2A2E38; border-radius: 8px; padding: 9px 12px; color: #8A8E9A; }
        .directory-search input { flex: 1; background: none; border: none; color: #EDEBE4; font-size: 14px; font-family: 'Inter', sans-serif; }
        .directory-search input:focus { outline: none; }
        .directory-list { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
        .contact-card { background: #1E212A; border: 1px solid #2A2E38; border-radius: 8px; padding: 14px; }
        .contact-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .contact-cat-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.03em; text-transform: uppercase; border: 1px solid; border-radius: 4px; padding: 2px 7px; }
        .contact-area { font-size: 11.5px; color: #6B6F7A; margin-left: auto; }
        .contact-name { font-size: 15.5px; font-weight: 700; margin: 0 0 4px; }
        .contact-address { font-size: 12.5px; color: #8A8E9A; margin: 0 0 10px; line-height: 1.5; }
        .contact-phones { display: flex; gap: 8px; flex-wrap: wrap; }
        .contact-phone-btn { display: inline-flex; align-items: center; gap: 5px; background: #14161B; border: 1px solid #3A3E4A; border-radius: 6px; padding: 6px 10px; font-size: 12.5px; font-weight: 600; color: #4A9A5A; text-decoration: none; font-family: 'IBM Plex Mono', monospace; }
        .contact-phone-btn:hover { border-color: #4A9A5A; }
        .layer-panel { position: absolute; bottom: 16px; left: 16px; z-index: 500; }
        .layer-panel-toggle { display: inline-flex; align-items: center; gap: 6px; background: #1E212A; border: 1px solid #3A3E4A; border-radius: 8px; padding: 8px 12px; color: #EDEBE4; font-size: 12.5px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
        .layer-panel-body { margin-top: 8px; background: #1E212A; border: 1px solid #3A3E4A; border-radius: 8px; padding: 10px; min-width: 220px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); }
        .layer-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 4px; }
        .layer-row-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #C8C6C0; }
        .layer-row-count { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; color: #6B6F7A; background: #14161B; border-radius: 999px; padding: 1px 6px; margin-left: 2px; }
        .toggle-switch { width: 34px; height: 20px; border-radius: 999px; background: #3A3E4A; border: none; position: relative; cursor: pointer; flex-shrink: 0; transition: background 0.15s ease; }
        .toggle-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #EDEBE4; transition: transform 0.15s ease; display: block; }
        .toggle-switch--on .toggle-knob { transform: translateX(14px); }
        .view-fade { flex: 1; min-height: 0; display: flex; flex-direction: column; animation: fadeIn 0.45s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .home-screen { position: relative; flex: 1; min-height: 0; overflow: hidden; }
        .home-map-bg { position: absolute; inset: 0; filter: grayscale(0.3) brightness(0.55) saturate(0.8); transform: scale(1.08); }
        .home-overlay { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(20,22,27,0.55) 0%, rgba(14,16,20,0.88) 100%); }
        .home-content { position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 24px; text-align: center; }
        .home-title-box { display: inline-flex; align-items: center; gap: 12px; background: #1C2541; border: 1px solid #2E3A66; border-radius: 14px; padding: 18px 32px; box-shadow: 0 8px 32px rgba(0,0,0,0.45); animation: riseIn 0.6s ease; }
        .home-title { font-family: 'Inter', sans-serif; font-weight: 800; font-size: clamp(1.9rem, 6vw, 3.2rem); letter-spacing: -0.02em; margin: 0; color: #EDEBE4; }
        .home-tagline-box { background: #1C2541; border: 1px solid #2E3A66; border-radius: 10px; padding: 12px 22px; max-width: 520px; box-shadow: 0 6px 24px rgba(0,0,0,0.4); animation: riseIn 0.6s ease 0.1s both; }
        .home-tagline { margin: 0; font-size: 15px; color: #C8CCE0; line-height: 1.5; }
        .home-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 6px; animation: riseIn 0.6s ease 0.2s both; }
        @keyframes riseIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .home-btn { display: inline-flex; align-items: center; gap: 8px; border-radius: 8px; padding: 12px 22px; font-size: 14px; font-weight: 700; cursor: pointer; transition: transform 0.15s ease, background 0.15s ease; }
        .home-btn:hover { transform: translateY(-2px); }
        .home-btn--primary { background: #C13B3B; border: 1px solid #C13B3B; color: #fff; }
        .home-btn--primary:hover { background: #a83030; }
        .home-btn--secondary { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.25); color: #EDEBE4; backdrop-filter: blur(4px); }
        .home-btn--secondary:hover { background: rgba(255,255,255,0.12); }
        @media (max-width: 480px) {
          .home-title-box { flex-direction: column; gap: 8px; padding: 16px 24px; }
          .home-actions { flex-direction: column; width: 100%; max-width: 280px; }
        }
        @media (max-width: 720px) {
          .body-layout { flex-direction: column; }
          .sidebar { width: 100%; height: 40%; border-left: none; border-top: 1px solid #2A2E38; }
          .map-container { height: 60%; }
        }
      `}</style>

      {view !== "home" && (
        <Header
          view={view}
          onViewChange={setView}
          onReportClick={handleReportClick}
          alertCount={newAlertCount}
          onClearAlerts={() => setNewAlertCount(0)}
          pushState={pushState}
          onTogglePush={handleTogglePush}
        />
      )}
      {view === "map" && <CategoryFilterBar active={activeCats} onToggle={toggleCat} />}

      {view === "home" && (
        <div className="view-fade">
          <HomeScreen
            onReport={() => {
              setView("map");
              handleReportClick();
            }}
            onGoToMap={() => setView("map")}
            onGoToDirectory={() => setView("directory")}
          />
        </div>
      )}

      <div className="body-layout" style={{ display: view === "map" ? "flex" : "none" }}>
        <div className="map-container">
          <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
          {incidents === null && (
            <div className="loading-overlay">
              <Loader2 size={16} className="spin" /> Loading map…
            </div>
          )}
          {pinMode && (
            <div className="pin-banner">
              Tap anywhere on the map to drop your pin
              <button
                className="pin-banner-cancel"
                onClick={() => {
                  setPinMode(false);
                  setModalOpen(true);
                }}
              >
                Cancel
              </button>
            </div>
          )}
          {!pinMode && (
            <OfficeLayerToggles
              activeLayers={officeLayers}
              onToggle={toggleOfficeLayer}
              isOpen={layerPanelOpen}
              onOpenChange={setLayerPanelOpen}
              contactsWithLocation={(contacts || []).filter((c) => c.lat != null && c.lng != null)}
            />
          )}
          <button className="locate-btn" onClick={handleLocateMe} disabled={locating} aria-label="Find my location">
            {locating ? <Loader2 size={18} className="spin" /> : <Locate size={18} strokeWidth={2.2} />}
          </button>
          {error && <div className="error-toast">{error}</div>}
        </div>
        <div className="sidebar">
          <div className="sidebar-header">
            {visibleIncidents.length} active incident{visibleIncidents.length === 1 ? "" : "s"}
          </div>
          <IncidentList
            incidents={visibleIncidents}
            onSelect={(inc) => setSelectedId(inc.id)}
            onVote={handleVote}
            onResolve={handleResolve}
            selectedId={selectedIncident?.id}
            myVotes={myVotes}
            ownedIds={ownedIds}
          />
        </div>
      </div>

      {view === "directory" && (
        <div className="directory-body view-fade">
          {error && <div className="error-toast" style={{ position: "static", margin: "12px auto", display: "block", width: "fit-content" }}>{error}</div>}
          <Directory contacts={contacts} loading={contactsLoading} />
        </div>
      )}

      {modalOpen && !pinMode && (
        <ReportModal
          pendingLocation={pendingLocation}
          onCancel={() => {
            setModalOpen(false);
            setPendingLocation(null);
            setPinMode(false);
          }}
          onRequestPin={handleRequestPin}
          onSubmit={handleSubmitReport}
        />
      )}

      {namePromptOpen && (
        <NamePrompt
          onConfirm={handleNameConfirm}
          onCancel={() => {
            setNamePromptOpen(false);
            setPendingVote(null);
          }}
        />
      )}
    </div>
  );
}
