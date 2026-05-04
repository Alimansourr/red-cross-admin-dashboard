import { useEffect, useState, useRef } from "react";
import { UserCheck, ChevronDown, Loader2, X, Calendar } from "lucide-react";
import { getThisWeeksTeamLeaders, assignRequest, unassignRequest } from "../services/assignmentService";

export default function AssignButton({ request, collectionName }) {
  const [open, setOpen] = useState(false);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      window.addEventListener("mousedown", handler);
      // Load leaders when dropdown opens
      if (leaders.length === 0) loadLeaders();
    }
    return () => window.removeEventListener("mousedown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadLeaders() {
    setLoading(true);
    setError("");
    try {
      const data = await getThisWeeksTeamLeaders();
      setLeaders(data);
    } catch (err) {
      setError("Failed to load team leaders: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign(leader) {
    setAssigning(true);
    setError("");
    try {
      await assignRequest(collectionName, request.id, leader);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign() {
    if (!window.confirm(`Unassign from ${request.assignedToEmtName}?`)) return;
    setAssigning(true);
    setError("");
    try {
      await unassignRequest(collectionName, request.id);
      setOpen(false);
    } catch (err) {
      setError("Failed to unassign: " + err.message);
    } finally {
      setAssigning(false);
    }
  }

  const isAssigned = !!request.assignedToEmtId;

  return (
    <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        disabled={assigning}
        className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isAssigned
            ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
            : "bg-redcross-100 text-redcross-700 hover:bg-redcross-200"
        }`}
        title={isAssigned ? `Assigned to ${request.assignedToEmtName}` : "Assign to team leader"}
      >
        {assigning ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <UserCheck size={12} />
        )}
        <span className="truncate max-w-[120px]">
          {isAssigned ? request.assignedToEmtName : "Assign"}
        </span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 w-72 py-1 max-h-96 overflow-y-auto">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
              {isAssigned ? "Reassign or" : "Assign to"} Team Leader
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>

          {/* Currently assigned (with unassign) */}
          {isAssigned && (
            <div className="px-3 py-2 border-b border-gray-100 bg-blue-50">
              <div className="text-xs text-gray-500 mb-1">Currently assigned to:</div>
              <div className="font-medium text-gray-900 text-sm">
                {request.assignedToEmtName}
              </div>
              {request.assignedDay && (
                <div className="text-xs text-gray-500">
                  {request.assignedDay} team leader
                </div>
              )}
              <button
                onClick={handleUnassign}
                disabled={assigning}
                className="mt-1 text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Unassign
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin mx-auto mb-1" />
              Loading...
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-700 bg-red-50">
              {error}
            </div>
          )}

          {/* Leader list */}
          {!loading && leaders.length === 0 && !error && (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No team leaders set in Weekly Schedule.
              <br />
              <span className="text-xs">
                Go to Schedule page to add them.
              </span>
            </div>
          )}

          {!loading && leaders.length > 0 && (
            <div className="py-1">
              {leaders.map((leader) => {
                const isCurrent = leader.emtId === request.assignedToEmtId;
                const noMatch = !leader.emtId;
                return (
                  <button
                    key={`${leader.day}_${leader.teamLeader}`}
                    onClick={() => !isCurrent && !noMatch && handleAssign(leader)}
                    disabled={assigning || isCurrent || noMatch}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 flex items-start gap-2 ${
                      isCurrent ? "bg-blue-50" : ""
                    }`}
                  >
                    <Calendar size={12} className="text-gray-400 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">
                        {leader.teamLeader}
                        {isCurrent && (
                          <span className="text-xs text-blue-600 ml-2">
                            (assigned)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {leader.day}
                        {leader.leaderPhone && ` · ${leader.leaderPhone}`}
                      </div>
                      {noMatch && (
                        <div className="text-xs text-amber-600 mt-0.5">
                          ⚠️ Name doesn't match any user account
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}