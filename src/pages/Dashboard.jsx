import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import ProgressModal from "@/components/ProgressModal";
import { createPageUrl } from "@/utils";
import { Calendar, Users, Shield, AlertTriangle, Clock, TrendingUp, ChevronRight, Settings, Globe, Trash2, Plus, X, CheckCircle, ChevronDown, ChevronUp, LogIn, UserPlus, Newspaper, CheckSquare, XSquare } from "lucide-react";

const NEWS_ITEMS = [
  { date: "2026-03-06", title: "Late Game Distribution", body: "Schedules now automatically balance 10 pm+ games evenly across all teams." },
  { date: "2026-03-06", title: "Multi-Division Scheduling", body: "Generate schedules for multiple divisions at once in the Schedule Builder." },
  { date: "2026-03-06", title: "Bulk Import", body: "Import teams and ice slots via CSV with live progress tracking." },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ teams: 0, games: 0, officials: 0, forfeits: 0, pendingBlackouts: 0, pendingOfficials: 0 });
  const [pendingOfficials, setPendingOfficials] = useState([]);
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [recentForfeits, setRecentForfeits] = useState([]);
  const [leagueBlackouts, setLeagueBlackouts] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showParamsPanel, setShowParamsPanel] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [seasonForm, setSeasonForm] = useState({
    name: "2025-2026", season_start: "", season_end: "", playoff_start: "",
    games_per_team: 30, schedule_release_weeks: 4, allow_team_realignment: true,
    status: "planning", notes: ""
  });
  const [savingParam, setSavingParam] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const SILVER = "#c0c0c0";
  const GOLD = "#d4af37";

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
      pendingOfficials: officials.filter(o => o.approval_status === "pending").length,
    });
    setPendingOfficials(officials.filter(o => o.approval_status === "pending"));
    const today = new Date().toISOString().split("T")[0];
    setUpcomingGames(games.filter(g => g.date >= today && g.status === "scheduled").slice(0, 6));
    setRecentForfeits(forfeits.slice(0, 5));
    setLeagueBlackouts(blackouts.filter(b => b.team_id === "league" && b.status === "approved"));
    setSeasons(seasons);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const isAdmin = user?.role === "admin";
  const isLoggedIn = !!user;

  const saveSeason = async () => {
    setSavingParam(true);
    await base44.entities.LeagueSeason.create(seasonForm);
    setShowSeasonForm(false);
    setSeasonForm({ name: "2025-2026", season_start: "", season_end: "", playoff_start: "", games_per_team: 30, schedule_release_weeks: 4, allow_team_realignment: true, status: "planning", notes: "" });
    await reload();
    setSavingParam(false);
  };

  const [deleteProgress, setDeleteProgress] = useState(null);

  const deleteSeason = async (seasonId) => {
    setDeletingId(seasonId);
    setDeleteConfirm(null);
    const s = seasons.find(s => s.id === seasonId);
    if (s) {
      const seasonGames = await base44.entities.Game.filter({ season: s.name });
      if (seasonGames.length > 0) {
        setDeleteProgress({ title: "Deleting Season Games", current: 0, total: seasonGames.length });
        const CHUNK = 10;
        for (let i = 0; i < seasonGames.length; i += CHUNK) {
          await Promise.all(seasonGames.slice(i, i + CHUNK).map(g => base44.entities.Game.delete(g.id)));
          if (i + CHUNK < seasonGames.length) await new Promise(r => setTimeout(r, 200));
          setDeleteProgress(p => ({ ...p, current: Math.min(i + CHUNK, seasonGames.length) }));
        }
      }
    }
    await base44.entities.LeagueSeason.delete(seasonId);
    setDeleteProgress(null);
    setDeletingId(null);
    await reload();
  };

  const statusBadge = {
    planning: "text-yellow-400 border-yellow-500/30",
    active: "text-green-400 border-green-500/30",
    completed: "text-gray-400 border-gray-500/30",
  };

  const cards = [
    { label: "Teams", value: stats.teams, icon: Users, page: "TeamsAndDivisions", color: SILVER },
    { label: "Games Scheduled", value: stats.games, icon: Calendar, page: "Schedule", color: GOLD },
    { label: "Officials", value: stats.officials, icon: Shield, page: "Officials", color: SILVER },
    { label: "Forfeits", value: stats.forfeits, icon: AlertTriangle, page: "Forfeits", color: "#ef4444" },
    { label: "Pending Blackouts", value: stats.pendingBlackouts, icon: Clock, page: "BlackoutDates", color: GOLD },
    { label: "Pending Officials", value: stats.pendingOfficials, icon: Shield, page: "Officials", color: "#a855f7" },
  ];

  return (
    <div className="space-y-8">
      {deleteProgress && <ProgressModal title={deleteProgress.title} current={deleteProgress.current} total={deleteProgress.total} />}

      {/* Hero / Landing Section */}
      <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #111 50%, #0d0d0d 100%)", border: "1px solid #2a2a2a" }}>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #d4af37 0%, transparent 50%), radial-gradient(circle at 80% 20%, #c0c0c0 0%, transparent 40%)" }} />
        <div className="relative px-8 py-10 flex flex-col md:flex-row gap-8 items-center">
          {/* Logo & Name */}
          <div className="text-center md:text-left">
            <div className="text-6xl mb-3">🏒</div>
            <h1 className="text-4xl font-black tracking-tight">
              <span style={{ color: SILVER }}>Hockey</span><span style={{ color: GOLD }}>Ops</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">League Management Platform</p>
          </div>

          <div className="flex-1">
            <p className="text-gray-300 text-base leading-relaxed mb-4">
              A complete operations platform for hockey leagues — manage teams, divisions, ice slots, schedules,
              officials, forfeits, and blackouts all in one place. Built for league administrators, referees, and team managers.
            </p>
            <div className="flex flex-wrap gap-3">
              {!isLoggedIn && (
                <>
                  <button onClick={() => base44.auth.redirectToLogin()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-black transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${SILVER}, #e8e8e8)` }}>
                    <LogIn className="w-4 h-4" /> Sign In
                  </button>
                  <button onClick={() => base44.auth.redirectToLogin()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                    style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD }}>
                    <UserPlus className="w-4 h-4" /> Register
                  </button>
                </>
              )}
              {isLoggedIn && (
                <>
                  <Link to={createPageUrl("Schedule")}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-black transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${SILVER}, #e8e8e8)` }}>
                    <Calendar className="w-4 h-4" /> View Schedule
                  </Link>
                  {isAdmin && (
                    <Link to={createPageUrl("ScheduleBuilder")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                      style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD }}>
                      <Settings className="w-4 h-4" /> Build Schedule
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Admin Workflow Guide */}
      {isAdmin && (
        <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: `${GOLD}40` }}>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <span style={{ color: GOLD }}>⚡</span> Season Setup Workflow
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { step: "1", label: "Teams & Divisions", desc: "Add divisions and import teams via CSV", page: "TeamsAndDivisions", color: SILVER },
              { step: "2", label: "Ice Slots", desc: "Import arena time slots via CSV or bulk add", page: "IceSlots", color: SILVER },
              { step: "3", label: "Build Schedule", desc: "Auto-generate the season schedule", page: "ScheduleBuilder", color: GOLD },
              { step: "4", label: "Verify Schedule", desc: "Check game counts & gap warnings", page: "ScheduleVerification", color: SILVER },
              { step: "5", label: "Assign Officials", desc: "Assign refs & timekeepers to games", page: "AssignOfficials", color: SILVER },
              { step: "6", label: "Manage Season", desc: "Track forfeits, blackouts & changes", page: "Schedule", color: SILVER },
            ].map(({ step, label, desc, page, color }) => (
              <Link key={step} to={createPageUrl(page)}
                className="rounded-xl border p-4 transition-all hover:scale-105 flex flex-col gap-1"
                style={{ background: "#111", borderColor: "#2a2a2a" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black mb-1" style={{ background: color }}>{step}</div>
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* News / Updates */}
      <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Newspaper className="w-4 h-4" style={{ color: GOLD }} /> What's New
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {NEWS_ITEMS.map((item, i) => (
            <div key={i} className="rounded-lg p-4 border" style={{ background: "#111", borderColor: "#222" }}>
              <div className="text-xs mb-1.5" style={{ color: GOLD }}>{item.date}</div>
              <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{item.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats (only for logged-in users) */}
      {isLoggedIn && (
        <>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => <div key={i} className="rounded-xl h-28 animate-pulse" style={{ background: "#111" }} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {cards.map(card => (
                <Link key={card.label} to={createPageUrl(card.page)}
                  className="rounded-xl p-5 border transition-all hover:scale-105 hover:border-opacity-50"
                  style={{ background: "#0d0d0d", borderColor: "#2a2a2a" }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style={{ background: `${card.color}15` }}>
                    <card.icon className="w-5 h-5" style={{ color: card.color }} />
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
            <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: GOLD }} /> Upcoming Games
                </h2>
                <Link to={createPageUrl("Schedule")} className="text-xs flex items-center gap-1 hover:text-white transition-colors" style={{ color: SILVER }}>
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {upcomingGames.length === 0 ? (
                <p className="text-gray-500 text-sm">No upcoming games scheduled.</p>
              ) : (
                <div className="divide-y" style={{ borderColor: "#1a1a1a" }}>
                  {upcomingGames.map(game => (
                    <div key={game.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="text-sm font-medium text-white">{game.home_team_name} vs {game.away_team_name}</div>
                        <div className="text-xs text-gray-500">{game.division_name} · {game.arena_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm" style={{ color: GOLD }}>{game.date}</div>
                        <div className="text-xs text-gray-500">{game.start_time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: SILVER }} /> Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Submit Blackout", page: "BlackoutDates" },
                  { label: "View Schedule", page: "Schedule" },
                  { label: "Report Forfeit", page: "Forfeits" },
                  { label: "My Availability", page: "OfficialAvailability" },
                  { label: "Assign Officials", page: "AssignOfficials" },
                  { label: "Build Schedule", page: "ScheduleBuilder" },
                ].map(a => (
                  <Link key={a.page} to={createPageUrl(a.page)}
                    className="flex items-center justify-center rounded-xl p-3 text-xs font-medium border text-black transition-all hover:scale-105"
                    style={{ background: SILVER, borderColor: SILVER }}>
                    {a.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Pending Officials Approval */}
          {isAdmin && pendingOfficials.length > 0 && (
            <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#d4af3740" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span style={{ color: GOLD }}>⏳</span> Officials Awaiting Approval ({pendingOfficials.length})
                </h2>
                <Link to={createPageUrl("Officials")} className="text-xs flex items-center gap-1 hover:text-white transition-colors" style={{ color: SILVER }}>
                  Manage all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {pendingOfficials.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg px-4 py-2.5 border border-gray-800" style={{ background: "#111" }}>
                    <div>
                      <div className="text-sm font-medium text-white">{o.full_name}</div>
                      <div className="text-xs text-gray-500 capitalize">{o.role}{o.certification_level ? ` · ${o.certification_level}` : ""}{o.user_email ? ` · ${o.user_email}` : ""}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        await base44.entities.Official.update(o.id, { approval_status: "approved" });
                        await reload();
                      }} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20">
                        <CheckSquare className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={async () => {
                        await base44.entities.Official.update(o.id, { approval_status: "rejected" });
                        await reload();
                      }} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20">
                        <XSquare className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Forfeits & League Blackouts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" /> Recent Forfeits
                </h2>
                <Link to={createPageUrl("Forfeits")} className="text-xs flex items-center gap-1 hover:text-white transition-colors" style={{ color: SILVER }}>
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {recentForfeits.length === 0 ? (
                <p className="text-gray-500 text-sm">No forfeits reported.</p>
              ) : (
                <div className="space-y-2">
                  {recentForfeits.map(f => (
                    <div key={f.id} className="flex items-start justify-between py-2 border-b last:border-0" style={{ borderColor: "#1a1a1a" }}>
                      <div>
                        <div className="text-sm font-medium text-white">{f.forfeiting_team_name}</div>
                        <div className="text-xs text-gray-500">{f.game_date} · {f.division_name}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${f.status === "confirmed_forfeit" ? "text-red-400 border-red-500/30" : f.status === "replacement_found" ? "text-green-400 border-green-500/30" : "text-yellow-400 border-yellow-500/30"}`}>
                        {f.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: `${GOLD}30` }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4" style={{ color: GOLD }} /> League Blackout Dates
                </h2>
                <Link to={createPageUrl("BlackoutDates")} className="text-xs flex items-center gap-1 hover:text-white" style={{ color: SILVER }}>
                  Manage <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {leagueBlackouts.length === 0 ? (
                <p className="text-gray-500 text-sm">No league blackout dates set.</p>
              ) : (
                <div className="space-y-2">
                  {leagueBlackouts.map(b => (
                    <div key={b.id} className="flex items-start justify-between py-2 border-b last:border-0" style={{ borderColor: "#1a1a1a" }}>
                      <div>
                        <div className="text-sm font-medium" style={{ color: GOLD }}>
                          {b.date_from}{b.date_to && b.date_to !== b.date_from ? ` → ${b.date_to}` : ""}
                        </div>
                        {b.reason && <div className="text-xs text-gray-500">{b.reason}</div>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full border" style={{ color: GOLD, borderColor: `${GOLD}30` }}>League</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin: League Parameters */}
          {isAdmin && (
            <div className="space-y-4">
              <button onClick={() => setShowParamsPanel(!showParamsPanel)}
                className="w-full flex items-center justify-between rounded-xl border px-5 py-4 hover:border-opacity-70 transition-colors"
                style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5" style={{ color: GOLD }} />
                  <span className="font-semibold text-white">League Parameters & Season History</span>
                </div>
                {showParamsPanel ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>

              {showParamsPanel && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">New Season Parameters</h3>
                      {!showSeasonForm && (
                        <button onClick={() => setShowSeasonForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-black" style={{ background: SILVER }}>
                          <Plus className="w-3.5 h-3.5" /> New Season
                        </button>
                      )}
                    </div>
                    {showSeasonForm ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Season Name *</label>
                            <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              value={seasonForm.name} onChange={e => setSeasonForm(f => ({ ...f, name: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Status</label>
                            <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
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
                            <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              value={seasonForm.season_start} onChange={e => setSeasonForm(f => ({ ...f, season_start: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Season End</label>
                            <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              value={seasonForm.season_end} onChange={e => setSeasonForm(f => ({ ...f, season_end: e.target.value }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Games Per Team</label>
                            <input type="number" min={1} className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              value={seasonForm.games_per_team} onChange={e => setSeasonForm(f => ({ ...f, games_per_team: parseInt(e.target.value) || 30 }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 block mb-1">Release Block (weeks)</label>
                            <input type="number" min={1} max={12} className="w-full bg-black border border-gray-800 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-yellow-500"
                              value={seasonForm.schedule_release_weeks} onChange={e => setSeasonForm(f => ({ ...f, schedule_release_weeks: parseInt(e.target.value) || 4 }))} />
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={seasonForm.allow_team_realignment} className="accent-yellow-500 w-4 h-4"
                            onChange={e => setSeasonForm(f => ({ ...f, allow_team_realignment: e.target.checked }))} />
                          <span className="text-sm text-gray-300">Allow team realignment between releases</span>
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => setShowSeasonForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
                          <button onClick={saveSeason} disabled={savingParam} className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: SILVER }}>
                            {savingParam ? "Saving..." : "Create Season"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Click "New Season" to configure a season with dates, game counts, and release settings.</p>
                    )}
                  </div>

                  <div className="rounded-xl border p-5" style={{ background: "#0a0a0a", borderColor: "#2a2a2a" }}>
                    <h3 className="font-semibold text-white mb-4">Season History</h3>
                    {seasons.length === 0 ? (
                      <p className="text-gray-500 text-sm">No seasons created yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {seasons.map(s => (
                          <div key={s.id} className="rounded-xl p-3 border" style={{ background: "#111", borderColor: "#222" }}>
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-white">{s.name}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[s.status]}`}>{s.status}</span>
                                </div>
                                <div className="text-xs text-gray-500 space-y-0.5">
                                  {s.season_start && <div>📅 {s.season_start} → {s.season_end || "TBD"}</div>}
                                  <div>🎮 {s.games_per_team} games/team · 📦 {s.schedule_release_weeks}-week releases</div>
                                </div>
                              </div>
                              <button onClick={() => setDeleteConfirm(s.id)} className="p-1.5 text-gray-600 hover:text-red-400 rounded-lg ml-2">
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
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border p-6 w-full max-w-md" style={{ background: "#111", borderColor: "#333" }}>
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
              ⚠️ This will permanently delete the season record and all associated games.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={() => deleteSeason(deleteConfirm)} disabled={!!deletingId}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
                {deletingId ? "Deleting..." : "Yes, Delete Season"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}