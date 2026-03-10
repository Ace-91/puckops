import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2, Loader2, AlertTriangle, ChevronDown, Plus, X, Calendar } from "lucide-react";
import { batchDelete, batchUpdate } from "@/components/batchOps";

const isLateTime = (t, lateHour = 22, lateMinute = 0) => {
  if (!t) return false;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m >= lateHour * 60 + lateMinute;
};

const daysBetween = (d1, d2) => Math.abs(new Date(d1) - new Date(d2)) / (1000 * 60 * 60 * 24);

const addDaysToDate = (dateStr, days) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

export default function ScheduleBuilder() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [slots, setSlots] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [selectedDivIds, setSelectedDivIds] = useState([]);
  const [season, setSeason] = useState("2025-2026");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState([]);
  const [existingGames, setExistingGames] = useState([]);
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [divDropOpen, setDivDropOpen] = useState(false);

  const [timeframeMode, setTimeframeMode] = useState("full");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [leagueBlackoutList, setLeagueBlackoutList] = useState([]);
  const [newBlackout, setNewBlackout] = useState({ date_from: "", date_to: "", reason: "" });
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);

  const [lateGameThreshold, setLateGameThreshold] = useState({ hour: 22, minute: 0 });

  const [constraints, setConstraints] = useState({
    noSameDay: true,
    minGapDays: 2,
    maxDaysBetweenGames: 10,
    respectLeagueBlackouts: true,
    respectTeamBlackouts: true,
  });

  const [saveProgress, setSaveProgress] = useState(null);

  useEffect(() => {
    const load = async () => {
      const [d, t, s, b, g] = await Promise.all([
        base44.entities.Division.list(),
        base44.entities.Team.list(),
        base44.entities.IceSlot.filter({ is_available: true }),
        base44.entities.BlackoutDate.filter({ status: "approved" }),
        base44.entities.Game.list("date", 3000),
      ]);
      setDivisions(d);
      setTeams(t);
      setSlots(s);
      setBlackouts(b);
      setExistingGames(g);
      setLeagueBlackoutList(b.filter(x => !x.team_id || x.team_id === "league"));
    };
    load();
  }, []);

  const addLeagueBlackout = async () => {
    if (!newBlackout.date_from) return;
    const created = await base44.entities.BlackoutDate.create({
      team_id: "league", team_name: "League",
      date_from: newBlackout.date_from,
      date_to: newBlackout.date_to || newBlackout.date_from,
      reason: newBlackout.reason || "League blackout",
      status: "approved",
    });
    setLeagueBlackoutList(prev => [...prev, created]);
    setNewBlackout({ date_from: "", date_to: "", reason: "" });
    setShowBlackoutForm(false);
  };

  const removeLeagueBlackout = async (id) => {
    await base44.entities.BlackoutDate.delete(id);
    setLeagueBlackoutList(prev => prev.filter(b => b.id !== id));
  };

  const toggleDiv = (id) => setSelectedDivIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
  const selectAllDivs = () => setSelectedDivIds(
    selectedDivIds.length === divisions.length ? [] : divisions.map(d => d.id)
  );

  const getDateRange = () => {
    if (timeframeMode === "custom") return { start: customStart || null, end: customEnd || null };
    return { start: null, end: null };
  };

  // ─── MAIN SCHEDULE GENERATOR ───────────────────────────────────────────────
  //
  // ALGORITHM: Slot-First with Round-Robin Grid
  //
  // Step 1 — Build exact matchup lists per division:
  //   - Full round-robin rounds (every team plays every other at least once)
  //   - Repeat rounds until we have enough matchups for targetGames/team
  //   - Greedily trim to exact target: pick matchups where both teams still need games
  //   - This guarantees balanced game counts and min-1-play-vs-each-opponent
  //
  // Step 2 — Walk slots chronologically (slot-first):
  //   - For each slot, try divisions ordered by urgency (most pending matchups first)
  //   - Within a division, scan pending matchups for first valid pair on this date
  //   - Assign and move on — one game per slot
  //   - Natural chronological spread eliminates gap violations
  //
  // Step 3 — Warn only about real shortfalls (unscheduled matchups = not enough slots)
  //
  const generateSchedule = () => {
    if (selectedDivIds.length === 0) { setResult({ error: "Select at least one division." }); return; }
    setGenerating(true);
    setResult(null);
    setPreview([]);
    setWarnings([]);

    setTimeout(() => {
      try {
        const { start: rangeStart, end: rangeEnd } = getDateRange();
        let poolSlots = slots.filter(s => !s.season || s.season === season);
        if (rangeStart) poolSlots = poolSlots.filter(s => s.date >= rangeStart);
        if (rangeEnd) poolSlots = poolSlots.filter(s => s.date <= rangeEnd);
        if (poolSlots.length === 0) throw new Error("No available ice slots found. Add ice slots first.");

        // Sort slots chronologically — this is the spine of the algorithm
        poolSlots = [...poolSlots].sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time));

        // ── Build blackout lookups ────────────────────────────────────────────
        const allBlackouts = [...blackouts, ...leagueBlackoutList];
        const leagueBlackoutDates = new Set();
        const teamBlackoutsMap = {};

        allBlackouts.forEach(b => {
          if (!b.team_id || b.team_id === "league") {
            if (constraints.respectLeagueBlackouts) {
              let d = new Date(b.date_from + "T12:00:00");
              const end = new Date((b.date_to || b.date_from) + "T12:00:00");
              while (d <= end) { leagueBlackoutDates.add(d.toISOString().split("T")[0]); d.setDate(d.getDate() + 1); }
            }
          } else if (b.team_id && b.team_id !== "league" && constraints.respectTeamBlackouts) {
            if (!teamBlackoutsMap[b.team_id]) teamBlackoutsMap[b.team_id] = [];
            teamBlackoutsMap[b.team_id].push(b);
          }
        });

        const isTeamBlackedOut = (tid, date) =>
          (teamBlackoutsMap[tid] || []).some(b => date >= b.date_from && date <= (b.date_to || b.date_from));

        // Late ratio across slot pool
        const lateRatio = poolSlots.length > 0
          ? poolSlots.filter(s => isLateTime(s.start_time, lateGameHour)).length / poolSlots.length
          : 0;

        // ── Step 1: Build matchup lists per division ──────────────────────────
        const divDataMap = {};
        const activeDivIds = [];

        for (const divId of selectedDivIds) {
          const division = divisions.find(d => d.id === divId);
          const divTeams = teams.filter(t => t.division_id === divId);
          if (divTeams.length < 2) continue;

          const targetPerTeam = division?.games_per_team || 30;
          const n = divTeams.length;
          // Total games in this division = floor(target * teams / 2)
          const totalTarget = Math.floor(targetPerTeam * n / 2);

          // One complete round-robin round — every team plays every other exactly once
          const baseRound = [];
          for (let i = 0; i < n; i++)
            for (let j = i + 1; j < n; j++)
              baseRound.push([divTeams[i], divTeams[j]]);
          // Each team plays (n-1) games per full round

          // How many rounds to cover target? ceil(target / (n-1)) + 1 buffer
          const roundsNeeded = Math.ceil(targetPerTeam / (n - 1)) + 1;

          // Build rounds — shuffle within each round for variety
          let allMatchups = [];
          for (let r = 0; r < roundsNeeded; r++) {
            const shuffled = [...baseRound].sort(() => Math.random() - 0.5);
            allMatchups = allMatchups.concat(shuffled);
          }

          // Greedy trim: accept matchups where BOTH teams still need games
          // Guarantees each team ends at exactly targetPerTeam (or as close as possible)
          const gameCount = {};
          divTeams.forEach(t => { gameCount[t.id] = 0; });

          const pendingMatchups = [];
          for (const [a, b] of allMatchups) {
            if (pendingMatchups.length >= totalTarget) break;
            if (gameCount[a.id] < targetPerTeam && gameCount[b.id] < targetPerTeam) {
              pendingMatchups.push([a, b]);
              gameCount[a.id]++;
              gameCount[b.id]++;
            }
          }

          // Per-team tracking — use teamLastDate for O(1) gap checks
          const teamGameDates = {}, teamLateCounts = {}, teamGameCount = {}, teamLastDate = {};
          divTeams.forEach(t => {
            teamGameDates[t.id] = new Set();
            teamLateCounts[t.id] = 0;
            teamGameCount[t.id] = 0;
            teamLastDate[t.id] = null;
          });

          const targetLatePerTeam = Math.round(lateRatio * targetPerTeam);

          divDataMap[divId] = {
            division, divTeams, targetPerTeam, totalTarget,
            pendingMatchups,
            teamGameDates, teamLateCounts, teamGameCount, teamLastDate,
            targetLatePerTeam,
          };
          activeDivIds.push(divId);
        }

        // ── Step 2: Slot-first chronological assignment ───────────────────────
        const scheduledGames = [];
        const usedSlotIds = new Set();
        const minGap = constraints.minGapDays || 0;

        for (const slot of poolSlots) {
          if (usedSlotIds.has(slot.id)) continue;
          if (leagueBlackoutDates.has(slot.date)) continue;

          const isLate = isLateTime(slot.start_time, lateGameHour);

          // Try divisions ordered by urgency: most pending matchups first
          // This prevents any one division from starving when slots are scarce
          const divsByUrgency = activeDivIds
            .filter(id => divDataMap[id].pendingMatchups.length > 0)
            .sort((a, b) => divDataMap[b].pendingMatchups.length - divDataMap[a].pendingMatchups.length);

          for (const divId of divsByUrgency) {
            const dd = divDataMap[divId];
            if (dd.pendingMatchups.length === 0) continue;

            // Find first valid matchup from this division for this slot
            // Two-pass: prefer late-hungry matchups for late slots (soft preference)
            let foundIdx = -1;

            const scanOrder = isLate
              ? [...dd.pendingMatchups.keys()].sort((i, j) => {
                  const [ai, bi] = dd.pendingMatchups[i];
                  const [aj, bj] = dd.pendingMatchups[j];
                  const needsI = (dd.teamLateCounts[ai.id] < dd.targetLatePerTeam ? 1 : 0) + (dd.teamLateCounts[bi.id] < dd.targetLatePerTeam ? 1 : 0);
                  const needsJ = (dd.teamLateCounts[aj.id] < dd.targetLatePerTeam ? 1 : 0) + (dd.teamLateCounts[bj.id] < dd.targetLatePerTeam ? 1 : 0);
                  return needsJ - needsI; // higher need first
                })
              : dd.pendingMatchups.map((_, i) => i); // chronological order for non-late

            for (const mi of scanOrder) {
              const [home, away] = dd.pendingMatchups[mi];

              if (dd.teamGameCount[home.id] >= dd.targetPerTeam || dd.teamGameCount[away.id] >= dd.targetPerTeam) continue;
              if (isTeamBlackedOut(home.id, slot.date) || isTeamBlackedOut(away.id, slot.date)) continue;
              if (constraints.noSameDay && (dd.teamGameDates[home.id].has(slot.date) || dd.teamGameDates[away.id].has(slot.date))) continue;

              if (minGap > 0) {
                const hLast = dd.teamLastDate[home.id];
                const aLast = dd.teamLastDate[away.id];
                if (hLast && daysBetween(hLast, slot.date) < minGap) continue;
                if (aLast && daysBetween(aLast, slot.date) < minGap) continue;
              }

              foundIdx = mi;
              break;
            }

            if (foundIdx >= 0) {
              const [home, away] = dd.pendingMatchups.splice(foundIdx, 1)[0];

              usedSlotIds.add(slot.id);
              dd.teamGameDates[home.id].add(slot.date);
              dd.teamGameDates[away.id].add(slot.date);
              dd.teamGameCount[home.id]++;
              dd.teamGameCount[away.id]++;
              dd.teamLastDate[home.id] = slot.date;
              dd.teamLastDate[away.id] = slot.date;
              if (isLate) { dd.teamLateCounts[home.id]++; dd.teamLateCounts[away.id]++; }

              scheduledGames.push({
                season, division_id: divId, division_name: dd.division?.name,
                home_team_id: home.id, home_team_name: home.name,
                away_team_id: away.id, away_team_name: away.name,
                arena_id: slot.arena_id, arena_name: slot.arena_name,
                date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
                is_late_game: isLate, game_type: "regular", status: "scheduled", ice_slot_id: slot.id,
              });
              break; // one game per slot — move to next slot
            }
          }
        }

        // ── Step 3: Warnings — only real shortfalls ───────────────────────────
        const allWarns = [];
        for (const divId of activeDivIds) {
          const dd = divDataMap[divId];
          if (!dd) continue;

          // Unscheduled matchups = not enough slots
          if (dd.pendingMatchups.length > 0) {
            allWarns.push(`${dd.division?.name}: ${dd.pendingMatchups.length} games unscheduled — need ${dd.pendingMatchups.length} more ice slots.`);
          }

          // Teams short of target
          dd.divTeams.forEach(t => {
            const c = dd.teamGameCount[t.id];
            if (c < dd.targetPerTeam)
              allWarns.push(`${dd.division?.name} — ${t.name}: ${c}/${dd.targetPerTeam} games scheduled.`);
          });

          // Late balance (warn if spread > 3)
          const lateCounts = dd.divTeams.map(t => dd.teamLateCounts[t.id]);
          if (lateCounts.length > 0) {
            const maxLate = Math.max(...lateCounts), minLate = Math.min(...lateCounts);
            if (maxLate - minLate > 3)
              allWarns.push(`${dd.division?.name}: Late game spread ${minLate}–${maxLate} — consider adding more late slots.`);
          }
        }

        setPreview(scheduledGames);
        setWarnings([...new Set(allWarns)]);
        const lateGames = scheduledGames.filter(g => g.is_late_game);
        setStats({
          total: scheduledGames.length,
          lateGames: lateGames.length,
          divCount: activeDivIds.length,
          perDiv: activeDivIds.map(id => {
            const dd = divDataMap[id];
            return {
              name: dd.division?.name,
              scheduled: scheduledGames.filter(g => g.division_id === id).length,
              target: dd.totalTarget,
            };
          }),
        });
        setResult({ success: true, count: scheduledGames.length });
      } catch (e) {
        setResult({ error: e.message });
      }
      setGenerating(false);
    }, 100);
  };

  const saveSchedule = async () => {
    if (!preview.length) return;
    setGenerating(true);
    const slotIds = [...new Set(preview.map(g => g.ice_slot_id).filter(Boolean))];
    const totalSteps = preview.length + slotIds.length;
    setSaveProgress({ current: 0, total: totalSteps, phase: "Saving games" });

    // Bulk create games in chunks of 20 with delays
    let created = 0;
    const GAME_CHUNK = 20;
    for (let i = 0; i < preview.length; i += GAME_CHUNK) {
      const chunk = preview.slice(i, i + GAME_CHUNK);
      await base44.entities.Game.bulkCreate(chunk);
      created += chunk.length;
      setSaveProgress({ current: created, total: totalSteps, phase: "Saving games" });
      await new Promise(r => setTimeout(r, 600));
    }

    // Update ice slots one-by-one to avoid rate limits
    let slotsDone = 0;
    for (const id of slotIds) {
      await base44.entities.IceSlot.update(id, { is_available: false });
      slotsDone++;
      setSaveProgress({ current: preview.length + slotsDone, total: totalSteps, phase: "Updating ice slots" });
      await new Promise(r => setTimeout(r, 250));
    }

    setSaveProgress(null);
    setResult({ saved: true, count: preview.length });
    setPreview([]); setStats(null); setWarnings([]);
    setGenerating(false);
  };

  const clearDivisionSchedule = async (divId) => {
    const div = divisions.find(d => d.id === divId);
    if (!confirm(`Delete all regular season games for ${div?.name}?`)) return;
    const toDelete = existingGames.filter(g => g.division_id === divId && g.game_type === "regular");
    const slotIds = [...new Set(toDelete.map(g => g.ice_slot_id).filter(Boolean))];
    await batchDelete(toDelete.map(g => g.id), id => base44.entities.Game.delete(id));
    await batchUpdate(slotIds, id => base44.entities.IceSlot.update(id, { is_available: true }));
    const g = await base44.entities.Game.list("date", 3000);
    setExistingGames(g);
  };

  const inputCls = "w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">Generate balanced schedules — divisions are interleaved for fair slot distribution</p>
      </div>

      <div className="rounded-xl border border-gray-800 p-6 space-y-6" style={{ background: "#111" }}>

        {/* Season + Divisions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Season</label>
            <input className={inputCls} value={season} onChange={e => setSeason(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Divisions *</label>
            <div className="relative">
              <button onClick={() => setDivDropOpen(!divDropOpen)}
                className="w-full flex items-center justify-between bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm">
                <span className={selectedDivIds.length === 0 ? "text-gray-500" : "text-white"}>
                  {selectedDivIds.length === 0 ? "Select divisions..." :
                   selectedDivIds.length === divisions.length ? "All divisions" :
                   `${selectedDivIds.length} division${selectedDivIds.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {divDropOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 border border-gray-800 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto" style={{ background: "#1a1a1a" }}>
                  <button onClick={selectAllDivs} className="w-full text-left px-3 py-2 text-xs text-yellow-400 hover:bg-white/5 border-b border-gray-800">
                    {selectedDivIds.length === divisions.length ? "Deselect All" : "Select All"}
                  </button>
                  {divisions.map(d => (
                    <button key={d.id} onClick={() => toggleDiv(d.id)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-white/5 ${selectedDivIds.includes(d.id) ? "text-yellow-400" : "text-gray-300"}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selectedDivIds.includes(d.id) ? "bg-yellow-500 border-yellow-500" : "border-gray-600"}`}>
                        {selectedDivIds.includes(d.id) && <CheckCircle className="w-3 h-3 text-black" />}
                      </span>
                      {d.name}
                      <span className="text-xs text-gray-500 ml-auto">{teams.filter(t => t.division_id === d.id).length} teams</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Division summaries */}
        {selectedDivIds.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {selectedDivIds.map(divId => {
              const div = divisions.find(d => d.id === divId);
              const divTeams = teams.filter(t => t.division_id === divId);
              const divExisting = existingGames.filter(g => g.division_id === divId);
              const needed = Math.ceil((divTeams.length * (div?.games_per_team || 30)) / 2);
              return (
                <div key={divId} className="rounded-lg p-3 border border-gray-800 text-xs" style={{ background: "#0d0d0d" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-white">{div?.name}</span>
                    {divExisting.length > 0 && (
                      <button onClick={() => clearDivisionSchedule(divId)} className="text-red-400 hover:text-red-300 flex items-center gap-0.5">
                        <Trash2 className="w-3 h-3" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5 text-gray-400">
                    <div className="flex justify-between"><span>Teams:</span><span className="text-white">{divTeams.length}</span></div>
                    <div className="flex justify-between"><span>Games/team:</span><span className="text-white">{div?.games_per_team || 30}</span></div>
                    <div className="flex justify-between"><span>Slots needed:</span><span className="text-yellow-400">{needed}</span></div>
                    {divExisting.length > 0 && <div className="flex justify-between"><span>Existing:</span><span className="text-yellow-400">{divExisting.length}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-gray-800" />

        {/* Timeframe */}
        <div>
          <label className="text-sm text-gray-400 block mb-2">Schedule Timeframe</label>
          <div className="flex gap-2 mb-3">
            {["full", "custom"].map(m => (
              <button key={m} onClick={() => setTimeframeMode(m)}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={timeframeMode === m
                  ? { background: "#c0c0c0", color: "#000", borderColor: "#c0c0c0" }
                  : { background: "#0d0d0d", color: "#888", borderColor: "#333" }}>
                {m === "full" ? "Full Season" : "Custom Dates"}
              </button>
            ))}
          </div>
          {timeframeMode === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">From</label>
                <input type="date" className={inputCls} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">To</label>
                <input type="date" className={inputCls} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800" />

        {/* Rules + Blackouts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: "#d4af37" }} /> Scheduling Rules
            </h3>
            <div className="space-y-2.5">
              {[
                { key: "noSameDay", label: "No same-day games per team" },
                { key: "respectTeamBlackouts", label: "Respect team blackout dates" },
                { key: "respectLeagueBlackouts", label: "Respect league blackout dates" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={constraints[key]}
                    onChange={e => setConstraints(c => ({ ...c, [key]: e.target.checked }))}
                    style={{ accentColor: "#d4af37" }} className="w-4 h-4" />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
              <div className="pt-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Min days between games</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={14} className="w-16 bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      value={constraints.minGapDays}
                      onChange={e => setConstraints(c => ({ ...c, minGapDays: parseInt(e.target.value) || 0 }))} />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Max days between games</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={30} className="w-16 bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      value={constraints.maxDaysBetweenGames}
                      onChange={e => setConstraints(c => ({ ...c, maxDaysBetweenGames: parseInt(e.target.value) || 0 }))} />
                    <span className="text-xs text-gray-500">days (0=none)</span>
                  </div>
                </div>
              </div>
              <div className="pt-1">
                <label className="text-sm text-gray-400 block mb-1 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-yellow-400" /> Late game starts at or after
                </label>
                <div className="flex items-center gap-2">
                  <select className="bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                    value={lateGameHour} onChange={e => setLateGameHour(parseInt(e.target.value))}>
                    {[19,20,21,22,23].map(h => (
                      <option key={h} value={h}>{h}:00 ({h > 12 ? `${h-12}pm` : `${h}am`})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* League Blackouts */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#d4af37" }} /> League Blackouts
              </h3>
              <button onClick={() => setShowBlackoutForm(!showBlackoutForm)}
                className="text-xs text-black px-2 py-1 rounded-lg flex items-center gap-1 font-medium"
                style={{ background: "#c0c0c0" }}>
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {showBlackoutForm && (
              <div className="rounded-lg p-3 mb-3 space-y-2 border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">From *</label>
                    <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                      value={newBlackout.date_from} onChange={e => setNewBlackout(b => ({ ...b, date_from: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">To</label>
                    <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                      value={newBlackout.date_to} onChange={e => setNewBlackout(b => ({ ...b, date_to: e.target.value }))} />
                  </div>
                </div>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none"
                  placeholder="Reason" value={newBlackout.reason} onChange={e => setNewBlackout(b => ({ ...b, reason: e.target.value }))} />
                <div className="flex gap-2">
                  <button onClick={() => setShowBlackoutForm(false)} className="flex-1 py-1.5 border border-gray-700 rounded-lg text-gray-400 text-xs">Cancel</button>
                  <button onClick={addLeagueBlackout} disabled={!newBlackout.date_from}
                    className="flex-1 py-1.5 text-black text-xs rounded-lg font-medium disabled:opacity-50" style={{ background: "#c0c0c0" }}>Add</button>
                </div>
              </div>
            )}
            {leagueBlackoutList.length === 0 ? (
              <p className="text-xs text-gray-600">No league blackouts set.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {leagueBlackoutList.map(b => (
                  <div key={b.id} className="flex items-start justify-between rounded-lg px-3 py-2 text-xs border border-gray-800" style={{ background: "#0d0d0d" }}>
                    <div>
                      <div className="text-white">{b.date_from}{b.date_to && b.date_to !== b.date_from ? ` → ${b.date_to}` : ""}</div>
                      {b.reason && <div className="text-gray-500 mt-0.5">{b.reason}</div>}
                    </div>
                    <button onClick={() => removeLeagueBlackout(b.id)} className="text-gray-600 hover:text-red-400 ml-2"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-800" />

        {/* Results / Warnings */}
        {result?.error && (
          <div className="rounded-xl p-4 flex items-start gap-3 border border-red-500/20 bg-red-500/8">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div><p className="text-red-400 font-medium">Error</p><p className="text-red-300 text-sm mt-1">{result.error}</p></div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl p-4 border border-yellow-500/20" style={{ background: "rgba(212,175,55,0.05)" }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 font-medium text-sm">{warnings.length} Warning{warnings.length > 1 ? "s" : ""}</span>
            </div>
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {warnings.map((w, i) => <li key={i} className="text-yellow-300 text-xs flex gap-2"><span className="shrink-0 text-yellow-500">•</span><span>{w}</span></li>)}
            </ul>
          </div>
        )}

        {result?.success && stats && (
          <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">{result.count} games generated — review then save</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Games</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1"><Moon className="w-4 h-4" />{stats.lateGames}</div>
                <div className="text-xs text-gray-400">Late ({lateGameHour}:00+)</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold" style={{ color: "#c0c0c0" }}>{stats.divCount}</div>
                <div className="text-xs text-gray-400">Divisions</div>
              </div>
            </div>
            {stats.perDiv && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {stats.perDiv.map(d => (
                  <div key={d.name} className="rounded-lg px-3 py-2 border text-xs flex justify-between items-center"
                    style={{ background: "#0d0d0d", borderColor: d.scheduled >= d.target ? "#22c55e30" : "#ef444430" }}>
                    <span className="text-gray-300 font-medium">{d.name}</span>
                    <span className={d.scheduled >= d.target ? "text-green-400" : "text-red-400"}>
                      {d.scheduled}/{d.target}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {saveProgress && (
          <div className="rounded-xl p-4 border border-gray-700" style={{ background: "#0d0d0d" }}>
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>{saveProgress.phase} — {saveProgress.current} of {saveProgress.total}</span>
              <span>{saveProgress.total > 0 ? Math.round((saveProgress.current / saveProgress.total) * 100) : 0}%</span>
            </div>
            <div className="w-full rounded-full h-2.5" style={{ background: "#222" }}>
              <div className="h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${saveProgress.total > 0 ? Math.round((saveProgress.current / saveProgress.total) * 100) : 0}%`, background: "linear-gradient(90deg,#c0c0c0,#d4af37)" }} />
            </div>
          </div>
        )}

        {result?.saved && (
          <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400">{result.count} games saved successfully!</span>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
            <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-2">
              <Eye className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-white">Preview — First 50 of {preview.length} games</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Division</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Date</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Time</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Matchup</th>
                    <th className="text-left px-4 py-2 text-xs text-gray-500">Arena</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900">
                  {preview.slice(0, 50).map((g, i) => (
                    <tr key={i} className="hover:bg-white/2">
                      <td className="px-4 py-2 text-xs text-yellow-400">{g.division_name}</td>
                      <td className="px-4 py-2 text-sm text-white whitespace-nowrap">{g.date}</td>
                      <td className="px-4 py-2 text-sm text-gray-400 whitespace-nowrap">
                        <span className="flex items-center gap-1">{g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}</span>
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

        {/* Generate / Save buttons */}
        <div className="flex gap-3 pt-2">
          <button onClick={() => { setDivDropOpen(false); generateSchedule(); }}
            disabled={generating || selectedDivIds.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-black"
            style={{ background: "#c0c0c0" }}>
            {generating && !saveProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />}
            {generating && !saveProgress ? "Generating..." : `Generate Schedule${selectedDivIds.length > 1 ? ` (${selectedDivIds.length} divs)` : ""}`}
          </button>
          {result?.success && preview.length > 0 && (
            <button onClick={saveSchedule} disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm disabled:opacity-50 text-black transition-colors"
              style={{ background: "#d4af37" }}>
              {generating && saveProgress ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Save {preview.length} Games
            </button>
          )}
        </div>
      </div>
    </div>
  );
}