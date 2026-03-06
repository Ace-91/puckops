import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarX, CheckCircle, Clock } from "lucide-react";

// Embeddable public blackout request form — no login required.
// Can be linked from the league website. Feeds directly into app BlackoutDates.
export default function PublicBlackoutForm() {
  const [form, setForm] = useState({
    team_name: "",
    division_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    date_from: "",
    date_to: "",
    time_restriction: "none",
    specific_time_notes: "",
    reason: "",
    season: "2025-2026",
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.team_name || !form.date_from || !form.contact_email) {
      setError("Team name, start date, and email are required."); return;
    }
    setSubmitting(true);
    setError("");
    await base44.entities.BlackoutDate.create({
      team_id: "public_submission",
      team_name: form.team_name,
      division_id: "",
      submitted_by: form.contact_email,
      date_from: form.date_from,
      date_to: form.date_to || form.date_from,
      time_restriction: form.time_restriction,
      specific_time_notes: form.specific_time_notes,
      reason: form.reason,
      season: form.season,
      status: "pending",
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
          <h2 className="text-2xl font-bold text-white mb-2">Request Received</h2>
          <p className="text-gray-400 mb-4">Your blackout date request has been submitted for review. The league will approve or reject it and reach out if needed. Approved blackouts will be respected when generating the schedule.</p>
          <button onClick={() => { setSubmitted(false); setForm({ team_name: "", division_name: "", contact_name: "", contact_email: "", contact_phone: "", date_from: "", date_to: "", time_restriction: "none", specific_time_notes: "", reason: "", season: "2025-2026" }); }}
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
          <div className="w-14 h-14 bg-yellow-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <CalendarX className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Blackout Date Request</h1>
          <p className="text-gray-400 mt-1 text-sm">Submit dates when your team is unable to play. Requests are reviewed by the league office before being applied to the schedule.</p>
        </div>

        <div className="bg-[#1e2533] rounded-2xl border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm font-semibold text-white mb-1">Team Information</div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Team Name *</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.team_name} onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))} placeholder="Your team name" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Division</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.division_name} onChange={e => setForm(f => ({ ...f, division_name: e.target.value }))} placeholder="e.g. Division A" />
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <div className="text-sm font-semibold text-white mb-3">Blackout Dates</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">From Date *</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">To Date (leave blank for single day)</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))} />
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs text-gray-400 block mb-1">Time Restriction</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={form.time_restriction} onChange={e => setForm(f => ({ ...f, time_restriction: e.target.value }))}>
                  <option value="none">No restriction — entire day(s) blacked out</option>
                  <option value="no_late_games">No late games (10:30pm or later)</option>
                  <option value="specific_times">Specific time restrictions (describe below)</option>
                </select>
              </div>

              {form.time_restriction === "specific_times" && (
                <div className="mt-3">
                  <label className="text-xs text-gray-400 block mb-1">Describe Time Restrictions</label>
                  <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={form.specific_time_notes} onChange={e => setForm(f => ({ ...f, specific_time_notes: e.target.value }))}
                    placeholder="e.g. Cannot play before 6:00pm" />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Reason</label>
              <textarea className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500 h-20 resize-none"
                value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Tournament, school break, holiday event, etc." />
            </div>

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

            {error && <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}

            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors">
              {submitting ? "Submitting..." : "Submit Blackout Request"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">Your request will be reviewed by the league office. Status updates will be communicated to the email provided.</p>
      </div>
    </div>
  );
}