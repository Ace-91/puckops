import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarX, CheckCircle, Plus, X } from "lucide-react";

// Christmas blackout: Dec 20 – Jan 5 (never available)
const isChristmasPeriod = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  const m = d.getMonth() + 1; // 1-12
  const day = d.getDate();
  return (m === 12 && day >= 20) || (m === 1 && day <= 5);
};

const getMonthKey = (dateStr) => dateStr ? dateStr.substring(0, 7) : ""; // "YYYY-MM"

const SEASON_MONTHS = ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03","2026-04","2026-05"];
const MONTH_LABELS = {
  "2025-09":"September 2025","2025-10":"October 2025","2025-11":"November 2025",
  "2025-12":"December 2025","2026-01":"January 2026","2026-02":"February 2026",
  "2026-03":"March 2026","2026-04":"April 2026","2026-05":"May 2026",
};

export default function PublicBlackoutForm() {
  const [divisions, setDivisions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [leagueBlackouts, setLeagueBlackouts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });

  // Each entry: { month: "2025-11", date: "2025-11-15", time_restriction: "none", notes: "" }
  const [blackoutEntries, setBlackoutEntries] = useState([]);
  const [addingMonth, setAddingMonth] = useState("");
  const [addingDate, setAddingDate] = useState("");
  const [addingRestriction, setAddingRestriction] = useState("none");
  const [addingNotes, setAddingNotes] = useState("");

  // League blackout availability: { [blackoutId]: true/false }
  const [leagueBlackoutAvail, setLeagueBlackoutAvail] = useState({});

  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const [d, t, b] = await Promise.all([
        base44.entities.Division.list(),
        base44.entities.Team.filter({ is_active: true }),
        base44.entities.BlackoutDate.filter({ status: "approved" }),
      ]);
      setDivisions(d);
      setTeams(t);
      const league = b.filter(x => !x.team_id || x.team_id === "league");
      setLeagueBlackouts(league);
      // Default: all league blackouts unchecked (not available)
      const avail = {};
      league.forEach(lb => { avail[lb.id] = false; });
      setLeagueBlackoutAvail(avail);
      setLoading(false);
    };
    load();
  }, []);

  const filteredTeams = selectedDivision
    ? teams.filter(t => t.division_id === selectedDivision)
    : teams;

  const usedMonths = new Set(blackoutEntries.map(e => e.month));

  const canAddEntry = () => {
    if (!addingMonth || !addingDate) return false;
    if (usedMonths.has(addingMonth)) return false;
    if (isChristmasPeriod(addingDate)) return false;
    if (getMonthKey(addingDate) !== addingMonth) return false;
    return true;
  };

  const addEntry = () => {
    if (!canAddEntry()) return;
    setBlackoutEntries(prev => [...prev, {
      month: addingMonth,
      date: addingDate,
      time_restriction: addingRestriction,
      notes: addingNotes,
    }]);
    setAddingMonth("");
    setAddingDate("");
    setAddingRestriction("none");
    setAddingNotes("");
  };

  const removeEntry = (month) => {
    setBlackoutEntries(prev => prev.filter(e => e.month !== month));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeam) { setError("Please select your team."); return; }
    if (!contact.name || !contact.email || !contact.phone) { setError("Name, email, and cell phone are required."); return; }
    if (blackoutEntries.length === 0) { setError("Please add at least one blackout date."); return; }
    setSubmitting(true);
    setError("");

    const leagueNote = Object.entries(leagueBlackoutAvail)
      .filter(([, v]) => v)
      .map(([id]) => {
        const lb = leagueBlackouts.find(x => x.id === id);
        return lb ? `Available on league blackout: ${lb.date_from}${lb.date_to && lb.date_to !== lb.date_from ? ` – ${lb.date_to}` : ""}` : "";
      })
      .filter(Boolean)
      .join("; ");

    for (const entry of blackoutEntries) {
      await base44.entities.BlackoutDate.create({
        team_id: selectedTeam.id,
        team_name: selectedTeam.name,
        division_id: selectedTeam.division_id,
        submitted_by: contact.email,
        date_from: entry.date,
        date_to: entry.date,
        time_restriction: entry.time_restriction,
        specific_time_notes: entry.notes || (leagueNote ? `League blackout availability: ${leagueNote}` : ""),
        reason: reason,
        season: "2025-2026",
        status: "pending",
      });
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  const reset = () => {
    setSubmitted(false);
    setSelectedDivision("");
    setSelectedTeam(null);
    setContact({ name: "", email: "", phone: "" });
    setBlackoutEntries([]);
    setReason("");
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
          <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
          <p className="text-gray-400 mb-2">{blackoutEntries.length} blackout date{blackoutEntries.length > 1 ? "s" : ""} submitted for <strong className="text-white">{selectedTeam?.name}</strong>.</p>
          <p className="text-gray-400 mb-4 text-sm">The league office will review and approve your request.</p>
          <button onClick={reset} className="text-sky-400 hover:text-sky-300 text-sm underline">Submit another</button>
        </div>
      </div>
    );
  }

  const availableMonths = SEASON_MONTHS.filter(m => !usedMonths.has(m));

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-yellow-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarX className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Blackout Date Request</h1>
          <p className="text-gray-400 mt-1 text-sm">One blackout date per month. All requests are reviewed by the league before being applied to the schedule.</p>
        </div>

        <div className="bg-[#1e2533] rounded-2xl border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Team Selection */}
            <div>
              <div className="text-sm font-semibold text-white mb-3">Team</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Division (filter)</label>
                  <select className={inputCls} value={selectedDivision} onChange={e => { setSelectedDivision(e.target.value); setSelectedTeam(null); }}>
                    <option value="">All Divisions</option>
                    {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Team Name *</label>
                  <select className={inputCls} value={selectedTeam?.id || ""} onChange={e => setSelectedTeam(filteredTeams.find(t => t.id === e.target.value) || null)}>
                    <option value="">Select your team...</option>
                    {filteredTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm font-semibold text-white mb-3">Contact Information</div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Full Name *</label>
                  <input className={inputCls} value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} placeholder="Your full name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email *</label>
                    <input type="email" className={inputCls} value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Cell Phone *</label>
                    <input type="tel" className={inputCls} value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>
            </div>

            {/* Blackout Entries */}
            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm font-semibold text-white mb-1">Blackout Dates</div>
              <p className="text-xs text-gray-500 mb-3">One date per calendar month. Christmas period (Dec 20 – Jan 5) is not available.</p>

              {blackoutEntries.length > 0 && (
                <div className="space-y-2 mb-3">
                  {blackoutEntries.map(entry => (
                    <div key={entry.month} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm border border-gray-700 bg-gray-900">
                      <div>
                        <span className="text-white font-medium">{entry.date}</span>
                        <span className="text-gray-500 ml-2">({MONTH_LABELS[entry.month]})</span>
                        {entry.time_restriction !== "none" && <span className="text-yellow-400 text-xs ml-2">— {entry.time_restriction === "no_late_games" ? "No late games" : "Time restricted"}</span>}
                      </div>
                      <button type="button" onClick={() => removeEntry(entry.month)} className="text-gray-600 hover:text-red-400 ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {availableMonths.length > 0 && (
                <div className="rounded-lg border border-gray-700 p-3 space-y-2 bg-gray-900/40">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Month</label>
                      <select className={inputCls} value={addingMonth} onChange={e => { setAddingMonth(e.target.value); setAddingDate(""); }}>
                        <option value="">Select month...</option>
                        {availableMonths.map(m => <option key={m} value={m}>{MONTH_LABELS[m]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Date</label>
                      <input type="date"
                        className={inputCls}
                        value={addingDate}
                        min={addingMonth ? `${addingMonth}-01` : ""}
                        max={addingMonth ? `${addingMonth}-31` : ""}
                        onChange={e => setAddingDate(e.target.value)}
                        disabled={!addingMonth}
                      />
                    </div>
                  </div>
                  {addingDate && isChristmasPeriod(addingDate) && (
                    <p className="text-red-400 text-xs">Christmas period (Dec 20 – Jan 5) cannot be blacked out — no games are scheduled during this time.</p>
                  )}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Time Restriction</label>
                    <select className={inputCls} value={addingRestriction} onChange={e => setAddingRestriction(e.target.value)}>
                      <option value="none">Entire day blacked out</option>
                      <option value="no_late_games">No late games (10:30pm+)</option>
                      <option value="specific_times">Specific times (describe below)</option>
                    </select>
                  </div>
                  {addingRestriction === "specific_times" && (
                    <input className={inputCls} value={addingNotes} onChange={e => setAddingNotes(e.target.value)} placeholder="e.g. Cannot play before 6:00pm" />
                  )}
                  <button type="button" onClick={addEntry} disabled={!canAddEntry()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-40 text-black"
                    style={{ background: canAddEntry() ? "#facc15" : "#555" }}>
                    <Plus className="w-4 h-4" /> Add This Month
                  </button>
                </div>
              )}
              {availableMonths.length === 0 && blackoutEntries.length > 0 && (
                <p className="text-xs text-green-400">All available months have been added.</p>
              )}
            </div>

            {/* League Blackout Availability */}
            {leagueBlackouts.length > 0 && (
              <div className="border-t border-gray-700 pt-4">
                <div className="text-sm font-semibold text-white mb-1">League-Wide Blackout Dates</div>
                <p className="text-xs text-gray-500 mb-3">The league has the following scheduled blackouts. Check any dates your team IS available and willing to play if needed.</p>
                <div className="space-y-2">
                  {leagueBlackouts.map(lb => {
                    const isXmas = isChristmasPeriod(lb.date_from);
                    return (
                      <div key={lb.id} className={`flex items-start gap-3 rounded-lg px-3 py-2 border text-sm ${isXmas ? "border-gray-800 bg-gray-900/30 opacity-50" : "border-gray-700 bg-gray-900/40"}`}>
                        {isXmas ? (
                          <span className="text-gray-600 text-xs mt-0.5">🎄</span>
                        ) : (
                          <input type="checkbox"
                            checked={leagueBlackoutAvail[lb.id] || false}
                            onChange={e => setLeagueBlackoutAvail(prev => ({ ...prev, [lb.id]: e.target.checked }))}
                            className="mt-0.5 w-4 h-4 accent-sky-500"
                          />
                        )}
                        <div>
                          <div className="text-white">{lb.date_from}{lb.date_to && lb.date_to !== lb.date_from ? ` – ${lb.date_to}` : ""}</div>
                          {lb.reason && <div className="text-gray-500 text-xs">{lb.reason}</div>}
                          {isXmas && <div className="text-gray-600 text-xs">Christmas period — no games scheduled</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="text-xs text-gray-400 block mb-1">Reason (optional)</label>
              <textarea className={`${inputCls} h-20 resize-none`} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="Tournament, school break, holiday event, etc." />
            </div>

            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors">
              {submitting ? "Submitting..." : `Submit ${blackoutEntries.length > 0 ? `${blackoutEntries.length} ` : ""}Blackout Request${blackoutEntries.length > 1 ? "s" : ""}`}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-600 mt-4">Requests are reviewed by the league office. You will be contacted at the email provided.</p>
      </div>
    </div>
  );
}