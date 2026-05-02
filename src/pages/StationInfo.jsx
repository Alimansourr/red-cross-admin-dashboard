import { useEffect, useState } from "react";
import {
  Building,
  User,
  Phone,
  Quote,
  Save,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_INFO = {
  stationName: "Station 104",
  headOfStation: "",
  headPhone: "",
  motto: "Hope Comes in Red and White",
};

export default function StationInfo() {
  const [info, setInfo] = useState(DEFAULT_INFO);
  const [original, setOriginal] = useState(DEFAULT_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadInfo();
  }, []);

  async function loadInfo() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "station_info", "config"));
      if (snap.exists()) {
        const data = { ...DEFAULT_INFO, ...snap.data() };
        setInfo(data);
        setOriginal(data);
      }
    } catch (err) {
      console.error("Failed to load station info:", err);
      setError("Failed to load: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "station_info", "config"), info);
      setOriginal(info);
      setSavedNotice("Station info updated successfully!");
      setTimeout(() => setSavedNotice(""), 3000);
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function update(field, value) {
    setInfo((prev) => ({ ...prev, [field]: value }));
  }

  // Detect unsaved changes
  const hasChanges = JSON.stringify(info) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading station info...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Station Info</h1>
        <p className="text-gray-600 mt-1">
          Edit the info displayed on the EMT mobile app dashboard.
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

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <Field
          icon={Building}
          label="Station Name"
          value={info.stationName}
          onChange={(v) => update("stationName", v)}
          placeholder="e.g. Station 104"
          help="The name shown at the top of the EMT mobile dashboard"
        />

        <Field
          icon={User}
          label="Head of Station"
          value={info.headOfStation}
          onChange={(v) => update("headOfStation", v)}
          placeholder="e.g. Ali Al Mokdad"
          help="The person in charge — name shown on EMT dashboard"
        />

        <Field
          icon={Phone}
          label="Head's Phone"
          value={info.headPhone}
          onChange={(v) => update("headPhone", v)}
          placeholder="e.g. 03504469"
          help="Contact number for the head of station"
          type="tel"
        />

        <Field
          icon={Quote}
          label="Station Motto"
          value={info.motto}
          onChange={(v) => update("motto", v)}
          placeholder="e.g. Hope Comes in Red and White"
          help="A short slogan or motto displayed on the dashboard"
        />
      </div>

      {/* Live preview */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          📱 Mobile App Preview
        </h3>
        <div className="bg-gradient-to-br from-redcross-500 to-redcross-700 rounded-2xl p-6 text-white">
          <div className="text-xs opacity-80 mb-1">Welcome to</div>
          <h2 className="text-2xl font-bold mb-1">
            {info.stationName || "Station Name"}
          </h2>
          <p className="text-sm italic opacity-90 mb-4">
            "{info.motto || "Your motto here"}"
          </p>
          <div className="border-t border-white/20 pt-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <User size={14} className="opacity-70" />
              <span className="opacity-90">Head:</span>
              <span className="font-medium">
                {info.headOfStation || "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={14} className="opacity-70" />
              <span className="opacity-90">Phone:</span>
              <span className="font-medium">{info.headPhone || "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {hasChanges ? (
            <span className="text-amber-600 font-medium">
              ● Unsaved changes
            </span>
          ) : (
            <span>All changes saved</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-redcross-500 hover:bg-redcross-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Field component
// ──────────────────────────────────────────────
function Field({ icon: Icon, label, value, onChange, placeholder, help, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
        />
      </div>
      {help && <p className="text-xs text-gray-500 mt-1">{help}</p>}
    </div>
  );
}