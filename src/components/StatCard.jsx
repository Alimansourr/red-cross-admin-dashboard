export default function StatCard({ icon: Icon, label, value, change, color = "redcross", loading }) {
  const colorClasses = {
    redcross: "bg-redcross-50 text-redcross-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          {loading ? (
            <div className="h-9 w-20 bg-gray-100 rounded mt-2 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          )}
          {change && !loading && (
            <p className="text-xs text-gray-500 mt-1">{change}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}