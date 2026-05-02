import { useEffect, useState } from "react";
import {
  Building2,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";

export default function Stations() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadStations();
  }, []);

  async function loadStations() {
    setLoading(true);

    try {
      let snap;

      try {
        const q = query(
          collection(db, "station_details"),
          orderBy("stationName")
        );
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, "station_details"));
      }

      setStations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load stations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(station) {
    const newValue = !station.isActive;

    try {
      await updateDoc(doc(db, "station_details", station.id), {
        isActive: newValue,
      });

      setStations((prev) =>
        prev.map((s) =>
          s.id === station.id ? { ...s, isActive: newValue } : s
        )
      );
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "station_details", confirmDelete.id));

      setStations((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  const activeCount = stations.filter((s) => s.isActive).length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stations</h1>
          <p className="text-gray-600 mt-1">
            Manage Red Cross stations. Patients are routed to the nearest active
            station for emergencies.
          </p>
        </div>

        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-redcross-500 hover:bg-redcross-600 text-white rounded-lg font-medium"
        >
          <Plus size={18} />
          New Station
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Stations</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {stations.length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">
            Active (routing emergencies)
          </div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {activeCount}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
        <AlertCircle
          className="text-amber-600 flex-shrink-0 mt-0.5"
          size={18}
        />
        <div className="text-sm text-amber-900">
          <strong>Critical:</strong> When a patient sends an emergency request,
          the system finds the <strong>nearest active station</strong> using the
          GPS coordinates below. Wrong coordinates lead to wrong station
          assigned. Double-check lat/lng before saving.
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading stations...
        </div>
      ) : stations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Building2 className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">No stations yet</p>
          <p className="text-sm mt-1">
            Click "New Station" to add your first station.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              onToggle={() => toggleActive(station)}
              onEdit={() => {
                setEditing(station);
                setShowForm(true);
              }}
              onDelete={() => setConfirmDelete(station)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <StationForm
          station={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={(saved, isNew) => {
            if (isNew) {
              setStations((prev) => [...prev, saved]);
            } else {
              setStations((prev) =>
                prev.map((s) => (s.id === saved.id ? saved : s))
              );
            }

            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Station?"
        maxWidth="max-w-md"
      >
        <p className="text-gray-700 mb-2">
          Delete <strong>"{confirmDelete?.stationName}"</strong>?
        </p>

        <p className="text-sm text-amber-600 mb-4">
          Patients near this station's coordinates will be routed to a different
          station. This cannot be undone.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={handleDelete}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
          >
            Delete Station
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StationCard({ station, onToggle, onEdit, onDelete }) {
  const lat = parseFloat(station.latitude);
  const lng = parseFloat(station.longitude);
  const hasValidCoords = !isNaN(lat) && !isNaN(lng);

  const mapsUrl = hasValidCoords
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  return (
    <div
      className={`bg-white rounded-xl border-2 ${
        station.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
      } p-5 hover:shadow-md transition-shadow`}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-sm font-medium"
          title="Click to toggle"
        >
          {station.isActive ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-green-600" />
              <span className="text-green-700">Active</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <XCircle size={16} className="text-gray-400" />
              <span className="text-gray-500">Inactive</span>
            </span>
          )}
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-gray-100"
            title="Edit"
          >
            <Edit3 size={16} className="text-gray-600" />
          </button>

          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50"
            title="Delete"
          >
            <Trash2 size={16} className="text-red-600" />
          </button>
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
        <Building2 size={18} className="text-redcross-500" />
        {station.stationName || "Unnamed Station"}
      </h3>

      {hasValidCoords ? (
        <div className="space-y-2">
          <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs">
            <div className="text-gray-500 mb-1">GPS Coordinates</div>

            <div className="text-gray-900">
              <span className="text-gray-500">Lat:</span> {lat.toFixed(6)}
            </div>

            <div className="text-gray-900">
              <span className="text-gray-500">Lng:</span> {lng.toFixed(6)}
            </div>
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
          >
            <MapPin size={14} />
            View on Google Maps
            <ExternalLink size={12} />
          </a>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Invalid or missing coordinates. Won't be used for emergency routing.
        </div>
      )}
    </div>
  );
}

function StationForm({ station, onClose, onSaved }) {
  const isEditing = !!station;

  const [form, setForm] = useState({
    stationName: station?.stationName || "",
    latitude: station?.latitude?.toString() || "",
    longitude: station?.longitude?.toString() || "",
    isActive: station?.isActive !== undefined ? station.isActive : true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function isValidCoord(value) {
    if (value === "" || value === null || value === undefined) return false;

    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num);
  }

  async function handleSubmit() {
    if (!form.stationName.trim()) {
      setError("Station name is required.");
      return;
    }

    if (!isValidCoord(form.latitude) || !isValidCoord(form.longitude)) {
      setError("Latitude and longitude must be valid numbers.");
      return;
    }

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);

    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90.");
      return;
    }

    if (lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = {
        stationName: form.stationName.trim(),
        latitude: lat,
        longitude: lng,
        isActive: form.isActive,
      };

      if (isEditing) {
        await updateDoc(doc(db, "station_details", station.id), data);
        onSaved({ ...station, ...data }, false);
      } else {
        const ref = await addDoc(collection(db, "station_details"), data);
        onSaved({ id: ref.id, ...data }, true);
      }
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewUrl =
    isValidCoord(form.latitude) && isValidCoord(form.longitude)
      ? `https://www.google.com/maps?q=${form.latitude},${form.longitude}`
      : null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? "Edit Station" : "New Station"}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Station Name <span className="text-red-500">*</span>
          </label>

          <input
            type="text"
            value={form.stationName}
            onChange={(e) =>
              setForm({ ...form, stationName: e.target.value })
            }
            placeholder="e.g. Red Cross Station 191"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude <span className="text-red-500">*</span>
            </label>

            <input
              type="number"
              step="0.000001"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              placeholder="e.g. 33.888630"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none font-mono"
            />

            <p className="text-xs text-gray-500 mt-1">Between -90 and 90</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude <span className="text-red-500">*</span>
            </label>

            <input
              type="number"
              step="0.000001"
              value={form.longitude}
              onChange={(e) =>
                setForm({ ...form, longitude: e.target.value })
              }
              placeholder="e.g. 35.495480"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none font-mono"
            />

            <p className="text-xs text-gray-500 mt-1">Between -180 and 180</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <strong>How to find coordinates:</strong>

          <ol className="list-decimal list-inside mt-1 space-y-0.5 text-xs">
            <li>
              Open{" "}
              <a
                href="https://www.google.com/maps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-blue-700"
              >
                Google Maps
              </a>
            </li>

            <li>Right-click on the station's location</li>
            <li>Click the coordinates at the top to copy them</li>
            <li>Paste. First number is latitude, second is longitude.</li>
          </ol>
        </div>

        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
          >
            <MapPin size={14} />
            Preview on Google Maps
            <ExternalLink size={12} />
          </a>
        )}

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900 text-sm">
              Active for emergency routing
            </div>

            <div className="text-xs text-gray-500">
              {form.isActive
                ? "This station can be assigned to emergencies"
                : "Excluded from nearest-station search"}
            </div>
          </div>

          <label className="relative inline-block w-11 h-6">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.checked })
              }
              className="opacity-0 w-0 h-0"
            />

            <span
              className={`absolute cursor-pointer inset-0 rounded-full transition-colors ${
                form.isActive ? "bg-redcross-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute h-4 w-4 bg-white rounded-full top-1 transition-transform ${
                  form.isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-redcross-500 hover:bg-redcross-600 disabled:bg-gray-400 text-white rounded-lg font-medium"
          >
            {saving
              ? "Saving..."
              : isEditing
              ? "Save Changes"
              : "Create Station"}
          </button>
        </div>
      </div>
    </Modal>
  );
}