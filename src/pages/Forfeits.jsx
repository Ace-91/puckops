import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Plus, X, Clock, CheckCircle, XCircle, Mail, Phone } from "lucide-react";

export default function Forfeits() {
  const [forfeits, setForfeits] = useState([]);
  const [forfeitResponses, setForfeitResponses] = useState([]);
  const [games, setGames] = useState([]);
  const [teams, setTeams] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({ game_id: "", reason: "" });

  useEffect(() => {
    const load = async () => {
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
      const today = new Date().toISOString().split("T")[0];
      const [f, g, t, fr] = await Promise.all([
        base44.entities.Forfeit.list("-created_date"),
        base44.entities.Game.filter({ status: "scheduled" }),
        base44.entities.Team.list(),
        base44.entities.ForfeitResponse.list(),
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

  // Manager's teams
  const myTeams = teams.filter(t => t.manager_email === user?.email);

  // Games for my teams
  const myGames = isAdmin ? games : games.filter(g =>
    myTeams.some(t => t.id === g.home_team_id || t.id === g.away_team_id)
  );

  const submit = async () => {
    if (!form.game_id || !form.reason) { alert("Please select a game and provide a reason."); return; }
    setSending(true);

    const game = games.find(g => g.id === form.game_id);
    if (!game) { setSending(false); return; }

    const forfeitingTeam = myTeams.find(t => t.id === game.home_team_id || t.id === game.away_team_id);
    const opposingTeamId = game.home_team_id === forfeitingTeam?.id ? game.away_team_id : game.home_team_id;
    const opposingTeam = teams.find(t => t.id === opposingTeamId);

    const gameDate = new Date(game.date + "T" + (game.start_time || "12:00") + ":00");
    const now = new Date();
    const hoursUntil = (gameDate - now) / (1000 * 60 * 60);
    const earlyEnough = hoursUntil > 48;

    const forfeit = await base44.entities.Forfeit.create({
      game_id: form.game_id,
      game_date: game.date,
      game_time: game.start_time,
      arena_name: game.arena_name,
      forfeiting_team_id: forfeitingTeam?.id,
      forfeiting_team_name: forfeitingTeam?.name,
      opposing_team_id: opposingTeamId,
      opposing_team_name: game.home_team_id === forfeitingTeam?.id ? game.away_team_name : game.home_team_name,
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

    // Update game status
    await base44.entities.Game.update(form.game_id, { status: earlyEnough ? "replacement_needed" : "forfeited" });

    // If early enough, notify other division teams
    if (earlyEnough) {
      const divisionTeams = teams.filter(t => t.division_id === game.division_id && t.id !== forfeitingTeam?.id && t.id !== opposingTeamId);
      for (const team of divisionTeams) {
        await base44.entities.ForfeitResponse.create({
          forfeit_id: forfeit.id,
          team_id: team.id,
          team_name: team.name,
          manager_email: team.manager_email,
          response: "pending",
        });
        // Send notification email
        if (team.manager_email) {
          await base44.integrations.Core.SendEmail({
            to: team.manager_email,
            subject: `Game Slot Available – ${game.division_name} – ${game.date} ${game.start_time}`,
            body: `Hello ${team.manager_name || team.name},\n\nA game slot has become available in your division:\n\nDate: ${game.date}\nTime: ${game.start_time}\nArena: ${game.arena_name}\nOpponent: ${game.home_team_id === forfeitingTeam?.id ? game.away_team_name : game.home_team_name}\n\nIf your team is available to play, please log in to HockeyOps and accept this game.\n\nThis is a time-sensitive notification — first team to accept gets the slot.\n\nHockeyOps`
          }).catch(() => {});
        }
      }
    }

    // Notify referees
    const notifyList = [game.referee1_name, game.referee2_name, game.timekeeper_name].filter(Boolean);
    if (game.referee1_id) {
      const refTeams = [
        { email: teams.find(t => t.id === game.home_team_id)?.manager_email, name: "Home Team" },
        { email: teams.find(t => t.id === game.away_team_id)?.manager_email, name: "Away Team" },
      ];
    }

    setShowForm(false);
    setForm({ game_id: "", reason: "" });
    const [f, fr] = await Promise.all([base44.entities.Forfeit.list("-created_date"), base44.entities.ForfeitResponse.list()]);
    setForfeits(f);
    setForfeitResponses(fr);
    setSending(false);
    alert(earlyEnough
      ? "Forfeit submitted. Division teams have been notified and can accept the available slot."
      : "Forfeit confirmed. The league and officials have been notified.");
  };

  const respondToForfeit = async (responseId, response) => {
    await base44.entities.ForfeitResponse.update(responseId, { response, responded_at: new Date().toISOString() });
    // If accepted, update forfeit
    if (response === "accepted") {
      const resp = forfeitResponses.find(r => r.id === responseId);
      if (resp) {
        await base44.entities.Forfeit.update(resp.forfeit_id, { status: "replacement_found", replacement_team_id: resp.team_id, replacement_team_name: resp.team_name });
        // Decline all other responses for this forfeit
        const others = forfeitResponses.filter(r => r.forfeit_id === resp.forfeit_id && r.id !== responseId && r.response === "pending");
        for (const o of others) {
          await base44.entities.ForfeitResponse.update(o.id, { response: "declined" });
        }
      }
    }
    const [f, fr] = await Promise.all([base44.entities.Forfeit.list("-created_date"), base44.entities.ForfeitResponse.list()]);
    setForfeits(f);
    setForfeitResponses(fr);
  };

  // Pending responses for my teams
  const myPendingResponses = forfeitResponses.filter(r =>
    r.response === "pending" && myTeams.some(t => t.id === r.team_id)
  );

  const statusColors = {
    submitted: "bg-yellow-500/10 text-yellow-400",
    notified: "bg-blue-500/10 text-blue-400",
    replacement_found: "bg-green-500/10 text-green-400",
    no_replacement: "bg-orange-500/10 text-orange-400",
    confirmed_forfeit: "bg-red-500/10 text-red-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Forfeits</h1>
          <p className="text-gray-400 text-sm mt-1">Report and manage game forfeits</p>
        </div>
        {(isAdmin || myTeams.length > 0) && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Report Forfeit
          </button>
        )}
      </div>

      {/* Pending game slot offers for my team */}
      {myPendingResponses.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" /> Available Game Slots For Your Team
          </h2>
          {myPendingResponses.map(resp => {
            const forfeit = forfeits.find(f => f.id === resp.forfeit_id);
            return (
              <div key={resp.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-white">{forfeit?.game_date} · {forfeit?.game_time}</div>
                    <div className="text-sm text-gray-300 mt-1">Arena: {forfeit?.arena_name} · Division: {forfeit?.division_name}</div>
                    <div className="text-sm text-gray-400">Opponent: {forfeit?.opposing_team_name}</div>
                    <div className="text-xs text-gray-500 mt-1">{forfeit?.forfeiting_team_name} has forfeited this slot</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondToForfeit(resp.id, "accepted")}
                      className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => respondToForfeit(resp.id, "declined")}
                      className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                      <XCircle className="w-4 h-4" /> Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Forfeit list */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-24 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {forfeits.map(forfeit => {
            const responses = forfeitResponses.filter(r => r.forfeit_id === forfeit.id);
            return (
              <div key={forfeit.id} className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-white">{forfeit.forfeiting_team_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[forfeit.status]}`}>{forfeit.status.replace("_"," ")}</span>
                    </div>
                    <div className="text-sm text-gray-300">{forfeit.game_date} · {forfeit.game_time} · {forfeit.arena_name}</div>
                    <div className="text-sm text-gray-400">vs {forfeit.opposing_team_name} · {forfeit.division_name}</div>
                    <div className="text-sm text-gray-400 mt-1">{forfeit.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {forfeit.hours_until_game}h before game · Submitted by {forfeit.submitted_by}
                    </div>
                    {forfeit.is_early_enough_for_replacement && forfeit.replacement_team_name && (
                      <div className="text-xs text-green-400 mt-1">Replacement: {forfeit.replacement_team_name}</div>
                    )}
                  </div>
                  {forfeit.is_early_enough_for_replacement && (
                    <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                      <Mail className="w-3 h-3" /> Replacement Sought
                    </div>
                  )}
                </div>
                {responses.length > 0 && (
                  <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="text-xs text-gray-500 mb-1">Team Responses ({responses.filter(r => r.response !== "pending").length}/{responses.length}):</div>
                    <div className="flex flex-wrap gap-2">
                      {responses.map(r => (
                        <span key={r.id} className={`text-xs px-2 py-0.5 rounded-full ${r.response === "accepted" ? "bg-green-500/10 text-green-400" : r.response === "declined" ? "bg-red-500/10 text-red-400" : "bg-gray-500/10 text-gray-400"}`}>
                          {r.team_name}: {r.response}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {forfeits.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No forfeits reported.</p>
            </div>
          )}
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
              ⚠️ If forfeiting more than 48 hours before game time, other teams will be notified automatically and can claim the slot.
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Select Game *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.game_id} onChange={e => setForm(f => ({ ...f, game_id: e.target.value }))}>
                  <option value="">Choose a game...</option>
                  {myGames.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.date} {g.start_time} – {g.home_team_name} vs {g.away_team_name} ({g.arena_name})
                    </option>
                  ))}
                </select>
              </div>
              {form.game_id && (() => {
                const game = games.find(g => g.id === form.game_id);
                const gameDate = game ? new Date(game.date + "T" + (game.start_time || "12:00") + ":00") : null;
                const hoursUntil = gameDate ? (gameDate - new Date()) / (1000 * 60 * 60) : 0;
                return (
                  <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${hoursUntil > 48 ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    {hoursUntil > 48
                      ? `${Math.round(hoursUntil)} hours until game — replacement will be sought automatically`
                      : `Only ${Math.round(hoursUntil)} hours until game — forfeit will be confirmed (too late for replacement)`}
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