import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLeague } from "@/components/useLeague";
import { AlertTriangle, Plus, X, Clock, CheckCircle, XCircle, Mail, Trophy, RefreshCw, Calendar, Pencil, Trash2 } from "lucide-react";

const STATUS_COLORS = {
  submitted: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  notified: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  replacement_found: "bg-green-500/10 text-green-400 border-green-500/20",
  no_replacement: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  confirmed_forfeit: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function Forfeits() {
  const { leagueId } = useLeague();
  const [forfeits, setForfeits] = useState([]);
  const [forfeitResponses, setForfeitResponses] = useState([]);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ team_id: "", game_id: "", reason: "" });
  const [editingForfeit, setEditingForfeit] = useState(null);
  const [editForfeitForm, setEditForfeitForm] = useState({});

  const reload = async () => {
    const q = leagueId ? { league_id: leagueId } : {};
    const [f, fr] = await Promise.all([
      base44.entities.Forfeit.filter(q, "-created_date"),
      base44.entities.ForfeitResponse.filter(q),
    ]);
    setForfeits(f);
    setForfeitResponses(fr);
  };

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const today = new Date().toISOString().split("T")[0];
      const q = leagueId ? { league_id: leagueId } : {};
      const [f, g, t, fr] = await Promise.all([
        base44.entities.Forfeit.filter(q, "-created_date"),
        base44.entities.Game.filter({ ...q, status: "scheduled" }),
        base44.entities.Team.filter(q),
        base44.entities.ForfeitResponse.filter(q),
      ]);
      setForfeits(f);
      setGames(g.filter(game => game.date >= today));
      setTeams(t);
      setForfeitResponses(fr);
      setLoading(false);
    };
    load();
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "referee_coordinator";
  const myTeams = teams.filter(t => t.manager_email === user?.email);
  const myGames = isAdmin ? games : games.filter(g =>
    myTeams.some(t => t.id === g.home_team_id || t.id === g.away_team_id)
  );

  const submit = async () => {
    if (!form.team_id || !form.game_id || !form.reason) { alert("Please select your team, a game, and provide a reason."); return; }
    setSending(true);
    const game = games.find(g => g.id === form.game_id);
    if (!game) { setSending(false); return; }

    const forfeitingTeam = teams.find(t => t.id === form.team_id)
      || myTeams.find(t => t.id === game.home_team_id || t.id === game.away_team_id);
    const opposingTeamId = game.home_team_id === forfeitingTeam?.id ? game.away_team_id : game.home_team_id;
    const opposingTeam = teams.find(t => t.id === opposingTeamId);

    const gameDate = new Date(game.date + "T" + (game.start_time || "12:00") + ":00");
    const hoursUntil = (gameDate - new Date()) / (1000 * 60 * 60);
    const earlyEnough = hoursUntil > 48;

    // Create forfeit
    const forfeit = await base44.entities.Forfeit.create({
      league_id: leagueId || "",
      game_id: form.game_id,
      game_date: game.date,
      game_time: game.start_time,
      arena_name: game.arena_name,
      forfeiting_team_id: forfeitingTeam?.id,
      forfeiting_team_name: forfeitingTeam?.name,
      opposing_team_id: opposingTeamId,
      opposing_team_name: opposingTeam?.name || (game.home_team_id === forfeitingTeam?.id ? game.away_team_name : game.home_team_name),
      division_id: game.division_id,
      division_name: game.division_name,
      submitted_by: user?.full_name,
      submitted_by_email: user?.email,
      reason: form.reason,
      hours_until_game: Math.round(hoursUntil),
      is_early_enough_for_replacement: earlyEnough,
      status: earlyEnough ? "notified" : "confirmed_forfeit",
      season: "2025-2026",
    });

    // Update game status — forfeiting team loses 1 game played; opponent gets a win
    await base44.entities.Game.update(form.game_id, {
      status: earlyEnough ? "replacement_needed" : "forfeited"
    });

    // Update team stats: forfeiting team loses game played, opponent gets win
    if (forfeitingTeam) {
      const currentLost = forfeitingTeam.total_games || 0;
      await base44.entities.Team.update(forfeitingTeam.id, { total_games: Math.max(0, currentLost - 1) });
    }

    // Notify division teams if early enough
    if (earlyEnough) {
      const divisionTeams = teams.filter(t => t.division_id === game.division_id && t.id !== forfeitingTeam?.id && t.id !== opposingTeamId);
      for (const team of divisionTeams) {
        await base44.entities.ForfeitResponse.create({
          league_id: leagueId || "",
          forfeit_id: forfeit.id,
          team_id: team.id,
          team_name: team.name,
          manager_email: team.manager_email,
          response: "pending",
        });
        if (team.manager_email) {
          await base44.integrations.Core.SendEmail({
            to: team.manager_email,
            subject: `Game Slot Available – ${game.division_name} – ${game.date} ${game.start_time}`,
            body: `Hello ${team.manager_name || team.name},\n\nA game slot has opened up:\n\nDate: ${game.date}\nTime: ${game.start_time}\nArena: ${game.arena_name}\nOpponent: ${forfeitingTeam?.id === game.home_team_id ? game.away_team_name : game.home_team_name}\n\nLog in to HockeyOps to accept this slot. First team to accept wins the slot.\n\nHockeyOps`
          }).catch(() => {});
        }
      }
    }

    setShowForm(false);
    setForm({ team_id: "", game_id: "", reason: "" });
    await reload();
    setSending(false);
  };

  const notifyAdmin = async (subject, body) => {
    const admins = await base44.entities.User.list().catch(() => []);
    const adminEmails = admins.filter(u => u.role === "admin").map(u => u.email).filter(Boolean);
    await Promise.all(adminEmails.map(email =>
      base44.integrations.Core.SendEmail({ to: email, subject, body }).catch(() => {})
    ));
  };

  const respondToForfeit = async (responseId, response) => {
    await base44.entities.ForfeitResponse.update(responseId, { response, responded_at: new Date().toISOString() });

    const resp = forfeitResponses.find(r => r.id === responseId);
    if (!resp) { await reload(); return; }

    const forfeit = forfeits.find(f => f.id === resp.forfeit_id);

    if (response === "accepted") {
      await base44.entities.Forfeit.update(resp.forfeit_id, {
        status: "replacement_found",
        replacement_team_id: resp.team_id,
        replacement_team_name: resp.team_name
      });
      // Mark all other pending responses as declined
      const others = forfeitResponses.filter(r => r.forfeit_id === resp.forfeit_id && r.id !== responseId && r.response === "pending");
      for (const o of others) await base44.entities.ForfeitResponse.update(o.id, { response: "declined" });

      // Update the game: swap in the replacement team, mark as scheduled again
      if (forfeit?.game_id) {
        const isHome = forfeit.forfeiting_team_id === forfeit.opposing_team_id; // replacement takes the forfeiting team's spot
        const updateFields = forfeit.forfeiting_team_id
          ? {
              status: "scheduled",
              notes: `Replacement: ${forfeit.forfeiting_team_name} forfeited — replaced by ${resp.team_name}`,
              // Replace the forfeiting team's slot (check if they were home or away)
              home_team_id: undefined,
              away_team_id: undefined,
            }
          : {};
        // Determine which side the forfeiting team was on by fetching the game
        const allGames = games.length > 0 ? games : [];
        const theGame = allGames.find(g => g.id === forfeit.game_id);
        if (theGame) {
          const forfeitingWasHome = theGame.home_team_id === forfeit.forfeiting_team_id;
          await base44.entities.Game.update(forfeit.game_id, {
            status: "scheduled",
            ...(forfeitingWasHome
              ? { home_team_id: resp.team_id, home_team_name: resp.team_name }
              : { away_team_id: resp.team_id, away_team_name: resp.team_name }),
            notes: `Replacement: ${forfeit.forfeiting_team_name} forfeited — replaced by ${resp.team_name}`,
          });
        } else {
          // Fallback: just mark scheduled with a note
          await base44.entities.Game.update(forfeit.game_id, {
            status: "scheduled",
            notes: `Replacement: ${forfeit.forfeiting_team_name} forfeited — replaced by ${resp.team_name}`,
          });
        }
      }

      // Notify admin
      await notifyAdmin(
        `Replacement Found – ${forfeit?.division_name} – ${forfeit?.game_date} ${forfeit?.game_time}`,
        `A replacement team has been found for a forfeited slot.\n\nGame: ${forfeit?.game_date} ${forfeit?.game_time} at ${forfeit?.arena_name}\nDivision: ${forfeit?.division_name}\nOriginal Forfeit: ${forfeit?.forfeiting_team_name}\nReplacement Team: ${resp.team_name}\n\nThe schedule has been updated automatically. Log in to HockeyOps to review.\n\nHockeyOps`
      );
    } else {
      // Check if ALL responses are now non-pending after this decline
      const allResponses = forfeitResponses.filter(r => r.forfeit_id === resp.forfeit_id);
      const remainingPending = allResponses.filter(r => r.id !== responseId && r.response === "pending");
      if (remainingPending.length === 0) {
        await base44.entities.Forfeit.update(resp.forfeit_id, { status: "no_replacement" });
        // Notify admin that no team stepped up
        await notifyAdmin(
          `No Replacement Found – ${forfeit?.division_name} – ${forfeit?.game_date} ${forfeit?.game_time}`,
          `All teams have declined the replacement slot. No replacement was found.\n\nGame: ${forfeit?.game_date} ${forfeit?.game_time} at ${forfeit?.arena_name}\nDivision: ${forfeit?.division_name}\nForfeiting Team: ${forfeit?.forfeiting_team_name}\n\nA makeup game may need to be scheduled manually.\n\nLog in to HockeyOps to review.\n\nHockeyOps`
        );
      }
    }

    await reload();
  };

  const deleteForfeit = async (forfeit) => {
    if (!confirm(`Delete forfeit request from ${forfeit.submitted_by}?`)) return;
    if (forfeit.game_id) {
      await base44.entities.Game.update(forfeit.game_id, { status: "scheduled" }).catch(() => {});
    }
    const responses = forfeitResponses.filter(r => r.forfeit_id === forfeit.id);
    for (const r of responses) {
      await base44.entities.ForfeitResponse.delete(r.id).catch(() => {});
    }
    if (forfeit.submitted_by_email) {
      await base44.integrations.Core.SendEmail({
        to: forfeit.submitted_by_email,
        subject: `Forfeit Request Cancelled – ${forfeit.division_name} – ${forfeit.game_date}`,
        body: `Hello ${forfeit.submitted_by},\n\nYour forfeit request for the game on ${forfeit.game_date} at ${forfeit.game_time} (${forfeit.arena_name}) has been cancelled by the league administrator.\n\nThe game has been restored to scheduled status. If you still need to forfeit, please submit a new request.\n\nHockeyOps`,
      }).catch(() => {});
    }
    await base44.entities.Forfeit.delete(forfeit.id);
    await reload();
  };

  const saveEditForfeit = async () => {
    await base44.entities.Forfeit.update(editingForfeit, editForfeitForm);
    setEditingForfeit(null);
    await reload();
  };

  const myPendingResponses = forfeitResponses.filter(r =>
    r.response === "pending" && myTeams.some(t => t.id === r.team_id)
  );

  const filteredForfeits = forfeits.filter(f => filterStatus === "all" || f.status === filterStatus);

  // Stats
  const confirmed = forfeits.filter(f => f.status === "confirmed_forfeit").length;
  const replacements = forfeits.filter(f => f.status === "replacement_found").length;
  const pending = forfeits.filter(f => f.status === "notified" || f.status === "submitted").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Forfeit Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track forfeits, replacements, and game adjustments</p>
        </div>
        {(isAdmin || myTeams.length > 0) && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Report Forfeit
          </button>
        )}
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Forfeits", value: forfeits.length, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Confirmed Forfeits", value: confirmed, color: "text-orange-400", bg: "bg-orange-500/10" },
          { label: "Replacements Found", value: replacements, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Seeking Replacement", value: pending, color: "text-yellow-400", bg: "bg-yellow-500/10" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-800 text-center`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div className="bg-[#1e2533] border border-gray-700 rounded-xl p-4 mb-5 text-sm text-gray-300">
        <div className="flex items-start gap-2">
          <Trophy className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-white">Forfeit Rules: </span>
            A forfeit deducts 1 game played from the forfeiting team's record. The opponent receives a win. A makeup game will be scheduled to keep total games equal for the season.
            If reported 48+ hours in advance, other teams are notified to claim the slot.
          </div>
        </div>
      </div>

      {/* Pending slot offers for my team */}
      {myPendingResponses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" /> Available Slots For Your Team
          </h2>
          {myPendingResponses.map(resp => {
            const forfeit = forfeits.find(f => f.id === resp.forfeit_id);
            return (
              <div key={resp.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-3">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-semibold text-white">{forfeit?.game_date} · {forfeit?.game_time}</div>
                    <div className="text-sm text-gray-300 mt-1">Arena: {forfeit?.arena_name} · Division: {forfeit?.division_name}</div>
                    <div className="text-sm text-gray-400">Opponent: {forfeit?.opposing_team_name}</div>
                    <div className="text-xs text-gray-500 mt-1">{forfeit?.forfeiting_team_name} forfeited this slot</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondToForfeit(resp.id, "accepted")} className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => respondToForfeit(resp.id, "declined")} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="notified">Notified (seeking replacement)</option>
          <option value="replacement_found">Replacement Found</option>
          <option value="confirmed_forfeit">Confirmed Forfeit</option>
          <option value="no_replacement">No Replacement Found</option>
        </select>
      </div>

      {/* Forfeit list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filteredForfeits.map(forfeit => {
            const responses = forfeitResponses.filter(r => r.forfeit_id === forfeit.id);
            return (
              <div key={forfeit.id} className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="font-semibold text-white">{forfeit.forfeiting_team_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[forfeit.status]}`}>
                        {forfeit.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">{forfeit.game_date} · {forfeit.game_time} · {forfeit.arena_name}</div>
                    <div className="text-sm text-gray-400">vs {forfeit.opposing_team_name} · {forfeit.division_name}</div>
                    <div className="text-sm text-gray-400 mt-1 italic">"{forfeit.reason}"</div>
                    <div className="text-xs text-gray-500 mt-1">{forfeit.hours_until_game}h notice · by {forfeit.submitted_by}</div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    {forfeit.is_early_enough_for_replacement && (
                      <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                        <Mail className="w-3 h-3" /> Replacement Sought
                      </span>
                    )}
                    {forfeit.replacement_team_name && (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        <CheckCircle className="w-3 h-3" /> {forfeit.replacement_team_name}
                      </span>
                    )}
                    {forfeit.status === "confirmed_forfeit" && (
                      <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                        <RefreshCw className="w-3 h-3" /> Makeup needed
                      </span>
                    )}
                  </div>
                </div>
                {responses.length > 0 && (
                  <div className="border-t border-gray-700 pt-2">
                    <div className="text-xs text-gray-500 mb-1.5">Team Responses ({responses.filter(r => r.response !== "pending").length}/{responses.length}):</div>
                    <div className="flex flex-wrap gap-1.5">
                      {responses.map(r => (
                        <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full ${r.response === "accepted" ? "bg-green-500/10 text-green-400" : r.response === "declined" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                          {r.team_name}: {r.response}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {isAdmin && (
                  <div className="border-t border-gray-800 pt-2 mt-2 flex gap-2 justify-end">
                    <button onClick={() => { setEditingForfeit(forfeit.id); setEditForfeitForm({ status: forfeit.status, reason: forfeit.reason }); }}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => deleteForfeit(forfeit)}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-red-700/40 text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {filteredForfeits.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No forfeits reported.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Forfeit Modal */}
      {editingForfeit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Edit Forfeit</h2>
              <button onClick={() => setEditingForfeit(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Status</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={editForfeitForm.status} onChange={e => setEditForfeitForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="submitted">Submitted</option>
                  <option value="notified">Notified (seeking replacement)</option>
                  <option value="replacement_found">Replacement Found</option>
                  <option value="no_replacement">No Replacement Found</option>
                  <option value="confirmed_forfeit">Confirmed Forfeit</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Reason</label>
                <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm h-24 resize-none focus:outline-none"
                  value={editForfeitForm.reason} onChange={e => setEditForfeitForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingForfeit(null)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={saveEditForfeit} className="flex-1 py-2 rounded-lg text-black text-sm font-medium" style={{ background: "#d4af37" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Forfeit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Report Forfeit</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 text-xs text-yellow-300">
              ⚠️ Forfeiting removes 1 game from your team's total played. The opponent receives a win. A makeup game will be scheduled to restore your total games.
              <br />If 48+ hours before game time, other teams will be notified to claim the slot.
            </div>
            <div className="space-y-4">
              {/* Step 1: Select team */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Step 1: Select Your Team *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value, game_id: "" }))}>
                  <option value="">Choose your team...</option>
                  {(isAdmin ? teams : myTeams).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.division_name})</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select game (filtered by team) */}
              {form.team_id && (() => {
                const teamGames = games.filter(g => g.home_team_id === form.team_id || g.away_team_id === form.team_id);
                return (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Step 2: Select Game to Forfeit *</label>
                    <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                      value={form.game_id} onChange={e => setForm(f => ({ ...f, game_id: e.target.value }))}>
                      <option value="">Choose a game...</option>
                      {teamGames.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.date} {g.start_time} – {g.home_team_name} vs {g.away_team_name} ({g.division_name})
                        </option>
                      ))}
                    </select>
                    {teamGames.length === 0 && <p className="text-xs text-gray-500 mt-1">No upcoming scheduled games found for this team.</p>}
                  </div>
                );
              })()}

              {form.game_id && (() => {
                const game = games.find(g => g.id === form.game_id);
                const hoursUntil = game ? (new Date(game.date + "T" + (game.start_time || "12:00") + ":00") - new Date()) / (1000 * 60 * 60) : 0;
                return (
                  <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${hoursUntil > 48 ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    {hoursUntil > 48
                      ? `${Math.round(hoursUntil)}h until game — replacement will be sought`
                      : `Only ${Math.round(Math.max(0, hoursUntil))}h until game — forfeit confirmed, no replacement`}
                  </div>
                );
              })()}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Reason *</label>
                <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-24 resize-none"
                  value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Explain why you are unable to play this game..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={submit} disabled={sending}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
                {sending ? "Submitting..." : "Submit Forfeit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}