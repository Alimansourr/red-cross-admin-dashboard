import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import {
  Siren,
  Building2,
  Clock,
  Phone,
  ExternalLink,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { formatDistanceToNow } from "date-fns";

const DEFAULT_CENTER = [33.888, 35.495];
const DEFAULT_ZOOM = 11;

// Fix Leaflet default icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const stationIcon = L.divIcon({
  className: "custom-marker-station",
  html: `<div style="
    background: #2563eb;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  ">🏥</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

export default function LiveMap() {
  const [emergencies, setEmergencies] = useState([]);
  const [stations, setStations] = useState([]);
  const [showStations, setShowStations] = useState(true);
  const [showEmergencies, setShowEmergencies] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    async function loadStations() {
      try {
        const snap = await getDocs(collection(db, "station_details"));

        setStations(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter(
              (s) =>
                s.isActive !== false &&
                !Number.isNaN(Number(s.latitude)) &&
                !Number.isNaN(Number(s.longitude))
            )
        );
      } catch (err) {
        console.error("Failed to load stations:", err);
      }
    }

    loadStations();
  }, []);

  useEffect(() => {
    const unsub1 = onSnapshot(
      collection(db, "emergency_requests"),
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          _source: "regular",
          ...d.data(),
        }));

        setEmergencies((prev) => {
          const filtered = prev.filter((e) => e._source !== "regular");
          return [...filtered, ...docs];
        });
      },
      (err) => {
        console.error("emergency_requests error:", err);
      }
    );

    const unsub2 = onSnapshot(
      collection(db, "quick_emergency_requests"),
      (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          _source: "quick",
          ...d.data(),
        }));

        setEmergencies((prev) => {
          const filtered = prev.filter((e) => e._source !== "quick");
          return [...filtered, ...docs];
        });
      },
      (err) => {
        console.error("quick_emergency_requests error:", err);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const visibleEmergencies = useMemo(() => {
    return emergencies.filter((e) => {
      const lat = Number(e.latitude);
      const lng = Number(e.longitude);

      if (Number.isNaN(lat) || Number.isNaN(lng)) return false;

      if (statusFilter === "pending") {
        return e.status === "pending";
      }

      if (statusFilter === "active") {
        return e.status === "pending" || e.status === "dispatched";
      }

      return true;
    });
  }, [emergencies, statusFilter]);

  const mapCenter = useMemo(() => {
    const coords = [];

    if (showStations) {
      stations.forEach((s) => {
        coords.push([Number(s.latitude), Number(s.longitude)]);
      });
    }

    if (showEmergencies) {
      visibleEmergencies.forEach((e) => {
        coords.push([Number(e.latitude), Number(e.longitude)]);
      });
    }

    if (coords.length === 0) return DEFAULT_CENTER;

    const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    return [avgLat, avgLng];
  }, [stations, visibleEmergencies, showStations, showEmergencies]);

  const pendingCount = emergencies.filter((e) => e.status === "pending").length;

  const dispatchedCount = emergencies.filter(
    (e) => e.status === "dispatched"
  ).length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="text-redcross-500" size={28} />
            Live Map
          </h1>

          <p className="text-gray-600 mt-1">
            Real-time view of stations and emergencies.
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Live
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatBlock
          label="Total Stations"
          value={stations.length}
          icon={Building2}
          color="blue"
        />

        <StatBlock
          label="Pending"
          value={pendingCount}
          icon={AlertTriangle}
          color="amber"
        />

        <StatBlock
          label="Dispatched"
          value={dispatchedCount}
          icon={Siren}
          color="redcross"
        />

        <StatBlock
          label="Total on Map"
          value={visibleEmergencies.length + (showStations ? stations.length : 0)}
          icon={MapPin}
          color="purple"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Show:</span>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showStations}
            onChange={(e) => setShowStations(e.target.checked)}
            className="w-4 h-4 rounded text-redcross-500 focus:ring-redcross-500"
          />

          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-600 rounded"></span>
            Stations ({stations.length})
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showEmergencies}
            onChange={(e) => setShowEmergencies(e.target.checked)}
            className="w-4 h-4 rounded text-redcross-500 focus:ring-redcross-500"
          />

          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-600 rounded-full"></span>
            Emergencies
          </span>
        </label>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
          >
            <option value="all">All</option>
            <option value="pending">Pending only</option>
            <option value="active">Active (pending + dispatched)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div style={{ height: "600px", width: "100%" }}>
          <MapContainer
            center={mapCenter}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showStations &&
              stations.map((station) => (
                <Marker
                  key={`station_${station.id}`}
                  position={[Number(station.latitude), Number(station.longitude)]}
                  icon={stationIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-blue-700 mb-1 flex items-center gap-1">
                        🏥 {station.stationName}
                      </div>

                      <div className="text-xs text-gray-600">
                        {Number(station.latitude).toFixed(4)},{" "}
                        {Number(station.longitude).toFixed(4)}
                      </div>

                      <div className="text-xs text-green-600 mt-1">
                        ✓ Active
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {showEmergencies &&
              visibleEmergencies.map((emergency) => {
                const lat = Number(emergency.latitude);
                const lng = Number(emergency.longitude);
                const isPending = emergency.status === "pending";

                let color = "#9ca3af";

                if (isPending) {
                  color = "#dc2626";
                } else if (emergency.status === "dispatched") {
                  color = "#2563eb";
                } else if (emergency.status === "completed") {
                  color = "#16a34a";
                }

                return (
                  <CircleMarker
                    key={`em_${emergency._source}_${emergency.id}`}
                    center={[lat, lng]}
                    radius={isPending ? 12 : 8}
                    pathOptions={{
                      color: "#fff",
                      weight: 2,
                      fillColor: color,
                      fillOpacity: isPending ? 0.9 : 0.6,
                    }}
                  >
                    <Popup>
                      <EmergencyPopup emergency={emergency} />
                    </Popup>
                  </CircleMarker>
                );
              })}
          </MapContainer>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-gray-700">Legend:</span>
          <LegendItem color="#2563eb" label="Station" shape="square" />
          <LegendItem color="#dc2626" label="Pending Emergency" pulse />
          <LegendItem color="#2563eb" label="Dispatched" />
          <LegendItem color="#16a34a" label="Completed" />
          <LegendItem color="#9ca3af" label="Cancelled" />
        </div>
      </div>

      {visibleEmergencies.length === 0 && stations.length === 0 && (
        <div className="mt-4 text-center text-gray-500 text-sm">
          No data to show. Add stations and submit emergencies to see them on
          the map.
        </div>
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

function LegendItem({ color, label, shape = "circle", pulse = false }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`${shape === "square" ? "rounded-sm" : "rounded-full"} ${
          pulse ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: color,
          width: 12,
          height: 12,
          border: "2px solid white",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
        }}
      />

      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function EmergencyPopup({ emergency }) {
  const isQuick = emergency._source === "quick";

  const time = emergency.createdAt?.toDate
    ? formatDistanceToNow(emergency.createdAt.toDate(), { addSuffix: true })
    : "—";

  const statusColors = {
    pending: "text-amber-700 bg-amber-100",
    dispatched: "text-blue-700 bg-blue-100",
    completed: "text-green-700 bg-green-100",
    cancelled: "text-gray-700 bg-gray-100",
  };

  const statusClass =
    statusColors[emergency.status] || "text-gray-700 bg-gray-100";

  return (
    <div className="text-sm" style={{ minWidth: 220 }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}
        >
          {emergency.status || "pending"}
        </span>

        {isQuick && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
            Quick
          </span>
        )}
      </div>

      <div className="font-bold text-gray-900 mb-1">
        {emergency.patientName || (isQuick ? "Anonymous" : "Unknown")}
      </div>

      {emergency.emergencyType && (
        <div className="text-gray-700 text-xs mb-1">
          <strong>Type:</strong> {emergency.emergencyType}
        </div>
      )}

      {emergency.currentCondition && (
        <div className="text-gray-700 text-xs mb-2">
          <strong>Condition:</strong> {emergency.currentCondition}
        </div>
      )}

      <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
        <Clock size={10} />
        {time}
      </div>

      {emergency.assignedStationName && (
        <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
          <Building2 size={10} />
          {emergency.assignedStationName}
        </div>
      )}

      {emergency.patientProfilePhone && (
        <div className="text-xs mb-2">
          <a
            href={`tel:${emergency.patientProfilePhone}`}
            className="text-redcross-600 hover:text-redcross-700 font-medium flex items-center gap-1"
          >
            <Phone size={10} />
            {emergency.patientProfilePhone}
          </a>
        </div>
      )}

      <Link
        to="/emergencies"
        className="text-xs text-redcross-600 hover:text-redcross-700 font-medium flex items-center gap-1 mt-2 pt-2 border-t border-gray-200"
      >
        Go to Emergencies <ExternalLink size={10} />
      </Link>
    </div>
  );
}