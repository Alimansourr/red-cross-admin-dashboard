import { useState } from "react";
import { Package } from "lucide-react";
import ReportsList, { formatTimestamp } from "../components/ReportsList";
import Modal from "../components/Modal";

export default function Replenishment() {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      <ReportsList
        collectionName="replenishment"
        title="Replenishment Requests"
        description="Items EMTs flagged for restocking from ambulance checklists."
        emptyIcon={Package}
        timestampField="submittedAt"
        searchFields={["emtName", "carNumber", "team"]}
        filters={[
          {
            label: "Car",
            key: "carNumber",
            options: ["186", "187", "188", "189", "190", "191", "192", "912"].map(
              (n) => ({ value: n, label: `Car ${n}` })
            ),
          },
        ]}
        columns={[
          {
            label: "Submitted",
            key: "submittedAt",
            render: (i) => formatTimestamp(i.submittedAt, "MMM d, yyyy h:mm a"),
          },
          {
            label: "Car",
            key: "carNumber",
            render: (i) => (
              <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono font-medium text-xs">
                {i.carNumber || "—"}
              </span>
            ),
          },
          { label: "EMT", key: "emtName", className: "font-medium text-gray-900" },
          { label: "Team", key: "team" },
          {
            label: "Items needed",
            key: "items",
            render: (i) => (
              <span
                className={`inline-flex px-2 py-0.5 rounded-md font-medium text-xs ${
                  (i.items?.length || 0) > 5
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {i.items?.length || 0} items
              </span>
            ),
          },
        ]}
        onRowClick={setViewing}
        csvExport={{
          filename: "replenishment",
          headers: [
            {
              label: "Submitted at",
              getValue: (i) => formatTimestamp(i.submittedAt, "yyyy-MM-dd HH:mm"),
            },
            { label: "Car", getValue: (i) => i.carNumber || "" },
            { label: "EMT", getValue: (i) => i.emtName || "" },
            { label: "Team", getValue: (i) => i.team || "" },
            {
              label: "Items count",
              getValue: (i) => (i.items?.length || 0).toString(),
            },
            {
              label: "Items list",
              getValue: (i) =>
                (i.items || [])
                  .map((it) => it.itemName || "")
                  .filter(Boolean)
                  .join("; "),
            },
          ],
        }}
      />

      {viewing && (
        <ReplenishmentDetailModal request={viewing} onClose={() => setViewing(null)} />
      )}
    </>
  );
}

function ReplenishmentDetailModal({ request, onClose }) {
  // Group items by section for cleaner view
  const grouped = (request.items || []).reduce((acc, item) => {
    const section = item.sectionTitle || "Uncategorized";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Replenishment — Car ${request.carNumber}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm bg-gray-50 rounded-lg p-3">
          <InfoBlock label="Car" value={request.carNumber} />
          <InfoBlock label="EMT" value={request.emtName} />
          <InfoBlock label="Team" value={request.team} />
          <InfoBlock
            label="Submitted"
            value={formatTimestamp(request.submittedAt)}
          />
          <InfoBlock label="Items" value={`${request.items?.length || 0} items`} />
        </div>

        {/* Items grouped */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Items needing restock
          </h4>
          {Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-gray-500 italic">No items.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([section, items]) => (
                <div
                  key={section}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-100 px-4 py-2 font-semibold text-sm text-gray-900">
                    {section}
                  </div>
                  <div className="divide-y divide-gray-100">
                    {items.map((item, i) => (
                      <div key={i} className="px-4 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              {item.itemName}
                            </div>
                            {item.subSectionTitle && (
                              <div className="text-xs text-gray-500">
                                {item.subSectionTitle}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              Required: {item.requirement || "—"}
                            </div>
                            <div className="text-sm font-mono text-red-600">
                              Current: {item.currentValue ?? "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium text-gray-900">{value || "—"}</div>
    </div>
  );
}