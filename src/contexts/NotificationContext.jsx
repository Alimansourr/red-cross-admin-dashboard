import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

// Short embedded notification sound (base64)
// A small "ding" sound, ~0.3 seconds
const NOTIFICATION_SOUND_URL =
  "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT5vAAA=";

// Better fallback: use a known free CDN sound
const FALLBACK_SOUND =
  "https://cdn.jsdelivr.net/gh/anars/blank-audio@master/250-milliseconds-of-silence.mp3";

export function NotificationProvider({ children }) {
  const { isAdmin, user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Track previous IDs to detect what's NEW
  const seenIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const audioRef = useRef(null);
  const originalTitleRef = useRef(document.title);

  // Initialize audio + ask for browser notification permission
  useEffect(() => {
    if (!isAdmin) return;

    // Create audio element
    audioRef.current = new Audio();
    audioRef.current.volume = 0.5;
    // Use a reliable web-friendly notification sound
    audioRef.current.src =
      "https://actions.google.com/sounds/v1/alarms/beep_short.ogg";
    audioRef.current.load();

    // Request browser notification permission
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

  // Subscribe to pending emergencies
  useEffect(() => {
    if (!isAdmin || !user) return;

    // Reset on mount
    isInitialLoadRef.current = true;
    seenIdsRef.current = new Set();

    // Listen to BOTH regular and quick emergency requests, status="pending"
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
        // Only count as "new" after initial load
        if (!isInitialLoadRef.current) {
          newRequests.push({ id: doc.id, source, ...doc.data() });
        }
      }
    });

    // Remove resolved requests from seen set
    const currentIds = new Set(snap.docs.map((d) => `${source}_${d.id}`));
    Array.from(seenIdsRef.current).forEach((id) => {
      if (id.startsWith(`${source}_`) && !currentIds.has(id)) {
        seenIdsRef.current.delete(id);
      }
    });

    // Trigger alerts for new requests
    if (newRequests.length > 0 && !isInitialLoadRef.current) {
      newRequests.forEach((req) => triggerAlert(req));
    }

    isInitialLoadRef.current = false;
    updatePendingCount();
  }

  function updatePendingCount() {
    // Count from seenIdsRef (which mirrors current pending items)
    const count = seenIdsRef.current.size;
    setPendingCount(count);

    // Update tab title
    if (count > 0) {
      document.title = `(${count}) ${originalTitleRef.current}`;
    } else {
      document.title = originalTitleRef.current;
    }
  }

  function triggerAlert(request) {
    // 1. Play sound
    playSound();

    // 2. Browser notification (if permitted)
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
          tag: request.id, // prevents duplicate notifications
          requireInteraction: false,
        });

        // Click notification → focus the tab and go to emergencies page
        notif.onclick = () => {
          window.focus();
          window.location.href = "/emergencies";
          notif.close();
        };

        // Auto-close after 8 seconds
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
          // Browsers block autoplay until user interacts with page
          console.warn("Sound blocked by browser:", err.message);
        });
      }
    } catch (err) {
      console.warn("Audio play error:", err);
    }
  }

  // Cleanup tab title on unmount
  useEffect(() => {
    return () => {
      document.title = originalTitleRef.current;
    };
  }, []);

  // Manually trigger test notification (useful for demo!)
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