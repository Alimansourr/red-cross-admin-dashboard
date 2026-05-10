import { useEffect, useState } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Loader2,
  AlertCircle,
  Award,
  Zap,
  BarChart3,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";
import {
  checkApiHealth,
  getModelMetrics,
  getFeatureImportance,
  predictOrder,
} from "../services/forecastService";

const MONTHS = [
  { value: 1, label: "January", season: "Winter" },
  { value: 2, label: "February", season: "Winter" },
  { value: 3, label: "March", season: "Spring" },
  { value: 4, label: "April", season: "Spring" },
  { value: 5, label: "May", season: "Spring" },
  { value: 6, label: "June", season: "Summer" },
  { value: 7, label: "July", season: "Summer" },
  { value: 8, label: "August", season: "Summer" },
  { value: 9, label: "September", season: "Fall" },
  { value: 10, label: "October", season: "Fall" },
  { value: 11, label: "November", season: "Fall" },
  { value: 12, label: "December", season: "Winter" },
];

export default function OrderForecast() {
  const [apiStatus, setApiStatus] = useState("checking"); // checking | online | offline
  const [apiError, setApiError] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [featureImportance, setFeatureImportance] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(7); // Default: July (summer)
  const [selectedYear, setSelectedYear] = useState(2026);
  const [forecast, setForecast] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const [predictError, setPredictError] = useState("");

  // Initial load: check API + load metrics + feature importance
  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialize() {
    setApiStatus("checking");
    setApiError("");
    try {
      const health = await checkApiHealth();
      if (health.status === "running") {
        setApiStatus("online");
        const [m, fi] = await Promise.all([
          getModelMetrics(),
          getFeatureImportance(),
        ]);
        setMetrics(m);
        setFeatureImportance(fi);
      } else {
        throw new Error("API is up but reports an unexpected status");
      }
    } catch (err) {
      setApiStatus("offline");
      setApiError(err.message);
    }
  }

  async function handlePredict() {
    setPredicting(true);
    setPredictError("");
    setForecast(null);
    try {
      const result = await predictOrder(selectedMonth, selectedYear);
      setForecast(result);
    } catch (err) {
      setPredictError(err.message);
    } finally {
      setPredicting(false);
    }
  }

  function exportToExcel() {
    if (!forecast) return;

    const rows = forecast.predictions.map((p) => ({
      Item: p.item,
      "Baseline (avg)": p.baseline,
      "Predicted Quantity": p.predicted_quantity,
      Unit: p.unit,
      "Change %": `${p.delta_pct > 0 ? "+" : ""}${p.delta_pct}%`,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 45 },
      { wch: 14 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    const monthLabel =
      MONTHS.find((m) => m.value === forecast.month)?.label || "Forecast";
    XLSX.utils.book_append_sheet(wb, ws, `${monthLabel} ${forecast.year}`);

    XLSX.writeFile(
      wb,
      `forecast_${monthLabel}_${forecast.year}.xlsx`
    );
  }

  // ─────────────────────────────────────
  // API offline state
  // ─────────────────────────────────────
  if (apiStatus === "offline") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="text-redcross-500" size={28} />
          <h1 className="text-3xl font-bold text-gray-900">AI Order Forecast</h1>
        </div>
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-600 flex-shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-bold text-amber-900 mb-2">
                ML API is not reachable
              </h3>
              <p className="text-sm text-amber-800 mb-3">{apiError}</p>
              <div className="bg-white rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  To fix:
                </p>
                <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
                  <li>
                    Open a terminal in your{" "}
                    <code className="bg-gray-100 px-1 rounded">ml</code> folder
                  </li>
                  <li>
                    Activate your virtual environment:{" "}
                    <code className="bg-gray-100 px-1 rounded">
                      venv\Scripts\activate
                    </code>
                  </li>
                  <li>
                    Run:{" "}
                    <code className="bg-gray-100 px-1 rounded">python api.py</code>
                  </li>
                  <li>Wait until you see "Starting Flask API on..."</li>
                  <li>Click Retry below</li>
                </ol>
              </div>
              <button
                onClick={initialize}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium"
              >
                <RefreshCw size={16} />
                Retry connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // Loading state
  // ─────────────────────────────────────
  if (apiStatus === "checking" || !metrics) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-redcross-500" size={32} />
          <span className="ml-3 text-gray-600">
            Connecting to ML model...
          </span>
        </div>
      </div>
    );
  }

  const selectedMonthData = MONTHS.find((m) => m.value === selectedMonth);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="text-redcross-500" size={28} />
            AI Order Forecast
          </h1>
          <p className="text-gray-600 mt-1">
            XGBoost machine learning model predicts order quantities based on
            seasonal patterns and operational data.
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              ML API online
            </span>
          </p>
        </div>
      </div>

      {/* Model Performance Card */}
      <div className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-2 border-purple-200 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Award className="text-purple-600" size={20} />
          <h3 className="font-bold text-purple-900">Model Performance</h3>
          <span className="text-xs text-purple-600 ml-2">
            Trained {new Date(metrics.trained_at).toLocaleDateString()}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Test R² Score"
            value={metrics.test_r2.toFixed(3)}
            description="Variance explained"
            isGood={metrics.test_r2 > 0.7}
          />
          <MetricCard
            label="Test RMSE"
            value={metrics.test_rmse.toFixed(1)}
            description="Avg error (units)"
            isGood={metrics.test_rmse < 25}
          />
          <MetricCard
            label="Test MAPE"
            value={`${metrics.test_mape.toFixed(1)}%`}
            description="Avg % error"
            isGood={metrics.test_mape < 20}
          />
          <MetricCard
            label="CV R² (5-fold)"
            value={`${metrics.cv_r2_mean.toFixed(3)} ± ${metrics.cv_r2_std.toFixed(3)}`}
            description="Cross-validated"
            isGood={metrics.cv_r2_mean > 0.7}
          />
        </div>
        <div className="mt-3 text-xs text-purple-800 bg-white/60 rounded-lg p-3">
          <strong>Architecture:</strong> XGBoost Regressor ·{" "}
          {metrics.n_train_samples} train + {metrics.n_test_samples} test samples
          · {metrics.n_features} engineered features (seasonal indicators,
          operational metrics, lag features, item one-hot encoding)
        </div>
      </div>

      {/* Forecast control */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-redcross-500" size={20} />
          <h3 className="font-bold text-gray-900">Generate Forecast</h3>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} ({m.season})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 outline-none"
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <button
            onClick={handlePredict}
            disabled={predicting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-redcross-500 hover:bg-redcross-600 disabled:bg-gray-400 text-white rounded-lg font-medium"
          >
            {predicting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Predicting...
              </>
            ) : (
              <>
                <Zap size={16} />
                Generate Forecast
              </>
            )}
          </button>

          {forecast && (
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2 border border-redcross-300 text-redcross-700 hover:bg-redcross-50 rounded-lg font-medium"
            >
              <Download size={16} />
              Export Excel
            </button>
          )}
        </div>

        {predictError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {predictError}
          </div>
        )}
      </div>

      {/* Forecast results */}
      {forecast && (
        <ForecastResults forecast={forecast} selectedMonthData={selectedMonthData} />
      )}

      {/* Feature importance chart (always visible if loaded) */}
      {featureImportance && (
        <FeatureImportanceCard data={featureImportance} />
      )}
    </div>
  );
}

// ─────────────────────────────────────
// Sub-components
// ─────────────────────────────────────
function MetricCard({ label, value, description, isGood }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-purple-100">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className={`text-lg font-bold ${
          isGood ? "text-green-600" : "text-amber-600"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{description}</div>
    </div>
  );
}

function ForecastResults({ forecast, selectedMonthData }) {
  // Split predictions into significant changes vs stable
  const significant = forecast.predictions.filter(
    (p) => Math.abs(p.delta_pct) >= 15
  );
  const stable = forecast.predictions.filter((p) => Math.abs(p.delta_pct) < 15);

  return (
    <>
      {/* Summary banner */}
      <div className="bg-gradient-to-r from-redcross-50 via-pink-50 to-purple-50 border-2 border-redcross-200 rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3">
          <Brain className="text-redcross-600" size={28} />
          <div className="flex-1">
            <div className="font-bold text-gray-900 text-lg">
              Forecast for{" "}
              {MONTHS.find((m) => m.value === forecast.month)?.label}{" "}
              {forecast.year} · {forecast.season}
            </div>
            <div className="text-sm text-gray-600">
              {forecast.predictions.length} items · {significant.length} with
              significant changes (≥15%) ·{" "}
              <span className="text-purple-700 font-medium">
                Model confidence: R²={forecast.model_metrics.test_r2.toFixed(3)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Significant changes */}
      {significant.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-gray-200 mb-4 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-redcross-600" />
              Significant Changes ({significant.length})
            </h3>
            <span className="text-xs text-gray-500">
              Items with ≥15% change vs baseline
            </span>
          </div>
          <ForecastTable rows={significant} highlight />
        </div>
      )}

      {/* Stable items */}
      {stable.length > 0 && (
        <details className="bg-white rounded-xl border border-gray-200 mb-4">
          <summary className="px-5 py-3 cursor-pointer font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <Minus size={16} className="text-gray-400" />
            Stable Items ({stable.length}) — click to expand
          </summary>
          <ForecastTable rows={stable} highlight={false} />
        </details>
      )}
    </>
  );
}

function ForecastTable({ rows, highlight }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500 uppercase">
              Item
            </th>
            <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500 uppercase">
              Baseline
            </th>
            <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500 uppercase">
              Predicted
            </th>
            <th className="text-left px-5 py-2 text-xs font-semibold text-gray-500 uppercase">
              Unit
            </th>
            <th className="text-right px-5 py-2 text-xs font-semibold text-gray-500 uppercase">
              Change
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-5 py-2.5 font-medium text-gray-900">
                {row.item}
              </td>
              <td className="px-5 py-2.5 text-right text-gray-600">
                {row.baseline}
              </td>
              <td className="px-5 py-2.5 text-right font-bold text-gray-900">
                {row.predicted_quantity}
              </td>
              <td className="px-5 py-2.5 text-gray-500">{row.unit}</td>
              <td className="px-5 py-2.5 text-right">
                <ChangeBadge delta={row.delta_pct} highlight={highlight} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeBadge({ delta, highlight }) {
  if (delta === 0) {
    return <span className="text-gray-400 text-xs">No change</span>;
  }

  const isPositive = delta > 0;
  const absDelta = Math.abs(delta);

  let bgClass = "bg-gray-100 text-gray-600";
  let Icon = Minus;

  if (highlight && absDelta >= 30) {
    bgClass = isPositive
      ? "bg-red-100 text-red-700"
      : "bg-green-100 text-green-700";
    Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  } else if (highlight && absDelta >= 15) {
    bgClass = isPositive
      ? "bg-orange-100 text-orange-700"
      : "bg-emerald-100 text-emerald-700";
    Icon = isPositive ? TrendingUp : TrendingDown;
  } else {
    Icon = isPositive ? TrendingUp : TrendingDown;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${bgClass}`}
    >
      <Icon size={12} />
      {isPositive ? "+" : ""}
      {delta}%
    </span>
  );
}

function FeatureImportanceCard({ data }) {
  const chartData = data.features.map((f, i) => ({
    feature: f.length > 28 ? f.slice(0, 28) + "..." : f,
    importance: data.importances[i],
  }));

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 mt-6 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <BarChart3 size={18} className="text-purple-600" />
        <h3 className="font-bold text-gray-900">
          Top Features by Importance
        </h3>
        <span className="text-xs text-gray-500 ml-2">
          (How much each input drives the model's predictions)
        </span>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="feature"
              width={180}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value) => [value.toFixed(4), "Importance"]}
            />
            <Bar dataKey="importance" fill="#9333ea" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}