import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";

// This page is designed to be embedded or linked on the league website.
// It submits directly to the app database — no login required.
export default function PublicForfeitForm() {
  const [form, setForm] = useState({
    forfeiting_team_name: "",
    opposing_team_name: "",
    division_name: "",
    game_date: "",
    game_time: "",
    arena_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    reason: "",
    season: "2025-2026",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hoursUntil = form.game_date && form.game_time
    ? (new Date(`${form.game_date}T${form.game_time}`) - new Date()) / (1000 * 60 * 60)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.forfeiting_team_name || !form.game_date || !form.reason || !form.contact_email) {
      setError("Please fill in all required fields."); return;
    }
    setSubmitting(true);
    setError("");
    await base44.entities.Forfeit.create({
      forfeiting_team_name: form.forfeiting_team_name,
      opposing_team_name: form.opposing_team_name,
      division_name: form.division_name,
      game_date: form.game_date,
      game_time: form.game_time,
      arena_name: form.arena_name,
      submitted_by: form.contact_name,
      submitted_by_email: form.contact_email,
      reason: form.reason,
      hours_until_game: hoursUntil ? Math.round(hoursUntil) : 0,
      is_early_enough_for_replacement: hoursUntil ? hoursUntil > 48 : false,
      status: "submitted",
      season: form.season,
      game_id: "public_submission",
      forfeiting_team_id: "public",
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-[#1e2533] rounded-2xl border border-green-500/30 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Forfeit Submitted</h2>
          <p className="text-gray-400 mb-4">Your forfeit has been received. The league office will be notified and division teams will be contacted if time permits a replacement.</p>
          <button onClick={() => { setSubmitted(false); setForm({ forfeiting_team_name: "", opposing_team_name: "", division_name: "", game_date: "", game_time: "", arena_name: "", contact_name: "", contact_email: "", contact_phone: "", reason: "", season: "2025-2026" }); }}
            className="text-sky-400 hover:text-sky-300 text-sm underline">Submit another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-start justify-center p-4 pt-8">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Report a Forfeit</h1>
          <p className="text-gray-400 mt-1 text-sm">Submit this form to notify the league of a game forfeit. Reports received 48+ hours before game time allow for replacement team notification.</p>
        </div>

        <div className="bg-[#1e2533] rounded-2xl border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm font-semibold text-white mb-1">Game Information</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Your Team Name *</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.forfeiting_team_name} onChange={e => setForm(f => ({ ...f, forfeiting_team_name: e.target.value }))} placeholder="Your team" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Opponent Team Name</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.opposing_team_name} onChange={e => setForm(f => ({ ...f, opposing_team_name: e.target.value }))} placeholder="Opposing team" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Division</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.division_name} onChange={e => setForm(f => ({ ...f, division_name: e.target.value }))} placeholder="e.g. Division A" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Arena</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.arena_name} onChange={e => setForm(f => ({ ...f, arena_name: e.target.value }))} placeholder="Arena name" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Game Date *</label>
                <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.game_date} onChange={e => setForm(f => ({ ...f, game_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Game Time</label>
                <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.game_time} onChange={e => setForm(f => ({ ...f, game_time: e.target.value }))} />
              </div>
            </div>

            {hoursUntil !== null && (
              <div className={`flex items-center gap-2 rounded-lg p-3 text-sm border ${hoursUntil > 48 ? "bg-green-500/10 border-green-500/20 text-green-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
                <Clock className="w-4 h-4 shrink-0" />
                {hoursUntil > 48
                  ? `${Math.round(hoursUntil)} hours away — replacement notice will be sent to division teams`
                  : `Only ${Math.round(Math.max(0, hoursUntil))} hours until game — forfeit will be confirmed without replacement`}
              </div>
            )}

            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm font-semibold text-white mb-3">Contact Information</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Your Name</label>
                  <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Email *</label>
                  <input type="email" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-400 block mb-1">Phone (optional)</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Reason for Forfeit *</label>
              <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-24 resize-none"
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
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