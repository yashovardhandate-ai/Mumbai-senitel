import React, { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, X, ThumbsUp, ThumbsDown, Loader2, MapPin, Bell, CheckCircle2, Phone, Search, Map as MapIcon, BookOpen } from "lucide-react";
import { supabase } from "./lib/supabaseClient";

const LEAFLET_CSS_ID = "leaflet-css";
const LEAFLET_JS_ID = "leaflet-js";
const FONT_LINK_ID = "sentinel-fonts";
const VOTER_NAME_KEY = "sentinel_voter_name";
const OWNED_REPORTS_KEY = "sentinel_owned_reports";

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
  { id: "police", label: "Police", color: "#3B5F7D" },
  { id: "fire", label: "Fire", color: "#C13B3B" },
  { id: "medical", label: "Medical", color: "#4A9A5A" },
  { id: "bmc", label: "BMC / Civic", color: "#C9862B" },
  { id: "pwd", label: "PWD / CPWD", color: "#8B6BAE" },
  { id: "other", label: "Other", color: "#6B6F7A" },
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

function Header({ view, onViewChange, onReportClick, alertCount, onClearAlerts }) {
  return (
    <div className="header-bar">
      <div className="header-left">
        <AlertTriangle size={20} strokeWidth={2.2} color="#C13B3B" />
        <span className="header-title">Mumbai Sentinel</span>
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

function Directory({ contacts, loading }) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
  const [category, setCategory] = useState("traffic");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = pendingLocation && description.trim() && name.trim() && phone.trim().length >= 7;

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
  const [view, setView] = useState("map");
  const [contacts, setContacts] = useState(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const lastSeenRef = useRef(Date.now());

  useEffect(() => {
    ensureFonts();
    const saved = localStorage.getItem(VOTER_NAME_KEY);
    if (saved) setVoterName(saved);
    setOwnedIds(new Set(Object.keys(getOwnedReports())));
  }, []);

  useEffect(() => {
    if (view !== "directory" || contacts !== null) return;
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
  }, [view, contacts]);

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
        .header-title { font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
        .header-right { display: flex; align-items: center; gap: 10px; }
        .alert-badge { display: inline-flex; align-items: center; gap: 5px; background: #C13B3B; color: #fff; font-size: 11.5px; font-weight: 600; padding: 4px 9px; border-radius: 999px; font-family: 'IBM Plex Mono', monospace; border: none; cursor: pointer; }
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
        @media (max-width: 720px) {
          .body-layout { flex-direction: column; }
          .sidebar { width: 100%; height: 40%; border-left: none; border-top: 1px solid #2A2E38; }
          .map-container { height: 60%; }
        }
      `}</style>

      <Header
        view={view}
        onViewChange={setView}
        onReportClick={handleReportClick}
        alertCount={newAlertCount}
        onClearAlerts={() => setNewAlertCount(0)}
      />
      {view === "map" && <CategoryFilterBar active={activeCats} onToggle={toggleCat} />}

      {view === "map" ? (
        <div className="body-layout">
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
      ) : (
        <div className="directory-body">
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
