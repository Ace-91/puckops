import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Clock, MapPin, X, Moon, Upload, Download, CheckSquare, Square, RefreshCw, Filter } from "lucide-react";
import ProgressModal from "@/components/ProgressModal";

function addOneHour(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function ImportProgress({ total, current, done }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{done ? "Import complete!" : `Importing ${current} of ${total}...`}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#c0c0c0,#d4af37)" }} />
      </div>
    </div>
  );
}

const isLate = (time) => {
  if (!time) return false;
  const [h] = time.split(":").map(Number);
  return h >= 22;
};

export default function IceSlots() {
  const [arenas, setArenas] = useState([]);
  const [slots, setSlots] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArenaForm, setShowArenaForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [filterArena, setFilterArena] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // all | available | used

  const [arenaForm, setArenaForm] = useState({ name: "", address: "" });
  const [slotForm, setSlotForm] = useState({ arena_id: "", date: "", start_time: "", season: "2025-2026" });

  const [bulkMode, setBulkMode] = useState(false);
  const [bulkForm, setBulkForm] = useState({ arena_id: "", start_date: "", end_date: "", days_of_week: [], start_time: "", season: "2025-2026" });

  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0, done: false });
  const [csvResult, setCsvResult] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());

  // Progress modal state
  const [progress, setProgress] = useState(null); // { title, current, total }

  useEffect(() => { loadAll(); }, []);

  const downloadSlotsTemplate = () => {
    const csv = "arena_name,date,start_time,season\nArena 1,2025-10-01,19:00,2025-2026\nArena 1,2025-10-03,22:00,2025-2026";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "iceslots_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = async () => {
    if (!csvFile) return;
    setCsvImporting(true);
    setCsvResult(null);
    const text = await csvFile.text();
    const lines = text.trim().split("\n").filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const dataLines = lines.slice(1);
    let created = 0, skipped = 0;
    const slotsToCreate = [];

    setCsvProgress({ current: 0, total: dataLines.length, done: false });

    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(",").map(c => c.trim());
      const row = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] || ""; });
      if (!row.date || !row.start_time) { skipped++; continue; }
      const arena = arenas.find(a => a.name.toLowerCase() === row.arena_name?.toLowerCase());
      const startTime = row.start_time;
      slotsToCreate.push({
        arena_id: arena?.id || "",
        arena_name: arena?.name || row.arena_name || "",
        date: row.date,
        start_time: startTime,
        end_time: addOneHour(startTime),
        season: row.season || "2025-2026",
        is_late_game: isLate(startTime),
        is_available: true,
      });
      created++;
      setCsvProgress({ current: i + 1, total: dataLines.length, done: false });
    }

    const CHUNK = 50;
    for (let i = 0; i < slotsToCreate.length; i += CHUNK) {
      await base44.entities.IceSlot.bulkCreate(slotsToCreate.slice(i, i + CHUNK));
      setCsvProgress({ current: Math.min(i + CHUNK, slotsToCreate.length), total: slotsToCreate.length, done: i + CHUNK >= slotsToCreate.length });
    }
    if (slotsToCreate.length === 0) setCsvProgress({ current: 0, total: 0, done: true });

    setCsvResult({ created, skipped });
    setCsvImporting(false);
    loadAll();
  };

  const loadAll = async () => {
    setLoading(true);
    const [a, s, g] = await Promise.all([
      base44.entities.Arena.list(),
      base44.entities.IceSlot.list("date", 2000),
      base44.entities.Game.filter({ status: "scheduled" }),
    ]);
    setArenas(a);
    setSlots(s);
    setGames(g);
    setSelectedIds(new Set());
    setLoading(false);
  };

  const saveArena = async () => {
    await base44.entities.Arena.create(arenaForm);
    setShowArenaForm(false);
    setArenaForm({ name: "", address: "" });
    loadAll();
  };

  const deleteArena = async (id) => {
    if (!confirm("Delete this arena? This will not delete associated ice slots.")) return;
    await base44.entities.Arena.delete(id);
    loadAll();
  };

  const saveSlot = async () => {
    await base44.entities.IceSlot.create({
      ...slotForm,
      end_time: addOneHour(slotForm.start_time),
      arena_name: arenas.find(a => a.id === slotForm.arena_id)?.name,
      is_late_game: isLate(slotForm.start_time),
      is_available: true,
    });
    setShowSlotForm(false);
    setSlotForm({ arena_id: "", date: "", start_time: "", season: "2025-2026" });
    loadAll();
  };

  const saveBulk = async () => {
    const arena = arenas.find(a => a.id === bulkForm.arena_id);
    const slotsToCreate = [];
    const start = new Date(bulkForm.start_date + "T12:00:00");
    const end = new Date(bulkForm.end_date + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (bulkForm.days_of_week.includes(String(d.getDay()))) {
        slotsToCreate.push({
          arena_id: bulkForm.arena_id,
          arena_name: arena?.name,
          date: d.toISOString().split("T")[0],
          start_time: bulkForm.start_time,
          end_time: addOneHour(bulkForm.start_time),
          season: bulkForm.season,
          is_late_game: isLate(bulkForm.start_time),
          is_available: true,
        });
      }
    }
    if (slotsToCreate.length === 0) { alert("No slots to create with those settings."); return; }

    setBulkMode(false);
    setProgress({ title: "Creating Ice Slots", current: 0, total: slotsToCreate.length });
    const CHUNK = 50;
    for (let i = 0; i < slotsToCreate.length; i += CHUNK) {
      await base44.entities.IceSlot.bulkCreate(slotsToCreate.slice(i, i + CHUNK));
      setProgress(p => ({ ...p, current: Math.min(i + CHUNK, slotsToCreate.length) }));
    }
    setProgress(null);
    loadAll();
  };

  // Delete a single slot
  const deleteSlot = async (id) => {
    await base44.entities.IceSlot.delete(id);
    setSlots(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  };

  // Delete selected slots with progress modal
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} selected slot(s)? This cannot be undone.`)) return;
    const ids = [...selectedIds];
    setProgress({ title: "Deleting Ice Slots", current: 0, total: ids.length });
    const CHUNK = 10;
    for (let i = 0; i < ids.length; i += CHUNK) {
      await Promise.all(ids.slice(i, i + CHUNK).map(id => base44.entities.IceSlot.delete(id)));
      if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 150));
      setProgress(p => ({ ...p, current: Math.min(i + CHUNK, ids.length) }));
    }
    setProgress(null);
    await loadAll();
  };

  // Unassign selected slots — mark available, clear game link if found
  const unassignSelected = async () => {
    const usedSelected = [...selectedIds].filter(id => {
      const slot = slots.find(s => s.id === id);
      return slot && !slot.is_available;
    });
    if (usedSelected.length === 0) { alert("No used (assigned) slots selected."); return; }
    if (!confirm(`Mark ${usedSelected.length} slot(s) as available again? Any linked games will have their ice slot reference cleared.`)) return;

    setProgress({ title: "Unassigning Ice Slots", current: 0, total: usedSelected.length });
    const CHUNK = 10;

    for (let i = 0; i < usedSelected.length; i++) {
      const slotId = usedSelected[i];
      const slot = slots.find(s => s.id === slotId);
      // Find games linked by ice_slot_id OR by matching arena+date+time
      const linkedGames = games.filter(g =>
        g.ice_slot_id === slotId ||
        (slot && g.arena_id === slot.arena_id && g.date === slot.date && g.start_time === slot.start_time)
      );
      for (const g of linkedGames) {
        await base44.entities.Game.update(g.id, { ice_slot_id: "" });
      }
      await base44.entities.IceSlot.update(slotId, { is_available: true });
      setProgress(p => ({ ...p, current: i + 1 }));
      if ((i + 1) % CHUNK === 0 && i + 1 < usedSelected.length) await new Promise(r => setTimeout(r, 150));
    }
    setProgress(null);
    await loadAll();
  };

  const filteredSlots = slots.filter(s =>
    (filterArena === "all" || s.arena_id === filterArena) &&
    (!filterDate || s.date === filterDate) &&
    (filterStatus === "all" || (filterStatus === "available" ? s.is_available : !s.is_available))
  );

  const toggleSelect = (id) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => {
    if (selectedIds.size === filteredSlots.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSlots.map(s => s.id)));
  };

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const usedCount = slots.filter(s => !s.is_available).length;
  const availableCount = slots.filter(s => s.is_available).length;

  return (
    <div>
      {progress && <ProgressModal title={progress.title} current={progress.current} total={progress.total} />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Ice Slots & Arenas</h1>
          <p className="text-gray-400 text-sm mt-1">
            {arenas.length} arenas · {availableCount} available · {usedCount} used
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setShowCsvImport(true); setCsvResult(null); setCsvFile(null); setCsvProgress({ current: 0, total: 0, done: false }); }}
            className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowArenaForm(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#d4af37" }}>
            <Plus className="w-4 h-4" /> Arena
          </button>
          <button onClick={() => setBulkMode(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Plus className="w-4 h-4" /> Bulk Slots
          </button>
          <button onClick={() => setShowSlotForm(true)} className="flex items-center gap-2 text-black px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "#c0c0c0" }}>
            <Plus className="w-4 h-4" /> Single Slot
          </button>
        </div>
      </div>

      {/* Arenas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {arenas.map(a => (
          <div key={a.id} className="rounded-lg p-3 border border-gray-800 flex items-center justify-between" style={{ background: "#111" }}>
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5" style={{ color: "#d4af37" }} /> {a.name}</div>
              {a.address && <div className="text-xs text-gray-500 mt-0.5">{a.address}</div>}
              <div className="text-xs text-gray-400 mt-1">{slots.filter(s => s.arena_id === a.id).length} slots</div>
            </div>
            <button onClick={() => deleteArena(a.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Filters + bulk actions */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <select className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterArena} onChange={e => setFilterArena(e.target.value)}>
          <option value="all">All Arenas</option>
          {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        <select className="bg-[#111] border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="used">Used</option>
        </select>
        {filterDate && <button onClick={() => setFilterDate("")} className="text-gray-500 hover:text-white text-sm px-2">Clear date</button>}

        {selectedIds.size > 0 && (
          <div className="ml-auto flex gap-2">
            <button onClick={unassignSelected}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: "#d4af37", color: "#d4af37" }}>
              <RefreshCw className="w-4 h-4" /> Unassign {selectedIds.size}
            </button>
            <button onClick={deleteSelected}
              className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete {selectedIds.size}
            </button>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 mb-2">Showing {Math.min(filteredSlots.length, 200)} of {filteredSlots.length} slots</div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="rounded-lg h-12 animate-pulse" style={{ background: "#111" }} />)}</div>
      ) : (
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "#0d0d0d" }}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800" style={{ background: "#111" }}>
                <th className="px-4 py-3 w-10">
                  <button onClick={selectAll} className="text-gray-500 hover:text-white">
                    {selectedIds.size === filteredSlots.length && filteredSlots.length > 0
                      ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} />
                      : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Arena</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900">
              {filteredSlots.slice(0, 200).map(slot => (
                <tr key={slot.id} className={`transition-colors ${selectedIds.has(slot.id) ? "bg-yellow-500/5" : "hover:bg-white/2"}`}>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggleSelect(slot.id)} className="text-gray-600 hover:text-yellow-400">
                      {selectedIds.has(slot.id) ? <CheckSquare className="w-4 h-4" style={{ color: "#d4af37" }} /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-white">{slot.date}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-300">{slot.arena_name}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-300">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-600" />{slot.start_time} – {slot.end_time || addOneHour(slot.start_time)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {slot.is_late_game && <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full w-fit"><Moon className="w-3 h-3" />Late</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${slot.is_available ? "border-green-500/20 text-green-400" : "border-gray-600 text-gray-500"}`}>
                      {slot.is_available ? "Available" : "Used"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right flex items-center justify-end gap-1">
                    {!slot.is_available && (
                      <button onClick={async () => {
                        const linkedGame = games.find(g => g.ice_slot_id === slot.id);
                        if (linkedGame) await base44.entities.Game.update(linkedGame.id, { ice_slot_id: "" });
                        await base44.entities.IceSlot.update(slot.id, { is_available: true });
                        setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, is_available: true } : s));
                      }} className="p-1 text-gray-600 hover:text-yellow-400" title="Mark as available">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => deleteSlot(slot.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredSlots.length === 0 && <p className="text-center py-8 text-gray-600">No slots found.</p>}
          {filteredSlots.length > 200 && <p className="text-center py-3 text-gray-600 text-xs">Showing 200 of {filteredSlots.length} slots. Use filters to narrow results.</p>}
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvImport && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-lg" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Import Ice Slots from CSV</h2>
              <button onClick={() => setShowCsvImport(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="rounded-lg p-3 mb-4 text-xs border" style={{ background: "#1a1a00", borderColor: "#d4af3730", color: "#d4af37" }}>
              Columns: <strong>arena_name, date (YYYY-MM-DD), start_time (HH:MM), season</strong><br />
              End time is auto-calculated as start + 60 minutes. Arenas must exist in the system.
            </div>
            <button onClick={downloadSlotsTemplate} className="flex items-center gap-2 text-sm mb-4 underline" style={{ color: "#c0c0c0" }}>
              <Download className="w-4 h-4" /> Download template CSV
            </button>
            <div>
              <label className="text-sm text-gray-400 block mb-1">CSV File *</label>
              <input type="file" accept=".csv" className="w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-black file:text-sm file:cursor-pointer cursor-pointer"
                style={{ '--file-bg': '#c0c0c0' }}
                onChange={e => setCsvFile(e.target.files[0])} />
            </div>
            {csvImporting && <ImportProgress total={csvProgress.total} current={csvProgress.current} done={csvProgress.done} />}
            {csvResult && !csvImporting && (
              <div className="mt-3 rounded-lg p-3 text-sm border border-green-500/20 text-green-400" style={{ background: "#001a00" }}>
                ✓ {csvResult.created} slots imported{csvResult.skipped > 0 ? `, ${csvResult.skipped} skipped` : ""}.
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCsvImport(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Close</button>
              <button onClick={handleCsvImport} disabled={!csvFile || csvImporting}
                className="flex-1 py-2 rounded-lg text-sm font-medium text-black disabled:opacity-50" style={{ background: "#c0c0c0" }}>
                {csvImporting ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Arena Modal */}
      {showArenaForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-sm" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Arena</h2>
              <button onClick={() => setShowArenaForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena Name *</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={arenaForm.name} onChange={e => setArenaForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Address</label>
                <input className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-500"
                  value={arenaForm.address} onChange={e => setArenaForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowArenaForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveArena} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#d4af37" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Slot Modal */}
      {showSlotForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-sm" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add Ice Slot</h2>
              <button onClick={() => setShowSlotForm(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.arena_id} onChange={e => setSlotForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Date *</label>
                <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.date} onChange={e => setSlotForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Start Time</label>
                <input type="time" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
                  value={slotForm.start_time} onChange={e => setSlotForm(f => ({ ...f, start_time: e.target.value }))} />
                {slotForm.start_time && <p className="text-xs text-gray-600 mt-1">End time: {addOneHour(slotForm.start_time)}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowSlotForm(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveSlot} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Slot Modal */}
      {bulkMode && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rounded-xl border border-gray-800 p-6 w-full max-w-md" style={{ background: "#111" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Bulk Add Ice Slots</h2>
              <button onClick={() => setBulkMode(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Arena *</label>
                <select className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                  value={bulkForm.arena_id} onChange={e => setBulkForm(f => ({ ...f, arena_id: e.target.value }))}>
                  <option value="">Select arena...</option>
                  {arenas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Start Date</label>
                  <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                    value={bulkForm.start_date} onChange={e => setBulkForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">End Date</label>
                  <input type="date" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                    value={bulkForm.end_date} onChange={e => setBulkForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Days of Week</label>
                <div className="flex gap-2 flex-wrap">
                  {dayNames.map((day, i) => (
                    <button key={i} type="button"
                      onClick={() => setBulkForm(f => ({ ...f, days_of_week: f.days_of_week.includes(String(i)) ? f.days_of_week.filter(d => d !== String(i)) : [...f.days_of_week, String(i)] }))}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-black"
                      style={{ background: bulkForm.days_of_week.includes(String(i)) ? "#d4af37" : "#333", color: bulkForm.days_of_week.includes(String(i)) ? "#000" : "#999" }}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Start Time</label>
                <input type="time" className="w-full bg-black border border-gray-800 rounded-lg px-3 py-2 text-white text-sm"
                  value={bulkForm.start_time} onChange={e => setBulkForm(f => ({ ...f, start_time: e.target.value }))} />
                {bulkForm.start_time && <p className="text-xs text-gray-600 mt-1">End time auto-set to {addOneHour(bulkForm.start_time)}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setBulkMode(false)} className="flex-1 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm">Cancel</button>
              <button onClick={saveBulk} className="flex-1 py-2 rounded-lg text-sm font-medium text-black" style={{ background: "#c0c0c0" }}>Create Slots</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}