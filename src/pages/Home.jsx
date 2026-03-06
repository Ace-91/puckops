import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LogIn, UserPlus, Calendar, Shield, Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import HockeyOpsLogo from "@/components/HockeyOpsLogo";

const SILVER = "#c0c0c0";
const GOLD = "#d4af37";

const FEATURES = [
  { icon: Calendar, title: "Smart Scheduling", desc: "Auto-generate balanced schedules across divisions with blackout dates and late-game equity." },
  { icon: Users, title: "Team Management", desc: "Manage teams, divisions, and managers. Import via CSV for quick setup." },
  { icon: Shield, title: "Official Assignment", desc: "Assign referees and timekeepers with drag-and-drop. Block-schedule for efficiency." },
  { icon: Clock, title: "Ice Slot Tracking", desc: "Track arena availability. Import hundreds of slots instantly." },
  { icon: AlertTriangle, title: "Forfeit Handling", desc: "Teams report forfeits with automatic notifications for replacement opportunities." },
  { icon: CheckCircle, title: "Availability Portal", desc: "Officials submit availability. Managers log blackout dates. All synced." },
];

const NEWS = [
  { date: "Mar 2026", title: "Late Game Balance", body: "Schedules now automatically distribute 10 pm+ slots evenly across all teams in each division." },
  { date: "Mar 2026", title: "Multi-Division Builder", body: "Generate schedules for multiple divisions simultaneously with shared ice-slot conflict prevention." },
  { date: "Mar 2026", title: "CSV Bulk Import", body: "Import teams and ice slots via CSV with live progress tracking and error reporting." },
];

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // If already logged in, redirect to dashboard
      if (u) window.location.href = createPageUrl("Dashboard");
    }).catch(() => {});
  }, []);

  // While checking auth, show nothing to avoid flash
  if (user) return null;

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b" style={{ background: "#0a0a0a", borderColor: "#1a1a1a" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HockeyOpsLogo size={38} />
            <span className="text-xl font-black"><span style={{ color: SILVER }}>Hockey</span><span style={{ color: GOLD }}>Ops</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-5 py-2 rounded-lg text-sm font-semibold border transition-all hover:scale-105"
              style={{ borderColor: SILVER, color: SILVER }}>
              <LogIn className="w-4 h-4 inline mr-1.5" />Login
            </button>
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-5 py-2 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${SILVER}, #e8e8e8)` }}>
              <UserPlus className="w-4 h-4 inline mr-1.5" />Register
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `radial-gradient(ellipse at 30% 40%, ${GOLD} 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, ${SILVER} 0%, transparent 55%)` }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="flex justify-center mb-6">
            <HockeyOpsLogo size={96} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black mb-4 leading-tight">
            <span style={{ color: SILVER }}>Hockey</span><span style={{ color: GOLD }}>Ops</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            The complete league management platform for hockey associations. Schedule games, manage teams, assign officials, and handle forfeits — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-10 py-4 rounded-xl text-lg font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${SILVER}, #e8e8e8)` }}>
              <LogIn className="w-5 h-5 inline mr-2" />Login
            </button>
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-10 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 border"
              style={{ borderColor: GOLD, color: GOLD }}>
              <UserPlus className="w-5 h-5 inline mr-2" />Register
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-2">Everything you need to run a league</h2>
          <p className="text-center text-gray-500 mb-12">Built for league administrators, team managers, and officials</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="rounded-2xl p-6 border transition-all" style={{ background: "#0a0a0a", borderColor: "#222" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: `${GOLD}18` }}>
                  <f.icon className="w-5 h-5" style={{ color: GOLD }} />
                </div>
                <h3 className="text-white font-semibold mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-2 text-center">What's New</h2>
          <p className="text-center text-gray-500 mb-12">Recent platform updates</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {NEWS.map((n, i) => (
              <div key={i} className="rounded-2xl p-6 border" style={{ background: "#0a0a0a", borderColor: `${GOLD}30` }}>
                <div className="text-xs font-medium mb-2" style={{ color: GOLD }}>{n.date}</div>
                <h3 className="text-white font-semibold mb-2">{n.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto rounded-3xl p-10 text-center border" style={{ background: "#0a0a0a", borderColor: `${SILVER}30` }}>
          <div className="flex justify-center mb-4"><HockeyOpsLogo size={56} /></div>
          <h2 className="text-3xl font-bold text-white mb-3">Ready to manage your league?</h2>
          <p className="text-gray-400 mb-8">Contact your league administrator for access, or sign in if you already have an account.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-8 py-3.5 rounded-xl text-base font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${SILVER}, #e8e8e8)` }}>
              <LogIn className="w-5 h-5 inline mr-2" />Login
            </button>
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-8 py-3.5 rounded-xl text-base font-semibold border transition-all hover:scale-105"
              style={{ borderColor: GOLD, color: GOLD }}>
              <UserPlus className="w-5 h-5 inline mr-2" />Register
            </button>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center border-t" style={{ borderColor: "#111", color: "#444" }}>
        <span style={{ color: SILVER }}>Hockey</span><span style={{ color: GOLD }}>Ops</span>
        <span className="ml-2 text-xs">© 2026 — League Management Platform</span>
      </footer>
    </div>
  );
}