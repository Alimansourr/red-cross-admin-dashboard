import { useEffect, useState } from "react";
import {
  Siren,
  Phone,
  MapPin,
  Clock,
  Search,
  Filter,
  ExternalLink,
  AlertTriangle,
  Activity,
  Heart,
  Building2,
  Mail,
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
  { value: "dispatched", label: "Dispatched", color: "blue" },
  { value: "completed", label: "Completed", color: "green" },
  { value: "cancelled", label: "Cancelled", color: "gray" },
];

export default function Emergencies() {
  const [regular, setRegular] = useState([]);
  const [quick, setQuick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "emergency_requests"), orderBy("createdAt", "desc")),
      (snap) => {
        setRegular(
          snap.docs.map((d) => ({
            id: d.id,
            _source: "regular",
            ...d.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("emergency_requests listener error:", err);
        setLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      query(
        collection(db, "quick_emergency_requests"),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setQuick(
          snap.docs.map((d) => ({
            id: d.id,
            _source: "quick",
            ...d.data(),
          }))
        );
      },
      (err) => {
        console.error("quick_emergency_requests listener error:", err);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const all = [...regular, ...quick].sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });

  const filtered = all.filter((req) => {
    if (sourceFilter !== "all" && req._source !== sourceFilter) return false;

    if (statusFilter !== "all" && req.status !== statusFilter) return false;

    if (search.trim()) {
      const term = search.toLowerCase();

      const fields = [
        req.patientName,
        req.emergencyType,
        req.currentCondition,
        req.assignedStationName,
        req.patientProfilePhone,
        req.patientEmail,
      ];

      if (!fields.some((f) => String(f || "").toLowerCase().includes(term))) {
        return false;
      }
    }

    return true;
  });

  async function updateStatus(req, newStatus) {
    const collectionName =
      req._source === "quick"
        ? "quick_emergency_requests"
        : "emergency_requests";

    try {
      await updateDoc(doc(db, collectionName, req.id), {
        status: newStatus,
        statusUpdatedAt: new Date(),
      });
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  }

  const pendingCount = all.filter((r) => r.status === "pending").length;

  const todayCount = all.filter((r) => {
    if (!r.createdAt?.toDate) return false;

    const reqDate = r.createdAt.toDate();
    const today = new Date();

    return (
      reqDate.getDate() === today.getDate() &&
      reqDate.getMonth() === today.getMonth() &&
      reqDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const quickCount = all.filter((r) => r._source === "quick").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Siren className="text-redcross-500" size={28} />
            Emergency Requests
          </h1>

          <p className="text-gray-600 mt-1">
            Live feed from patient app and quick emergency button.
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Real-time
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatBlock
          label="Total Requests"
          value={all.length}
          icon={Siren}
          color="redcross"
        />

        <StatBlock
          label="Pending"
          value={pendingCount}
          icon={AlertTriangle}
          color="amber"
        />

        <StatBlock
          label="Today"
          value={todayCount}
          icon={Activity}
          color="blue"
        />

        <StatBlock
          label="Quick (Anonymous)"
          value={quickCount}
          icon={Phone}
          color="purple"
        />
      </div>

      {pendingCount > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4 flex items-center gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />

          <div className="flex-1">
            <div className="font-semibold text-amber-900">
              {pendingCount} pending{" "}
              {pendingCount === 1 ? "request" : "requests"} awaiting response
            </div>

            <div className="text-sm text-amber-700">
              Click "Pending" filter below to see them all.
            </div>
          </div>

          <button
            onClick={() => setStatusFilter("pending")}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium"
          >
            Show pending
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search by name, condition, station..."
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none text-sm"
          >
            <option value="all">All Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none text-sm"
          >
            <option value="all">All Sources</option>
            <option value="regular">Patient App</option>
            <option value="quick">Quick Button</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Connecting to live feed...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Siren className="mx-auto mb-3" size={40} />
          <p className="font-medium text-gray-600">
            No requests match your filters
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <EmergencyCard
              key={`${req._source}-${req.id}`}
              request={req}
              onView={() => setViewing(req)}
              onStatusChange={(s) => updateStatus(req, s)}
            />
          ))}
        </div>
      )}

      {viewing && (
        <EmergencyDetailModal
          request={viewing}
          onClose={() => setViewing(null)}
          onStatusChange={(s) => updateStatus(viewing, s)}
        />
      )}
    </div>
  );
}

function StatBlock({ label, value, icon: Icon, color }) {
  const colors = {
    redcross: "bg-redcross-50 text-redcross-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        </div>

        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function EmergencyCard({ request, onView, onStatusChange }) {
  const isPending = request.status === "pending";
  const isQuick = request._source === "quick";

  const time = request.createdAt?.toDate
    ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })
    : "—";

  return (
    <div
      className={`bg-white rounded-xl border-2 p-4 hover:shadow-md transition-shadow cursor-pointer ${
        isPending ? "border-amber-300" : "border-gray-200"
      }`}
      onClick={onView}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <StatusBadge status={request.status} pulse={isPending} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-gray-900">
              {request.patientName ||
                (isQuick ? "Anonymous Caller" : "Unknown")}
            </span>

            {isQuick && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                <Phone size={10} />
                Quick Call
              </span>
            )}

            {request.isGuest && !isQuick && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium">
                Guest
              </span>
            )}

            {request.requiresDirectCall140 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-medium">
                Call 140
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 mb-2 line-clamp-1">
            <strong>{request.emergencyType || "Emergency"}:</strong>{" "}
            {request.currentCondition || "—"}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {time}
            </span>

            {request.assignedStationName && (
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {request.assignedStationName}
              </span>
            )}

            {request.patientProfilePhone && (
              <a
                href={`tel:${request.patientProfilePhone}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 hover:text-redcross-600"
              >
                <Phone size={12} />
                {request.patientProfilePhone}
              </a>
            )}
          </div>
        </div>

        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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

function StatusBadge({ status, pulse }) {
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
      className={`relative px-3 py-1 rounded-full border text-xs font-semibold ${colors[config.color]}`}
    >
      {pulse && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </span>
      )}

      {config.label}
    </div>
  );
}

function EmergencyDetailModal({ request, onClose, onStatusChange }) {
  const isQuick = request._source === "quick";

  const lat = request.latitude;
  const lng = request.longitude;

  const hasValidLocation =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  const mapsUrl =
    request.locationUrl ||
    (hasValidLocation
      ? `https://maps.google.com/?q=${Number(lat)},${Number(lng)}`
      : null);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Emergency Request — ${
        request.patientName || (isQuick ? "Anonymous" : "Unknown")
      }`}
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
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                Set to {s.label}
              </option>
            ))}
          </select>
        </div>

        <Section title="Emergency Details" icon={AlertTriangle}>
          <Row label="Type" value={request.emergencyType} />
          <Row label="Condition" value={request.currentCondition} />
          <Row
            label="Source"
            value={isQuick ? "Quick Emergency Button" : "Patient App"}
          />

          {request.requiresDirectCall140 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 text-sm text-red-700">
              This request was made via the Quick Emergency button. Direct 140
              call may be needed.
            </div>
          )}
        </Section>

        <Section title="Location" icon={MapPin}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {hasValidLocation ? (
                <div className="font-mono text-sm bg-gray-50 rounded p-2">
                  <div>
                    <span className="text-gray-500">Lat:</span>{" "}
                    {Number(lat).toFixed(6)}
                  </div>

                  <div>
                    <span className="text-gray-500">Lng:</span>{" "}
                    {Number(lng).toFixed(6)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No GPS location.</p>
              )}
            </div>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 bg-redcross-500 hover:bg-redcross-600 text-white text-sm rounded-lg font-medium whitespace-nowrap"
              >
                <MapPin size={14} />
                Open Map
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <Row
            label="Assigned Station"
            value={request.assignedStationName || "—"}
            className="mt-2"
          />
        </Section>

        {!isQuick && (
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
        )}

        {!isQuick && request.patientMedicalHistory && (
          <Section title="Medical History" icon={FileText} sensitive>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {request.patientMedicalHistory}
            </p>
          </Section>
        )}

        <Section title="Timeline" icon={Clock}>
          <Row
            label="Created"
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
        {sensitive && "🔒 "}
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

  const displayValue = String(value);

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
          {displayValue}
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
        {displayValue}
      </span>
    </div>
  );
}