import { useState } from "react";
import { ClipboardList, CheckCircle2, XCircle } from "lucide-react";
import ReportsList, { formatTimestamp } from "../components/ReportsList";
import Modal from "../components/Modal";

export default function Checklists() {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      <ReportsList
        collectionName="checklists"
        title="Ambulance Checklists"
        description="All ambulance checklists submitted by EMTs."
        emptyIcon={ClipboardList}
        timestampField="submittedAt"
        searchFields={["emtName", "carNumber", "team", "shift"]}
        filters={[
          {
            label: "Shift",
            key: "shift",
            options: [
              { value: "morning", label: "Morning" },
              { value: "evening", label: "Evening" },
            ],
          },
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
            label: "Date",
            key: "submittedAt",
            render: (item) => formatTimestamp(item.submittedAt, "MMM d, yyyy"),
          },
          { label: "Time", key: "submittedAt", render: (item) => formatTimestamp(item.submittedAt, "h:mm a") },
          { label: "EMT", key: "emtName", className: "font-medium text-gray-900" },
          { label: "Team", key: "team" },
          {
            label: "Car",
            key: "carNumber",
            render: (item) => (
              <span className="inline-flex px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-mono font-medium text-xs">
                {item.carNumber || "—"}
              </span>
            ),
          },
          {
            label: "Shift",
            key: "shift",
            render: (item) => (
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                  item.shift === "morning"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-indigo-100 text-indigo-700"
                }`}
              >
                {item.shift || "—"}
              </span>
            ),
          },
        ]}
        onRowClick={setViewing}
        csvExport={{
          filename: "checklists",
          headers: [
            {
              label: "Date",
              getValue: (i) => formatTimestamp(i.submittedAt, "yyyy-MM-dd HH:mm"),
            },
            { label: "EMT", getValue: (i) => i.emtName || "" },
            { label: "Team", getValue: (i) => i.team || "" },
            { label: "Car", getValue: (i) => i.carNumber || "" },
            { label: "Shift", getValue: (i) => i.shift || "" },
            { label: "Subcode", getValue: (i) => i.subcode || "" },
          ],
        }}
      />

      {viewing && (
        <ChecklistDetailModal
          checklist={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}

function ChecklistDetailModal({ checklist, onClose }) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Checklist — Car ${checklist.carNumber}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Header info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <InfoBlock label="EMT" value={checklist.emtName} />
          <InfoBlock label="Team" value={checklist.team} />
          <InfoBlock label="Shift" value={checklist.shift} />
          <InfoBlock label="Submitted" value={formatTimestamp(checklist.submittedAt)} />
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {(checklist.sections || []).map((section, sIdx) => (
            <div
              key={sIdx}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-900">
                {section.title}
              </div>
              <div className="divide-y divide-gray-100">
                {(section.subSections || []).map((sub, ssIdx) => (
                  <div key={ssIdx} className="p-4">
                    <h4 className="font-medium text-gray-700 mb-2">
                      {sub.title}
                    </h4>
                    <div className="space-y-1">
                      {(sub.items || []).map((item, iIdx) => (
                        <ChecklistItemRow key={iIdx} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(!checklist.sections || checklist.sections.length === 0) && (
            <p className="text-gray-500 text-center py-4">
              No checklist data available.
            </p>
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

function ChecklistItemRow({ item }) {
  // Items can be checkbox (bool) or text/number values
  const isBoolean = item.type === "bool" || typeof item.value === "boolean";
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-gray-700">{item.name}</span>
      <div className="flex items-center gap-3">
        {item.requirement && (
          <span className="text-xs text-gray-400">
            req: {item.requirement}
          </span>
        )}
        {isBoolean ? (
          item.value ? (
            <CheckCircle2 size={16} className="text-green-600" />
          ) : (
            <XCircle size={16} className="text-red-500" />
          )
        ) : (
          <span className="font-mono text-gray-900">
            {item.value ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="font-medium text-gray-900 mt-0.5">{value || "—"}</div>
    </div>
  );
}