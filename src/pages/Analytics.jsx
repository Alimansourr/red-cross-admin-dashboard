import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  Clock,
  Calendar,
  Building2,
  Star,
  Stethoscope,
  RefreshCw,
} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  format,
  subDays,
  startOfDay,
  eachDayOfInterval,
} from "date-fns";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const COLORS = {
  pending: "#f59e0b",
  dispatched: "#2563eb",
  completed: "#16a34a",
  cancelled: "#9ca3af",
  primary: "#c8102e",
  secondary: "#7c3aed",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  purple: "#a855f7",
  pink: "#ec4899",
};

const PIE_COLORS = [
  COLORS.pending,
  COLORS.dispatched,
  COLORS.completed,
  COLORS.cancelled,
];

export default function Analytics() {
  const [range, setRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    emergencies: [],
    quickEmergencies: [],
    transports: [],
    missions: [],
    feedbacks: [],
    stations: [],
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function loadData() {
    setLoading(true);
    try {
      const since =
        range === "all"
          ? null
          : startOfDay(subDays(new Date(), parseInt(range)));
      const sinceTs = since ? Timestamp.fromDate(since) : null;

      async function fetchCollection(name, dateField = "createdAt") {
        let q;
        if (sinceTs) {
          q = query(collection(db, name), where(dateField, ">=", sinceTs));
        } else {
          q = collection(db, name);
        }
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }

      const [
        emergencies,
        quickEmergencies,
        transports,
        missions,
        feedbacks,
        stationsSnap,
      ] = await Promise.all([
        fetchCollection("emergency_requests", "createdAt"),
        fetchCollection("quick_emergency_requests", "createdAt"),
        fetchCollection("transport_requests", "createdAt"),
        fetchCollection("missions", "submittedAt"),
        fetchCollection("feedbacks", "createdAt"),
        getDocs(collection(db, "station_details")),
      ]);

      setData({
        emergencies,
        quickEmergencies,
        transports,
        missions,
        feedbacks,
        stations: stationsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  const allEmergencies = useMemo(
    () => [...data.emergencies, ...data.quickEmergencies],
    [data.emergencies, data.quickEmergencies]
  );

  const trendData = useMemo(() => {
    if (allEmergencies.length === 0) return [];
    const days = range === "all" ? 90 : parseInt(range);
    const start = startOfDay(subDays(new Date(), days - 1));
    const dayList = eachDayOfInterval({ start, end: new Date() });

    return dayList.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = allEmergencies.filter((e) => {
        if (!e.createdAt?.toDate) return false;
        const t = e.createdAt.toDate();
        return t >= dayStart && t < dayEnd;
      }).length;

      const transportCount = data.transports.filter((t) => {
        if (!t.createdAt?.toDate) return false;
        const time = t.createdAt.toDate();
        return time >= dayStart && time < dayEnd;
      }).length;

      return {
        date: format(day, "MMM d"),
        emergencies: count,
        transports: transportCount,
      };
    });
  }, [allEmergencies, data.transports, range]);

  const statusData = useMemo(() => {
    const counts = { pending: 0, dispatched: 0, completed: 0, cancelled: 0 };
    allEmergencies.forEach((e) => {
      const s = e.status || "pending";
      if (counts[s] !== undefined) counts[s]++;
      else counts.pending++;
    });
    return Object.entries(counts)
      .filter(([_, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [allEmergencies]);

  const hourData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      hourLabel: `${i}:00`,
      count: 0,
    }));
    allEmergencies.forEach((e) => {
      if (!e.createdAt?.toDate) return;
      const h = e.createdAt.toDate().getHours();
      buckets[h].count++;
    });
    return buckets;
  }, [allEmergencies]);

  const dowData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets = days.map((d) => ({ day: d, count: 0 }));
    allEmergencies.forEach((e) => {
      if (!e.createdAt?.toDate) return;
      const dow = e.createdAt.toDate().getDay();
      buckets[dow].count++;
    });
    return buckets;
  }, [allEmergencies]);

  const stationData = useMemo(() => {
    const counts = {};
    allEmergencies.forEach((e) => {
      const name = e.assignedStationName || "Unassigned";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [allEmergencies]);

  const missionTypeData = useMemo(() => {
    const counts = {};
    data.missions.forEach((m) => {
      const type = m.missionType || "Unknown";
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data.missions]);

  const feedbackStats = useMemo(() => {
    const total = data.feedbacks.length;
    if (total === 0) return { total: 0, avg: 0, distribution: [] };
    const sum = data.feedbacks.reduce((acc, f) => acc + (f.rating || 0), 0);
    const distribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating: `${rating}★`,
      count: data.feedbacks.filter((f) => f.rating === rating).length,
    }));
    return { total, avg: sum / total, distribution };
  }, [data.feedbacks]);

  const kpis = useMemo(() => {
    const totalEmergencies = allEmergencies.length;
    const completedRate =
      totalEmergencies > 0
        ? (allEmergencies.filter((e) => e.status === "completed").length /
            totalEmergencies) *
          100
        : 0;
    const avgPerDay =
      range === "all"
        ? totalEmergencies
        : totalEmergencies / parseInt(range);

    return {
      totalEmergencies,
      totalTransports: data.transports.length,
      totalMissions: data.missions.length,
      completedRate,
      avgPerDay,
      avgRating: feedbackStats.avg,
    };
  }, [allEmergencies, data.transports, data.missions, feedbackStats, range]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-redcross-500" size={28} />
            Analytics
          </h1>
          <p className="text-gray-600 mt-1">
            Insights and trends across the entire platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none text-sm"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard
          label="Emergencies"
          value={kpis.totalEmergencies}
          icon={Activity}
          color="redcross"
        />
        <KpiCard
          label="Transports"
          value={kpis.totalTransports}
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          label="Missions"
          value={kpis.totalMissions}
          icon={Stethoscope}
          color="purple"
        />
        <KpiCard
          label="Completion Rate"
          value={`${kpis.completedRate.toFixed(0)}%`}
          icon={Activity}
          color="green"
        />
        <KpiCard
          label="Avg per Day"
          value={kpis.avgPerDay.toFixed(1)}
          icon={Calendar}
          color="amber"
        />
        <KpiCard
          label="Avg Rating"
          value={kpis.avgRating > 0 ? kpis.avgRating.toFixed(1) : "—"}
          icon={Star}
          color="pink"
          suffix={kpis.avgRating > 0 ? "/ 5" : ""}
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          Loading analytics...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <ChartCard
              title="Requests Over Time"
              subtitle="Emergencies vs Transports"
              icon={TrendingUp}
              className="lg:col-span-2"
            >
              {trendData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="emergencies"
                      name="Emergencies"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="transports"
                      name="Transports"
                      stroke={COLORS.blue}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Emergency Status"
              subtitle="Breakdown of all requests"
              icon={Activity}
            >
              {statusData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={
                            COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartCard
              title="Peak Hours"
              subtitle="When do most emergencies happen?"
              icon={Clock}
            >
              {hourData.every((h) => h.count === 0) ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={hourData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [`${value} requests`, "Count"]}
                      labelFormatter={(h) => `${h}:00 - ${h}:59`}
                    />
                    <Bar
                      dataKey="count"
                      fill={COLORS.amber}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Day of Week"
              subtitle="Busiest days for emergencies"
              icon={Calendar}
            >
              {dowData.every((d) => d.count === 0) ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dowData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill={COLORS.purple}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartCard
              title="Station Load"
              subtitle="Top stations by emergency count"
              icon={Building2}
            >
              {stationData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={stationData}
                    layout="vertical"
                    margin={{ left: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill={COLORS.blue}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Mission Types"
              subtitle="Most common mission categories"
              icon={Stethoscope}
            >
              {missionTypeData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={missionTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-15}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="count"
                      fill={COLORS.green}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          <ChartCard
            title="Patient Feedback"
            subtitle={`${feedbackStats.total} ratings · ${
              feedbackStats.avg > 0
                ? feedbackStats.avg.toFixed(1) + " avg"
                : "no ratings yet"
            }`}
            icon={Star}
          >
            {feedbackStats.total === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={feedbackStats.distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar
                    dataKey="count"
                    fill={COLORS.amber}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, suffix }) {
  const colors = {
    redcross: "bg-redcross-50 text-redcross-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    pink: "bg-pink-50 text-pink-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 truncate">{label}</div>
          <div className="text-xl font-bold text-gray-900 mt-0.5 flex items-baseline gap-1">
            <span>{value}</span>
            {suffix && (
              <span className="text-xs text-gray-400 font-normal">
                {suffix}
              </span>
            )}
          </div>
        </div>
        <div className={`p-1.5 rounded-md ${colors[color]}`}>
          <Icon size={14} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={16} className="text-gray-400" />}
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
      No data for this period
    </div>
  );
}