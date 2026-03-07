import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, Calendar, Users, Clock, Filter } from "lucide-react";

const GOLD = "#d4af37";
const SILVER = "#c0c0c0";

function StatusBadge({ type }) {
  if (type === "ok") return <span className="text-xs px-2 py-0.5 rounded-full border border-green-500/30 text-green-400 bg-green-500/5">✓ On Target</span>;
  if (type === "short") return <span className="text-xs px-2 py-0.5 rounded-full border border-red-500/30 text-red-400 bg-red-500/5">Under Target</span>;
  if (type === "over") return <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-500/30 text-yellow-400 bg-yellow-500/5">Over Target</span>;
  return null;
}

export default function ScheduleVerification() {
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDiv, setFilterDiv] = useState("all");
  const [filterIssues, setFilterIssues] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [gapThreshold, setGapThreshold] = useState(10);

  useEffect(() => {
    const load = async () => {
      const [g, t, d] = await Promise.all([
        base44.entities.Game.list("date", 5000),
        base44.entities.Team.list(),
        base44.entities.Division.list(),
      ]);
      setGames(g.filter(game => game.game_type === "regular" && game.status !== "forfeited"));
      setTeams(t);
      setDivisions(d);
      setLoading(false);
    };
    load();
  }, []);

  const daysBetween = (d1, d2) => Math.abs(new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24);

  // Build per-team stats
  const teamStats = teams.map(team => {
    const division = divisions.find(d => d.id === team.division_id);
    const target = division?.games_per_team || 30;
    const teamGames = games.filter(g => g.home_team_id === team.id || g.away_team_id === team.id);
    const gameDates = [...new Set(teamGames.map(g => g.date))].sort();
    
    // Find gaps
    const gaps = [];
    for (let i = 1; i < gameDates.length; i++) {
      const gap = daysBetween(gameDates[i - 1], gameDates[i]);
      if (gap > gapThreshold) {
        gaps.push({ from: gameDates[i - 1], to: gameDates[i], days: Math.round(gap) });
      }
    }

    const count = teamGames.length;
    const status = count === target ? "ok" : count < target ? "short" : "over";
    const hasIssues = status !== "ok" || gaps.length > 0;

    return { team, division, target, count, gameDates, gaps, status, hasIssues };
  });

  const filtered = teamStats.filter(ts => {
    const divMatch = filterDiv === "all" || ts.team.division_id === filterDiv;
    const issueMatch = !filterIssues || ts.hasIssues;
    return divMatch && issueMatch;
  });

  // Division-level rollup
  const divisionSummary = divisions.map(div => {
    const divTeamStats = teamStats.filter(ts => ts.team.division_id === div.id);
    const issues = divTeamStats.filter(ts => ts.hasIssues).length;
    const totalGames = games.filter(g => g.division_id === div.id).length;
    return { div, teamCount: divTeamStats.length, issues, totalGames };
  }).filter(ds => ds.teamCount > 0);

  // Overall stats
  const totalTeams = teamStats.length;
  const onTarget = teamStats.filter(ts => ts.status === "ok").length;
  const withGaps = teamStats.filter(ts => ts.gaps.length > 0).length;
  const underTarget = teamStats.filter(ts => ts.status === "short").length;

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Verification</h1>
        <p className="text-gray-400 text-sm mt-1">Verify game counts and spacing for all teams across divisions</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "On Target", value: onTarget, color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle },
          { label: "Under Target", value: underTarget, color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
          { label: "Gap Warnings", value: withGaps, color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock },
          { label: "Total Teams", value: totalTeams, color: "text-gray-300", bg: "bg-gray-500/10", icon: Users },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-800 flex items-center gap-3`}>
            <s.icon className={`w-8 h-8 ${s.color} opacity-70`} />
            <div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Division Summary */}
      <div className="rounded-xl border border-gray-800 p-4 mb-6" style={{ background: "#0a0a0a" }}>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: GOLD }} /> Division Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {divisionSummary.map(ds => (
            <div key={ds.div.id} className="rounded-lg p-3 border border-gray-800 text-xs" style={{ background: "#111" }}>
              <div className="font-semibold text-white mb-1">{ds.div.name}</div>
              <div className="text-gray-400">{ds.teamCount} teams · {ds.totalGames} games</div>
              <div className={`mt-1 ${ds.issues > 0 ? "text-yellow-400" : "text-green-400"}`}>
                {ds.issues > 0 ? `⚠ ${ds.issues} team${ds.issues > 1 ? "s" : ""} with issues` : "✓ All on track"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterDiv} onChange={e => setFilterDiv(e.target.value)}>
          <option value="all">All Divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <label className="flex items-center gap-2 cursor-pointer bg-[#111] border border-gray-800 rounded-lg px-3 py-2">
          <input type="checkbox" checked={filterIssues} onChange={e => setFilterIssues(e.target.checked)}
            className="accent-yellow-500" />
          <span className="text-sm text-gray-300 flex items-center gap-1"><Filter className="w-3.5 h-3.5" /> Issues only</span>
        </label>

        <div className="flex items-center gap-2 bg-[#111] border border-gray-800 rounded-lg px-3 py-2">
          <span className="text-sm text-gray-400">Gap threshold:</span>
          <input type="number" min={1} max={60}
            className="w-16 bg-black border border-gray-700 rounded px-2 py-0.5 text-white text-sm focus:outline-none"
            value={gapThreshold} onChange={e => setGapThreshold(parseInt(e.target.value) || 10)} />
          <span className="text-sm text-gray-500">days</span>
        </div>
      </div>

      {/* Team List */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No issues found.</p>
            </div>
          )}
          {filtered.map(({ team, division, target, count, gameDates, gaps, status, hasIssues }) => {
            const isOpen = expanded[team.id];
            return (
              <div key={team.id} className={`rounded-xl border overflow-hidden transition-colors ${hasIssues ? "border-yellow-500/20" : "border-gray-800"}`}
                style={{ background: "#0d0d0d" }}>
                {/* Header row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/2 transition-colors"
                  onClick={() => toggleExpand(team.id)}>
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{team.name}</span>
                      <span className="text-xs text-gray-500">{division?.name || "No Division"}</span>
                      <StatusBadge type={status} />
                      {gaps.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-orange-500/30 text-orange-400 bg-orange-500/5">
                          {gaps.length} gap{gaps.length > 1 ? "s" : ""} &gt;{gapThreshold}d
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Game count bar */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block w-32">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{count} games</span>
                        <span>target: {target}</span>
                      </div>
                      <div className="w-full rounded-full h-1.5" style={{ background: "#222" }}>
                        <div className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (count / target) * 100)}%`,
                            background: status === "ok" ? "#22c55e" : status === "short" ? "#ef4444" : GOLD
                          }} />
                      </div>
                    </div>
                    <span className={`text-sm font-bold w-8 text-right ${status === "ok" ? "text-green-400" : status === "short" ? "text-red-400" : "text-yellow-400"}`}>
                      {count}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-800 px-4 py-4 space-y-4">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#111" }}>
                        <div className={`text-xl font-bold ${status === "ok" ? "text-green-400" : status === "short" ? "text-red-400" : "text-yellow-400"}`}>{count}</div>
                        <div className="text-xs text-gray-500">Games Scheduled</div>
                      </div>
                      <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#111" }}>
                        <div className="text-xl font-bold text-white">{target}</div>
                        <div className="text-xs text-gray-500">Target</div>
                      </div>
                      <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#111" }}>
                        <div className={`text-xl font-bold ${count - target === 0 ? "text-green-400" : "text-red-400"}`}>
                          {count - target > 0 ? `+${count - target}` : count - target}
                        </div>
                        <div className="text-xs text-gray-500">Difference</div>
                      </div>
                    </div>

                    {/* Gap warnings */}
                    {gaps.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Schedule Gaps (&gt;{gapThreshold} days)
                        </div>
                        <div className="space-y-1.5">
                          {gaps.map((gap, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 border border-orange-500/20 bg-orange-500/5 text-xs">
                              <span className="text-gray-400">{gap.from}</span>
                              <span className="text-gray-600">→</span>
                              <span className="text-gray-400">{gap.to}</span>
                              <span className="ml-auto font-bold text-orange-400">{gap.days} days</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Game dates list */}
                    {gameDates.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-400 mb-2">All Game Dates ({gameDates.length})</div>
                        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                          {gameDates.map((date, i) => {
                            const gapAfter = i < gameDates.length - 1 && daysBetween(date, gameDates[i + 1]) > gapThreshold;
                            return (
                              <span key={date}
                                className={`text-xs px-2 py-0.5 rounded border ${gapAfter ? "border-orange-500/40 text-orange-300 bg-orange-500/5" : "border-gray-800 text-gray-400"}`}>
                                {date}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {gameDates.length === 0 && (
                      <p className="text-sm text-red-400">No games scheduled for this team.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}