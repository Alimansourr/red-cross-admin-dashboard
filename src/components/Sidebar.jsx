import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Siren,
  Truck,
  Users,
  Heart,  
  Megaphone,
  Calendar,
  CalendarDays,
  Building2,
  ClipboardList,
  Stethoscope,
  MessageSquare,
  Package,
  LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/emergencies", icon: Siren, label: "Emergencies" },
  { to: "/transport", icon: Truck, label: "Transport Requests" },
  { to: "/users", icon: Users, label: "Users (EMTs)" },
  { to: "/patients", icon: Heart, label: "Patients" },
  { to: "/announcements", icon: Megaphone, label: "Announcements" },
  { to: "/events", icon: Calendar, label: "Events" },
  { to: "/schedule", icon: CalendarDays, label: "Weekly Schedule" },
  { to: "/stations", icon: Building2, label: "Stations" },
  { to: "/station-info", icon: Building2, label: "Station Info" }, 
  { to: "/checklists", icon: ClipboardList, label: "Checklists" },
  { to: "/missions", icon: Stethoscope, label: "Missions" },
  { to: "/wound-reports", icon: Stethoscope, label: "Wound Care Reports" },
  { to: "/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/replenishment", icon: Package, label: "Replenishment" },
];

export default function Sidebar() {
  const { profile, logout } = useAuth();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo / Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-redcross-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">+</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Red Cross</h1>
            <p className="text-xs text-gray-500">Admin Dashboard</p>
          </div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors text-sm ${
                isActive
                  ? "bg-redcross-50 text-redcross-600 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">
            {profile?.fullName || "Admin"}
          </p>
          <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}