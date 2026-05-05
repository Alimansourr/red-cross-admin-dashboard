import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Users,
  Heart,
  Siren,
  Truck,
  Megaphone,
  Calendar,
  Building2,
  ClipboardList,
  Stethoscope,
  MessageSquare,
  Package,
  Activity,
  RefreshCw,
  Clock,
  Shield,
  Server,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import { formatDistanceToNow } from "date-fns";

const COLLECTIONS = [
  { name: "users", label: "Users", icon: Users, color: "blue" },
  { name: "patients", label: "Patients", icon: Heart, color: "pink" },
  {
    name: "emergency_requests",
    label: "Emergency Requests",
    icon: Siren,
    color: "redcross",
  },
  {
    name: "quick_emergency_requests",
    label: "Quick Emergencies",
    icon: Siren,
    color: "amber",
  },
  {
    name: "transport_requests",
    label: "Transport Requests",
    icon: Truck,
    color: "purple",
  },
  { name: "missions", label: "Missions", icon: Stethoscope, color: "green" },
  {
    name: "wound_care_reports",
    label: "Wound Reports",
    icon: Stethoscope,
    color: "rose",
  },
  {
    name: "checklists",
    label: "Checklists",
    icon: ClipboardList,
    color: "indigo",
  },
  {
    name: "replenishment",
    label: "Replenishment",
    icon: Package,
    color: "orange",
  },
  { name: "events", label: "Events", icon: Calendar, color: "teal" },
  {
    name: "announcements",
    label: "Announcements",
    icon: Megaphone,
    color: "yellow",
  },
  {
    name: "weekly_schedule",
    label: "Schedule Days",
    icon: Calendar,
    color: "cyan",
  },
  {
    name: "station_details",
    label: "Stations",
    icon: Building2,
    color: "blue",
  },
  {
    name: "feedbacks",
    label: "Feedbacks",
    icon: MessageSquare,
    color: "pink",
  },
];

const COLOR_MAP = {
  blue: "bg-blue-50 text-blue-600",
  pink: "bg-pink-50 text-pink-600",
  redcross: "bg-redcross-50 text-redcross-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  green: "bg-green-50 text-green-600",
  rose: "bg-rose-50 text-rose-600",
  indigo: "bg-indigo-50 text-indigo-600",
  orange: "bg-orange-50 text-orange-600",
  teal: "bg-teal-50 text-teal-600",
  yellow: "bg-yellow-50 text-yellow-600",
  cyan: "bg-cyan-50 text-cyan-600",
};

export default function SystemStats() {
  const [counts, setCounts] = useState({});
  const [users, setUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const loadRecentActivity = useCallback(async () => {
    const activities = [];

    try {
      const snap = await getDocs(
        query(
          collection(db, "emergency_requests"),
          orderBy("createdAt", "desc"),
          limit(3)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        activities.push({
          type: "emergency",
          icon: Siren,
          color: "redcross",
          message: `New emergency from ${data.patientName || "Anonymous"}`,
          detail: data.emergencyType || "Emergency request",
          timestamp: data.createdAt?.toDate(),
        });
      });
    } catch {}

    try {
      const snap = await getDocs(
        query(
          collection(db, "missions"),
          orderBy("submittedAt", "desc"),
          limit(3)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        activities.push({
          type: "mission",
          icon: Stethoscope,
          color: "green",
          message: `Mission logged by ${data.submittedByName || "EMT"}`,
          detail: `${data.missionType || "Mission"} · Car ${data.carNumber || "?"}`,
          timestamp: data.submittedAt?.toDate(),
        });
      });
    } catch {}

    try {
      const snap = await getDocs(
        query(
          collection(db, "checklists"),
          orderBy("submittedAt", "desc"),
          limit(2)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        activities.push({
          type: "checklist",
          icon: ClipboardList,
          color: "indigo",
          message: `Checklist submitted by ${data.emtName || "EMT"}`,
          detail: `Car ${data.carNumber || "?"} · ${data.shift || "shift"}`,
          timestamp: data.submittedAt?.toDate(),
        });
      });
    } catch {}

    try {
      const snap = await getDocs(
        query(
          collection(db, "feedbacks"),
          orderBy("createdAt", "desc"),
          limit(2)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        activities.push({
          type: "feedback",
          icon: MessageSquare,
          color: "pink",
          message: `Feedback from ${data.patientName || "Patient"}`,
          detail: `${data.rating || "?"} stars`,
          timestamp: data.createdAt?.toDate(),
        });
      });
    } catch {}

    try {
      const snap = await getDocs(
        query(
          collection(db, "transport_requests"),
          orderBy("createdAt", "desc"),
          limit(2)
        )
      );
      snap.docs.forEach((d) => {
        const data = d.data();
        activities.push({
          type: "transport",
          icon: Truck,
          color: "purple",
          message: `Transport request from ${data.patientName || "Patient"}`,
          detail: `${data.pickupLocation || "Pickup"} → ${
            data.destination || "Destination"
          }`,
          timestamp: data.createdAt?.toDate(),
        });
      });
    } catch {}

    activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    setRecentActivity(activities.slice(0, 10));
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const countPromises = COLLECTIONS.map(async (c) => {
        try {
          const snap = await getDocs(collection(db, c.name));
          return { name: c.name, count: snap.size };
        } catch (err) {
          console.error(`Failed to count ${c.name}:`, err);
          return { name: c.name, count: 0, error: true };
        }
      });

      const results = await Promise.all(countPromises);
      const countsObj = {};
      results.forEach((r) => {
        countsObj[r.name] = r.count;
      });
      setCounts(countsObj);

      const usersSnap = await getDocs(collection(db, "users"));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      await loadRecentActivity();

      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoading(false);
    }
  }, [loadRecentActivity]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const userBreakdown = {
    admins: users.filter((u) => u.role === "admin").length,
    emts: users.filter((u) => u.role === "emt").length,
    activeUsers: users.filter((u) => u.isActive !== false).length,
    inactiveUsers: users.filter((u) => u.isActive === false).length,
    withSubcode: users.filter((u) => u.subcode && u.subcode.trim()).length,
  };

  const totalRecords = Object.values(counts).reduce((sum, c) => sum + c, 0);

  const totalEmergencies =
    (counts.emergency_requests || 0) + (counts.quick_emergency_requests || 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="text-redcross-500" size={28} />
            System Statistics
          </h1>
          <p className="text-gray-600 mt-1">
            Platform health, totals, and recent activity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Clock size={12} />
              Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
            </span>
          )}
          <button
            onClick={loadStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <BigStatCard
          icon={Database}
          label="Total Records"
          value={totalRecords.toLocaleString()}
          subtitle="Across all collections"
          color="redcross"
        />
        <BigStatCard
          icon={Users}
          label="Total Users"
          value={(counts.users || 0) + (counts.patients || 0)}
          subtitle={`${counts.users || 0} EMTs · ${counts.patients || 0} patients`}
          color="blue"
        />
        <BigStatCard
          icon={Siren}
          label="All Emergencies"
          value={totalEmergencies}
          subtitle="Regular + quick combined"
          color="amber"
        />
        <BigStatCard
          icon={Activity}
          label="Active Stations"
          value={counts.station_details || 0}
          subtitle="Routing emergencies"
          color="green"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          Users Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <UserStat
            label="Admins"
            value={userBreakdown.admins}
            icon={Shield}
            color="purple"
          />
          <UserStat
            label="EMTs"
            value={userBreakdown.emts}
            icon={Users}
            color="blue"
          />
          <UserStat
            label="Active"
            value={userBreakdown.activeUsers}
            icon={Activity}
            color="green"
          />
          <UserStat
            label="Inactive"
            value={userBreakdown.inactiveUsers}
            icon={Activity}
            color="gray"
          />
          <UserStat
            label="With Subcode"
            value={userBreakdown.withSubcode}
            icon={Shield}
            color="amber"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Server size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">
                Database Collections
              </h3>
              <span className="text-xs text-gray-500 ml-auto">
                {COLLECTIONS.length} collections
              </span>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {COLLECTIONS.map((c) => {
                  const count = counts[c.name] ?? 0;
                  const Icon = c.icon;
                  return (
                    <div
                      key={c.name}
                      className="px-5 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${COLOR_MAP[c.color]}`}
                        >
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">
                            {c.label}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {c.name}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {count.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {count === 1 ? "record" : "records"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <Activity size={16} className="text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">
                Recent Activity
              </h3>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : recentActivity.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No recent activity
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentActivity.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <div key={i} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-md ${COLOR_MAP[a.color]} flex-shrink-0`}>
                          <Icon size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 leading-tight">
                            {a.message}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            {a.detail}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {a.timestamp
                              ? formatDistanceToNow(a.timestamp, {
                                  addSuffix: true,
                                })
                              : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3">
        <Database className="text-gray-400 flex-shrink-0 mt-0.5" size={16} />
        <div className="text-xs text-gray-600">
          <strong>About this page:</strong> Shows real-time totals across all
          Firestore collections. Numbers update when you click Refresh. The
          "Recent Activity" section pulls the latest entries from key
          collections to give you a feel for what's happening in the system.
        </div>
      </div>
    </div>
  );
}

function BigStatCard({ icon: Icon, label, value, subtitle, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{value}</div>
          {subtitle && (
            <div className="text-xs text-gray-500 mt-1 truncate">
              {subtitle}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${COLOR_MAP[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function UserStat({ label, value, icon: Icon, color }) {
  const colors = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600",
    gray: "text-gray-500",
    amber: "text-amber-600",
  };
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <Icon size={12} />
        {label}
      </div>
      <div className={`text-2xl font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
}