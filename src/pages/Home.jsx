import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import {
  LogIn, UserPlus, Calendar, Shield, Users, Clock,
  AlertTriangle, CheckCircle, ArrowRight, Zap, Star
} from "lucide-react";
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
  { date: "Mar 2026", title: "PuckLeague Sync", body: "Connect your PuckLeague account for real-time game, team, and schedule sync between platforms." },
];

const PLANS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    tagline: "Perfect for small leagues",
    color: SILVER,
    features: [
      "Up to 4 divisions",
      "Up to 50 teams",
      "Schedule builder",
      "Team & manager portal",
      "Email notifications",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$99",
    period: "/mo",
    tagline: "Most popular for growing leagues",
    color: GOLD,
    features: [
      "Unlimited divisions",
      "Unlimited teams",
      "Everything in Starter",
      "Official assignment & portal",
      "Forfeit management",
      "Analytics dashboard",
      "CSV bulk import/export",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For multi-league organizations",
    color: SILVER,
    features: [
      "Multiple leagues",
      "PuckLeague sync integration",
      "White-label branding",
      "Priority support",
      "Custom onboarding",
      "API access",
    ],
    cta: "Contact Us",
    highlight: false,
  },
];

export default function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleStartTrial = () => {
    if (user) {
      // Already logged in, go to dashboard
      window.location.href = createPageUrl("Dashboard");
    } else {
      // Not logged in, go to login
      base44.auth.redirectToLogin();
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#000" }}>

      {/* Minimal Header — logo + auth only, no nav */}
      <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(0,0,0,0.92)", borderColor: "#1a1a1a", backdropFilter: "blur(10px)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HockeyOpsLogo size={38} />
            <span className="font-black italic text-xl" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
              <span style={{ color: GOLD }}>Puck</span><span style={{ color: SILVER }}>Operations</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Pricing")}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
              style={{ borderColor: "#333", color: SILVER }}>
              Pricing
            </Link>
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-white/5"
              style={{ borderColor: "#333", color: SILVER }}>
              Sign In
            </button>
            <button onClick={handleStartTrial}
              className="px-5 py-2 rounded-lg text-sm font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960f)` }}>
              Start Free Trial
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(ellipse at 30% 40%, ${GOLD} 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, ${SILVER} 0%, transparent 55%)`
        }} />
        <div className="relative max-w-5xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border" 
              style={{ borderColor: GOLD }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: GOLD }} />
              <span className="text-sm font-bold" style={{ color: GOLD }}>All hockey ops in one place</span>
            </div>
          </div>

          {/* Logo + Brand */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-3">
              <HockeyOpsLogo size={64} />
              <h2 className="text-3xl font-black italic" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
                <span style={{ color: GOLD }}>Puck</span><span style={{ color: SILVER }}>Operations</span>
              </h2>
            </div>
          </div>

          {/* Main Headline */}
          <h1 className="text-6xl md:text-7xl font-black leading-tight mb-2" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
            <span className="text-white">Set up your league.</span>
            <br />
            <span style={{ color: GOLD }}>Professionally</span>
            <br />
            <span className="text-white">managed.</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">
            Schedule games, manage teams, assign officials, and handle forfeits — everything you need to run a league smoothly.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={handleStartTrial}
              className="px-10 py-4 rounded-xl text-lg font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960f)` }}>
              Start Free Trial <ArrowRight className="w-5 h-5 inline ml-2" />
            </button>
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-10 py-4 rounded-xl text-lg font-semibold transition-all hover:scale-105 border"
              style={{ borderColor: SILVER, color: SILVER }}>
              View Pricing
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
              <div key={i} className="rounded-2xl p-6 border transition-all hover:border-yellow-500/30" style={{ background: "#0a0a0a", borderColor: "#222" }}>
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

      {/* Pricing */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-2">Simple, transparent pricing</h2>
          <p className="text-center text-gray-500 mb-12">Start free for 14 days — no credit card required</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <div key={i} className="rounded-2xl p-7 border relative"
                style={{
                  background: plan.highlight ? "#0d0d0d" : "#080808",
                  borderColor: plan.highlight ? GOLD : "#222",
                  boxShadow: plan.highlight ? `0 0 40px ${GOLD}18` : "none",
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-black flex items-center gap-1"
                    style={{ background: GOLD }}>
                    <Star className="w-3 h-3" /> Most Popular
                  </div>
                )}
                <div className="text-sm font-medium mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-500 mb-1">{plan.period}</span>}
                </div>
                <p className="text-xs text-gray-500 mb-5">{plan.tagline}</p>
                <ul className="space-y-2.5 mb-7">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to={createPageUrl("Pricing")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
                  style={plan.highlight
                    ? { background: `linear-gradient(135deg, ${GOLD}, #b8960f)`, color: "#000" }
                    : { border: `1px solid ${plan.color}40`, color: plan.color }}>
                  {plan.cta} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New */}
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
        <div className="max-w-2xl mx-auto rounded-3xl p-10 text-center border" style={{ background: "#0a0a0a", borderColor: `${GOLD}30` }}>
          <div className="flex justify-center mb-4"><HockeyOpsLogo size={56} /></div>
          <h2 className="text-3xl font-bold text-white mb-3">Ready to manage your league?</h2>
          <p className="text-gray-400 mb-8">Start your 14-day free trial. No credit card required.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => base44.auth.redirectToLogin()}
              className="px-8 py-3.5 rounded-xl text-base font-bold text-black transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #b8960f)` }}>
              <Zap className="w-5 h-5 inline mr-2" />Start Free Trial
            </button>
            <Link to={createPageUrl("Pricing")}
              className="px-8 py-3.5 rounded-xl text-base font-semibold border transition-all hover:scale-105 flex items-center justify-center gap-2"
              style={{ borderColor: SILVER, color: SILVER }}>
              View Pricing <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer — minimal, no nav */}
      <footer className="py-8 text-center border-t" style={{ borderColor: "#111", color: "#444" }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <HockeyOpsLogo size={20} />
          <span className="font-black italic text-sm" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
            <span style={{ color: GOLD }}>Puck</span><span style={{ color: SILVER }}>Operations</span>
          </span>
        </div>
        <p className="text-xs" style={{ color: "#444" }}>© 2026 PuckApps Inc. — League Management Platform</p>
      </footer>
    </div>
  );
}