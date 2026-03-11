import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Shuffle, AlertCircle, CheckCircle, Moon, Eye, Trash2,
  Loader2, AlertTriangle, ChevronDown, Plus, X, Calendar
} from "lucide-react";
import { batchDelete, batchUpdate } from "@/components/batchOps";
import ScheduleWarningsPanel from "@/components/ScheduleWarningsPanel";

const daysBetween = (d1, d2) =>
  Math.abs(new Date(d1 + "T12:00:00") - new Date(d2 + "T12:00:00")) / (1000 * 60 * 60 * 24);

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

  const [lateGameHour, setLateGameHour] = useState(22);
  const [lateGameMinute, setLateGameMinute] = useState(0);
  // League-wide late game target range per team
  const [lateMin, setLateMin] = useState(7);
  const [lateMax, setLateMax] = useState(10);

  const [constraints, setConstraints] = useState({
    noSameDay: true,
    minGapDays: 2,
    maxDaysBetweenGames: 15,
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
  // KEY IMPROVEMENTS:
  //  1. Overflow: each team targets exactly 30 games; if odd matchup math forces +1 on
  //     a small number of teams, that's allowed (max targetPerTeam+1).
  //  2. Max-gap ENFORCED: if a team will exceed maxDaysBetweenGames, the slot is skipped
  //     for that matchup UNLESS it's the only slot available (then we relax the gap to
  //     avoid leaving teams with no games).
  //  3. Late games: league-wide target range (lateMin–lateMax per team), not by division.
  //  4. 2-pass: first pass enforces all constraints strictly; second pass relaxes max-gap
  //     only to catch teams that couldn't be scheduled otherwise.
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

        poolSlots = [...poolSlots].sort((a, b) =>
          a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
        );

        // ── Blackout lookups ─────────────────────────────────────────────────
        const allBlackoutsRaw = [...blackouts, ...leagueBlackoutList];
        const leagueBlackoutDates = new Set();
        const teamBlackoutsMap = {};

        allBlackoutsRaw.forEach(b => {
          if (!b.team_id || b.team_id === "league") {
            if (constraints.respectLeagueBlackouts) {
              let d = new Date(b.date_from + "T12:00:00");
              const end = new Date((b.date_to || b.date_from) + "T12:00:00");
              while (d <= end) {
                leagueBlackoutDates.add(d.toISOString().split("T")[0]);
                d.setDate(d.getDate() + 1);
              }
            }
          } else if (b.team_id && constraints.respectTeamBlackouts) {
            if (!teamBlackoutsMap[b.team_id]) teamBlackoutsMap[b.team_id] = [];
            teamBlackoutsMap[b.team_id].push(b);
          }
        });

        const isTeamBlackedOut = (tid, date) =>
          (teamBlackoutsMap[tid] || []).some(b => date >= b.date_from && date <= (b.date_to || b.date_from));

        const isLateCustom = (t) => {
          if (!t) return false;
          const [h, m] = t.split(":").map(Number);
          return h > lateGameHour || (h === lateGameHour && m >= lateGameMinute);
        };

        // ── Step 1: Build matchup lists per division ─────────────────────────
        const divDataMap = {};
        const activeDivIds = [];

        for (const divId of selectedDivIds) {
          const division = divisions.find(d => d.id === divId);
          const divTeams = teams.filter(t => t.division_id === divId);
          if (divTeams.length < 2) continue;

          const targetPerTeam = division?.games_per_team || 30;
          const overflowLimit = targetPerTeam + 1; // allow +1 to close parity gaps
          const n = divTeams.length;
          const totalTarget = Math.floor(targetPerTeam * n / 2);

          // Build multiple round-robin rounds for enough matchups
          const baseRound = [];
          for (let i = 0; i < n; i++)
            for (let j = i + 1; j < n; j++)
              baseRound.push([divTeams[i], divTeams[j]]);

          const roundsNeeded = Math.ceil(overflowLimit / (n - 1)) + 2;
          let allMatchups = [];
          for (let r = 0; r < roundsNeeded; r++) {
            allMatchups = allMatchups.concat([...baseRound].sort(() => Math.random() - 0.5));
          }

          // Greedy trim — allow overflow (+1) only when it helps another team reach target
          const gameCount = {};
          divTeams.forEach(t => { gameCount[t.id] = 0; });

          const pendingMatchups = [];
          for (const [a, b] of allMatchups) {
            if (pendingMatchups.length >= totalTarget) break;
            // Primary: both under target
            if (gameCount[a.id] < targetPerTeam && gameCount[b.id] < targetPerTeam) {
              pendingMatchups.push([a, b]);
              gameCount[a.id]++;
              gameCount[b.id]++;
            }
          }
          // Second pass: pick up any teams still short by allowing one partner to go +1
          for (const [a, b] of allMatchups) {
            if (!divTeams.some(t => gameCount[t.id] < targetPerTeam)) break;
            if (gameCount[a.id] < targetPerTeam && gameCount[b.id] < overflowLimit) {
              if (!pendingMatchups.some(([pa, pb]) => pa.id === a.id && pb.id === b.id)) {
                pendingMatchups.push([a, b]);
                gameCount[a.id]++;
                gameCount[b.id]++;
              }
            } else if (gameCount[b.id] < targetPerTeam && gameCount[a.id] < overflowLimit) {
              if (!pendingMatchups.some(([pa, pb]) => pa.id === b.id && pb.id === a.id)) {
                pendingMatchups.push([b, a]);
                gameCount[b.id]++;
                gameCount[a.id]++;
              }
            }
          }

          const teamGameDates = {}, teamLateCounts = {}, teamGameCount = {}, teamLastDate = {};
          divTeams.forEach(t => {
            teamGameDates[t.id] = new Set();
            teamLateCounts[t.id] = 0;
            teamGameCount[t.id] = 0;
            teamLastDate[t.id] = null;
          });

          divDataMap[divId] = {
            division, divTeams, targetPerTeam, overflowLimit, totalTarget,
            pendingMatchups,
            teamGameDates, teamLateCounts, teamGameCount, teamLastDate,
          };
          activeDivIds.push(divId);
        }

        // ── Step 2: Two-pass slot assignment ─────────────────────────────────
        // Pass 1: all constraints enforced (including max gap)
        // Pass 2: relax max-gap only, for teams still short
        const scheduledGames = [];
        const usedSlotIds = new Set();
        const minGap = constraints.minGapDays || 0;
        const maxGap = constraints.maxDaysBetweenGames || 0;

        // ── Build weighted round-robin rotation cycle ─────────────────────────
        // Each division appears in the cycle proportional to its share of total
        // games, so ice slots are distributed evenly across ALL divisions
        // throughout the season rather than front-loading any single division.
        const totalGamesAll = activeDivIds.reduce((s, id) => s + divDataMap[id].totalTarget, 0);
        const rotationCycle = [];
        if (totalGamesAll > 0) {
          const divWeights = {};
          activeDivIds.forEach(id => { divWeights[id] = divDataMap[id].totalTarget / totalGamesAll; });
          const cycleLen = Math.min(totalGamesAll, 200);
          const placed = {};
          activeDivIds.forEach(id => { placed[id] = 0; });
          for (let i = 0; i < cycleLen; i++) {
            // Bresenham-style: pick division most behind its expected share
            let best = null, bestDeficit = -Infinity;
            activeDivIds.forEach(id => {
              const deficit = divWeights[id] * (i + 1) - placed[id];
              if (deficit > bestDeficit) { bestDeficit = deficit; best = id; }
            });
            rotationCycle.push(best);
            placed[best]++;
          }
        }
        let rotationIdx = 0;

        // League-wide late game tracking (per team, across all divisions)
        const leagueLateCount = {};
        activeDivIds.forEach(divId => {
          divDataMap[divId].divTeams.forEach(t => { leagueLateCount[t.id] = 0; });
        });

        const runPass = (relaxMaxGap) => {
          for (const slot of poolSlots) {
            if (usedSlotIds.has(slot.id)) continue;
            if (leagueBlackoutDates.has(slot.date)) continue;

            const isLate = isLateCustom(slot.start_time);

            // Use weighted rotation to decide which division gets this slot,
            // falling back to any division still needing games if the rotated
            // division has no viable matchup for this slot.
            const eligibleDivs = activeDivIds.filter(id => divDataMap[id].pendingMatchups.length > 0);
            if (eligibleDivs.length === 0) continue;

            // Advance rotation to next div that still has matchups
            let rotStart = rotationIdx;
            while (!eligibleDivs.includes(rotationCycle[rotationIdx % rotationCycle.length])) {
              rotationIdx++;
              if (rotationIdx - rotStart > rotationCycle.length) break;
            }
            const rotatedDiv = rotationCycle[rotationIdx % rotationCycle.length];
            rotationIdx++;

            // Try rotated div first, then fall back to others
            const divOrder = [rotatedDiv, ...eligibleDivs.filter(id => id !== rotatedDiv)];

            for (const divId of divOrder) {
              const dd = divDataMap[divId];
              if (dd.pendingMatchups.length === 0) continue;

              // Score each pending matchup — lower = better candidate for this slot
              const scored = dd.pendingMatchups.map((match, mi) => {
                const [home, away] = match;

                // Hard constraints — return Infinity to skip
                if (dd.teamGameCount[home.id] >= dd.overflowLimit) return { mi, score: Infinity };
                if (dd.teamGameCount[away.id] >= dd.overflowLimit) return { mi, score: Infinity };
                if (isTeamBlackedOut(home.id, slot.date) || isTeamBlackedOut(away.id, slot.date)) return { mi, score: Infinity };
                if (constraints.noSameDay && (dd.teamGameDates[home.id].has(slot.date) || dd.teamGameDates[away.id].has(slot.date))) return { mi, score: Infinity };

                const hLast = dd.teamLastDate[home.id];
                const aLast = dd.teamLastDate[away.id];

                if (minGap > 0) {
                  if (hLast && daysBetween(hLast, slot.date) < minGap) return { mi, score: Infinity };
                  if (aLast && daysBetween(aLast, slot.date) < minGap) return { mi, score: Infinity };
                }

                // Max gap enforcement — only relax in pass 2 for short teams
                if (!relaxMaxGap && maxGap > 0) {
                  if (hLast && daysBetween(hLast, slot.date) > maxGap) return { mi, score: Infinity };
                  if (aLast && daysBetween(aLast, slot.date) > maxGap) return { mi, score: Infinity };
                }

                // In pass 2, only process teams still short
                if (relaxMaxGap) {
                  const homeShort = dd.teamGameCount[home.id] < dd.targetPerTeam;
                  const awayShort = dd.teamGameCount[away.id] < dd.targetPerTeam;
                  if (!homeShort && !awayShort) return { mi, score: Infinity };
                }

                // Score: urgency (days since last game) — higher urgency = lower score = picked first
                const hDays = hLast ? daysBetween(hLast, slot.date) : 999;
                const aDays = aLast ? daysBetween(aLast, slot.date) : 999;
                let score = -(hDays + aDays); // negative so most overdue sorts first

                // Late game preference: teams under lateMin get priority for late slots
                if (isLate) {
                  const hNeedsLate = leagueLateCount[home.id] < lateMin ? 2 : (leagueLateCount[home.id] < lateMax ? 1 : 0);
                  const aNeedsLate = leagueLateCount[away.id] < lateMin ? 2 : (leagueLateCount[away.id] < lateMax ? 1 : 0);
                  score -= (hNeedsLate + aNeedsLate) * 10; // pull late-needy teams to front
                }

                // Avoid assigning late if team is at lateMax
                if (isLate && leagueLateCount[home.id] >= lateMax && leagueLateCount[away.id] >= lateMax) {
                  return { mi, score: Infinity };
                }

                return { mi, score };
              });

              scored.sort((a, b) => a.score - b.score);
              const best = scored[0];
              if (!best || best.score === Infinity) continue;

              const foundIdx = best.mi;
              const [home, away] = dd.pendingMatchups.splice(foundIdx, 1)[0];

              usedSlotIds.add(slot.id);
              dd.teamGameDates[home.id].add(slot.date);
              dd.teamGameDates[away.id].add(slot.date);
              dd.teamGameCount[home.id]++;
              dd.teamGameCount[away.id]++;
              dd.teamLastDate[home.id] = slot.date;
              dd.teamLastDate[away.id] = slot.date;
              if (isLate) {
                dd.teamLateCounts[home.id]++;
                dd.teamLateCounts[away.id]++;
                leagueLateCount[home.id]++;
                leagueLateCount[away.id]++;
              }

              scheduledGames.push({
                season, division_id: divId, division_name: dd.division?.name,
                home_team_id: home.id, home_team_name: home.name,
                away_team_id: away.id, away_team_name: away.name,
                arena_id: slot.arena_id, arena_name: slot.arena_name,
                date: slot.date, start_time: slot.start_time, end_time: slot.end_time,
                is_late_game: isLate, game_type: "regular", status: "scheduled", ice_slot_id: slot.id,
              });
              break;
            }
          }
        };

        runPass(false); // strict pass
        runPass(true);  // relaxed pass — fills gaps for short teams

        // ── Step 3: Build rich structured warnings ────────────────────────────
        const allWarns = [];

        // Total available slots after blackouts
        const usableSlots = poolSlots.filter(s => !leagueBlackoutDates.has(s.date)).length;
        const totalNeeded = activeDivIds.reduce((acc, id) => acc + divDataMap[id].totalTarget, 0);
        if (usableSlots < totalNeeded) {
          allWarns.push({
            severity: "critical", type: "slot_shortage",
            message: `Only ${usableSlots} usable ice slots for ${totalNeeded} games needed across all divisions.`,
            fix: `Add ${totalNeeded - usableSlots} more ice slots to cover the full schedule. Check Ice Slots & Arenas page.`,
          });
        }

        for (const divId of activeDivIds) {
          const dd = divDataMap[divId];
          if (!dd) continue;
          const divName = dd.division?.name;

          // Unscheduled matchups
          if (dd.pendingMatchups.length > 0) {
            allWarns.push({
              severity: "critical", type: "slot_shortage",
              message: `${divName}: ${dd.pendingMatchups.length} games could not be scheduled.`,
              fix: `Add at least ${dd.pendingMatchups.length} more ice slots for ${divName}, or reduce games-per-team in division settings.`,
            });
          }

          // Teams short of target
          const shortTeams = dd.divTeams.filter(t => dd.teamGameCount[t.id] < dd.targetPerTeam);
          if (shortTeams.length > 0) {
            shortTeams.forEach(t => {
              const c = dd.teamGameCount[t.id];
              const diff = dd.targetPerTeam - c;
              allWarns.push({
                severity: "critical", type: "short_games",
                message: `${divName} — ${t.name}: ${c}/${dd.targetPerTeam} games scheduled (short by ${diff}).`,
                fix: `Add ${diff} more ice slots that fall outside ${t.name}'s blackout dates. Check if this team has excessive blackouts.`,
              });
            });
          }

          // Gap violations — enforced but warn if 2nd pass still couldn't fix
          if (maxGap > 0) {
            const divGames = scheduledGames.filter(g => g.division_id === divId);
            dd.divTeams.forEach(t => {
              const tDates = divGames
                .filter(g => g.home_team_id === t.id || g.away_team_id === t.id)
                .map(g => g.date).sort();
              for (let i = 1; i < tDates.length; i++) {
                const gap = Math.round(daysBetween(tDates[i - 1], tDates[i]));
                if (gap > maxGap) {
                  allWarns.push({
                    severity: "warning", type: "gap_violation",
                    message: `${divName} — ${t.name}: ${gap}-day gap between ${tDates[i - 1]} and ${tDates[i]}.`,
                    fix: `Add an ice slot for ${divName} between ${tDates[i - 1]} and ${tDates[i]} (target max ${maxGap} days). Consider removing blackout dates in this window.`,
                  });
                  break;
                }
              }
            });
          }
        }

        // League-wide late game check
        const allScheduledTeams = activeDivIds.flatMap(id => divDataMap[id].divTeams);
        const teamsUnderMin = allScheduledTeams.filter(t => leagueLateCount[t.id] < lateMin);
        const teamsOverMax = allScheduledTeams.filter(t => leagueLateCount[t.id] > lateMax);

        if (teamsUnderMin.length > 0) {
          const lateSlotCount = poolSlots.filter(s => isLateCustom(s.start_time)).length;
          allWarns.push({
            severity: "warning", type: "late_low",
            message: `${teamsUnderMin.length} team${teamsUnderMin.length > 1 ? "s" : ""} have fewer than ${lateMin} late games: ${teamsUnderMin.slice(0, 4).map(t => t.name).join(", ")}${teamsUnderMin.length > 4 ? "..." : ""}.`,
            fix: `Add more late ice slots (${lateGameHour}:${String(lateGameMinute).padStart(2, "0")}+). Currently ${lateSlotCount} late slots available. Target ${lateMin}–${lateMax} late games per team league-wide.`,
          });
        }
        if (teamsOverMax.length > 0) {
          allWarns.push({
            severity: "info", type: "late_high",
            message: `${teamsOverMax.length} team${teamsOverMax.length > 1 ? "s" : ""} exceeded ${lateMax} late games: ${teamsOverMax.slice(0, 4).map(t => t.name).join(", ")}${teamsOverMax.length > 4 ? "..." : ""}.`,
            fix: `Reduce late ice slots or lower the late game threshold time. These teams will play more late games than targeted.`,
          });
        }

        // Overflow teams (hit 31)
        const overflowTeams = activeDivIds.flatMap(id =>
          divDataMap[id].divTeams.filter(t => divDataMap[id].teamGameCount[t.id] > divDataMap[id].targetPerTeam)
            .map(t => ({ name: t.name, count: divDataMap[id].teamGameCount[t.id], div: divDataMap[id].division?.name }))
        );
        if (overflowTeams.length > 0) {
          allWarns.push({
            severity: "info", type: "overflow",
            message: `${overflowTeams.length} team${overflowTeams.length > 1 ? "s" : ""} scheduled for ${overflowTeams[0].count} games (allowed +1 overflow to satisfy parity): ${overflowTeams.slice(0, 4).map(t => `${t.name} (${t.div})`).join(", ")}${overflowTeams.length > 4 ? "..." : ""}.`,
            fix: `This is normal — the scheduler used +1 overflow to ensure their opponents reached the target. No action required.`,
          });
        }

        setPreview(scheduledGames);
        setWarnings(allWarns);

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
              teams: dd.divTeams.map(t => ({
                name: t.name,
                games: dd.teamGameCount[t.id],
                target: dd.targetPerTeam,
                late: leagueLateCount[t.id],
              })),
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

    let created = 0;
    const GAME_CHUNK = 10;
    for (let i = 0; i < preview.length; i += GAME_CHUNK) {
      await base44.entities.Game.bulkCreate(preview.slice(i, i + GAME_CHUNK));
      created += Math.min(GAME_CHUNK, preview.length - i);
      setSaveProgress({ current: created, total: totalSteps, phase: "Saving games" });
      await new Promise(r => setTimeout(r, 1500));
    }

    let slotsDone = 0;
    const SLOT_CHUNK = 5;
    for (let i = 0; i < slotIds.length; i += SLOT_CHUNK) {
      const chunk = slotIds.slice(i, i + SLOT_CHUNK);
      await Promise.all(chunk.map(id => base44.entities.IceSlot.update(id, { is_available: false })));
      slotsDone += chunk.length;
      setSaveProgress({ current: preview.length + slotsDone, total: totalSteps, phase: "Updating ice slots" });
      await new Promise(r => setTimeout(r, 1200));
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

  const isLateCustom = (t) => {
    if (!t) return false;
    const [h, m] = t.split(":").map(Number);
    return h > lateGameHour || (h === lateGameHour && m >= lateGameMinute);
  };

  const inputCls = "w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500";

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Schedule Builder</h1>
        <p className="text-gray-400 text-sm mt-1">
          Generates balanced schedules with enforced gap limits, late game targets, and +1 overflow parity.
        </p>
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
                  <label className="text-xs text-gray-500 block mb-1">Min days between</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={14} className="w-16 bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      value={constraints.minGapDays}
                      onChange={e => setConstraints(c => ({ ...c, minGapDays: parseInt(e.target.value) || 0 }))} />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Max days between <span className="text-yellow-500">(enforced)</span></label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={30} className="w-16 bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
                      value={constraints.maxDaysBetweenGames}
                      onChange={e => setConstraints(c => ({ ...c, maxDaysBetweenGames: parseInt(e.target.value) || 0 }))} />
                    <span className="text-xs text-gray-500">days</span>
                  </div>
                </div>
              </div>

              {/* Late game settings */}
              <div className="pt-2 rounded-lg p-3 border border-gray-800 space-y-3" style={{ background: "#0d0d0d" }}>
                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-sm text-white font-medium">Late Game Settings</span>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Threshold (games at or after...)</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[{ h: 22, m: 0, label: "10:00pm" }, { h: 22, m: 30, label: "10:30pm" }, { h: 23, m: 0, label: "11:00pm" }].map(({ h, m, label }) => (
                      <button key={label}
                        onClick={() => { setLateGameHour(h); setLateGameMinute(m); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        style={lateGameHour === h && lateGameMinute === m
                          ? { background: "#d4af37", color: "#000", borderColor: "#d4af37" }
                          : { background: "#111", color: "#888", borderColor: "#333" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">Target per team (league-wide)</label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Min</span>
                      <input type="number" min={0} max={20} className="w-14 bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                        value={lateMin} onChange={e => setLateMin(parseInt(e.target.value) || 0)} />
                    </div>
                    <span className="text-gray-600">—</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500">Max</span>
                      <input type="number" min={0} max={20} className="w-14 bg-black border border-gray-800 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none"
                        value={lateMax} onChange={e => setLateMax(parseInt(e.target.value) || 0)} />
                    </div>
                    <span className="text-xs text-gray-500">games</span>
                  </div>
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

        {/* Error */}
        {result?.error && (
          <div className="rounded-xl p-4 flex items-start gap-3 border border-red-500/20 bg-red-500/8">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
            <div><p className="text-red-400 font-medium">Error</p><p className="text-red-300 text-sm mt-1">{result.error}</p></div>
          </div>
        )}

        {/* Structured warnings with fixes */}
        <ScheduleWarningsPanel warnings={warnings} />

        {/* Success summary */}
        {result?.success && stats && (
          <div className="rounded-xl p-4 border border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">{result.count} games generated — review then save</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-white">{stats.total}</div>
                <div className="text-xs text-gray-400">Total Games</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                  <Moon className="w-4 h-4" />{stats.lateGames}
                </div>
                <div className="text-xs text-gray-400">Late Games</div>
              </div>
              <div className="rounded-lg p-3 text-center border border-gray-800" style={{ background: "#0d0d0d" }}>
                <div className="text-2xl font-bold" style={{ color: "#c0c0c0" }}>{stats.divCount}</div>
                <div className="text-xs text-gray-400">Divisions</div>
              </div>
            </div>

            {/* Per-division team breakdown */}
            {stats.perDiv && stats.perDiv.map(d => (
              <div key={d.name} className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-white">{d.name}</span>
                  <span className={`text-xs ${d.scheduled >= d.target ? "text-green-400" : "text-red-400"}`}>
                    {d.scheduled}/{d.target} games
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {d.teams.map(t => (
                    <div key={t.name} className="rounded px-2.5 py-1.5 border text-xs flex items-center justify-between gap-2"
                      style={{
                        background: "#0d0d0d",
                        borderColor: t.games >= t.target ? "#22c55e20" : t.games >= t.target - 1 ? "#d4af3720" : "#ef444420"
                      }}>
                      <span className="text-gray-300 truncate">{t.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={t.games >= t.target ? "text-green-400" : t.games >= t.target - 1 ? "text-yellow-400" : "text-red-400"}>
                          {t.games}
                        </span>
                        {t.late > 0 && (
                          <span className="text-gray-500 flex items-center gap-0.5">
                            <Moon className="w-2.5 h-2.5 text-yellow-500" />{t.late}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save progress */}
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

        {/* Preview table */}
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
                        <span className="flex items-center gap-1">
                          {g.start_time} {g.is_late_game && <Moon className="w-3 h-3 text-yellow-400" />}
                        </span>
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