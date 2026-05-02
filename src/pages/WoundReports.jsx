import { useState } from "react";
import { Stethoscope } from "lucide-react";
import ReportsList, { formatTimestamp } from "../components/ReportsList";
import Modal from "../components/Modal";

export default function WoundReports() {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      <ReportsList
        collectionName="wound_care_reports"
        title="Wound Care Reports"
        description="Wound care reports submitted by EMTs."
        emptyIcon={Stethoscope}
        timestampField="submittedAt"
        searchFields={[
          "submittedByName",
          "emtName",
          "patient.firstName",
          "patient.lastName",
          "patient.nationality",
        ]}
        columns={[
          {
            label: "Date",
            key: "date",
            render: (i) => i.date || formatTimestamp(i.submittedAt, "MMM d, yyyy"),
          },
          { label: "Time", key: "time" },
          {
            label: "Patient",
            key: "patient.firstName",
            className: "font-medium text-gray-900",
            render: (i) => {
              const fn = i.patient?.firstName || "";
              const ln = i.patient?.lastName || "";
              return `${fn} ${ln}`.trim() || "—";
            },
          },
          {
            label: "Age",
            key: "patient.age",
            render: (i) => i.patient?.age || "—",
          },
          {
            label: "Injuries",
            key: "injuryTypes",
            render: (i) => (
              <span className="text-xs text-gray-700">
                {(i.injuryTypes || []).slice(0, 2).join(", ")}
                {(i.injuryTypes || []).length > 2 &&
                  ` +${i.injuryTypes.length - 2}`}
              </span>
            ),
          },
          { label: "EMT", key: "emtName" },
        ]}
        onRowClick={setViewing}
        csvExport={{
          filename: "wound_care_reports",
          headers: [
            { label: "Date", getValue: (i) => i.date || "" },
            { label: "Time", getValue: (i) => i.time || "" },
            { label: "First Name", getValue: (i) => i.patient?.firstName || "" },
            { label: "Last Name", getValue: (i) => i.patient?.lastName || "" },
            { label: "Age", getValue: (i) => i.patient?.age || "" },
            { label: "Gender", getValue: (i) => i.patient?.gender || "" },
            { label: "Nationality", getValue: (i) => i.patient?.nationality || "" },
            {
              label: "Injury Types",
              getValue: (i) => (i.injuryTypes || []).join("; "),
            },
            {
              label: "Injury Sites",
              getValue: (i) => (i.injurySites || []).join("; "),
            },
            { label: "Additional Injury", getValue: (i) => i.additionalInjury || "" },
            {
              label: "Materials Used",
              getValue: (i) => (i.materialsUsed || []).join("; "),
            },
            { label: "EMT", getValue: (i) => i.emtName || "" },
            { label: "Notes", getValue: (i) => i.notes || "" },
            {
              label: "Submitted at",
              getValue: (i) => formatTimestamp(i.submittedAt, "yyyy-MM-dd HH:mm"),
            },
          ],
        }}
      />

      {viewing && <WoundReportDetailModal report={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function WoundReportDetailModal({ report, onClose }) {
  const fullName =
    `${report.patient?.firstName || ""} ${report.patient?.lastName || ""}`.trim() ||
    "Unknown Patient";

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Wound Care Report — ${fullName}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* When */}
        <Section title="When">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoBlock label="Date" value={report.date} />
            <InfoBlock label="Time" value={report.time} />
          </div>
        </Section>

        {/* Patient */}
        <Section title="Patient">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <InfoBlock label="First Name" value={report.patient?.firstName} />
            <InfoBlock label="Last Name" value={report.patient?.lastName} />
            <InfoBlock label="Age" value={report.patient?.age} />
            <InfoBlock label="Gender" value={report.patient?.gender} />
            <InfoBlock label="Nationality" value={report.patient?.nationality} />
          </div>
        </Section>

        {/* Injuries */}
        <Section title="Injuries">
          <Tags label="Types" items={report.injuryTypes} />
          <Tags label="Sites" items={report.injurySites} />
          {report.additionalInjury && (
            <div className="mt-2 text-sm">
              <div className="text-xs text-gray-500">Additional</div>
              <div className="text-gray-900">{report.additionalInjury}</div>
            </div>
          )}
        </Section>

        {/* Materials */}
        <Section title="Materials Used">
          <Tags label="" items={report.materialsUsed} color="green" />
        </Section>

        {/* Notes */}
        {report.notes && (
          <Section title="Notes">
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {report.notes}
            </p>
          </Section>
        )}

        {/* Submission */}
        <Section title="Submission">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoBlock label="EMT" value={report.emtName} />
            <InfoBlock
              label="Submitted at"
              value={formatTimestamp(report.submittedAt)}
            />
          </div>
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

function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="bg-gray-50 rounded-lg p-3">{children}</div>
    </div>
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

function Tags({ label, items, color = "blue" }) {
  if (!items || items.length === 0) {
    return label ? (
      <div className="text-xs text-gray-400">{label}: —</div>
    ) : (
      <div className="text-xs text-gray-400">None</div>
    );
  }
  const colorClass =
    color === "green"
      ? "bg-green-100 text-green-700"
      : "bg-blue-100 text-blue-700";

  return (
    <div className="mb-2 last:mb-0">
      {label && <div className="text-xs text-gray-500 mb-1">{label}</div>}
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span
            key={i}
            className={`text-xs px-2 py-0.5 rounded ${colorClass}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}