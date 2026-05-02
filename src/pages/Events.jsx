import { useEffect, useState } from "react";
import {
  Calendar,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  Users,
  Eye,
  EyeOff,
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
} from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";
import { format, parseISO, isBefore } from "date-fns";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all | upcoming | past | inactive
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null); // event whose registrations we're viewing
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      // Order by date descending (newest first)
      let snap;
      try {
        const q = query(collection(db, "events"), orderBy("date", "desc"));
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, "events"));
      }
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(event) {
    const newValue = !event.isActive;
    try {
      await updateDoc(doc(db, "events", event.id), { isActive: newValue });
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, isActive: newValue } : e))
      );
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      // Note: deleting an event does NOT auto-delete its registrations subcollection
      // For a school project this is acceptable. For production you'd use a Cloud Function.
      await deleteDoc(doc(db, "events", confirmDelete.id));
      setEvents((prev) => prev.filter((e) => e.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  // Apply filter
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filtered = events.filter((e) => {
    if (filter === "all") return true;
    if (filter === "inactive") return !e.isActive;

    const eventDate = e.date ? parseDateLoose(e.date) : null;
    if (!eventDate) return filter === "upcoming"; // missing date = treat as upcoming

    if (filter === "upcoming") return !isBefore(eventDate, today) && e.isActive;
    if (filter === "past") return isBefore(eventDate, today);
    return true;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">
            Manage training events and view EMT registrations.
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
          New Event
        </button>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 mb-4 inline-flex gap-1">
        <FilterTab
          label="All"
          value="all"
          active={filter}
          onClick={setFilter}
          count={events.length}
        />
        <FilterTab
          label="Upcoming"
          value="upcoming"
          active={filter}
          onClick={setFilter}
          count={
            events.filter((e) => {
              const d = e.date ? parseDateLoose(e.date) : null;
              return e.isActive && (!d || !isBefore(d, today));
            }).length
          }
        />
        <FilterTab
          label="Past"
          value="past"
          active={filter}
          onClick={setFilter}
          count={
            events.filter((e) => {
              const d = e.date ? parseDateLoose(e.date) : null;
              return d && isBefore(d, today);
            }).length
          }
        />
        <FilterTab
          label="Hidden"
          value="inactive"
          active={filter}
          onClick={setFilter}
          count={events.filter((e) => !e.isActive).length}
        />
      </div>

      {/* Event grid */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Loading events...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Calendar className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">No events to show</p>
          <p className="text-sm mt-1">
            {filter === "all"
              ? 'Click "New Event" to create your first one.'
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onToggle={() => toggleActive(event)}
              onEdit={() => {
                setEditing(event);
                setShowForm(true);
              }}
              onDelete={() => setConfirmDelete(event)}
              onViewRegistrations={() => setViewing(event)}
            />
          ))}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <EventForm
          event={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={(saved, isNew) => {
            if (isNew) {
              setEvents((prev) => [saved, ...prev]);
            } else {
              setEvents((prev) =>
                prev.map((e) => (e.id === saved.id ? saved : e))
              );
            }
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {/* Registrations modal */}
      {viewing && (
        <RegistrationsModal
          event={viewing}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Delete confirmation */}
      <Modal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Event?"
        maxWidth="max-w-md"
      >
        <p className="text-gray-700 mb-2">
          Are you sure you want to delete{" "}
          <strong>"{confirmDelete?.title}"</strong>?
        </p>
        <p className="text-sm text-amber-600 mb-4">
          ⚠️ This will remove the event from the mobile app, but existing
          registrations will not be deleted from the database.
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
            Delete Event
          </button>
        </div>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// Parse various date formats: "2025-12-25", "2025-12-25T10:00", etc.
function parseDateLoose(dateStr) {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
}

function formatEventDate(dateStr) {
  const d = parseDateLoose(dateStr);
  if (!d) return dateStr || "—";
  return format(d, "EEE, MMM d, yyyy");
}

// ──────────────────────────────────────────────
// Filter Tab
// ──────────────────────────────────────────────
function FilterTab({ label, value, active, onClick, count }) {
  const isActive = active === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-redcross-500 text-white"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}{" "}
      <span
        className={`text-xs ml-1 ${
          isActive ? "text-white/80" : "text-gray-400"
        }`}
      >
        ({count})
      </span>
    </button>
  );
}

// ──────────────────────────────────────────────
// Event Card
// ──────────────────────────────────────────────
function EventCard({ event, onToggle, onEdit, onDelete, onViewRegistrations }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = parseDateLoose(event.date);
  const isPast = eventDate && isBefore(eventDate, today);

  return (
    <div
      className={`bg-white rounded-xl border-2 ${
        event.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
      } p-5 hover:shadow-md transition-shadow`}
    >
      {/* Status badges */}
      <div className="flex items-center gap-2 mb-3">
        {event.isActive ? (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">
            Visible on mobile
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600">
            Hidden
          </span>
        )}
        {isPast && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
            Past
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        {event.title || "Untitled Event"}
      </h3>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {event.description}
        </p>
      )}

      {/* Date + Location */}
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={14} className="text-gray-400" />
          {formatEventDate(event.date)}
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400" />
            {event.location}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <button
          onClick={onViewRegistrations}
          className="inline-flex items-center gap-1.5 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
        >
          <Users size={14} />
          Registrations
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100"
            title={event.isActive ? "Hide" : "Show"}
          >
            {event.isActive ? (
              <Eye size={16} className="text-gray-600" />
            ) : (
              <EyeOff size={16} className="text-gray-400" />
            )}
          </button>
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
    </div>
  );
}

// ──────────────────────────────────────────────
// Event Form (Create / Edit)
// ──────────────────────────────────────────────
function EventForm({ event, onClose, onSaved }) {
  const isEditing = !!event;
  const [form, setForm] = useState({
    title: event?.title || "",
    description: event?.description || "",
    date: event?.date || "",
    location: event?.location || "",
    isActive: event?.isActive !== undefined ? event.isActive : true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim()) {
      setError("Event title is required.");
      return;
    }
    if (!form.date) {
      setError("Event date is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = {
        title: form.title.trim(),
        description: form.description.trim(),
        date: form.date, // Stored as string "YYYY-MM-DD"
        location: form.location.trim(),
        isActive: form.isActive,
      };

      if (isEditing) {
        await updateDoc(doc(db, "events", event.id), data);
        onSaved({ ...event, ...data }, false);
      } else {
        const ref = await addDoc(collection(db, "events"), data);
        onSaved({ id: ref.id, ...data }, true);
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
      title={isEditing ? "Edit Event" : "New Event"}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Event Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. CPR Refresher Training"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            rows={3}
            placeholder="What's the event about? Who should attend?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Station 191"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900 text-sm">
              Show on mobile app
            </div>
            <div className="text-xs text-gray-500">
              {form.isActive
                ? "EMTs can see and sign up for this event"
                : "Saved but hidden from EMTs"}
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
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Create Event"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────
// Registrations Modal — view who signed up
// ──────────────────────────────────────────────
function RegistrationsModal({ event, onClose }) {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRegistrations() {
    setLoading(true);
    try {
      const snap = await getDocs(
        collection(db, "events", event.id, "registrations")
      );
      const regs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by signedUpAt descending (newest first)
      regs.sort((a, b) => {
        const aTime = a.signedUpAt?.seconds || 0;
        const bTime = b.signedUpAt?.seconds || 0;
        return bTime - aTime;
      });
      setRegistrations(regs);
    } catch (err) {
      console.error("Failed to load registrations:", err);
    } finally {
      setLoading(false);
    }
  }

  async function removeRegistration(reg) {
    if (
      !window.confirm(
        `Remove ${reg.fullName || "this user"}'s registration? This cannot be undone.`
      )
    )
      return;

    setRemoving(reg.id);
    try {
      await deleteDoc(doc(db, "events", event.id, "registrations", reg.id));
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    } catch (err) {
      alert("Failed to remove: " + err.message);
    } finally {
      setRemoving(null);
    }
  }

  function exportCSV() {
    if (registrations.length === 0) return;

    const headers = ["Name", "Email", "Role", "Team", "Signed up at"];
    const rows = registrations.map((r) => [
      r.fullName || "",
      r.email || "",
      r.role || "",
      r.team || "",
      r.signedUpAt?.toDate
        ? format(r.signedUpAt.toDate(), "yyyy-MM-dd HH:mm")
        : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, "_")}_registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Registrations: ${event.title}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Event summary */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar size={14} className="text-gray-400" />
            {formatEventDate(event.date)}
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-gray-700 mt-1">
              <MapPin size={14} className="text-gray-400" />
              {event.location}
            </div>
          )}
        </div>

        {/* Stats + Export */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <strong className="text-gray-900 text-lg">
              {registrations.length}
            </strong>{" "}
            {registrations.length === 1 ? "person" : "people"} signed up
          </div>
          {registrations.length > 0 && (
            <button
              onClick={exportCSV}
              className="text-sm text-redcross-600 hover:text-redcross-700 font-medium"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading registrations...
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users className="mx-auto mb-2" size={32} />
            <p className="text-sm">No one has signed up yet.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Role
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Team
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Signed up
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {reg.fullName || "—"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {reg.email || ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {reg.role === "admin" ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          Admin
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          EMT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {reg.team || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {reg.signedUpAt?.toDate
                        ? format(reg.signedUpAt.toDate(), "MMM d, h:mm a")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeRegistration(reg)}
                        disabled={removing === reg.id}
                        className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                        title="Remove registration"
                      >
                        {removing === reg.id ? "Removing..." : "Remove"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-redcross-500 hover:bg-redcross-600 text-white rounded-lg font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}