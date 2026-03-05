import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Clock, MapPin, X, Moon } from "lucide-react";

export default function IceSlots() {
  const [arenas, setArenas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArenaForm, setShowArenaForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [filterArena, setFilterArena] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const [arenaForm, setArenaForm] = useState({ name: "", address: "" });
  const [slotForm, setSlotForm] = useState({ arena_id: "", date: "", start_time: "", end_time: "", season: "2025-2026" });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkForm, setBulkForm] = useState({ arena_id: "", start_date: "", end_date: "", days_of_week: [], start_time: "", end_time: "", season: "2025-2026" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [a, s] = await Promise.all([base44.entities.Arena.list(), base44.entities.IceSlot.list("-date", 500)]);
    setArenas(a);
    setSlots(s);
    setLoading(false);
  };

  const saveArena = async () => {
    await base44.entities.Arena.create(arenaForm);
    setShowArenaForm(false);
    setArenaForm({ name: "", address: "" });
    loadAll();
  };

  const deleteArena = async (id) => {
    if (!confirm("Delete this arena?")) return;
    await base44.entities.Arena.delete(id);
    loadAll();
  };

  const isLate = (time) => {
    if (!time) return false;
    const [h, m] = time.split(":").map(Number);
    return h > 22 || (h === 22 && m >= 30);
  };

  const saveSlot = async () => {
    await base44.entities.IceSlot.create({
      ...slotForm,
      arena_name: arenas.find(a => a.id === slotForm.arena_id)?.name,
      is_late_game: isLate(slotForm.start_time),
    });
    setShowSlotForm(false);
    setSlotForm({ arena_id: "", date: "", start_time: "", end_time: "", season: "2025-2026" });
    loadAll();
  };

  const saveBulk = async () => {
    const arena = arenas.find(a => a.id === bulkForm.arena_id);
    const slotsToCreate = [];
    const start = new Date(bulkForm.start_date);
    const end = new Date(bulkForm.end_date);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (bulkForm.days_of_week.includes(String(d.getDay()))) {
        slotsToCreate.push({
          arena_id: bulkForm.arena_id,
          arena_name: arena?.name,
          date: d.toISOString().split("T")[0],
          start_time: bulkForm.start_time,
          end_time: bulkForm.end_time,
          season: bulkForm.season,
          is_late_game: isLate(bulkForm.start_time),
          is_available: true,
        });
      }
    }
    if (slotsToCreate.length === 0) { alert("No slots to create with those settings."); return; }
    await base44.entities.IceSlot.bulkCreate(slotsToCreate);
    setBulkMode(false);
    loadAll();
  };

  const deleteSlot = async (id) => {
    await base44.entities.IceSlot.delete(id);
    loadAll();
  };

  const filteredSlots = slots.filter(s =>
    (filterArena === "all" || s.arena_id === filterArena) &&
    (!filterDate || s.date === filterDate)
  );

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ice Slots & Arenas</h1>
          <p className="text-gray-400 text-sm mt-1">{arenas.length} arenas · {slots.length} total slots</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowArenaForm(true)} className="flex items-center gap-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Arena
          </button>
          <button onClick={() => setBulkMode(true)} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Bulk Slots
          </button>
          <button onClick={() => setShowSlotForm(true)} className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Single Slot
          </button>
        </div>
      </div>

      {/* Arenas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {arenas.map(a => (
          <div key={a.id} className="bg-[#1e2533] rounded-lg p-3 border border-gray-700 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-sky-400" /> {a.name}</div>
              {a.address && <div className="text-xs text-gray-500 mt-0.5">{a.address}</div>}
              <div className="text-xs text-gray-400 mt-1">{slots.filter(s => s.arena_id === a.id).length} slots</div>
            </div>
            <button onClick={() => deleteArena(a.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterArena} onChange={e => setFilterArena(e.target.value)}>
          <option value="all">All Arenas</option>
          {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" className="bg-[#1e2533] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        {filterDate && <button onClick={() => setFilterDate("")} className="text-gray-400 hover:text-white text-sm px-2">Clear</button>}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="bg-[#1e2533] rounded-lg h-12 animate-pulse" />)}</div>
      ) : (
        <div className="bg-[#1e2533] rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Arena</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredSlots.slice(0, 100).map(slot => (
                <tr key={slot.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{slot.date}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{slot.arena_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-500" />{slot.start_time} – {slot.end_time}</td>
                  <td className="px-4 py-3">
                    {slot.is_late_game && <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full w-fit"><Moon className="w-3 h-3" />Late Game</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${slot.is_available ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {slot.is_available ? "Available" : "Used"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteSlot(slot.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSlots.length === 0 && <p className="text-center py-8 text-gray-500">No slots found.</p>}
        </div>
      )}

      {/* Arena Modal */}
      {showArenaForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Arena</h2>
              <button onClick={() => setShowArenaForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena Name *</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={arenaForm.name} onChange={e => setArenaForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Address</label>
                <input className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={arenaForm.address} onChange={e => setArenaForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowArenaForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={saveArena} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Slot Modal */}
      {showSlotForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Ice Slot</h2>
              <button onClick={() => setShowSlotForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={slotForm.arena_id} onChange={e => setSlotForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Date *</label>
                <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Time</label>
                  <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Time</label>
                  <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={slotForm.end_time} onChange={e => setSlotForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSlotForm(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={saveSlot} className="flex-1 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg text-white text-sm font-medium">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Slot Modal */}
      {bulkMode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e2533] rounded-xl border border-gray-700 p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bulk Add Ice Slots</h2>
              <button onClick={() => setBulkMode(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                  value={bulkForm.arena_id} onChange={e => setBulkForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Date</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={bulkForm.start_date} onChange={e => setBulkForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Date</label>
                  <input type="date" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={bulkForm.end_date} onChange={e => setBulkForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {dayNames.map((day, i) => (
                    <button key={i} type="button"
                      onClick={() => setBulkForm(f => ({ ...f, days_of_week: f.days_of_week.includes(String(i)) ? f.days_of_week.filter(d => d !== String(i)) : [...f.days_of_week, String(i)] }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${bulkForm.days_of_week.includes(String(i)) ? "bg-sky-500 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Time</label>
                  <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={bulkForm.start_time} onChange={e => setBulkForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Time</label>
                  <input type="time" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-500"
                    value={bulkForm.end_time} onChange={e => setBulkForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBulkMode(false)} className="flex-1 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancel</button>
              <button onClick={saveBulk} className="flex-1 py-2 bg-green-500 hover:bg-green-600 rounded-lg text-white text-sm font-medium">Create Slots</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}