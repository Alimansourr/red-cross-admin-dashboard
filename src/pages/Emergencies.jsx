import { useEffect, useState, useRef } from "react";
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
  Sparkles,
  Loader2,
  Zap,
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
import PriorityBadge from "../components/PriorityBadge";
import AssignButton from "../components/AssignButton";
import {
  triageEmergency,
  sortByPriority,
  PRIORITIES,
} from "../services/triageService";
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [viewing, setViewing] = useState(null);
  const [analyzingIds, setAnalyzingIds] = useState(new Set());
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);

  const autoTriagedRef = useRef(new Set());

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, "emergency_requests"), orderBy("createdAt", "desc")),
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          _source: "regular",
          ...d.data(),
        }));

        setRegular(docs);
        autoTriageNewOnes(docs, "regular");
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
        const docs = snap.docs.map((d) => ({
          id: d.id,
          _source: "quick",
          ...d.data(),
        }));

        setQuick(docs);
        autoTriageNewOnes(docs, "quick");
      },
      (err) => {
        console.error("quick_emergency_requests listener error:", err);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function autoTriageNewOnes(docs, source) {
    docs.forEach((emergencyDoc) => {
      const key = `${source}_${emergencyDoc.id}`;

      if (autoTriagedRef.current.has(key)) return;

      if (emergencyDoc.status === "pending" && !emergencyDoc.aiPriority) {
        autoTriagedRef.current.add(key);

        runTriage(emergencyDoc).catch((err) => {
          console.warn(`Auto-triage failed for ${key}:`, err.message);
        });
      } else {
        autoTriagedRef.current.add(key);
      }
    });
  }

  async function runTriage(emergency) {
    const collectionName =
      emergency._source === "quick"
        ? "quick_emergency_requests"
        : "emergency_requests";

    setAnalyzingIds((prev) => new Set(prev).add(emergency.id));

    try {
      const result = await triageEmergency(emergency);

      await updateDoc(doc(db, collectionName, emergency.id), {
        aiPriority: result.priority,
        aiCategory: result.category,
        aiSuggestion: result.suggestion,
        aiReasoning: result.reasoning,
        aiAnalyzedAt: new Date(),
      });
    } catch (err) {
      console.error("Triage failed:", err);
      alert("AI analysis failed: " + err.message);
      throw err;
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(emergency.id);
        return next;
      });
    }
  }

  async function batchAnalyze() {
    const confirmed = window.confirm(
      "Analyze all unanalyzed emergencies? This will use Gemini API quota for each one."
    );

    if (!confirmed) return;

    const all = [...regular, ...quick];
    const needsAnalysis = all.filter((e) => !e.aiPriority);

    if (needsAnalysis.length === 0) {
      alert("All emergencies already analyzed!");
      return;
    }

    setBatchAnalyzing(true);

    let success = 0;
    let failed = 0;

    for (const emergency of needsAnalysis) {
      try {
        await runTriage(emergency);
        success += 1;

        await new Promise((resolve) => setTimeout(resolve, 7000));
      } catch {
        failed += 1;
      }
    }

    setBatchAnalyzing(false);
    alert(`Done! Analyzed: ${success}, Failed: ${failed}`);
  }

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

  const all = [...regular, ...quick];

  let filtered = all.filter((req) => {
    if (sourceFilter !== "all" && req._source !== sourceFilter) return false;

    if (statusFilter !== "all" && req.status !== statusFilter) return false;

    if (priorityFilter !== "all" && req.aiPriority !== priorityFilter) {
      return false;
    }

    if (search.trim()) {
      const term = search.toLowerCase();

      const fields = [
        req.patientName,
        req.emergencyType,
        req.currentCondition,
        req.assignedStationName,
        req.aiCategory,
      ];

      if (!fields.some((f) => String(f || "").toLowerCase().includes(term))) {
        return false;
      }
    }

    return true;
  });

  if (sortBy === "priority") {
    filtered = sortByPriority(filtered);
  } else {
    filtered.sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });
  }

  const pendingCount = all.filter((r) => r.status === "pending").length;
  const criticalCount = all.filter((r) => r.aiPriority === "CRITICAL").length;
  const highCount = all.filter((r) => r.aiPriority === "HIGH").length;
  const unanalyzedCount = all.filter((r) => !r.aiPriority).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Siren className="text-redcross-500" size={28} />
            Emergency Requests
          </h1>

          <p className="text-gray-600 mt-1">
            Real-time feed with AI-powered priority triage.
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live
            </span>
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-purple-600">
              <Sparkles size={12} />
              AI triage
            </span>
          </p>
        </div>

        {unanalyzedCount > 0 && (
          <button
            onClick={batchAnalyze}
            disabled={batchAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm"
          >
            {batchAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Analyze {unanalyzedCount} unanalyzed
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatBlock
          label="Total"
          value={all.length}
          icon={Siren}
          color="redcross"
        />

        <StatBlock
          label="🔴 Critical"
          value={criticalCount}
          icon={AlertTriangle}
          color="red"
          highlight={criticalCount > 0}
        />

        <StatBlock
          label="🟠 High"
          value={highCount}
          icon={AlertTriangle}
          color="orange"
        />

        <StatBlock
          label="Pending"
          value={pendingCount}
          icon={Clock}
          color="amber"
        />

        <StatBlock
          label="Active EMTs"
          value={all.filter((r) => r.status === "dispatched").length}
          icon={Activity}
          color="blue"
        />
      </div>

      {criticalCount > 0 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />

          <div className="flex-1">
            <div className="font-bold text-red-900">
              🚨 {criticalCount} CRITICAL{" "}
              {criticalCount === 1 ? "emergency" : "emergencies"} — immediate
              response needed
            </div>
          </div>

          <button
            onClick={() => setPriorityFilter("CRITICAL")}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold"
          >
            Show critical
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
            placeholder="Search name, condition, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
          >
            <option value="all">All Priority</option>
            {Object.keys(PRIORITIES).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
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
            className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
          >
            <option value="all">All Sources</option>
            <option value="regular">Patient App</option>
            <option value="quick">Quick Button</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg outline-none text-sm"
            title="Sort order"
          >
            <option value="priority">Sort: Priority</option>
            <option value="time">Sort: Newest</option>
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
              key={`${req._source}_${req.id}`}
              request={req}
              isAnalyzing={analyzingIds.has(req.id)}
              onView={() => setViewing(req)}
              onStatusChange={(s) => updateStatus(req, s)}
              onAnalyze={() => runTriage(req)}
            />
          ))}
        </div>
      )}

      {viewing && (
        <EmergencyDetailModal
          request={viewing}
          onClose={() => setViewing(null)}
          onStatusChange={(s) => updateStatus(viewing, s)}
          onAnalyze={() => runTriage(viewing)}
          isAnalyzing={analyzingIds.has(viewing.id)}
        />
      )}
    </div>
  );
}

function StatBlock({ label, value, icon: Icon, color, highlight }) {
  const colors = {
    redcross: "bg-redcross-50 text-redcross-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <div
      className={`bg-white rounded-xl border p-3 ${
        highlight ? "border-red-400 ring-2 ring-red-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        </div>

        <div className={`p-1.5 rounded-md ${colors[color]}`}>
          <Icon size={14} />
        </div>
      </div>
    </div>
  );
}

function EmergencyCard({
  request,
  isAnalyzing,
  onView,
  onStatusChange,
  onAnalyze,
}) {
  const isPending = request.status === "pending";
  const isQuick = request._source === "quick";
  const isCritical = request.aiPriority === "CRITICAL";

  const time = request.createdAt?.toDate
    ? formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })
    : "—";

  let borderClass = "border-gray-200";

  if (isCritical) {
    borderClass = "border-red-400 ring-2 ring-red-200";
  } else if (request.aiPriority === "HIGH") {
    borderClass = "border-orange-300";
  } else if (isPending) {
    borderClass = "border-amber-300";
  }

  return (
    <div
      className={`bg-white rounded-xl border-2 ${borderClass} p-4 hover:shadow-md transition-shadow cursor-pointer`}
      onClick={onView}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 flex flex-col items-start gap-1.5">
          <PriorityBadge priority={request.aiPriority} />
          <StatusBadge status={request.status} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-gray-900">
              {request.patientName ||
                (isQuick ? "Anonymous Caller" : "Unknown")}
            </span>

            {isQuick && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium flex items-center gap-1">
                <Phone size={10} /> Quick
              </span>
            )}

            {request.emergencyImageUrl && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium">
                Image attached
              </span>
            )}

            {request.aiCategory && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 font-medium">
                {request.aiCategory}
              </span>
            )}
          </div>

          <div className="text-sm text-gray-600 mb-2 line-clamp-1">
            <strong>{request.emergencyType || "Emergency"}:</strong>{" "}
            {request.currentCondition || "—"}
          </div>

          {request.aiSuggestion && (
            <div className="text-xs text-purple-700 bg-purple-50 rounded px-2 py-1 mb-2 inline-flex items-center gap-1">
              <Sparkles size={10} />
              <strong>AI:</strong> {request.aiSuggestion}
            </div>
          )}

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

        <div
          className="flex-shrink-0 flex flex-col gap-1 items-end"
          onClick={(e) => e.stopPropagation()}
        >
             <AssignButton request={request} collectionName={request._source === "quick" ? "quick_emergency_requests" : "emergency_requests"} />
          
          <select
            value={request.status || "pending"}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded-lg outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {!request.aiPriority && (
            <button
              onClick={onAnalyze}
              disabled={isAnalyzing}
              className="text-xs px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg flex items-center gap-1 disabled:opacity-50"
              title="Analyze with AI"
            >
              {isAnalyzing ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Sparkles size={10} />
              )}

              {isAnalyzing ? "Analyzing..." : "Analyze"}
            </button>
          )}
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
    <span
      className={`px-2 py-0.5 rounded-full border text-xs font-medium ${
        colors[config.color]
      }`}
    >
      {config.label}
    </span>
  );
}

function EmergencyDetailModal({
  request,
  onClose,
  onStatusChange,
  onAnalyze,
  isAnalyzing,
}) {
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
      title={`Emergency — ${
        request.patientName || (isQuick ? "Anonymous" : "Unknown")
      }`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-purple-700 font-semibold text-sm">
              <Sparkles size={16} />
              AI Triage Analysis
            </div>

            {!request.aiPriority && (
              <button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg flex items-center gap-1"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={12} />
                    Analyze
                  </>
                )}
              </button>
            )}
          </div>

          {request.aiPriority ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <PriorityBadge priority={request.aiPriority} size="lg" />

                {request.aiCategory && (
                  <span className="px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 font-semibold text-sm">
                    {request.aiCategory}
                  </span>
                )}
              </div>

              {request.aiSuggestion && (
                <div className="bg-white rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500 uppercase mb-1">
                    Recommendation
                  </div>
                  <div className="text-gray-900 font-medium">
                    {request.aiSuggestion}
                  </div>
                </div>
              )}

              {request.aiReasoning && (
                <div className="bg-white rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500 uppercase mb-1">
                    Reasoning
                  </div>
                  <div className="text-gray-700 italic">
                    {request.aiReasoning}
                  </div>
                </div>
              )}

              <button
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={10} className="animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles size={10} />
                    Re-analyze
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-600">
              {isAnalyzing
                ? "AI is analyzing this emergency..."
                : "Click Analyze to let AI assess priority and suggest action."}
            </div>
          )}
        </div>

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

        <Section title="Emergency Details" icon={AlertTriangle}>
          <Row label="Type" value={request.emergencyType} />
          <Row label="Condition" value={request.currentCondition} />
          <Row
            label="Source"
            value={isQuick ? "Quick Emergency Button" : "Patient App"}
          />
        </Section>

        {request.emergencyImageUrl && (
          <Section title="Emergency Image" icon={FileText}>
            <div className="space-y-2">
              <img
                src={request.emergencyImageUrl}
                alt="Emergency uploaded by patient"
                className="w-full max-h-[420px] object-contain rounded-lg border border-gray-200 bg-white"
              />

              <a
                href={request.emergencyImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-redcross-600 hover:text-redcross-700 font-medium"
              >
                Open full image
                <ExternalLink size={12} />
              </a>
            </div>
          </Section>
        )}

        <Section title="Location" icon={MapPin}>
          {hasValidLocation ? (
            <div className="flex items-start justify-between gap-4">
              <div className="font-mono text-sm bg-gray-50 rounded p-2 flex-1">
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
                  className="inline-flex items-center gap-2 px-3 py-2 bg-redcross-500 hover:bg-redcross-600 text-white text-sm rounded-lg font-medium whitespace-nowrap"
                >
                  <MapPin size={14} />
                  Open Map
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No GPS location.</p>
          )}

          <Row
            label="Assigned Station"
            value={request.assignedStationName}
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

          {request.aiAnalyzedAt && (
            <Row
              label="AI Analyzed"
              value={
                request.aiAnalyzedAt?.toDate
                  ? format(
                      request.aiAnalyzedAt.toDate(),
                      "MMM d, yyyy 'at' h:mm a"
                    )
                  : "—"
              }
            />
          )}

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
          {String(value)}
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