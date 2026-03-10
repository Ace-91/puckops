import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "8px 12px" }}>
      {label && <p style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || GOLD, fontSize: 12, margin: 0 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function LeagueMetricsCharts() {
  const [games, setGames] = useState([]);
  const [forfeits, setForfeits] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Game.list("date", 3000),
      base44.entities.Forfeit.list(),
      base44.entities.IceSlot.list("date", 5000),
    ]).then(([g, f, s]) => {
      setGames(g);
      setForfeits(f);
      setSlots(s);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl h-56 animate-pulse" style={{ background: "#111" }} />
        ))}
      </div>
    );
  }

  // ── Chart 1: Game Status Breakdown ─────────────────────────────────────────
  const statusCounts = games.reduce((acc, g) => {
    acc[g.status] = (acc[g.status] || 0) + 1;
    return acc;
  }, {});
  const gameStatusData = [
    { name: "Scheduled", value: statusCounts.scheduled || 0, color: GOLD },
    { name: "Completed", value: statusCounts.completed || 0, color: "#4ade80" },
    { name: "Forfeited", value: statusCounts.forfeited || 0, color: "#f87171" },
    { name: "Postponed", value: statusCounts.postponed || 0, color: "#60a5fa" },
  ].filter(d => d.value > 0);
  const totalGames = games.length;
  const completionRate = totalGames > 0
    ? Math.round(((statusCounts.completed || 0) / totalGames) * 100)
    : 0;

  // ── Chart 2: Forfeits by Division ──────────────────────────────────────────
  const forfeitsByDiv = forfeits.reduce((acc, f) => {
    const div = f.division_name || "Unknown";
    acc[div] = (acc[div] || 0) + 1;
    return acc;
  }, {});
  const forfeitData = Object.entries(forfeitsByDiv)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Chart 3: Ice Slot Utilization by Arena ─────────────────────────────────
  const slotsByArena = slots.reduce((acc, s) => {
    const arena = s.arena_name || "Unknown";
    if (!acc[arena]) acc[arena] = { available: 0, used: 0 };
    if (s.is_available) acc[arena].available++;
    else acc[arena].used++;
    return acc;
  }, {});
  const slotData = Object.entries(slotsByArena)
    .map(([name, d]) => ({
      name: name.length > 12 ? name.slice(0, 12) + "…" : name,
      fullName: name,
      used: d.used,
      available: d.available,
      total: d.used + d.available,
      utilization: d.used + d.available > 0 ? Math.round((d.used / (d.used + d.available)) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const totalSlots = slots.length;
  const usedSlots = slots.filter(s => !s.is_available).length;
  const overallUtilization = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-white flex items-center gap-2">
        <span style={{ color: GOLD }}>📊</span> League Metrics
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Game Completion */}
        <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
          <div className="text-sm font-semibold text-white mb-1">Game Status</div>
          <div className="text-xs text-gray-500 mb-3">{totalGames} total games · {completionRate}% completed</div>
          {gameStatusData.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8">No game data yet</p>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={gameStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" strokeWidth={0}>
                    {gameStatusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-1">
                {gameStatusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-gray-400">{d.name} <span className="text-white font-medium">{d.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Forfeits by Division */}
        <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
          <div className="text-sm font-semibold text-white mb-1">Forfeit Frequency</div>
          <div className="text-xs text-gray-500 mb-3">{forfeits.length} total forfeits by division</div>
          {forfeitData.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8">No forfeits recorded yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forfeitData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 10 }} width={60} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="count" name="Forfeits" fill="#f87171" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ice Slot Utilization */}
        <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
          <div className="text-sm font-semibold text-white mb-1">Ice Slot Utilization</div>
          <div className="text-xs text-gray-500 mb-3">{overallUtilization}% used · {usedSlots}/{totalSlots} slots assigned</div>
          {slotData.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-8">No ice slot data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={slotData} layout="vertical" margin={{ left: 0, right: 12 }}>
                <XAxis type="number" tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 10 }} width={55} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "8px 12px" }}>
                        <p style={{ color: "#aaa", fontSize: 11, marginBottom: 4 }}>{d?.fullName}</p>
                        <p style={{ color: GOLD, fontSize: 12, margin: 0 }}>Used: <strong>{d?.used}</strong></p>
                        <p style={{ color: "#4ade80", fontSize: 12, margin: 0 }}>Available: <strong>{d?.available}</strong></p>
                        <p style={{ color: SILVER, fontSize: 12, margin: 0 }}>Utilization: <strong>{d?.utilization}%</strong></p>
                      </div>
                    );
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="used" name="Used" stackId="a" fill={GOLD} radius={[0, 0, 0, 0]} maxBarSize={18} />
                <Bar dataKey="available" name="Available" stackId="a" fill="#2a2a2a" radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: GOLD }} /><span className="text-xs text-gray-400">Used</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-gray-700" /><span className="text-xs text-gray-400">Available</span></div>
          </div>
        </div>

      </div>
    </div>
  );
}