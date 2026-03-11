import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, CheckCircle, Zap } from "lucide-react";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

const PLANS = [
  {
    name: "Basic",
    price: "$79",
    period: "/mo",
    features: [
      "Up to 4 divisions",
      "Up to 50 teams",
      "Schedule builder",
      "Team & manager portal",
      "Email notifications",
    ],
  },
  {
    name: "Pro",
    price: "$149",
    period: "/mo",
    features: [
      "Unlimited divisions",
      "Unlimited teams",
      "Everything in Basic",
      "Official assignment & portal",
      "Forfeit management",
      "Analytics dashboard",
      "CSV bulk import/export",
    ],
    highlight: true,
  },
  {
    name: "Elite",
    price: "$249",
    period: "/mo",
    features: [
      "Everything in Pro",
      "Multiple leagues",
      "PuckLeague sync",
      "Custom branding",
      "Priority support",
      "API access (included)",
      "Advanced analytics",
    ],
  },
];

const ADDONS = [
  { name: "Auto Scheduler", price: "$79/mo", desc: "Advanced scheduling automation with AI-powered optimization" },
  { name: "Referee Automation", price: "$39/mo", desc: "Automated official assignment and availability management" },
  { name: "API Access", price: "$49/mo", desc: "Full REST API for third-party integrations (included with Elite)" },
];

export default function Pricing() {
  return (
    <div className="min-h-screen" style={{ background: "#000" }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: "#1a1a1a" }}>
        <Link to={createPageUrl("Home")}
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: GOLD }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>
      </div>

      <div className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Heading */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-black italic text-white mb-3" style={{ fontFamily: "Arial Black, Arial, sans-serif" }}>
              <span style={{ color: GOLD }}>Puck</span><span style={{ color: SILVER }}>Operations</span> Pricing
            </h1>
            <p className="text-gray-400 text-lg">Choose the plan that fits your league</p>
          </div>

          {/* Plans */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            {PLANS.map((plan, i) => (
              <div key={i} className="rounded-2xl p-8 border relative"
                style={{
                  background: plan.highlight ? "#0d0d0d" : "#080808",
                  borderColor: plan.highlight ? GOLD : "#222",
                  boxShadow: plan.highlight ? `0 0 40px ${GOLD}18` : "none",
                }}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-black flex items-center gap-1"
                    style={{ background: GOLD }}>
                    <Zap className="w-3 h-3" /> Most Popular
                  </div>
                )}
                <div className="text-lg font-bold text-white mb-1">{plan.name}</div>
                <div className="flex items-end gap-1 mb-6">
                  <span className="text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-gray-500 mb-1">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                      <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: GOLD }} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <button
                  className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:scale-105"
                  style={plan.highlight
                    ? { background: `linear-gradient(135deg, ${GOLD}, #b8960f)`, color: "#000" }
                    : { border: `1px solid ${GOLD}40`, color: GOLD }}>
                  Get Started
                </button>
              </div>
            ))}
          </div>

          {/* Add-Ons */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Add-Ons</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ADDONS.map((addon, i) => (
                <div key={i} className="rounded-2xl p-6 border" style={{ background: "#0a0a0a", borderColor: "#222" }}>
                  <h3 className="text-white font-semibold mb-1">{addon.name}</h3>
                  <div className="text-xl font-bold mb-3" style={{ color: GOLD }}>{addon.price}</div>
                  <p className="text-gray-500 text-sm">{addon.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}