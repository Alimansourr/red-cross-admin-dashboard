import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const { isAdmin, user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const seenIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const audioRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  useEffect(() => {
    if (!isAdmin) return;

    audioRef.current = new Audio();
    audioRef.current.volume = 0.5;
    audioRef.current.src =
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
    audioRef.current.load();

    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        setPermissionGranted(true);
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((perm) => {
          setPermissionGranted(perm === "granted");
        });
      }
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || !user) return;

    isInitialLoadRef.current = true;
    seenIdsRef.current = new Set();

    const unsubRegular = onSnapshot(
      query(
        collection(db, "emergency_requests"),
        where("status", "==", "pending")
      ),
      (snap) => handleSnapshot(snap, "regular")
    );

    const unsubQuick = onSnapshot(
      query(
        collection(db, "quick_emergency_requests"),
        where("status", "==", "pending")
      ),
      (snap) => handleSnapshot(snap, "quick")
    );

    return () => {
      unsubRegular();
      unsubQuick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user]);

  function handleSnapshot(snap, source) {
    const newRequests = [];

    snap.docs.forEach((doc) => {
      const id = `${source}_${doc.id}`;
      if (!seenIdsRef.current.has(id)) {
        seenIdsRef.current.add(id);
        if (!isInitialLoadRef.current) {
          newRequests.push({ id: doc.id, source, ...doc.data() });
        }
      }
    });

    const currentIds = new Set(snap.docs.map((d) => `${source}_${d.id}`));
    Array.from(seenIdsRef.current).forEach((id) => {
      if (id.startsWith(`${source}_`) && !currentIds.has(id)) {
        seenIdsRef.current.delete(id);
      }
    });

    if (newRequests.length > 0 && !isInitialLoadRef.current) {
      newRequests.forEach((req) => triggerAlert(req));
    }

    isInitialLoadRef.current = false;
    updatePendingCount();
  }

  function updatePendingCount() {
    const count = seenIdsRef.current.size;
    setPendingCount(count);

    if (count > 0) {
      document.title = `(${count}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }

  function triggerAlert(request) {
    playSound();

    if (permissionGranted && "Notification" in window) {
      const isQuick = request.source === "quick";
      const title = isQuick
        ? "🚨 Quick Emergency Call"
        : "🚨 New Emergency Request";
      const body = `${request.patientName || "Anonymous"}: ${
        request.emergencyType || "Emergency"
      }${request.assignedStationName ? ` → ${request.assignedStationName}` : ""}`;

      try {
        const notif = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: request.id,
          requireInteraction: false,
        });

        notif.onclick = () => {
          window.focus();
          window.location.href = "/emergencies";
          notif.close();
        };

        setTimeout(() => notif.close(), 8000);
      } catch (err) {
        console.warn("Failed to show notification:", err);
      }
    }
  }

  function playSound() {
    if (!audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise) {
        playPromise.catch((err) => {
          console.warn("Sound blocked by browser:", err.message);
        });
      }
    } catch (err) {
      console.warn("Audio play error:", err);
    }
  }

  useEffect(() => {
    const originalTitle = originalTitleRef.current;
    return () => {
      document.title = originalTitle;
    };
  }, []);

  function testNotification() {
    triggerAlert({
      id: "test",
      source: "regular",
      patientName: "Test Patient",
      emergencyType: "Test Alert",
      assignedStationName: "Test Station",
    });
  }

  const value = {
    pendingCount,
    permissionGranted,
    testNotification,
    requestPermission: async () => {
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        setPermissionGranted(perm === "granted");
      }
    },
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);