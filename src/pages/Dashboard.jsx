import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Siren,
  Users,
  Activity,
  Heart,
  Clock,
  TrendingUp,
  AlertCircle,
  Megaphone,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import StatCard from "../components/StatCard";
import Card from "../components/Card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    emergenciesToday: 0,
    pendingRequests: 0,
    activeEmts: 0,
    totalPatients: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [recentEmergencies, setRecentEmergencies] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      // Run all reads in parallel for speed
      await Promise.all([
        loadStats(),
        loadChartData(),
        loadRecentEmergencies(),
        loadAnnouncements(),
      ]);
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    const todayStart = Timestamp.fromDate(startOfDay(new Date()));

    // Emergencies today (both regular + quick)
    const emergenciesQ = query(
      collection(db, "emergency_requests"),
      where("createdAt", ">=", todayStart)
    );
    const quickEmergenciesQ = query(
      collection(db, "quick_emergency_requests"),
      where("createdAt", ">=", todayStart)
    );

    // Pending requests (status === 'pending')
    const pendingQ = query(
      collection(db, "emergency_requests"),
      where("status", "==", "pending")
    );

    // Active EMTs
    const emtsQ = query(
      collection(db, "users"),
      where("role", "==", "emt"),
      where("isActive", "==", true)
    );

    // Total patients
    const patientsQ = collection(db, "patients");

    const [emerSnap, quickSnap, pendingSnap, emtsSnap, patientsSnap] =
      await Promise.all([
        getDocs(emergenciesQ),
        getDocs(quickEmergenciesQ),
        getDocs(pendingQ),
        getDocs(emtsQ),
        getDocs(patientsQ),
      ]);

    setStats({
      emergenciesToday: emerSnap.size + quickSnap.size,
      pendingRequests: pendingSnap.size,
      activeEmts: emtsSnap.size,
      totalPatients: patientsSnap.size,
    });
  }

  async function loadChartData() {
    // Last 7 days, including today
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      days.push({
        date: startOfDay(day),
        label: format(day, "MMM d"),
        count: 0,
      });
    }

    const sevenDaysAgo = Timestamp.fromDate(days[0].date);

    const emerSnap = await getDocs(
      query(
        collection(db, "emergency_requests"),
        where("createdAt", ">=", sevenDaysAgo)
      )
    );
    const quickSnap = await getDocs(
      query(
        collection(db, "quick_emergency_requests"),
        where("createdAt", ">=", sevenDaysAgo)
      )
    );

    // Bucket each request into the correct day
    const allDocs = [...emerSnap.docs, ...quickSnap.docs];
    allDocs.forEach((doc) => {
      const ts = doc.data().createdAt;
      if (!ts) return;
      const date = ts.toDate();
      const dayBucket = days.find((d) => {
        const next = new Date(d.date);
        next.setDate(next.getDate() + 1);
        return date >= d.date && date < next;
      });
      if (dayBucket) dayBucket.count++;
    });

    setChartData(days);
  }

  async function loadRecentEmergencies() {
    const q = query(
      collection(db, "emergency_requests"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const snap = await getDocs(q);
    setRecentEmergencies(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }

  async function loadAnnouncements() {
    const q = query(
      collection(db, "announcements"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    const snap = await getDocs(q);
    setAnnouncements(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {profile?.fullName?.split(" ")[0] || "Admin"} 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening at the station today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Siren}
          label="Emergencies Today"
          value={stats.emergenciesToday}
          change="Including quick requests"
          color="redcross"
          loading={loading}
        />
        <StatCard
          icon={Clock}
          label="Pending Requests"
          value={stats.pendingRequests}
          change="Awaiting response"
          color="amber"
          loading={loading}
        />
        <StatCard
          icon={Activity}
          label="Active EMTs"
          value={stats.activeEmts}
          change="On the team"
          color="blue"
          loading={loading}
        />
        <StatCard
          icon={Heart}
          label="Total Patients"
          value={stats.totalPatients}
          change="Registered"
          color="green"
          loading={loading}
        />
      </div>

      {/* Chart + Announcements row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Chart */}
        <Card
          title="Emergency Requests — Last 7 Days"
          className="lg:col-span-2"
          action={
            <span className="flex items-center gap-1 text-sm text-gray-500">
              <TrendingUp size={16} />
              Daily
            </span>
          }
        >
          {loading ? (
            <div className="h-64 bg-gray-50 rounded animate-pulse" />
          ) : (
            <div style={{ width: "100%", height: 250 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#c8102e"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Active announcements */}
        <Card
          title="Active Announcements"
          action={
            <Link
              to="/announcements"
              className="text-sm text-redcross-600 hover:text-redcross-700 font-medium"
            >
              Manage
            </Link>
          }
        >
          {loading ? (
            <div className="space-y-3">
              <div className="h-16 bg-gray-50 rounded animate-pulse" />
              <div className="h-16 bg-gray-50 rounded animate-pulse" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Megaphone className="mx-auto mb-2" size={32} />
              <p className="text-sm">No active announcements</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <AnnouncementItem key={a.id} announcement={a} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent emergencies */}
      <Card
        title="Recent Emergency Requests"
        action={
          <Link
            to="/emergencies"
            className="text-sm text-redcross-600 hover:text-redcross-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight size={14} />
          </Link>
        }
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded animate-pulse" />
            ))}
          </div>
        ) : recentEmergencies.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <AlertCircle className="mx-auto mb-2" size={32} />
            <p className="text-sm">No recent emergencies</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentEmergencies.map((e) => (
              <EmergencyRow key={e.id} emergency={e} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function AnnouncementItem({ announcement }) {
  const colorMap = {
    yellow: "bg-yellow-50 border-yellow-300",
    red: "bg-red-50 border-red-300",
    green: "bg-green-50 border-green-300",
    blue: "bg-blue-50 border-blue-300",
  };
  const colorClass = colorMap[announcement.color] || "bg-gray-50 border-gray-300";

  return (
    <div className={`border-l-4 p-3 rounded ${colorClass}`}>
      <p className="text-sm text-gray-800">{announcement.text}</p>
      <p className="text-xs text-gray-500 mt-1">
        Posted by {announcement.postedBy || "Unknown"}
      </p>
    </div>
  );
}

function EmergencyRow({ emergency }) {
  const statusColors = {
    pending: "bg-amber-100 text-amber-800",
    dispatched: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  const statusClass =
    statusColors[emergency.status] || "bg-gray-100 text-gray-800";

  const time = emergency.createdAt?.toDate
    ? format(emergency.createdAt.toDate(), "MMM d, h:mm a")
    : "—";

  return (
    <div className="py-3 flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900 truncate">
            {emergency.patientName || emergency.fullName || "Anonymous"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass}`}
          >
            {emergency.status || "pending"}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">
          {emergency.problemDescription ||
            emergency.description ||
            "No description"}
        </p>
      </div>
      <div className="text-xs text-gray-400 ml-4 whitespace-nowrap">{time}</div>
    </div>
  );
}