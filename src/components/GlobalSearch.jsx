import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  User,
  Heart,
  Siren,
  Truck,
  Calendar,
  Megaphone,
  Building2,
  Loader2,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Search across these collections with these field weights
const SEARCH_TARGETS = [
  {
    collection: "users",
    label: "User",
    icon: User,
    color: "blue",
    route: "/users",
    fields: ["fullName", "email", "username"],
    title: (d) => d.fullName || d.username || "User",
    subtitle: (d) =>
      `${d.role || "user"}${d.email ? ` · ${d.email}` : ""}${
        d.team ? ` · ${d.team}` : ""
      }`,
  },
  {
    collection: "patients",
    label: "Patient",
    icon: Heart,
    color: "pink",
    route: "/patients",
    fields: ["fullName", "email", "phone"],
    title: (d) => d.fullName || "Patient",
    subtitle: (d) =>
      [d.email, d.phone, d.bloodType].filter(Boolean).join(" · "),
  },
  {
    collection: "emergency_requests",
    label: "Emergency",
    icon: Siren,
    color: "redcross",
    route: "/emergencies",
    fields: ["patientName", "emergencyType", "currentCondition"],
    title: (d) => d.patientName || "Emergency Request",
    subtitle: (d) =>
      `${d.emergencyType || "Emergency"} · ${d.status || "pending"}${
        d.assignedStationName ? ` · ${d.assignedStationName}` : ""
      }`,
  },
  {
    collection: "transport_requests",
    label: "Transport",
    icon: Truck,
    color: "purple",
    route: "/transport",
    fields: [
      "patientName",
      "transportType",
      "pickupLocation",
      "destination",
    ],
    title: (d) => d.patientName || "Transport",
    subtitle: (d) =>
      `${d.pickupLocation || "?"} → ${d.destination || "?"} · ${
        d.status || "pending"
      }`,
  },
  {
    collection: "events",
    label: "Event",
    icon: Calendar,
    color: "teal",
    route: "/events",
    fields: ["title", "description", "location"],
    title: (d) => d.title || "Event",
    subtitle: (d) =>
      [d.date, d.location].filter(Boolean).join(" · ") || "—",
  },
  {
    collection: "announcements",
    label: "Announcement",
    icon: Megaphone,
    color: "yellow",
    route: "/announcements",
    fields: ["text", "postedBy"],
    title: (d) => (d.text || "").slice(0, 80) || "Announcement",
    subtitle: (d) =>
      `Posted by ${d.postedBy || "Admin"} · ${d.color || "yellow"}`,
  },
  {
    collection: "station_details",
    label: "Station",
    icon: Building2,
    color: "blue",
    route: "/stations",
    fields: ["stationName"],
    title: (d) => d.stationName || "Station",
    subtitle: (d) =>
      d.latitude && d.longitude
        ? `${parseFloat(d.latitude).toFixed(3)}, ${parseFloat(
            d.longitude
          ).toFixed(3)}`
        : "No coordinates",
  },
];

const COLOR_MAP = {
  blue: "bg-blue-100 text-blue-600",
  pink: "bg-pink-100 text-pink-600",
  redcross: "bg-redcross-100 text-redcross-600",
  purple: "bg-purple-100 text-purple-600",
  teal: "bg-teal-100 text-teal-600",
  yellow: "bg-yellow-100 text-yellow-600",
};

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allData, setAllData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Open with Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      // Lazy-load data on first open
      if (Object.keys(allData).length === 0) {
        loadAllData();
      }
    } else {
      setSearch("");
      setSelectedIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function loadAllData() {
    setLoading(true);
    const result = {};
    try {
      await Promise.all(
        SEARCH_TARGETS.map(async (target) => {
          try {
            const snap = await getDocs(collection(db, target.collection));
            result[target.collection] = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
          } catch (err) {
            console.warn(`Search: failed to load ${target.collection}`, err);
            result[target.collection] = [];
          }
        })
      );
      setAllData(result);
    } catch (err) {
      console.error("Search: failed to load data", err);
    } finally {
      setLoading(false);
    }
  }

  // Compute search results
  const results = search.trim()
    ? computeResults(allData, search.trim().toLowerCase())
    : [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (!isOpen || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const result = results[selectedIndex];
        if (result) handleSelect(result);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, results, selectedIndex]);

  function handleSelect(result) {
    navigate(result.route);
    setIsOpen(false);
  }

  return (
    <>
      {/* Trigger button — visible in the layout */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
        title="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span>Search...</span>
        <span className="text-xs text-gray-400 ml-2 px-1.5 py-0.5 bg-white border border-gray-200 rounded">
          ⌘K
        </span>
      </button>

      {/* Mobile button */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        title="Search"
      >
        <Search size={18} />
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Search box */}
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
              {loading ? (
                <Loader2 size={20} className="text-gray-400 animate-spin" />
              ) : (
                <Search size={20} className="text-gray-400" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users, emergencies, events, announcements..."
                className="flex-1 outline-none text-base text-gray-900 bg-transparent"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Close (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {!search.trim() ? (
                <EmptyHint loading={loading} />
              ) : results.length === 0 ? (
                <NoResults search={search} loading={loading} />
              ) : (
                <ResultsList
                  results={results}
                  selectedIndex={selectedIndex}
                  onSelect={handleSelect}
                  onHover={setSelectedIndex}
                />
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-5 py-2 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShortcutHint icon="↑↓" label="Navigate" />
                <ShortcutHint icon="↵" label="Open" />
                <ShortcutHint icon="esc" label="Close" />
              </div>
              <span>
                {search.trim()
                  ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                  : `${countTotal(allData)} items indexed`}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────
// Search logic
// ──────────────────────────────────────────────
function computeResults(allData, term) {
  const results = [];

  SEARCH_TARGETS.forEach((target) => {
    const docs = allData[target.collection] || [];
    docs.forEach((doc) => {
      const score = scoreMatch(doc, target.fields, term);
      if (score > 0) {
        results.push({
          id: doc.id,
          target,
          doc,
          title: target.title(doc),
          subtitle: target.subtitle(doc),
          icon: target.icon,
          color: target.color,
          label: target.label,
          route: target.route,
          score,
        });
      }
    });
  });

  // Sort by score desc, then alphabetically by title
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.title.localeCompare(b.title);
  });

  // Limit to top 50 to keep it snappy
  return results.slice(0, 50);
}

function scoreMatch(doc, fields, term) {
  let bestScore = 0;
  for (const field of fields) {
    const value = String(doc[field] || "").toLowerCase();
    if (!value) continue;

    if (value === term) {
      bestScore = Math.max(bestScore, 100);
    } else if (value.startsWith(term)) {
      bestScore = Math.max(bestScore, 50);
    } else if (value.includes(term)) {
      bestScore = Math.max(bestScore, 25);
    } else {
      // Word-boundary match
      const words = value.split(/\s+/);
      if (words.some((w) => w.startsWith(term))) {
        bestScore = Math.max(bestScore, 15);
      }
    }
  }
  return bestScore;
}

function countTotal(allData) {
  return Object.values(allData).reduce((sum, arr) => sum + arr.length, 0);
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function ResultsList({ results, selectedIndex, onSelect, onHover }) {
  // Group by label
  const grouped = {};
  results.forEach((r) => {
    if (!grouped[r.label]) grouped[r.label] = [];
    grouped[r.label].push(r);
  });

  let runningIndex = 0;
  return (
    <div className="py-2">
      {Object.entries(grouped).map(([label, items]) => (
        <div key={label} className="mb-2 last:mb-0">
          <div className="px-5 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label} ({items.length})
          </div>
          {items.map((result) => {
            const Icon = result.icon;
            const idx = runningIndex++;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={`${result.target.collection}_${result.id}`}
                onClick={() => onSelect(result)}
                onMouseEnter={() => onHover(idx)}
                className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                  isSelected ? "bg-redcross-50" : "hover:bg-gray-50"
                }`}
              >
                <div
                  className={`p-2 rounded-lg flex-shrink-0 ${
                    COLOR_MAP[result.color] || "bg-gray-100 text-gray-600"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {result.title}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {result.subtitle}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-xs text-gray-400">↵</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ loading }) {
  if (loading) {
    return (
      <div className="px-5 py-12 text-center text-gray-400">
        <Loader2 size={32} className="mx-auto mb-3 animate-spin" />
        <p className="text-sm">Loading search index...</p>
      </div>
    );
  }
  return (
    <div className="px-5 py-12 text-center text-gray-400">
      <Search size={32} className="mx-auto mb-3" />
      <p className="text-sm font-medium text-gray-500">
        Start typing to search
      </p>
      <p className="text-xs mt-1">
        Search across users, patients, emergencies, events & more
      </p>
    </div>
  );
}

function NoResults({ search, loading }) {
  if (loading) {
    return (
      <div className="px-5 py-12 text-center text-gray-400">
        <Loader2 size={24} className="mx-auto mb-3 animate-spin" />
        <p className="text-sm">Searching...</p>
      </div>
    );
  }
  return (
    <div className="px-5 py-12 text-center text-gray-400">
      <p className="text-sm font-medium text-gray-500">
        No results for "{search}"
      </p>
      <p className="text-xs mt-1">Try a different keyword or shorter search.</p>
    </div>
  );
}

function ShortcutHint({ icon, label }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-xs font-mono">
        {icon}
      </kbd>
      <span>{label}</span>
    </span>
  );
}