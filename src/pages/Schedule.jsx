import { useEffect, useState } from "react";
import {
  Calendar,
  User,
  Phone,
  Save,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const ROLE_FIELDS = [
  { key: "drivers", label: "Drivers", color: "blue" },
  { key: "missionLeaders", label: "Mission Leaders", color: "purple" },
  { key: "emts", label: "EMTs", color: "green" },
  { key: "firstResponders", label: "First Responders", color: "amber" },
];

const emptyDay = () => ({
  teamLeader: "",
  leaderPhone: "",
  drivers: [],
  missionLeaders: [],
  emts: [],
  firstResponders: [],
});

export default function Schedule() {
  const [schedule, setSchedule] = useState({});
  const [activeDay, setActiveDay] = useState("Monday");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    setLoading(true);
    try {
      const result = {};
      for (const day of DAYS) {
        const snap = await getDoc(doc(db, "weekly_schedule", day));
        if (snap.exists()) {
          const data = snap.data();
          result[day] = {
            teamLeader: data.teamLeader || "",
            leaderPhone: data.leaderPhone || "",
            drivers: data.drivers || [],
            missionLeaders: data.missionLeaders || [],
            emts: data.emts || [],
            firstResponders: data.firstResponders || [],
          };
        } else {
          result[day] = emptyDay();
        }
      }
      setSchedule(result);
    } catch (err) {
      console.error("Failed to load schedule:", err);
      setError("Failed to load schedule: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDay(day) {
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "weekly_schedule", day), schedule[day]);
      setSavedNotice(`${day} saved successfully!`);
      setTimeout(() => setSavedNotice(""), 3000);
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateField(day, field, value) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function addToList(day, field, name) {
    if (!name.trim()) return;
    const current = schedule[day][field] || [];
    if (current.includes(name.trim())) return; // no duplicates
    updateField(day, field, [...current, name.trim()]);
  }

  function removeFromList(day, field, index) {
    const current = schedule[day][field] || [];
    updateField(
      day,
      field,
      current.filter((_, i) => i !== index)
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading schedule...
        </div>
      </div>
    );
  }

  const day = schedule[activeDay] || emptyDay();

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Weekly Schedule</h1>
        <p className="text-gray-600 mt-1">
          Set the team for each day. EMTs see this on their mobile app.
        </p>
      </div>

      {/* Success notice */}
      {savedNotice && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle size={18} />
          {savedNotice}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Day tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                activeDay === d
                  ? "text-redcross-600 border-b-2 border-redcross-500 bg-redcross-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Calendar size={14} className="inline mr-2" />
              {d}
            </button>
          ))}
        </div>

        {/* Day content */}
        <div className="p-6">
          {/* Team Leader section */}
          <div className="mb-6 p-4 bg-redcross-50 border border-redcross-200 rounded-lg">
            <h3 className="text-sm font-semibold text-redcross-700 uppercase tracking-wider mb-3">
              👑 Team Leader
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Name
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={day.teamLeader}
                    onChange={(e) =>
                      updateField(activeDay, "teamLeader", e.target.value)
                    }
                    placeholder="Team leader name"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="tel"
                    value={day.leaderPhone}
                    onChange={(e) =>
                      updateField(activeDay, "leaderPhone", e.target.value)
                    }
                    placeholder="Phone number"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Role lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLE_FIELDS.map((role) => (
              <RoleList
                key={role.key}
                label={role.label}
                color={role.color}
                items={day[role.key] || []}
                onAdd={(name) => addToList(activeDay, role.key, name)}
                onRemove={(index) =>
                  removeFromList(activeDay, role.key, index)
                }
              />
            ))}
          </div>

          {/* Save button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => saveDay(activeDay)}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-redcross-500 hover:bg-redcross-600 disabled:bg-gray-400 text-white rounded-lg font-medium"
            >
              <Save size={16} />
              {saving ? "Saving..." : `Save ${activeDay}`}
            </button>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle
          className="text-blue-600 flex-shrink-0 mt-0.5"
          size={18}
        />
        <div className="text-sm text-blue-900">
          <strong>Tip:</strong> Save each day separately. The mobile app reads
          this schedule when EMTs view "Weekly Schedule". Changes appear when
          they refresh.
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Role list (drivers, EMTs, etc.)
// ──────────────────────────────────────────────
function RoleList({ label, color, items, onAdd, onRemove }) {
  const [newName, setNewName] = useState("");

  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };

  const tagClasses = {
    blue: "bg-blue-100 text-blue-800",
    purple: "bg-purple-100 text-purple-800",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
  };

  function handleAdd() {
    onAdd(newName);
    setNewName("");
  }

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <h4 className="text-sm font-semibold uppercase tracking-wider mb-3 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-xs font-normal opacity-70">
          {items.length} {items.length === 1 ? "person" : "people"}
        </span>
      </h4>

      {/* Existing names */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {items.map((name, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm ${tagClasses[color]}`}
            >
              {name}
              <button
                onClick={() => onRemove(i)}
                className="hover:bg-black/10 rounded-full p-0.5"
                title="Remove"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={`Add ${label.toLowerCase().slice(0, -1)}...`}
          className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}