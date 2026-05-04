import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/**
 * Get this week's team leaders by reading weekly_schedule
 * Returns: [{ day, teamLeader, leaderPhone, emtData? }]
 */
export async function getThisWeeksTeamLeaders() {
  const leaders = [];
  for (const day of DAYS) {
    try {
      const snap = await getDoc(doc(db, "weekly_schedule", day));
      if (snap.exists()) {
        const data = snap.data();
        if (data.teamLeader && data.teamLeader.trim()) {
          leaders.push({
            day,
            teamLeader: data.teamLeader,
            leaderPhone: data.leaderPhone || "",
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to load schedule for ${day}:`, err);
    }
  }

  // Try to enrich with user UID/email by matching name to /users
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    leaders.forEach((leader) => {
      // Match by fullName (case-insensitive)
      const match = users.find(
        (u) =>
          (u.fullName || "").toLowerCase().trim() ===
          leader.teamLeader.toLowerCase().trim()
      );
      if (match) {
        leader.emtId = match.id;
        leader.email = match.email;
        leader.team = match.team;
      }
    });
  } catch (err) {
    console.warn("Could not enrich leaders with user data:", err);
  }

  return leaders;
}

/**
 * Assign an emergency or transport request to an EMT
 * @param {string} collectionName - 'emergency_requests' or 'transport_requests'
 * @param {string} requestId
 * @param {object} leader - { teamLeader, leaderPhone, emtId, day }
 */
export async function assignRequest(collectionName, requestId, leader) {
  if (!leader.emtId) {
    throw new Error(
      `Cannot assign — "${leader.teamLeader}" has no matching user account in the database. Make sure their name in the Weekly Schedule matches their full name in Users (case-insensitive).`
    );
  }

  await updateDoc(doc(db, collectionName, requestId), {
    assignedToEmtId: leader.emtId,
    assignedToEmtName: leader.teamLeader,
    assignedToPhone: leader.leaderPhone || "",
    assignedDay: leader.day,
    assignedAt: new Date(),
    status: "dispatched",
    statusUpdatedAt: new Date(),
  });
}

/**
 * Unassign a request (remove EMT, set back to pending)
 */
export async function unassignRequest(collectionName, requestId) {
  await updateDoc(doc(db, collectionName, requestId), {
    assignedToEmtId: null,
    assignedToEmtName: null,
    assignedToPhone: null,
    assignedDay: null,
    assignedAt: null,
    status: "pending",
    statusUpdatedAt: new Date(),
  });
}