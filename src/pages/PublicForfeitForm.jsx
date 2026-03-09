import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle, Clock, AlertCircle } from "lucide-react";

export default function PublicForfeitForm() {
  const [teams, setTeams] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [reason, setReason] = useState("");
  const [contactVerified, setContactVerified] = useState(null); // null | true | false

  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [t, g] = await Promise.all([
        base44.entities.Team.filter({ is_active: true }),
        base44.entities.Game.filter({ status: "scheduled" }, "date", 1000),
      ]);
      setTeams(t);
      setGames(g.filter(g => g.date >= today));
      setLoading(false);
    };
    load();
  }, []);

  // Games for selected team (home or away), sorted by date
  const teamGames = selectedTeam
    ? games.filter(g => g.home_team_id === selectedTeam.id || g.away_team_id === selectedTeam.id)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    : [];

  const handleTeamChange = (teamId) => {
    const team = teams.find(t => t.id === teamId) || null;
    setSelectedTeam(team);
    setSelectedGame(null);
    setContactVerified(null);
    // Pre-fill contact with manager info if available
    if (team) {
      setContact({
        name: team.manager_name || "",
        email: team.manager_email || "",
        phone: team.manager_phone || "",
      });
    }
  };

  const handleGameChange = (gameId) => {
    setSelectedGame(games.find(g => g.id === gameId) || null);
  };

  // Verify contact info matches team admin
  const verifyContact = () => {
    if (!selectedTeam) return;
    const emailMatch = !selectedTeam.manager_email || contact.email.toLowerCase() === selectedTeam.manager_email.toLowerCase();
    setContactVerified(emailMatch);
  };

  const hoursUntil = selectedGame
    ? (new Date(`${selectedGame.date}T${selectedGame.start_time || "00:00"}`) - new Date()) / (1000 * 60 * 60)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeam) { setError("Please select your team."); return; }
    if (!selectedGame) { setError("Please select the game you are forfeiting."); return; }
    if (!contact.name || !contact.email || !contact.phone) { setError("Name, email, and cell phone are all required."); return; }
    if (!reason.trim()) { setError("Reason for forfeit is required."); return; }

    setSubmitting(true);
    setError("");

    const opponent = selectedGame.home_team_id === selectedTeam.id
      ? { id: selectedGame.away_team_id, name: selectedGame.away_team_name }
      : { id: selectedGame.home_team_id, name: selectedGame.home_team_name };

    await base44.entities.Forfeit.create({
      game_id: selectedGame.id,
      game_date: selectedGame.date,
      game_time: selectedGame.start_time,
      arena_name: selectedGame.arena_name,
      forfeiting_team_id: selectedTeam.id,
      forfeiting_team_name: selectedTeam.name,
      opposing_team_id: opponent.id,
      opposing_team_name: opponent.name,
      division_id: selectedGame.division_id,
      division_name: selectedGame.division_name,
      submitted_by: contact.name,
      submitted_by_email: contact.email,
      reason: reason,
      hours_until_game: hoursUntil ? Math.round(hoursUntil) : 0,
      is_early_enough_for_replacement: hoursUntil ? hoursUntil > 48 : false,
      status: "submitted",
      season: selectedGame.season || "2025-2026",
    });

    // Update game status
    await base44.entities.Game.update(selectedGame.id, {
      status: hoursUntil && hoursUntil > 48 ? "replacement_needed" : "forfeited",
    });

    setSubmitted(true);
    setSubmitting(false);
  };

  const reset = () => {
    setSubmitted(false);
    setSelectedTeam(null);
    setSelectedGame(null);
    setContact({ name: "", email: "", phone: "" });
    setReason("");
    setContactVerified(null);
    setError("");
  };

  const inputCls = "w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-[#1e2533] rounded-2xl border border-green-500/30 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Forfeit Submitted</h2>
          <p className="text-gray-400 mb-4">Your forfeit has been received. The league office will be notified
            {hoursUntil && hoursUntil > 48 ? " and division teams will be contacted for a replacement." : "."}
          </p>
          <button onClick={reset} className="text-sky-400 hover:text-sky-300 text-sm underline">Submit another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Report a Forfeit</h1>
          <p className="text-gray-400 mt-1 text-sm">Reports received 48+ hours before game time allow for replacement team notification.</p>
        </div>

        <div className="bg-[#1e2533] rounded-2xl border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Team selection */}
            <div>
              <div className="text-sm font-semibold text-white mb-3">Your Team</div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Team Name *</label>
                <select className={inputCls} value={selectedTeam?.id || ""} onChange={e => handleTeamChange(e.target.value)}>
                  <option value="">Select your team...</option>
                  {teams.sort((a, b) => (a.division_name || "").localeCompare(b.division_name || "") || a.name.localeCompare(b.name)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} {t.division_name ? `(${t.division_name})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Game selection */}
            {selectedTeam && (
              <div>
                <label className="text-xs text-gray-400 block mb-1">Select Game to Forfeit *</label>
                {teamGames.length === 0 ? (
                  <div className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">No upcoming scheduled games found for this team.</div>
                ) : (
                  <select className={inputCls} value={selectedGame?.id || ""} onChange={e => handleGameChange(e.target.value)}>
                    <option value="">Select a game...</option>
                    {teamGames.map(g => {
                      const isHome = g.home_team_id === selectedTeam.id;
                      const opponent = isHome ? g.away_team_name : g.home_team_name;
                      return (
                        <option key={g.id} value={g.id}>
                          {g.date} {g.start_time} — vs {opponent} @ {g.arena_name}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* Game details (auto-filled) */}
            {selectedGame && (
              <div className="rounded-lg border border-gray-700 p-3 bg-gray-900/40 space-y-1 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Division: </span><span className="text-white">{selectedGame.division_name}</span></div>
                  <div><span className="text-gray-500">Date: </span><span className="text-white">{selectedGame.date}</span></div>
                  <div><span className="text-gray-500">Time: </span><span className="text-white">{selectedGame.start_time}</span></div>
                  <div><span className="text-gray-500">Arena: </span><span className="text-white">{selectedGame.arena_name}</span></div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Opponent: </span>
                    <span className="text-white">
                      {selectedGame.home_team_id === selectedTeam?.id ? selectedGame.away_team_name : selectedGame.home_team_name}
                    </span>
                  </div>
                </div>
                {hoursUntil !== null && (
                  <div className={`flex items-center gap-2 rounded-lg p-2 text-xs mt-2 border ${hoursUntil > 48 ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    {hoursUntil > 48
                      ? `${Math.round(hoursUntil)} hours away — replacement notice will be sent to division teams`
                      : `Only ${Math.round(Math.max(0, hoursUntil))} hours until game — forfeit confirmed without replacement`}
                  </div>
                )}
              </div>
            )}

            {/* Contact */}
            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm font-semibold text-white mb-3">Contact Information <span className="text-xs font-normal text-gray-500">(must match team admin on file)</span></div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Full Name *</label>
                  <input className={inputCls} value={contact.name} onChange={e => { setContact(c => ({ ...c, name: e.target.value })); setContactVerified(null); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email *</label>
                    <input type="email" className={inputCls} value={contact.email} onChange={e => { setContact(c => ({ ...c, email: e.target.value })); setContactVerified(null); }} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cell Phone *</label>
                    <input type="tel" className={inputCls} value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="(555) 000-0000" />
                  </div>
                </div>
                {selectedTeam?.manager_email && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={verifyContact}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 transition-colors">
                      Verify Contact Info
                    </button>
                    {contactVerified === true && <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>}
                    {contactVerified === false && <span className="text-red-400 text-xs flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Email doesn't match team admin on file</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reason for Forfeit *</label>
              <textarea className={`${inputCls} h-24 resize-none`} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Please explain why your team is unable to play this game..." />
            </div>

            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors">
              {submitting ? "Submitting..." : "Submit Forfeit Notice"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">This form is submitted directly to the league management system. You will be contacted if further information is needed.</p>
      </div>
    </div>
  );
}