import { useEffect, useState } from "react";
import {
  Megaphone,
  Plus,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";
import { format } from "date-fns";

export default function Announcements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  async function loadAnnouncements() {
    setLoading(true);
    try {
      const q = query(
        collection(db, "announcements"),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load announcements:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(announcement) {
    const newValue = !announcement.isActive;
    try {
      await updateDoc(doc(db, "announcements", announcement.id), {
        isActive: newValue,
      });
      setAnnouncements((prev) =>
        prev.map((a) =>
          a.id === announcement.id ? { ...a, isActive: newValue } : a
        )
      );
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "announcements", confirmDelete.id));
      setAnnouncements((prev) =>
        prev.filter((a) => a.id !== confirmDelete.id)
      );
      setConfirmDelete(null);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  // Stats
  const activeCount = announcements.filter((a) => a.isActive).length;
  const inactiveCount = announcements.filter((a) => !a.isActive).length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Announcements</h1>
          <p className="text-gray-600 mt-1">
            Post messages that appear on the EMT app dashboard.
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
          New Announcement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {announcements.length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Active (visible)</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {activeCount}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Inactive (hidden)</div>
          <div className="text-2xl font-bold text-gray-400 mt-1">
            {inactiveCount}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex gap-3">
        <AlertCircle
          className="text-blue-600 flex-shrink-0 mt-0.5"
          size={18}
        />
        <div className="text-sm text-blue-900">
          <strong>How it works:</strong> Active announcements appear
          immediately on the EMT mobile app dashboard. The mobile app supports
          two colors — <strong>blue</strong> (info) and{" "}
          <strong>yellow</strong> (warning).
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading announcements...
        </div>
      ) : announcements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Megaphone className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">No announcements yet</p>
          <p className="text-sm mt-1">
            Click "New Announcement" to post your first one.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementCard
              key={a.id}
              announcement={a}
              onToggle={() => toggleActive(a)}
              onEdit={() => {
                setEditing(a);
                setShowForm(true);
              }}
              onDelete={() => setConfirmDelete(a)}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <AnnouncementForm
          announcement={editing}
          adminName={profile?.fullName || "Admin"}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={(saved, isNew) => {
            if (isNew) {
              setAnnouncements((prev) => [saved, ...prev]);
            } else {
              setAnnouncements((prev) =>
                prev.map((a) => (a.id === saved.id ? saved : a))
              );
            }
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Announcement?"
        maxWidth="max-w-md"
      >
        <p className="text-gray-700 mb-2">
          Are you sure you want to delete this announcement?
        </p>
        <p className="text-sm text-gray-500 mb-4 italic">
          "{confirmDelete?.text}"
        </p>
        <p className="text-sm text-amber-600 mb-4">
          This action cannot be undone.
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
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────
// Announcement Card
// ──────────────────────────────────────────────
function AnnouncementCard({ announcement, onToggle, onEdit, onDelete }) {
  const colorStyles = {
    blue: {
      border: "border-blue-300",
      bg: "bg-blue-50",
      dot: "bg-blue-500",
      label: "Info",
    },
    yellow: {
      border: "border-yellow-300",
      bg: "bg-yellow-50",
      dot: "bg-yellow-500",
      label: "Warning",
    },
  };
  const style = colorStyles[announcement.color] || colorStyles.yellow;
  const isActive = announcement.isActive;

  const time = announcement.createdAt?.toDate
    ? format(announcement.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
    : "Just now";

  return (
    <div
      className={`bg-white rounded-xl border-2 ${
        isActive ? style.border : "border-gray-200"
      } ${isActive ? style.bg : "bg-gray-50"} p-5 transition-opacity ${
        !isActive && "opacity-60"
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Color dot */}
        <div
          className={`w-3 h-3 rounded-full ${style.dot} mt-2 flex-shrink-0`}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                announcement.color === "blue"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {style.label}
            </span>
            {isActive ? (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
                Visible on mobile
              </span>
            ) : (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">
                Hidden
              </span>
            )}
          </div>

          <p className="text-gray-900 mb-3 whitespace-pre-wrap">
            {announcement.text}
          </p>

          <div className="text-xs text-gray-500">
            Posted by <strong>{announcement.postedBy || "Unknown"}</strong> ·{" "}
            {time}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            title={isActive ? "Hide from mobile" : "Show on mobile"}
          >
            {isActive ? (
              <Eye size={18} className="text-gray-600" />
            ) : (
              <EyeOff size={18} className="text-gray-400" />
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            title="Edit"
          >
            <Edit3 size={18} className="text-gray-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-red-100 transition-colors"
            title="Delete"
          >
            <Trash2 size={18} className="text-red-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Announcement Form (Create / Edit)
// ──────────────────────────────────────────────
function AnnouncementForm({ announcement, adminName, onClose, onSaved }) {
  const isEditing = !!announcement;
  const [text, setText] = useState(announcement?.text || "");
  const [color, setColor] = useState(announcement?.color || "yellow");
  const [isActive, setIsActive] = useState(
    announcement?.isActive !== undefined ? announcement.isActive : true
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!text.trim()) {
      setError("Announcement text cannot be empty.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (isEditing) {
        // Update existing
        const updates = {
          text: text.trim(),
          color,
          isActive,
        };
        await updateDoc(doc(db, "announcements", announcement.id), updates);
        onSaved({ ...announcement, ...updates }, false);
      } else {
        // Create new
        const newDoc = {
          text: text.trim(),
          color,
          isActive,
          postedBy: adminName,
          createdAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, "announcements"), newDoc);
        // serverTimestamp() returns null in client until refresh — use Date for now
        onSaved(
          { id: ref.id, ...newDoc, createdAt: { toDate: () => new Date() } },
          true
        );
      }
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? "Edit Announcement" : "New Announcement"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="e.g. Station 191 will be out of service tomorrow for maintenance."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            {text.length} characters · Visible to all EMTs on the mobile app
          </p>
        </div>

        {/* Color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <ColorOption
              value="yellow"
              currentValue={color}
              onChange={setColor}
              label="Warning"
              description="General notices, schedule changes"
              colorClass="bg-yellow-50 border-yellow-300"
              dotClass="bg-yellow-500"
            />
            <ColorOption
              value="blue"
              currentValue={color}
              onChange={setColor}
              label="Info"
              description="Updates, news, information"
              colorClass="bg-blue-50 border-blue-300"
              dotClass="bg-blue-500"
            />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900 text-sm">
              Show on mobile app
            </div>
            <div className="text-xs text-gray-500">
              {isActive
                ? "Will be visible to EMTs immediately"
                : "Will be saved but hidden"}
            </div>
          </div>
          <label className="relative inline-block w-11 h-6">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="opacity-0 w-0 h-0"
            />
            <span
              className={`absolute cursor-pointer inset-0 rounded-full transition-colors ${
                isActive ? "bg-redcross-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute h-4 w-4 bg-white rounded-full top-1 transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </span>
          </label>
        </div>

        {/* Preview */}
        {text.trim() && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview (how it'll look on mobile)
            </label>
            <div
              className={`border-2 rounded-2xl p-4 ${
                color === "blue"
                  ? "bg-blue-50 border-blue-300"
                  : "bg-yellow-50 border-yellow-300"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                    color === "blue" ? "bg-blue-500" : "bg-yellow-500"
                  }`}
                />
                <p className="text-gray-900 whitespace-pre-wrap flex-1">
                  {text}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
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
              : "Post Announcement"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ColorOption({
  value,
  currentValue,
  onChange,
  label,
  description,
  colorClass,
  dotClass,
}) {
  const isSelected = value === currentValue;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`text-left p-3 rounded-lg border-2 transition-all ${
        isSelected
          ? `${colorClass} ring-2 ring-offset-2 ring-redcross-500`
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-3 h-3 rounded-full ${dotClass}`} />
        <span className="font-medium text-gray-900 text-sm">{label}</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  );
}