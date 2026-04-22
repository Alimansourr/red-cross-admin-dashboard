import { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

function App() {
  const [user, setUser] = useState(null);        // Firebase Auth user
  const [profile, setProfile] = useState(null);  // Firestore user doc
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Watch auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch their Firestore profile to check role
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            setProfile(snap.data());
          } else {
            setError("No user profile found in database.");
            await signOut(auth);
          }
        } catch (err) {
          setError("Error loading profile: " + err.message);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <div style={styles.center}>Loading...</div>;

  // Not logged in → show login form
  if (!user) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1>Red Cross Admin</h1>
          <p style={{ color: "#666" }}>Sign in to continue</p>
          <form onSubmit={handleLogin}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
            />
            <button type="submit" style={styles.button}>Log in</button>
          </form>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </div>
    );
  }

  // Logged in but not an admin
  if (profile?.role !== "admin") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1>Access Denied</h1>
          <p>
            You're signed in as <b>{profile?.fullName || user.email}</b>, but this
            dashboard is only for administrators. Your role: <b>{profile?.role}</b>.
          </p>
          <button onClick={handleLogout} style={styles.button}>Sign out</button>
        </div>
      </div>
    );
  }

  // Logged in as admin
  return (
    <div style={{ padding: 30, fontFamily: "sans-serif" }}>
      <header style={styles.header}>
        <h1>Red Cross Admin Dashboard</h1>
        <div>
          <span style={{ marginRight: 15 }}>👤 {profile.fullName}</span>
          <button onClick={handleLogout} style={styles.button}>Sign out</button>
        </div>
      </header>
      <p>✅ Welcome, admin! You can now build features that read/write Firestore.</p>
    </div>
  );
}

const styles = {
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    fontFamily: "sans-serif",
    background: "#f5f5f5",
  },
  card: {
    background: "white",
    padding: 30,
    borderRadius: 8,
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    width: 350,
  },
  input: {
    display: "block",
    width: "100%",
    padding: 10,
    marginBottom: 10,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box",
  },
  button: {
    padding: "10px 20px",
    background: "#c8102e",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #eee",
    paddingBottom: 15,
    marginBottom: 20,
  },
};

export default App;