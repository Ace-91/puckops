import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Users, Shield, AlertTriangle, Clock, TrendingUp, ChevronRight, Settings, Globe, Trash2, Plus, X, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({ teams: 0, games: 0, officials: 0, forfeits: 0, pendingBlackouts: 0 });
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [recentForfeits, setRecentForfeits] = useState([]);
  const [leagueBlackouts, setLeagueBlackouts] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showParamsPanel, setShowParamsPanel] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // season id
  const [seasonForm, setSeasonForm] = useState({
    name: "2025-2026", season_start: "", season_end: "", playoff_start: "",
    games_per_team: 30, schedule_release_weeks: 4, allow_team_realignment: true,
    status: "planning", notes: ""
  });
  const [savingParam, setSavingParam] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const reload = async () => {
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    const [teams, games, officials, forfeits, blackouts, seasons] = await Promise.all([
      base44.entities.Team.list(),
      base44.entities.Game.list("date", 500),
      base44.entities.Official.list(),
      base44.entities.Forfeit.list("-created_date"),
      base44.entities.BlackoutDate.list("-created_date"),
      base44.entities.LeagueSeason.list("-created_date"),
    ]);
    setStats({
      teams: teams.length,
      games: games.length,
      officials: officials.length,
      forfeits: forfeits.length,
      pendingBlackouts: blackouts.filter(b => b.status === "pending").length,
    });
    const today = new Date().toISOString().split("T")[0];
    setUpcomingGames(games.filter(g => g.date >= today && g.status === "scheduled").slice(0, 6));
    setRecentForfeits(forfeits.slice(0, 5));
    setLeagueBlackouts(blackouts.filter(b => b.team_id === "league" && b.status === "approved"));
    setSeasons(seasons);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const isAdmin = user?.role === "admin";

  const saveSeason = async () => {
    setSavingParam(true);
    await base44.entities.LeagueSeason.create(seasonForm);
    setShowSeasonForm(false);
    setSeasonForm({ name: "2025-2026", season_start: "", season_end: "", playoff_start: "", games_per_team: 30, schedule_release_weeks: 4, allow_team_realignment: true, status: "planning", notes: "" });
    await reload();
    setSavingParam(false);
  };

  const deleteSeason = async (seasonId) => {
    setDeletingId(seasonId);
    // Delete all games for this season
    const s = seasons.find(s => s.id === seasonId);
    if (s) {
      const seasonGames = await base44.entities.Game.filter({ season: s.name });
      for (const g of seasonGames) await base44.entities.Game.delete(g.id);
    }
    await base44.entities.LeagueSeason.delete(seasonId);
    setDeleteConfirm(null);
    setDeletingId(null);
    await reload();
  };

  const statusBadge = {
    planning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  };

  const cards = [
    { label: "Teams", value: stats.teams, icon: Users, color: "text-sky-400", bg: "bg-sky-500/10", page: "TeamsAndDivisions" },
    { label: "Games Scheduled", value: stats.games, icon: Calendar, color: "text-green-400", bg: "bg-green-500/10", page: "Schedule" },
    { label: "Officials", value: stats.officials, icon: Shield, color: "text-purple-400", bg: "bg-purple-500/10", page: "Officials" },
    { label: "Forfeits", value: stats.forfeits, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", page: "Forfeits" },
    { label: "Pending Blackouts", value: stats.pendingBlackouts, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", page: "BlackoutDates" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="text-gray-400 mt-1">HockeyOps League Management</p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-28 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map(card => (
            <Link key={card.label} to={createPageUrl(card.page)}
              className="bg-[#1e2533] rounded-xl p-5 border border-gray-800 hover:border-sky-500/40 transition-colors">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="text-sm text-gray-400 mt-0.5">{card.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Games */}
        <div className="lg:col-span-2 bg-[#1e2533] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" /> Upcoming Games
            </h2>
            <Link to={createPageUrl("Schedule")} className="text-sky-400 text-xs hover:text-sky-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {upcomingGames.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming games scheduled.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {upcomingGames.map(game => (
                <div key={game.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-medium text-white">{game.home_team_name} vs {game.away_team_name}</div>
                    <div className="text-xs text-gray-400">{game.division_name} · {game.arena_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-sky-400">{game.date}</div>
                    <div className="text-xs text-gray-400">{game.start_time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-sky-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Submit Blackout", page: "BlackoutDates", color: "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20" },
              { label: "View Schedule", page: "Schedule", color: "bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/20" },
              { label: "Report Forfeit", page: "Forfeits", color: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20" },
              { label: "My Availability", page: "OfficialAvailability", color: "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20" },
              { label: "Assign Officials", page: "AssignOfficials", color: "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20" },
              { label: "Build Schedule", page: "ScheduleBuilder", color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20" },
            ].map(a => (
              <Link key={a.page} to={createPageUrl(a.page)}
                className={`flex items-center justify-center rounded-lg p-2.5 text-xs font-medium border transition-colors ${a.color}`}>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Forfeits & League Blackouts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Forfeits */}
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" /> Recent Forfeits
            </h2>
            <Link to={createPageUrl("Forfeits")} className="text-sky-400 text-xs hover:text-sky-300 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {recentForfeits.length === 0 ? (
            <p className="text-gray-500 text-sm">No forfeits reported.</p>
          ) : (
            <div className="space-y-2">
              {recentForfeits.map(f => (
                <div key={f.id} className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-white">{f.forfeiting_team_name}</div>
                    <div className="text-xs text-gray-400">{f.game_date} · {f.division_name}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${f.status === "confirmed_forfeit" ? "bg-red-500/10 text-red-400 border-red-500/20" : f.status === "replacement_found" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                    {f.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* League Blackout Dates */}
        <div className="bg-[#1e2533] rounded-xl border border-purple-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-purple-400" /> League Blackout Dates
            </h2>
            <Link to={createPageUrl("BlackoutDates")} className="text-sky-400 text-xs hover:text-sky-300 flex items-center gap-1">
              Manage <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {leagueBlackouts.length === 0 ? (
            <p className="text-gray-500 text-sm">No league blackout dates set.</p>
          ) : (
            <div className="space-y-2">
              {leagueBlackouts.map(b => (
                <div key={b.id} className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-purple-300">
                      {b.date_from}{b.date_to && b.date_to !== b.date_from ? ` → ${b.date_to}` : ""}
                    </div>
                    {b.reason && <div className="text-xs text-gray-400">{b.reason}</div>}
                  </div>
                  <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">League</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* League Parameters & Season History — Admin only */}
      {isAdmin && (
        <div className="space-y-4">
          {/* Section header */}
          <button onClick={() => setShowParamsPanel(!showParamsPanel)}
            className="w-full flex items-center justify-between bg-[#1e2533] rounded-xl border border-gray-800 px-5 py-4 hover:border-sky-500/30 transition-colors">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-sky-400" />
              <span className="font-semibold text-white">League Parameters & Season History</span>
            </div>
            {showParamsPanel ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showParamsPanel && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create New Season */}
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">New Season Parameters</h3>
                  {!showSeasonForm && (
                    <button onClick={() => setShowSeasonForm(true)} className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium">
                      <Plus className="w-3.5 h-3.5" /> New Season
                    </button>
                  )}
                </div>
                {showSeasonForm ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Season Name *</label>
                        <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.name} onChange={e => setSeasonForm(f => ({ ...f, name: e.target.value }))} placeholder="2025-2026" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Status</label>
                        <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.status} onChange={e => setSeasonForm(f => ({ ...f, status: e.target.value }))}>
                          <option value="planning">Planning</option>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Season Start</label>
                        <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.season_start} onChange={e => setSeasonForm(f => ({ ...f, season_start: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Season End</label>
                        <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.season_end} onChange={e => setSeasonForm(f => ({ ...f, season_end: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Playoff Start</label>
                      <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                        value={seasonForm.playoff_start} onChange={e => setSeasonForm(f => ({ ...f, playoff_start: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Games Per Team</label>
                        <input type="number" min={1} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.games_per_team} onChange={e => setSeasonForm(f => ({ ...f, games_per_team: parseInt(e.target.value) || 30 }))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Release Block (weeks)</label>
                        <input type="number" min={1} max={12} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500"
                          value={seasonForm.schedule_release_weeks} onChange={e => setSeasonForm(f => ({ ...f, schedule_release_weeks: parseInt(e.target.value) || 4 }))} />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={seasonForm.allow_team_realignment} className="accent-sky-500 w-4 h-4"
                        onChange={e => setSeasonForm(f => ({ ...f, allow_team_realignment: e.target.checked }))} />
                      <span className="text-sm text-gray-300">Allow team realignment between releases</span>
                    </label>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Notes</label>
                      <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-500 h-16 resize-none"
                        value={seasonForm.notes} onChange={e => setSeasonForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowSeasonForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
                      <button onClick={saveSeason} disabled={savingParam} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
                        {savingParam ? "Saving..." : "Create Season"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Click "New Season" to configure a season with dates, game counts, and release settings.</p>
                )}
              </div>

              {/* Season History */}
              <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-5">
                <h3 className="font-semibold text-white mb-4">Season History</h3>
                {seasons.length === 0 ? (
                  <p className="text-gray-500 text-sm">No seasons created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {seasons.map(s => (
                      <div key={s.id} className="bg-gray-900/50 rounded-xl p-3 border border-gray-800">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white">{s.name}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[s.status]}`}>{s.status}</span>
                            </div>
                            <div className="text-xs text-gray-400 space-y-0.5">
                              {s.season_start && <div>📅 {s.season_start} → {s.season_end || "TBD"}</div>}
                              {s.playoff_start && <div>🏆 Playoffs: {s.playoff_start}</div>}
                              <div>🎮 {s.games_per_team} games/team · 📦 {s.schedule_release_weeks}-week releases</div>
                              {s.allow_team_realignment && <div>🔄 Realignment allowed</div>}
                            </div>
                            {s.notes && <div className="text-xs text-gray-500 mt-1 italic">{s.notes}</div>}
                          </div>
                          <button
                            onClick={() => setDeleteConfirm(s.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 ml-2 shrink-0"
                            title="Delete season"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-red-500/30 p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Delete Season?</h2>
                <p className="text-sm text-gray-400">"{seasons.find(s => s.id === deleteConfirm)?.name}"</p>
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-5 text-sm text-red-300">
              ⚠️ This will permanently delete the season record <strong>and all associated games</strong>. This action cannot be undone.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-600 rounded-lg text-gray-300 text-sm">
                Cancel
              </button>
              <button
                onClick={() => deleteSeason(deleteConfirm)}
                disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium"
              >
                {deletingId ? "Deleting..." : "Yes, Delete Season"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}