import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2, Loader2 } from "lucide-react";

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

    setTimeout(() => {
      try {
        const games = buildSchedule();
        setPreview(games);
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

  const buildSchedule = () => {
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

    // How many full round-robins needed
    const gamesPerRR = matchups.length;
    const roundRobins = Math.max(1, Math.ceil((targetGames * divTeams.length / 2) / Math.max(gamesPerRR, 1)));

    // Build full list of matchups (repeat RRs)
    let allMatchups = [];
    for (let r = 0; r < roundRobins; r++) {
      allMatchups = allMatchups.concat([...matchups].sort(() => Math.random() - 0.5));
    }

    // Trim if we have too many
    const maxGames = Math.ceil(targetGames * divTeams.length / 2);
    allMatchups = allMatchups.slice(0, maxGames);

    // Sort slots
    const sortedSlots = [...divSlots].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));
    const usedSlots = new Set();
    const teamGameDates = {}; // team_id -> [dates]
    const teamLateCounts = {};
    divTeams.forEach(t => { teamGameDates[t.id] = []; teamLateCounts[t.id] = 0; });

    // Track late games to distribute evenly
    const totalLateSlots = sortedSlots.filter(s => s.is_late_game).length;
    const targetLatePerTeam = Math.floor((totalLateSlots / divTeams.length) * 2); // rough target

    const blackoutsByTeam = {};
    blackouts.forEach(b => {
      if (!blackoutsByTeam[b.team_id]) blackoutsByTeam[b.team_id] = [];
      blackoutsByTeam[b.team_id].push(b);
    });

    const isBlackedOut = (teamId, date) => {
      const bos = blackoutsByTeam[teamId] || [];
      return bos.some(b => date >= b.date_from && date <= (b.date_to || b.date_from));
    };

    const scheduledGames = [];

    for (const [home, away] of allMatchups) {
      let assigned = false;
      for (const slot of sortedSlots) {
        if (usedSlots.has(slot.id)) continue;
        if (isBlackedOut(home.id, slot.date) || isBlackedOut(away.id, slot.date)) continue;
        // No back-to-back same day
        if (teamGameDates[home.id].includes(slot.date) || teamGameDates[away.id].includes(slot.date)) continue;
        // Late game distribution - skip late game if team already has too many
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
      // If not assigned, it's a scheduling gap — skip silently
    }

    return scheduledGames;
  };

  const saveSchedule = async () => {
    if (!preview.length) return;
    setGenerating(true);
    await base44.entities.Game.bulkCreate(preview);
    // Mark slots as used
    const slotIds = [...new Set(preview.map(g => g.ice_slot_id).filter(Boolean))];
    for (const id of slotIds) {
      await base44.entities.IceSlot.update(id, { is_available: false });
    }
    setResult({ saved: true, count: preview.length });
    setPreview([]);
    setStats(null);
    setGenerating(false);
  };

  const clearDivisionSchedule = async () => {
    if (!confirm(`Delete all regular season games for ${division?.name}?`)) return;
    const toDelete = existingGames.filter(g => g.division_id === selectedDiv && g.game_type === "regular");
    for (const g of toDelete) {
      await base44.entities.Game.delete(g.id);
      if (g.ice_slot_id) await base44.entities.IceSlot.update(g.ice_slot_id, { is_available: true });
    }
    const [g] = await Promise.all([base44.entities.Game.list()]);
    setExistingGames(g);
    setResult({ cleared: true });
  };

  const divExistingGames = existingGames.filter(g => g.division_id === selectedDiv);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Auto-generate randomized, balanced schedules per division</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Season</label>
              <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                value={season} onChange={e => setSeason(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Division *</label>
              <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                value={selectedDiv} onChange={e => { setSelectedDiv(e.target.value); setPreview([]); setResult(null); setStats(null); }}>
                <option value="">Select division...</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {selectedDiv && (
              <div className="bg-gray-900/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between text-gray-400"><span>Teams:</span><span className="text-white">{divTeams.length}</span></div>
                <div className="flex justify-between text-gray-400"><span>Target Games/Team:</span><span className="text-white">{division?.games_per_team || 30}</span></div>
                <div className="flex justify-between text-gray-400"><span>Available Slots:</span><span className="text-white">{slots.filter(s => !s.season || s.season === season).length}</span></div>
                <div className="flex justify-between text-gray-400"><span>Existing Games:</span><span className={divExistingGames.length > 0 ? "text-yellow-400" : "text-white"}>{divExistingGames.length}</span></div>
                <div className="flex justify-between text-gray-400"><span>Approved Blackouts:</span><span className="text-white">{blackouts.filter(b => divTeams.some(t => t.id === b.team_id)).length}</span></div>
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

          {result?.success && stats && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">{result.count} games generated — review before saving</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
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

              {/* Per-team breakdown */}
              <div className="text-sm font-medium text-gray-300 mb-2">Games per team:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4 max-h-40 overflow-y-auto">
                {Object.values(stats.teamGameCounts).map(tc => (
                  <div key={tc.name} className="bg-gray-900/50 rounded px-3 py-1.5 flex justify-between text-sm">
                    <span className="text-gray-300 truncate">{tc.name}</span>
                    <span className="text-white font-medium ml-2">{tc.count} <Moon className="w-3 h-3 inline text-yellow-400" /> {stats.teamLateCounts[Object.keys(stats.teamGameCounts).find(k => stats.teamGameCounts[k] === tc)] || 0}</span>
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
                <span className="text-sm font-medium text-white">Preview — First 20 of {preview.length} games</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left px-4 py-2 text-xs text-gray-400">Date</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400">Matchup</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400">Arena</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-400">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {preview.slice(0, 20).map((g, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="px-4 py-2 text-sm text-white">{g.date}</td>
                      <td className="px-4 py-2 text-sm text-gray-300">{g.home_team_name} vs {g.away_team_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-400">{g.arena_name}</td>
                      <td className="px-4 py-2 text-sm text-gray-400 flex items-center gap-1">
                        {g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}