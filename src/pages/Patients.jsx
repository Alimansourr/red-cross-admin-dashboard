import { useEffect, useState } from "react";
import {
  Search,
  Filter,
  Heart,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Droplet,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
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
import Modal from "../components/Modal";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState(null); // patient being viewed

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    setLoading(true);
    try {
      // Try ordering by fullName, fallback to no order if field missing
      let snap;
      try {
        const q = query(collection(db, "patients"), orderBy("fullName"));
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, "patients"));
      }
      setPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load patients:", err);
    } finally {
      setLoading(false);
    }
  }

  // Apply search + filters
  const filtered = patients.filter((p) => {
    const matchesSearch =
      !search ||
      p.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase()) ||
      p.phone?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.isActive !== false) ||
      (statusFilter === "inactive" && p.isActive === false);
    return matchesSearch && matchesStatus;
  });

  async function toggleActive(patient) {
    const newValue = !(patient.isActive !== false);
    try {
      await updateDoc(doc(db, "patients", patient.id), { isActive: newValue });
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id ? { ...p, isActive: newValue } : p
        )
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
          <h1 className="text-3xl font-bold text-gray-900">Patients</h1>
          <p className="text-gray-600 mt-1">
            View registered patients and their medical info. {filtered.length}{" "}
            of {patients.length} shown.
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
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
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

      {/* Patients table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading patients...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Heart className="mx-auto mb-3" size={40} />
            <p>No patients match your filters</p>
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
                    Contact
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Blood Type
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
                {filtered.map((p) => {
                  const isActive = p.isActive !== false;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold text-sm">
                            {(p.fullName || p.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {p.fullName || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{p.email || "—"}</div>
                        <div className="text-xs text-gray-500">
                          {p.phone || "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {p.age || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {p.bloodType ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium font-mono">
                            <Droplet size={10} />
                            {p.bloodType}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleActive(p)}
                          className="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
                          title="Click to toggle"
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
                          onClick={() => setViewing(p)}
                          className="inline-flex items-center gap-1 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
                        >
                          <Eye size={14} />
                          View
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

      {/* Patient detail modal */}
      <PatientDetailModal
        patient={viewing}
        onClose={() => setViewing(null)}
      />
    </div>
  );
}

// ──────────────────────────────────────────────
// Patient Detail Modal
// ──────────────────────────────────────────────
function PatientDetailModal({ patient, onClose }) {
  if (!patient) return null;

  const isActive = patient.isActive !== false;

  return (
    <Modal
      isOpen={!!patient}
      onClose={onClose}
      title="Patient Details"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Header with avatar */}
        <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-2xl">
            {(patient.fullName || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900">
              {patient.fullName || "—"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {isActive ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  <CheckCircle2 size={10} />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                  <XCircle size={10} />
                  Inactive
                </span>
              )}
              <span className="text-xs text-gray-400 font-mono">
                ID: {patient.id.slice(0, 12)}...
              </span>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <Section title="Contact Information">
          <InfoRow icon={Mail} label="Email" value={patient.email} />
          <InfoRow icon={Phone} label="Phone" value={patient.phone} />
          <InfoRow icon={MapPin} label="Address" value={patient.address} />
        </Section>

        {/* Personal info */}
        <Section title="Personal Information">
          <InfoRow icon={Calendar} label="Age" value={patient.age} />
          <InfoRow
            icon={Droplet}
            label="Blood Type"
            value={patient.bloodType}
            valueClassName="font-mono font-semibold text-red-600"
          />
          {patient.gender && (
            <InfoRow icon={null} label="Gender" value={patient.gender} />
          )}
          {patient.dateOfBirth && (
            <InfoRow
              icon={Calendar}
              label="Date of Birth"
              value={patient.dateOfBirth}
            />
          )}
        </Section>

        {/* Medical history */}
        <Section title="Medical Information" warning>
          {patient.medicalHistory ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2 mb-2">
                <FileText size={16} className="text-red-600 mt-0.5" />
                <div className="font-medium text-red-900">Medical History</div>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {patient.medicalHistory}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              No medical history on file
            </p>
          )}

          {patient.allergies && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-3">
              <div className="font-medium text-amber-900 mb-1">⚠️ Allergies</div>
              <p className="text-sm text-gray-700">{patient.allergies}</p>
            </div>
          )}

          {patient.medications && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
              <div className="font-medium text-blue-900 mb-1">
                💊 Current Medications
              </div>
              <p className="text-sm text-gray-700">{patient.medications}</p>
            </div>
          )}
        </Section>

        {/* Emergency contact */}
        {(patient.emergencyContactName ||
          patient.emergencyContactPhone) && (
          <Section title="Emergency Contact">
            <InfoRow
              icon={null}
              label="Name"
              value={patient.emergencyContactName}
            />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={patient.emergencyContactPhone}
            />
          </Section>
        )}

        {/* Show ALL remaining fields we didn't account for (debugging-friendly) */}
        <Section title="Additional Data">
          <RemainingFields patient={patient} />
        </Section>

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

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────
function Section({ title, warning, children }) {
  return (
    <div>
      <h4
        className={`text-sm font-semibold uppercase tracking-wider mb-3 ${
          warning ? "text-red-600" : "text-gray-500"
        }`}
      >
        {warning && "🔒 "}
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, valueClassName = "" }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-32 flex items-center gap-2 text-sm text-gray-500 pt-0.5">
        {Icon && <Icon size={14} />}
        <span>{label}</span>
      </div>
      <div className={`flex-1 text-sm text-gray-900 ${valueClassName}`}>
        {value || <span className="text-gray-400">—</span>}
      </div>
    </div>
  );
}

// Display any fields we don't explicitly handle, so admin sees everything
function RemainingFields({ patient }) {
  const known = new Set([
    "id",
    "fullName",
    "email",
    "phone",
    "address",
    "age",
    "bloodType",
    "gender",
    "dateOfBirth",
    "medicalHistory",
    "allergies",
    "medications",
    "emergencyContactName",
    "emergencyContactPhone",
    "isActive",
  ]);

  const extras = Object.entries(patient).filter(
    ([key, value]) =>
      !known.has(key) && value !== null && value !== undefined && value !== ""
  );

  if (extras.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No additional fields</p>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      {extras.map(([key, value]) => (
        <div key={key} className="flex items-start gap-3 text-sm">
          <div className="w-40 text-gray-500 font-mono text-xs">{key}</div>
          <div className="flex-1 text-gray-700 break-words">
            {typeof value === "object"
              ? JSON.stringify(value)
              : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}