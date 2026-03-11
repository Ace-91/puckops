import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLeague } from "@/components/useLeague";
import { Calendar, Shield, Clock, ArrowLeftRight, CheckCircle, XCircle, Moon, AlertCircle, Plus, X } from "lucide-react";

export default function OfficialPortal() {
  const { leagueId } = useLeague();
  const [user, setUser] = useState(null);
  const [myOfficial, setMyOfficial] = useState(null);
  const [myGames, setMyGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [officials, setOfficials] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schedule");
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [tradeForm, setTradeForm] = useState({ my_game_id: "", target_official_id: "", target_game_id: "", message: "" });
  const [submittingTrade, setSubmittingTrade] = useState(false);

  const load = async () => {
    setLoading(true);
    const u = await base44.auth.me().catch(() => null);
    setUser(u);
    if (!u) { setLoading(false); return; }

    const q = leagueId ? { league_id: leagueId } : {};
    const [officials, games, trades] = await Promise.all([
      base44.entities.Official.filter(q),
      base44.entities.Game.filter({ ...q, status: "scheduled" }),
      base44.entities.OfficialTrade.filter(q, "-created_date"),
    ]);

    const me = officials.find(o => o.user_email === u.email);
    setMyOfficial(me);
    setOfficials(officials);

    const today = new Date().toISOString().split("T")[0];
    const upcoming = games.filter(g => g.date >= today);
    setAllGames(upcoming);

    if (me) {
      const mine = upcoming.filter(g =>
        g.referee1_id === me.id || g.referee2_id === me.id || g.timekeeper_id === me.id
      );
      setMyGames(mine);
    }

    setTrades(trades.filter(t => t.requester_id === me?.id || t.target_official_id === me?.id));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitTrade = async () => {
    if (!tradeForm.my_game_id || !tradeForm.target_official_id || !tradeForm.target_game_id) {
      alert("Please fill in all required trade fields."); return;
    }
    setSubmittingTrade(true);
    const myGame = myGames.find(g => g.id === tradeForm.my_game_id);
    const targetGame = allGames.find(g => g.id === tradeForm.target_game_id);
    const targetOff = officials.find(o => o.id === tradeForm.target_official_id);

    await base44.entities.OfficialTrade.create({
      league_id: leagueId || "",
      requester_id: myOfficial.id,
      requester_name: myOfficial.full_name,
      requester_game_id: myGame.id,
      requester_game_date: myGame.date,
      requester_game_info: `${myGame.date} ${myGame.start_time} – ${myGame.home_team_name} vs ${myGame.away_team_name}`,
      target_official_id: targetOff.id,
      target_official_name: targetOff.full_name,
      target_game_id: targetGame.id,
      target_game_date: targetGame.date,
      target_game_info: `${targetGame.date} ${targetGame.start_time} – ${targetGame.home_team_name} vs ${targetGame.away_team_name}`,
      field: myOfficial.role === "referee" ? "referee1_id" : "timekeeper_id",
      message: tradeForm.message,
      status: "pending",
    });

    setShowTradeForm(false);
    setTradeForm({ my_game_id: "", target_official_id: "", target_game_id: "", message: "" });
    await load();
    setSubmittingTrade(false);
  };

  const respondTrade = async (tradeId, accept) => {
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;

    if (accept) {
      // Swap: put target official in requester's game, put requester in target game
      const reqGame = allGames.find(g => g.id === trade.requester_game_id);
      const tgtGame = allGames.find(g => g.id === trade.target_game_id);
      if (reqGame && tgtGame) {
        const field = trade.field;
        const nameField = field.replace("_id", "_name");
        await base44.entities.Game.update(trade.requester_game_id, { [field]: trade.target_official_id, [nameField]: trade.target_official_name });
        await base44.entities.Game.update(trade.target_game_id, { [field]: trade.requester_id, [nameField]: trade.requester_name });
      }
    }

    await base44.entities.OfficialTrade.update(tradeId, {
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString()
    });
    await load();
  };

  const targetGamesForOfficials = tradeForm.target_official_id
    ? allGames.filter(g => {
        const o = officials.find(x => x.id === tradeForm.target_official_id);
        if (!o) return false;
        return g.referee1_id === o.id || g.referee2_id === o.id || g.timekeeper_id === o.id;
      })
    : [];

  const pendingIncoming = trades.filter(t => t.target_official_id === myOfficial?.id && t.status === "pending");

  if (loading) return (
    <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-xl h-20 animate-pulse" />)}</div>
  );

  if (!user) return (
    <div className="text-center py-20 text-gray-500">
      <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>Please sign in to access the Official Portal.</p>
    </div>
  );

  if (!myOfficial) return (
    <div className="text-center py-20 text-gray-500">
      <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>Your account is not linked to an official profile. Contact the league admin.</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Official Portal</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {myOfficial.full_name} · <span className="capitalize">{myOfficial.role}</span> · {myOfficial.certification_level}
          </p>
        </div>
        {pendingIncoming.length > 0 && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
            <ArrowLeftRight className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm">{pendingIncoming.length} trade request{pendingIncoming.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161c27] rounded-xl p-1 mb-5 w-fit">
        {[
          { id: "schedule", label: "My Schedule", icon: Calendar },
          { id: "available", label: "Available Games", icon: Shield },
          { id: "trades", label: `Trades${pendingIncoming.length > 0 ? ` (${pendingIncoming.length})` : ""}`, icon: ArrowLeftRight },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? "bg-sky-500 text-white" : "text-gray-400 hover:text-white"}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* My Schedule */}
      {activeTab === "schedule" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-gray-400 text-sm">{myGames.length} upcoming assignments</p>
            <button onClick={() => setShowTradeForm(true)}
              className="flex items-center gap-1.5 text-sm bg-[#1e2533] border border-gray-700 hover:border-sky-500 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Request Trade
            </button>
          </div>
          {myGames.length === 0 ? (
            <div className="text-center py-12 text-gray-500"><Calendar className="w-10 h-10 mx-auto mb-3 opacity-20" /><p>No upcoming assignments.</p></div>
          ) : (
            myGames.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)).map(game => {
              const myField = game.referee1_id === myOfficial.id ? "Referee 1" : game.referee2_id === myOfficial.id ? "Referee 2" : "Timekeeper";
              return (
                <div key={game.id} className="bg-[#1e2533] rounded-xl border border-gray-800 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{game.home_team_name} vs {game.away_team_name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{game.date} · {game.start_time} · {game.arena_name} · {game.division_name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {game.is_late_game && <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full"><Moon className="w-3 h-3" /> Late</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">{myField}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Available games (unassigned in my role) */}
      {activeTab === "available" && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm mb-3">Games that still need a {myOfficial.role} — contact admin to request assignment.</p>
          {allGames.filter(g => {
            if (myOfficial.role === "referee") return !g.referee1_id || !g.referee2_id;
            if (myOfficial.role === "timekeeper") return !g.timekeeper_id;
            return false;
          }).sort((a, b) => a.date.localeCompare(b.date)).map(game => (
            <div key={game.id} className="bg-[#1e2533] rounded-xl border border-orange-500/20 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-white">{game.home_team_name} vs {game.away_team_name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{game.date} · {game.start_time} · {game.arena_name} · {game.division_name}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">Needs {myOfficial.role}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trades */}
      {activeTab === "trades" && (
        <div className="space-y-4">
          {/* Incoming trades */}
          {pendingIncoming.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Incoming Trade Requests</h3>
              {pendingIncoming.map(trade => (
                <div key={trade.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-3">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-semibold text-white text-sm">{trade.requester_name} wants to trade</div>
                      <div className="text-xs text-gray-300 mt-1">Their game: <span className="text-white">{trade.requester_game_info}</span></div>
                      <div className="text-xs text-gray-300">For your game: <span className="text-white">{trade.target_game_info}</span></div>
                      {trade.message && <div className="text-xs text-gray-400 mt-1 italic">"{trade.message}"</div>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => respondTrade(trade.id, true)} className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm">
                        <CheckCircle className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button onClick={() => respondTrade(trade.id, false)} className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-sm">
                        <XCircle className="w-3.5 h-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* My outgoing trades */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">My Trade Requests</h3>
              <button onClick={() => setShowTradeForm(true)}
                className="flex items-center gap-1.5 text-sm bg-sky-500 hover:bg-sky-600 text-white px-3 py-1.5 rounded-lg">
                <Plus className="w-3.5 h-3.5" /> New Request
              </button>
            </div>
            {trades.filter(t => t.requester_id === myOfficial?.id).length === 0
              ? <p className="text-gray-500 text-sm">No trade requests submitted.</p>
              : trades.filter(t => t.requester_id === myOfficial?.id).map(trade => (
                <div key={trade.id} className={`bg-[#1e2533] border rounded-xl p-4 mb-2 ${trade.status === "accepted" ? "border-green-500/20" : trade.status === "declined" ? "border-red-500/20" : "border-gray-800"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="text-sm font-medium text-white">Trade with {trade.target_official_name}</div>
                      <div className="text-xs text-gray-400">Your: {trade.requester_game_info}</div>
                      <div className="text-xs text-gray-400">Their: {trade.target_game_info}</div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${trade.status === "accepted" ? "bg-green-500/10 text-green-400 border-green-500/20" : trade.status === "declined" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>
                      {trade.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Trade Request Form */}
      {showTradeForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Request Game Trade</h2>
              <button onClick={() => setShowTradeForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Your game to trade away *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={tradeForm.my_game_id} onChange={e => setTradeForm(f => ({ ...f, my_game_id: e.target.value }))}>
                  <option value="">Select your game...</option>
                  {myGames.map(g => <option key={g.id} value={g.id}>{g.date} {g.start_time} – {g.home_team_name} vs {g.away_team_name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Official to trade with *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={tradeForm.target_official_id} onChange={e => setTradeForm(f => ({ ...f, target_official_id: e.target.value, target_game_id: "" }))}>
                  <option value="">Select official...</option>
                  {officials.filter(o => o.id !== myOfficial?.id && o.role === myOfficial?.role).map(o => (
                    <option key={o.id} value={o.id}>{o.full_name}</option>
                  ))}
                </select>
              </div>
              {tradeForm.target_official_id && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Their game you want *</label>
                  {targetGamesForOfficials.length === 0
                    ? <p className="text-xs text-gray-500">This official has no upcoming assigned games.</p>
                    : (
                      <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                        value={tradeForm.target_game_id} onChange={e => setTradeForm(f => ({ ...f, target_game_id: e.target.value }))}>
                        <option value="">Select their game...</option>
                        {targetGamesForOfficials.map(g => <option key={g.id} value={g.id}>{g.date} {g.start_time} – {g.home_team_name} vs {g.away_team_name}</option>)}
                      </select>
                    )}
                </div>
              )}
              <div>
                <label className="text-sm text-gray-400 block mb-1">Message (optional)</label>
                <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-16 resize-none"
                  value={tradeForm.message} onChange={e => setTradeForm(f => ({ ...f, message: e.target.value }))} placeholder="Reason for trade..." />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowTradeForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={submitTrade} disabled={submittingTrade}
                className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
                {submittingTrade ? "Submitting..." : "Send Trade Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}