import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Calendar, Users, Shield, Clock, AlertTriangle, Home,
  Menu, X, ChevronDown, LogOut, Settings, Layers
} from "lucide-react";

const navItems = [
  { label: "Dashboard", page: "Dashboard", icon: Home, roles: ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"] },
  { label: "Schedule", page: "Schedule", icon: Calendar, roles: ["admin", "referee_coordinator", "team_manager", "referee", "timekeeper"] },
  { label: "Teams & Divisions", page: "TeamsAndDivisions", icon: Layers, roles: ["admin"] },
  { label: "Ice Slots & Arenas", page: "IceSlots", icon: Clock, roles: ["admin"] },
  { label: "Schedule Builder", page: "ScheduleBuilder", icon: Settings, roles: ["admin"] },
  { label: "Blackout Dates", page: "BlackoutDates", icon: AlertTriangle, roles: ["admin", "team_manager"] },
  { label: "Officials", page: "Officials", icon: Shield, roles: ["admin", "referee_coordinator"] },
  { label: "Official Availability", page: "OfficialAvailability", icon: Calendar, roles: ["referee", "timekeeper"] },
  { label: "Assign Officials", page: "AssignOfficials", icon: Users, roles: ["admin", "referee_coordinator"] },
  { label: "Forfeits", page: "Forfeits", icon: AlertTriangle, roles: ["admin", "referee_coordinator", "team_manager"] },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const userRole = user?.role || "team_manager";

  const visibleNav = navItems.filter(item => item.roles.includes(userRole) || userRole === "admin");

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <style>{`
        :root {
          --primary: #0ea5e9;
          --primary-dark: #0284c7;
          --surface: #1e2533;
          --surface2: #161c27;
        }
        body { background: #0d1117; }
      `}</style>

      {/* Top nav */}
      <header className="bg-[#161c27] border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <Link to={createPageUrl("Dashboard")} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">🏒</span>
              </div>
              <span className="font-bold text-lg text-white hidden sm:block">HockeyOps</span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {visibleNav.slice(0, 6).map(item => (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  currentPageName === item.page
                    ? "bg-sky-500/20 text-sky-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            {visibleNav.length > 6 && (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5"
                >
                  More <ChevronDown className="w-3 h-3" />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-[#1e2533] border border-gray-700 rounded-lg shadow-xl w-52 py-1 z-50">
                    {visibleNav.slice(6).map(item => (
                      <Link
                        key={item.page}
                        to={createPageUrl(item.page)}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5"
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-sky-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {user.full_name?.[0] || user.email?.[0] || "U"}
                </div>
                <span className="text-sm text-gray-300 hidden sm:block">{user.full_name || user.email}</span>
                <button
                  onClick={() => base44.auth.logout()}
                  className="p-1.5 text-gray-400 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => base44.auth.redirectToLogin()}
                className="bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lg:hidden bg-[#161c27] border-b border-gray-800 px-4 py-3 space-y-1">
          {visibleNav.map(item => (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                currentPageName === item.page ? "bg-sky-500/20 text-sky-400" : "text-gray-400"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="bg-[#161c27] border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
        HockeyOps © 2026
      </footer>
    </div>
  );
}