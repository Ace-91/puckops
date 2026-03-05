import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Users, Shield, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";

export default function Dashboard() {
  const [stats, setStats] = useState({ teams: 0, games: 0, officials: 0, forfeits: 0, pendingBlackouts: 0 });
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        const [teams, games, officials, forfeits, blackouts] = await Promise.all([
          base44.entities.Team.list(),
          base44.entities.Game.list("-date", 200),
          base44.entities.Official.list(),
          base44.entities.Forfeit.list(),
          base44.entities.BlackoutDate.filter({ status: "pending" }),
        ]);
        setStats({
          teams: teams.length,
          games: games.length,
          officials: officials.length,
          forfeits: forfeits.length,
          pendingBlackouts: blackouts.length,
        });
        const today = new Date().toISOString().split("T")[0];
        const upcoming = games.filter(g => g.date >= today && g.status === "scheduled").slice(0, 5);
        setUpcomingGames(upcoming);
      } catch (e) {}
      setLoading(false);
    };
    load();
  }, []);

  const cards = [
    { label: "Teams", value: stats.teams, icon: Users, color: "text-sky-400", bg: "bg-sky-500/10", page: "TeamsAndDivisions" },
    { label: "Games Scheduled", value: stats.games, icon: Calendar, color: "text-green-400", bg: "bg-green-500/10", page: "Schedule" },
    { label: "Officials", value: stats.officials, icon: Shield, color: "text-purple-400", bg: "bg-purple-500/10", page: "Officials" },
    { label: "Forfeits", value: stats.forfeits, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", page: "Forfeits" },
    { label: "Pending Blackouts", value: stats.pendingBlackouts, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", page: "BlackoutDates" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back{user?.full_name ? `, ${user.full_name}` : ""}
        </h1>
        <p className="text-gray-400 mt-1">HockeyOps League Management Dashboard</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#1e2533] rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {cards.map(card => (
            <Link key={card.label} to={createPageUrl(card.page)}
              className="bg-[#1e2533] rounded-xl p-5 border border-gray-800 hover:border-sky-500/40 transition-colors group"
            >
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
              <div className="text-sm text-gray-400 mt-0.5">{card.label}</div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Games */}
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" /> Upcoming Games
            </h2>
            <Link to={createPageUrl("Schedule")} className="text-sky-400 text-sm hover:text-sky-300 flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {upcomingGames.length === 0 ? (
            <p className="text-gray-500 text-sm">No upcoming games scheduled.</p>
          ) : (
            <div className="space-y-3">
              {upcomingGames.map(game => (
                <div key={game.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
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
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-400" /> Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Submit Blackout", page: "BlackoutDates", color: "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20" },
              { label: "View Schedule", page: "Schedule", color: "bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border-sky-500/20" },
              { label: "Report Forfeit", page: "Forfeits", color: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20" },
              { label: "My Availability", page: "OfficialAvailability", color: "bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border-purple-500/20" },
              { label: "Assign Officials", page: "AssignOfficials", color: "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20" },
              { label: "Build Schedule", page: "ScheduleBuilder", color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20" },
            ].map(a => (
              <Link key={a.page} to={createPageUrl(a.page)}
                className={`flex items-center justify-center rounded-lg p-3 text-sm font-medium border transition-colors ${a.color}`}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}