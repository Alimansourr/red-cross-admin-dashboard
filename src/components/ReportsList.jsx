import { useEffect, useState } from "react";
import { Search, Filter, FileText, Eye, Download } from "lucide-react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { format } from "date-fns";

/**
 * Shared list view for read-only Firestore collections.
 *
 * Props:
 *   collectionName: Firestore collection (e.g., "missions")
 *   title, description, emptyIcon: page header info
 *   timestampField: field to order by (default "submittedAt")
 *   columns: [{ label, key, render?, className? }]
 *   searchFields: array of field names to search across
 *   filters: optional [{ label, key, options: [{ value, label }] }]
 *   onRowClick: function(item) for opening details
 *   csvExport: { filename, headers: [{label, key, getValue}] } | null
 */
export default function ReportsList({
  collectionName,
  title,
  description,
  emptyIcon: EmptyIcon = FileText,
  timestampField = "submittedAt",
  columns,
  searchFields = [],
  filters = [],
  onRowClick,
  csvExport = null,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  async function loadItems() {
    setLoading(true);
    try {
      let snap;
      try {
        const q = query(
          collection(db, collectionName),
          orderBy(timestampField, "desc")
        );
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(collection(db, collectionName));
      }
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(`Failed to load ${collectionName}:`, err);
    } finally {
      setLoading(false);
    }
  }

  // Apply search + filters
  const filtered = items.filter((item) => {
    // Search
    if (search.trim() && searchFields.length > 0) {
      const term = search.toLowerCase();
      const matches = searchFields.some((field) => {
        const value = getNested(item, field);
        return String(value || "").toLowerCase().includes(term);
      });
      if (!matches) return false;
    }
    // Filters
    for (const filter of filters) {
      const selected = filterValues[filter.key];
      if (selected && selected !== "all") {
        const value = getNested(item, filter.key);
        if (String(value) !== selected) return false;
      }
    }
    return true;
  });

  function exportCSV() {
    if (!csvExport || filtered.length === 0) return;
    const { filename, headers } = csvExport;
    const headerRow = headers.map((h) => h.label);
    const dataRows = filtered.map((item) =>
      headers.map((h) => h.getValue(item))
    );
    const csv = [headerRow, ...dataRows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">
            {description} {filtered.length} of {items.length} shown.
          </p>
        </div>
        {csvExport && filtered.length > 0 && (
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium text-sm"
          >
            <Download size={16} />
            Export CSV
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        {searchFields.length > 0 && (
          <div className="flex-1 min-w-[200px] relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none"
            />
          </div>
        )}
        {filters.map((filter) => (
          <div key={filter.key} className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filterValues[filter.key] || "all"}
              onChange={(e) =>
                setFilterValues((prev) => ({
                  ...prev,
                  [filter.key]: e.target.value,
                }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-redcross-500 focus:border-transparent outline-none text-sm"
            >
              <option value="all">All {filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <EmptyIcon className="mx-auto mb-3" size={40} />
            <p>No records to show</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.label}
                      className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  {onRowClick && <th className="px-6 py-3 w-12"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                    className={
                      onRowClick
                        ? "hover:bg-gray-50 cursor-pointer"
                        : "hover:bg-gray-50"
                    }
                  >
                    {columns.map((col) => (
                      <td
                        key={col.label}
                        className={`px-6 py-3 text-sm ${
                          col.className || "text-gray-700"
                        }`}
                      >
                        {col.render
                          ? col.render(item)
                          : String(getNested(item, col.key) ?? "—")}
                      </td>
                    ))}
                    {onRowClick && (
                      <td className="px-6 py-3 text-right">
                        <Eye size={16} className="text-gray-400" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper: support nested keys like "patient.name"
function getNested(obj, key) {
  if (!key) return undefined;
  return key.split(".").reduce((acc, k) => acc?.[k], obj);
}

// Helper for formatting timestamps
export function formatTimestamp(ts, formatStr = "MMM d, yyyy h:mm a") {
  if (!ts) return "—";
  if (ts.toDate) return format(ts.toDate(), formatStr);
  if (ts instanceof Date) return format(ts, formatStr);
  return String(ts);
}