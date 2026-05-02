import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  Users as UsersIcon,
  Shield,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import Modal from "../components/Modal";

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all"); // all | emt | admin
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [editing, setEditing] = useState(null); // user being edited

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), orderBy("fullName"));
      const snap = await getDocs(q);
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  }

  // Apply search + filters
  const filtered = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && u.isActive !== false) ||
      (statusFilter === "inactive" && u.isActive === false);
    return matchesSearch && matchesRole && matchesStatus;
  });

  async function toggleActive(user) {
    const newValue = !(user.isActive !== false); // flip current state
    try {
      await updateDoc(doc(db, "users", user.id), { isActive: newValue });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: newValue } : u))
      );
    } catch (err) {
      alert("Failed to update: " + err.message);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users (EMTs)</h1>
          <p className="text-gray-600 mt-1">
            Manage EMTs and admins. {filtered.length} of {users.length} shown.
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none text-sm"
          >
            <option value="all">All Roles</option>
            <option value="emt">EMT</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading users...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <UsersIcon className="mx-auto mb-3" size={40} />
            <p>No users match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => {
                  const isActive = u.isActive !== false;
                  const isCurrent = u.id === currentUser?.uid;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-redcross-100 text-redcross-600 flex items-center justify-center font-semibold text-sm">
                            {(u.fullName || u.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {u.fullName || "—"}
                              {isCurrent && (
                                <span className="ml-2 text-xs text-gray-400">
                                  (you)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              @{u.username || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {u.email}
                      </td>
                      <td className="px-6 py-4">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {u.team || "—"}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => !isCurrent && toggleActive(u)}
                          disabled={isCurrent}
                          className={`flex items-center gap-1.5 text-sm font-medium ${
                            isCurrent
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer"
                          }`}
                          title={
                            isCurrent
                              ? "You can't deactivate yourself"
                              : "Click to toggle"
                          }
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2
                                size={16}
                                className="text-green-600"
                              />
                              <span className="text-green-700">Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} className="text-gray-400" />
                              <span className="text-gray-500">Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setEditing(u)}
                          className="inline-flex items-center gap-1 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit modal */}
      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? updated : u))
          );
          setEditing(null);
        }}
        currentUserId={currentUser?.uid}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Role Badge
// ──────────────────────────────────────────────
function RoleBadge({ role }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
        <Shield size={12} />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
      EMT
    </span>
  );
}

// ──────────────────────────────────────────────
// Edit Modal
// ──────────────────────────────────────────────
function EditUserModal({ user, onClose, onSaved, currentUserId }) {
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    role: "emt",
    team: "",
    subcode: "",
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // When user prop changes, populate form
  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || "",
        username: user.username || "",
        role: user.role || "emt",
        team: user.team || "",
        subcode: user.subcode || "",
        isActive: user.isActive !== false,
      });
      setError("");
    }
  }, [user]);

  if (!user) return null;

  const isCurrent = user.id === currentUserId;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updates = {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        role: form.role,
        team: form.team.trim(),
        subcode: form.subcode.trim(),
        isActive: form.isActive,
      };
      await updateDoc(doc(db, "users", user.id), updates);
      onSaved({ ...user, ...updates });
    } catch (err) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={!!user} onClose={onClose} title="Edit User" maxWidth="max-w-xl">
      <div className="space-y-4">
        {/* Email is read-only - tied to Firebase Auth */}
        <Field label="Email (cannot be changed)">
          <input
            type="email"
            value={user.email || ""}
            disabled
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name">
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            />
          </Field>

          <Field label="Username">
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              disabled={isCurrent}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            >
              <option value="emt">EMT</option>
              <option value="admin">Admin</option>
            </select>
            {isCurrent && (
              <p className="text-xs text-gray-500 mt-1">
                You can't change your own role
              </p>
            )}
          </Field>

          <Field label="Team (Day)">
            <select
              value={form.team}
              onChange={(e) => setForm({ ...form, team: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            >
              <option value="">— None —</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </Field>
        </div>

        <Field label="Subcode (used to sign forms)">
          <input
            type="text"
            value={form.subcode}
            onChange={(e) => setForm({ ...form, subcode: e.target.value })}
            placeholder="e.g. ABC123"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            ⚠️ Changing this affects the EMT's ability to sign forms in the
            mobile app. Inform them after change.
          </p>
        </Field>

        <Field label="Status">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm({ ...form, isActive: e.target.checked })
              }
              disabled={isCurrent}
              className="w-4 h-4 rounded text-redcross-500 focus:ring-redcross-500"
            />
            <span className="text-sm text-gray-700">
              Account is active
            </span>
            {isCurrent && (
              <span className="text-xs text-gray-500">
                (you can't deactivate yourself)
              </span>
            )}
          </label>
        </Field>

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
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-redcross-500 hover:bg-redcross-600 disabled:bg-gray-400 text-white rounded-lg font-medium"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}