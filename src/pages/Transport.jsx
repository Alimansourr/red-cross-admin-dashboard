import { useEffect, useState } from "react";
import {
  Truck,
  Phone,
  MapPin,
  Clock,
  Search,
  Filter,
  ExternalLink,
  Calendar as CalendarIcon,
  Building2,
  Mail,
  Heart,
  Droplet,
  FileText,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import Modal from "../components/Modal";
import { format, formatDistanceToNow } from "date-fns";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "amber" },
  { value: "approved", label: "Approved", color: "blue" },
  { value: "completed", label: "Completed", color: "green" },
  { value: "cancelled", label: "Cancelled", color: "gray" },
];

export default function Transport() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "transport_requests"), orderBy("createdAt", "desc")),
      (snap) => {
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("transport_requests listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;

    if (search.trim()) {
      const term = search.toLowerCase();

      const fields = [
        r.patientName,
        r.transportType,
        r.pickupLocation,
        r.destination,
        r.assignedStationName,
      ];

      if (!fields.some((f) => String(f || "").toLowerCase().includes(term))) {
        return false;
      }
    }

    return true;
  });

  async function updateStatus(req, newStatus) {
    try {
      await updateDoc(doc(db, "transport_requests", req.id), {
        status: newStatus,
        statusUpdatedAt: new Date(),
      });
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="text-redcross-500" size={28} />
          Transport Requests
        </h1>

        <p className="text-gray-600 mt-1">
          Scheduled patient transport requests.
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Real-time
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Requests</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            {requests.length}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Pending</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {pendingCount}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Completed</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {requests.filter((r) => r.status === "completed").length}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search by patient, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none text-sm"
          >
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Connecting to live feed...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Truck className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">No transport requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <TransportCard
              key={req.id}
              request={req}
              onView={() => setViewing(req)}
              onStatusChange={(s) => updateStatus(req, s)}
            />
          ))}
        </div>
      )}

      {viewing && (
        <TransportDetailModal
          request={viewing}
          onClose={() => setViewing(null)}
          onStatusChange={(s) => updateStatus(viewing, s)}
        />
      )}
    </div>
  );
}

function TransportCard({ request, onView, onStatusChange }) {
  const time = request.createdAt?.toDate
    ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })
    : "—";

  const isPending = request.status === "pending";

  return (
    <div
      className={`bg-white rounded-xl border-2 p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isPending ? "border-amber-300" : "border-gray-200"
      }`}
      onClick={onView}
    >
      <div className="flex items-start gap-4">
        <StatusBadge status={request.status} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 mb-1">
            {request.patientName || "Unknown"}{" "}
            <span className="text-gray-400 font-normal text-sm">
              · {request.transportType || "Transport"}
            </span>
          </div>

          <div className="text-sm text-gray-700 mb-2">
            <span className="text-gray-500">From:</span>{" "}
            <strong>{request.pickupLocation || "—"}</strong>
            <span className="text-gray-400 mx-2">→</span>
            <span className="text-gray-500">To:</span>{" "}
            <strong>{request.destination || "—"}</strong>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            {request.preferredDate && (
              <span className="flex items-center gap-1">
                <CalendarIcon size={12} />
                {request.preferredDate}
                {request.preferredTime && ` at ${request.preferredTime}`}
              </span>
            )}

            <span className="flex items-center gap-1">
              <Clock size={12} />
              Submitted {time}
            </span>

            {request.assignedStationName && (
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {request.assignedStationName}
              </span>
            )}
          </div>
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <select
            value={request.status || "pending"}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config =
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

  const colors = {
    amber: "bg-amber-100 text-amber-700 border-amber-300",
    blue: "bg-blue-100 text-blue-700 border-blue-300",
    green: "bg-green-100 text-green-700 border-green-300",
    gray: "bg-gray-100 text-gray-700 border-gray-300",
  };

  return (
    <div
      className={`px-3 py-1 rounded-full border text-xs font-semibold ${
        colors[config.color]
      }`}
    >
      {config.label}
    </div>
  );
}

function TransportDetailModal({ request, onClose, onStatusChange }) {
  const lat = request.requestLatitude;
  const lng = request.requestLongitude;

  const hasValidLocation =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  const mapsUrl = hasValidLocation
    ? `https://maps.google.com/?q=${Number(lat)},${Number(lng)}`
    : null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Transport Request — ${request.patientName || "Unknown"}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <StatusBadge status={request.status} />
          </div>

          <select
            value={request.status || "pending"}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                Set to {s.label}
              </option>
            ))}
          </select>
        </div>

        <Section title="Transport Details" icon={Truck}>
          <Row label="Type" value={request.transportType} />
          <Row label="Pickup" value={request.pickupLocation} icon={MapPin} />
          <Row label="Destination" value={request.destination} icon={MapPin} />
          <Row
            label="Preferred Date"
            value={request.preferredDate}
            icon={CalendarIcon}
          />
          <Row
            label="Preferred Time"
            value={request.preferredTime}
            icon={Clock}
          />
          <Row label="Notes" value={request.notes} />
        </Section>

        <Section title="Patient Information" icon={Heart}>
          <Row label="Name" value={request.patientName} icon={Heart} />
          <Row
            label="Phone"
            value={request.patientProfilePhone}
            icon={Phone}
            link="tel"
          />
          <Row label="Email" value={request.patientEmail} icon={Mail} />
          <Row label="Address" value={request.patientAddress} icon={MapPin} />
          <Row label="Age" value={request.patientAge} />
          <Row
            label="Blood Type"
            value={request.patientBloodType}
            icon={Droplet}
          />
        </Section>

        {request.patientMedicalHistory && (
          <Section title="Medical History" icon={FileText} sensitive>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {request.patientMedicalHistory}
            </p>
          </Section>
        )}

        <Section title="Request Origin" icon={MapPin}>
          {hasValidLocation ? (
            <div className="flex items-start justify-between gap-4">
              <div className="font-mono text-sm bg-white rounded p-2 flex-1">
                <div>
                  <span className="text-gray-500">Lat:</span>{" "}
                  {Number(lat).toFixed(6)}
                </div>

                <div>
                  <span className="text-gray-500">Lng:</span>{" "}
                  {Number(lng).toFixed(6)}
                </div>
              </div>

              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-redcross-500 hover:bg-redcross-600 text-white text-sm rounded-lg font-medium whitespace-nowrap"
                >
                  Open Map
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No GPS info.</p>
          )}

          <Row
            label="Assigned Station"
            value={request.assignedStationName}
            className="mt-2"
          />
        </Section>

        <Section title="Timeline" icon={Clock}>
          <Row
            label="Submitted"
            value={
              request.createdAt?.toDate
                ? format(request.createdAt.toDate(), "MMM d, yyyy 'at' h:mm a")
                : "—"
            }
          />

          {request.statusUpdatedAt && (
            <Row
              label="Last Updated"
              value={
                request.statusUpdatedAt?.toDate
                  ? format(
                      request.statusUpdatedAt.toDate(),
                      "MMM d, yyyy 'at' h:mm a"
                    )
                  : "—"
              }
            />
          )}
        </Section>

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

function Section({ title, icon: Icon, sensitive, children }) {
  return (
    <div>
      <h4
        className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1 ${
          sensitive ? "text-red-600" : "text-gray-500"
        }`}
      >
        {Icon && <Icon size={12} />}
        {title}
      </h4>

      <div
        className={`rounded-lg p-3 space-y-1 ${
          sensitive ? "bg-red-50 border border-red-200" : "bg-gray-50"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon, link, className = "" }) {
  if (!value && value !== 0) {
    return (
      <div className={`flex items-start gap-3 text-sm ${className}`}>
        <span className="w-32 text-gray-500 flex items-center gap-1">
          {Icon && <Icon size={12} />}
          {label}:
        </span>

        <span className="text-gray-400">—</span>
      </div>
    );
  }

  if (link === "tel") {
    return (
      <div className={`flex items-start gap-3 text-sm ${className}`}>
        <span className="w-32 text-gray-500 flex items-center gap-1">
          {Icon && <Icon size={12} />}
          {label}:
        </span>

        <a
          href={`tel:${value}`}
          className="text-redcross-600 hover:text-redcross-700 font-medium"
        >
          {value}
        </a>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 text-sm ${className}`}>
      <span className="w-32 text-gray-500 flex items-center gap-1">
        {Icon && <Icon size={12} />}
        {label}:
      </span>

      <span className="text-gray-900 font-medium flex-1 break-words">
        {String(value)}
      </span>
    </div>
  );
}