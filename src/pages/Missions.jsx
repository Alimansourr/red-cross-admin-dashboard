import { useState } from "react";
import { Stethoscope } from "lucide-react";
import ReportsList, { formatTimestamp } from "../components/ReportsList";
import Modal from "../components/Modal";

export default function Missions() {
  const [viewing, setViewing] = useState(null);

  return (
    <>
      <ReportsList
        collectionName="missions"
        title="Missions"
        description="All missions logged by EMTs."
        emptyIcon={Stethoscope}
        timestampField="submittedAt"
        searchFields={[
          "submittedByName",
          "carNumber",
          "missionType",
          "patient.name",
          "driver",
          "missionLeader",
        ]}
        filters={[
          {
            label: "Status",
            key: "missionStatus",
            options: [
              { value: "Completed", label: "Completed" },
              { value: "Cancelled", label: "Cancelled" },
              { value: "In Progress", label: "In Progress" },
            ],
          },
        ]}
        columns={[
          {
            label: "Date",
            key: "missionDate",
            render: (i) => i.missionDate || formatTimestamp(i.submittedAt, "MMM d, yyyy"),
          },
          {
            label: "Patient",
            key: "patient.name",
            className: "font-medium text-gray-900",
            render: (i) => i.patient?.name || "—",
          },
          {
            label: "Type",
            key: "missionType",
            render: (i) => (
              <span className="text-sm text-gray-700">
                {i.missionType || "—"}
              </span>
            ),
          },
          {
            label: "Status",
            key: "missionStatus",
            render: (i) => {
              const colors = {
                Completed: "bg-green-100 text-green-700",
                Cancelled: "bg-gray-100 text-gray-700",
                "In Progress": "bg-blue-100 text-blue-700",
              };
              const cls = colors[i.missionStatus] || "bg-gray-100 text-gray-700";
              return (
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${cls}`}>
                  {i.missionStatus || "—"}
                </span>
              );
            },
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
          { label: "Driver", key: "driver" },
          { label: "Leader", key: "missionLeader" },
          { label: "Logged by", key: "submittedByName" },
        ]}
        onRowClick={setViewing}
        csvExport={{
          filename: "missions",
          headers: [
            { label: "Date", getValue: (i) => i.missionDate || "" },
            { label: "Patient name", getValue: (i) => i.patient?.name || "" },
            { label: "Patient age", getValue: (i) => i.patient?.age || "" },
            { label: "Patient gender", getValue: (i) => i.patient?.gender || "" },
            { label: "Mission type", getValue: (i) => i.missionType || "" },
            { label: "Status", getValue: (i) => i.missionStatus || "" },
            { label: "Car", getValue: (i) => i.carNumber || "" },
            { label: "Driver", getValue: (i) => i.driver || "" },
            { label: "Leader", getValue: (i) => i.missionLeader || "" },
            { label: "Departure", getValue: (i) => i.departureArea || "" },
            { label: "Stop 1", getValue: (i) => i.stop1 || "" },
            { label: "Stop 2", getValue: (i) => i.stop2 || "" },
            { label: "Logged by", getValue: (i) => i.submittedByName || "" },
            {
              label: "Submitted at",
              getValue: (i) => formatTimestamp(i.submittedAt, "yyyy-MM-dd HH:mm"),
            },
          ],
        }}
      />

      {viewing && <MissionDetailModal mission={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function MissionDetailModal({ mission, onClose }) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Mission — ${mission.missionDate || "Unknown date"}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {/* Mission info */}
        <Section title="Mission">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoBlock label="Type" value={mission.missionType} />
            <InfoBlock label="Status" value={mission.missionStatus} />
            <InfoBlock label="Date" value={mission.missionDate} />
            <InfoBlock label="Car" value={mission.carNumber} />
            <InfoBlock label="Driver" value={mission.driver} />
            <InfoBlock label="Mission Leader" value={mission.missionLeader} />
          </div>
        </Section>

        {/* Route */}
        <Section title="Route">
          <div className="space-y-2 text-sm">
            <div className="flex gap-3">
              <span className="w-24 text-gray-500">Departure:</span>
              <span className="text-gray-900">{mission.departureArea || "—"}</span>
            </div>
            <div className="flex gap-3">
              <span className="w-24 text-gray-500">Stop 1:</span>
              <span className="text-gray-900">{mission.stop1 || "—"}</span>
            </div>
            <div className="flex gap-3">
              <span className="w-24 text-gray-500">Stop 2:</span>
              <span className="text-gray-900">{mission.stop2 || "—"}</span>
            </div>
          </div>
        </Section>

        {/* Patient */}
        <Section title="Patient">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <InfoBlock label="Name" value={mission.patient?.name} />
            <InfoBlock label="Age" value={mission.patient?.age} />
            <InfoBlock label="Gender" value={mission.patient?.gender} />
          </div>
        </Section>

        {/* Submission info */}
        <Section title="Submission">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoBlock label="Logged by" value={mission.submittedByName} />
            <InfoBlock
              label="Submitted at"
              value={formatTimestamp(mission.submittedAt)}
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