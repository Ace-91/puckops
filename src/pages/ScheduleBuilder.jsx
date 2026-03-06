import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2, Loader2, Settings, AlertTriangle } from "lucide-react";

export default function ScheduleBuilder() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [selectedDiv, setSelectedDiv] = useState("");
  const [season, setSeason] = useState("2025-2026");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [existingGames, setExistingGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Constraint config
  const [constraints, setConstraints] = useState({
    noBackToBack: true,
    noSameDay: true,
    maxDaysBetweenGames: 10,
    respectLeagueBlackouts: true,
    respectTeamBlackouts: true,
  });

  useEffect(() => {
    const load = async () => {
      const [d, t, s, b, g] = await Promise.all([
        base44.entities.Division.list(),
        base44.entities.Team.list(),
        base44.entities.IceSlot.filter({ is_available: true }),
        base44.entities.BlackoutDate.filter({ status: "approved" }),
        base44.entities.Game.list(),
      ]);
      setDivisions(d);
      setTeams(t);
      setSlots(s);
      setBlackouts(b);
      setExistingGames(g);
    };
    load();
  }, []);

  const divTeams = teams.filter(t => t.division_id === selectedDiv);
  const division = divisions.find(d => d.id === selectedDiv);

  const generateSchedule = () => {
    if (!selectedDiv || divTeams.length < 2) {
      setResult({ error: "Select a division with at least 2 teams." });
      return;
    }
    setGenerating(true);
    setResult(null);
    setPreview([]);
    setWarnings([]);

    setTimeout(() => {
      try {
        const { games, warns } = buildSchedule();
        setPreview(games);
        setWarnings(warns);
        const lateGames = games.filter(g => g.is_late_game);
        const teamLateMap = {};
        divTeams.forEach(t => { teamLateMap[t.id] = 0; });
        lateGames.forEach(g => {
          teamLateMap[g.home_team_id] = (teamLateMap[g.home_team_id] || 0) + 1;
          teamLateMap[g.away_team_id] = (teamLateMap[g.away_team_id] || 0) + 1;
        });
        setStats({
          total: games.length,
          lateGames: lateGames.length,
          teamGameCounts: buildTeamGameCounts(games),
          teamLateCounts: teamLateMap,
        });
        setResult({ success: true, count: games.length });
      } catch (e) {
        setResult({ error: e.message });
      }
      setGenerating(false);
    }, 100);
  };

  const buildTeamGameCounts = (games) => {
    const counts = {};
    divTeams.forEach(t => { counts[t.id] = { name: t.name, count: 0 }; });
    games.forEach(g => {
      if (counts[g.home_team_id]) counts[g.home_team_id].count++;
      if (counts[g.away_team_id]) counts[g.away_team_id].count++;
    });
    return counts;
  };

  const daysBetween = (d1, d2) => {
    const diff = Math.abs(new Date(d1) - new Date(d2));
    return diff / (1000 * 60 * 60 * 24);
  };

  const buildSchedule = () => {
    const warns = [];
    const targetGames = division?.games_per_team || 30;
    const divSlots = slots.filter(s => s.season === season || !s.season);
    if (divSlots.length === 0) throw new Error("No available ice slots found for this season. Please add ice slots first.");

    // Build all round-robin matchups
    const matchups = [];
    for (let i = 0; i < divTeams.length; i++) {
      for (let j = i + 1; j < divTeams.length; j++) {
        matchups.push([divTeams[i], divTeams[j]]);
      }
    }

    const gamesPerRR = matchups.length;
    const roundRobins = Math.max(1, Math.ceil((targetGames * divTeams.length / 2) / Math.max(gamesPerRR, 1)));

    let allMatchups = [];
    for (let r = 0; r < roundRobins; r++) {
      allMatchups = allMatchups.concat([...matchups].sort(() => Math.random() - 0.5));
    }

    const maxGames = Math.ceil(targetGames * divTeams.length / 2);
    allMatchups = allMatchups.slice(0, maxGames);

    const sortedSlots = [...divSlots].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const usedSlots = new Set();
    const teamGameDates = {}; // team_id -> [dates]
    const teamLateCounts = {};
    divTeams.forEach(t => { teamGameDates[t.id] = []; teamLateCounts[t.id] = 0; });

    // Separate team and league blackouts
    const teamBlackouts = {};
    const leagueBlackoutDates = new Set();
    blackouts.forEach(b => {
      if (!b.team_id || b.team_id === "league") {
        // League-wide blackout
        if (constraints.respectLeagueBlackouts) {
          let d = new Date(b.date_from);
          const end = new Date(b.date_to || b.date_from);
          while (d <= end) {
            leagueBlackoutDates.add(d.toISOString().split("T")[0]);
            d.setDate(d.getDate() + 1);
          }
        }
      } else {
        if (!teamBlackouts[b.team_id]) teamBlackouts[b.team_id] = [];
        teamBlackouts[b.team_id].push(b);
      }
    });

    const isTeamBlackedOut = (teamId, date) => {
      if (!constraints.respectTeamBlackouts) return false;
      const bos = teamBlackouts[teamId] || [];
      return bos.some(b => date >= b.date_from && date <= (b.date_to || b.date_from));
    };

    const isLeagueBlackedOut = (date) => leagueBlackoutDates.has(date);

    const scheduledGames = [];
    let unscheduled = 0;

    for (const [home, away] of allMatchups) {
      let assigned = false;
      for (const slot of sortedSlots) {
        if (usedSlots.has(slot.id)) continue;
        if (isLeagueBlackedOut(slot.date)) continue;
        if (isTeamBlackedOut(home.id, slot.date) || isTeamBlackedOut(away.id, slot.date)) continue;

        // No same-day games
        if (constraints.noSameDay) {
          if (teamGameDates[home.id].includes(slot.date) || teamGameDates[away.id].includes(slot.date)) continue;
        }

        // No back-to-back days
        if (constraints.noBackToBack) {
          const homeDates = teamGameDates[home.id];
          const awayDates = teamGameDates[away.id];
          const slotDate = new Date(slot.date);
          const dayBefore = new Date(slotDate); dayBefore.setDate(slotDate.getDate() - 1);
          const dayAfter = new Date(slotDate); dayAfter.setDate(slotDate.getDate() + 1);
          const dayBeforeStr = dayBefore.toISOString().split("T")[0];
          const dayAfterStr = dayAfter.toISOString().split("T")[0];
          if (homeDates.includes(dayBeforeStr) || homeDates.includes(dayAfterStr)) continue;
          if (awayDates.includes(dayBeforeStr) || awayDates.includes(dayAfterStr)) continue;
        }

        // Max days gap between games (check that last game isn't too far in the past from this slot)
        if (constraints.maxDaysBetweenGames > 0 && teamGameDates[home.id].length > 0) {
          const lastHomeGame = teamGameDates[home.id][teamGameDates[home.id].length - 1];
          if (daysBetween(lastHomeGame, slot.date) > constraints.maxDaysBetweenGames + 1) {
            // Don't skip — this is a soft warning, not a hard block
          }
        }

        // Late game distribution
        if (slot.is_late_game) {
          const avgLate = Object.values(teamLateCounts).reduce((a, b) => a + b, 0) / divTeams.length;
          if (teamLateCounts[home.id] > avgLate + 2 || teamLateCounts[away.id] > avgLate + 2) continue;
        }

        usedSlots.add(slot.id);
        teamGameDates[home.id].push(slot.date);
        teamGameDates[away.id].push(slot.date);
        if (slot.is_late_game) {
          teamLateCounts[home.id]++;
          teamLateCounts[away.id]++;
        }

        scheduledGames.push({
          season,
          division_id: selectedDiv,
          division_name: division?.name,
          home_team_id: home.id,
          home_team_name: home.name,
          away_team_id: away.id,
          away_team_name: away.name,
          arena_id: slot.arena_id,
          arena_name: slot.arena_name,
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_late_game: slot.is_late_game || false,
          game_type: "regular",
          status: "scheduled",
          ice_slot_id: slot.id,
        });

        assigned = true;
        break;
      }
      if (!assigned) unscheduled++;
    }

    if (unscheduled > 0) warns.push(`${unscheduled} matchup(s) could not be scheduled — not enough available slots.`);

    // Check max gap between games per team
    if (constraints.maxDaysBetweenGames > 0) {
      divTeams.forEach(team => {
        const dates = teamGameDates[team.id].sort();
        for (let i = 1; i < dates.length; i++) {
          const gap = daysBetween(dates[i - 1], dates[i]);
          if (gap > constraints.maxDaysBetweenGames) {
            warns.push(`${team.name}: ${gap}-day gap between ${dates[i-1]} and ${dates[i]} (max: ${constraints.maxDaysBetweenGames})`);
          }
        }
      });
    }

    return { games: scheduledGames, warns };
  };

  const saveSchedule = async () => {
    if (!preview.length) return;
    setGenerating(true);
    await base44.entities.Game.bulkCreate(preview);
    const slotIds = [...new Set(preview.map(g => g.ice_slot_id).filter(Boolean))];
    for (const id of slotIds) {
      await base44.entities.IceSlot.update(id, { is_available: false });
    }
    setResult({ saved: true, count: preview.length });
    setPreview([]);
    setStats(null);
    setWarnings([]);
    setGenerating(false);
  };

  const clearDivisionSchedule = async () => {
    if (!confirm(`Delete all regular season games for ${division?.name}?`)) return;
    const toDelete = existingGames.filter(g => g.division_id === selectedDiv && g.game_type === "regular");
    for (const g of toDelete) {
      await base44.entities.Game.delete(g.id);
      if (g.ice_slot_id) await base44.entities.IceSlot.update(g.ice_slot_id, { is_available: true });
    }
    const g = await base44.entities.Game.list();
    setExistingGames(g);
    setResult({ cleared: true });
  };

  const divExistingGames = existingGames.filter(g => g.division_id === selectedDiv);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Auto-generate balanced schedules with constraint enforcement</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><Settings className="w-4 h-4 text-sky-400" /> Configuration</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Season</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={season} onChange={e => setSeason(e.target.value)} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Division *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={selectedDiv} onChange={e => { setSelectedDiv(e.target.value); setPreview([]); setResult(null); setStats(null); setWarnings([]); }}>
                  <option value="">Select division...</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              {selectedDiv && (
                <div className="bg-gray-900/50 rounded-lg p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-400"><span>Teams:</span><span className="text-white">{divTeams.length}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Target Games/Team:</span><span className="text-white">{division?.games_per_team || 30}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Available Slots:</span><span className="text-white">{slots.filter(s => !s.season || s.season === season).length}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Existing Games:</span><span className={divExistingGames.length > 0 ? "text-yellow-400" : "text-white"}>{divExistingGames.length}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Approved Blackouts:</span><span className="text-white">{blackouts.filter(b => divTeams.some(t => t.id === b.team_id)).length}</span></div>
                  <div className="flex justify-between text-gray-400"><span>League Blackouts:</span><span className="text-white">{blackouts.filter(b => !b.team_id || b.team_id === "league").length}</span></div>
                </div>
              )}

              {divExistingGames.length > 0 && (
                <button onClick={clearDivisionSchedule} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm transition-colors">
                  <Trash2 className="w-4 h-4" /> Clear Existing Schedule
                </button>
              )}

              <button onClick={generateSchedule} disabled={generating || !selectedDiv || divTeams.length < 2}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
                {generating ? "Generating..." : "Generate Schedule"}
              </button>
            </div>
          </div>

          {/* Constraints panel */}
          <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-6">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-400" /> Scheduling Rules</h2>
            <div className="space-y-3">
              {[
                { key: "noSameDay", label: "No same-day games per team" },
                { key: "noBackToBack", label: "No back-to-back day games" },
                { key: "respectTeamBlackouts", label: "Respect team blackout dates" },
                { key: "respectLeagueBlackouts", label: "Respect league blackout dates" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={constraints[key]}
                    onChange={e => setConstraints(c => ({ ...c, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-sky-500" />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Max days between games</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} max={30}
                    className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={constraints.maxDaysBetweenGames}
                    onChange={e => setConstraints(c => ({ ...c, maxDaysBetweenGames: parseInt(e.target.value) || 0 }))} />
                  <span className="text-sm text-gray-400">days (0 = no limit)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Result / Stats */}
        <div className="lg:col-span-2 space-y-4">
          {result?.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-red-400 font-medium">Error</p>
                <p className="text-red-300 text-sm mt-1">{result.error}</p>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <span className="text-yellow-400 font-medium text-sm">{warnings.length} Warning{warnings.length > 1 ? "s" : ""}</span>
              </div>
              <ul className="space-y-1">
                {warnings.map((w, i) => <li key={i} className="text-yellow-300 text-xs">• {w}</li>)}
              </ul>
            </div>
          )}

          {result?.success && stats && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">{result.count} games generated — review before saving</span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{stats.total}</div>
                  <div className="text-xs text-gray-400">Total Games</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1"><Moon className="w-4 h-4" />{stats.lateGames}</div>
                  <div className="text-xs text-gray-400">Late Games</div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-sky-400">{divTeams.length}</div>
                  <div className="text-xs text-gray-400">Teams</div>
                </div>
              </div>

              <div className="text-sm font-medium text-gray-300 mb-2">Games per team:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-40 overflow-y-auto">
                {Object.entries(stats.teamGameCounts).map(([id, tc]) => (
                  <div key={tc.name} className="bg-gray-900/50 rounded px-3 py-1.5 flex justify-between text-sm">
                    <span className="text-gray-300 truncate">{tc.name}</span>
                    <span className="text-white font-medium ml-2">{tc.count} <Moon className="w-3 h-3 inline text-yellow-400" /> {stats.teamLateCounts[id] || 0}</span>
                  </div>
                ))}
              </div>

              <button onClick={saveSchedule} disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-medium text-sm transition-colors">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Save {result.count} Games to Schedule
              </button>
            </div>
          )}

          {result?.saved && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{result.count} games saved successfully!</span>
            </div>
          )}

          {result?.cleared && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-yellow-400" />
              <span className="text-yellow-400">Schedule cleared. You can now regenerate.</span>
            </div>
          )}

          {/* Preview table */}
          {preview.length > 0 && (
            <div className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
              <div className="border-b border-gray-700 px-4 py-3 flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-medium text-white">Preview — First 25 of {preview.length} games</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Date</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Time</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Matchup</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-400">Arena</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {preview.slice(0, 25).map((g, i) => (
                      <tr key={i} className="hover:bg-white/2">
                        <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{g.date}</td>
                        <td className="px-4 py-2 text-sm text-gray-400 flex items-center gap-1 whitespace-nowrap">
                          {g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-300">{g.home_team_name} vs {g.away_team_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-400">{g.arena_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}