import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, RefreshCw } from "lucide-react";

export default function IceSlotCalculator({ slots, divisions = [], teams = [] }) {
  const availableCount = slots.filter(s => s.is_available).length;

  const [rows, setRows] = useState([
    { id: 1, label: "Division 1", teams: 8, games: 30 },
  ]);

  // Auto-populate from real divisions when they load
  useEffect(() => {
    if (divisions.length > 0) {
      const autoRows = divisions.map((d, i) => ({
        id: d.id || i + 1,
        label: d.name,
        teams: teams.filter(t => t.division_id === d.id).length || 0,
        games: d.games_per_team || 30,
      }));
      setRows(autoRows);
    }
  }, [divisions, teams]);

  const addRow = () => setRows(prev => [...prev, { id: Date.now(), label: `Division ${prev.length + 1}`, teams: 8, games: 30 }]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const updateRow = (id, field, value) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const resetFromDivisions = () => {
    if (divisions.length > 0) {
      setRows(divisions.map((d, i) => ({
        id: d.id || i + 1,
        label: d.name,
        teams: teams.filter(t => t.division_id === d.id).length || 0,
        games: d.games_per_team || 30,
      })));
    }
  };

  const totalNeeded = rows.reduce((sum, r) => sum + Math.ceil((r.teams * r.games) / 2), 0);
  const diff = availableCount - totalNeeded;

  const inputCls = "bg-black border border-gray-800 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-yellow-500 w-full";

  return (
    <div className="rounded-xl border border-gray-800 p-4 mb-6" style={{ background: "#111" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "#d4af37" }} /> Ice Slot Calculator
        </h2>
        <div className="flex gap-2">
          {divisions.length > 0 && (
            <button onClick={resetFromDivisions} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium text-gray-400 border border-gray-700 hover:text-white">
              <RefreshCw className="w-3 h-3" /> Sync from League
            </button>
          )}
          <button onClick={addRow} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium text-black" style={{ background: "#c0c0c0" }}>
            <Plus className="w-3 h-3" /> Add Row
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-1.5 pr-3 text-xs text-gray-500 font-medium">Division</th>
              <th className="text-center py-1.5 px-2 text-xs text-gray-500 font-medium">Teams</th>
              <th className="text-center py-1.5 px-2 text-xs text-gray-500 font-medium">Games/Team</th>
              <th className="text-center py-1.5 px-2 text-xs text-gray-500 font-medium">Slots Needed</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {rows.map(row => {
              const needed = Math.ceil((row.teams * row.games) / 2);
              return (
                <tr key={row.id}>
                  <td className="py-1.5 pr-3">
                    <input className={inputCls} value={row.label} onChange={e => updateRow(row.id, "label", e.target.value)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min={2} max={30} className={inputCls + " text-center"} value={row.teams} onChange={e => updateRow(row.id, "teams", Number(e.target.value) || 2)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min={1} max={60} className={inputCls + " text-center"} value={row.games} onChange={e => updateRow(row.id, "games", Number(e.target.value) || 1)} />
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold text-lg" style={{ color: "#d4af37" }}>{needed}</td>
                  <td className="py-1.5 pl-2">
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(row.id)} className="text-gray-700 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-700">
              <td className="pt-2 pr-3 text-sm font-semibold text-white">Totals</td>
              <td className="pt-2 px-2 text-center font-bold text-sm text-white">{rows.reduce((s, r) => s + (Number(r.teams) || 0), 0)}</td>
              <td className="pt-2 px-2 text-center font-bold text-sm text-white">{rows.reduce((s, r) => s + (Number(r.games) || 0), 0)}</td>
              <td className="pt-2 px-2 text-center font-bold text-lg" style={{ color: "#d4af37" }}>{totalNeeded}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-800">
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: "#d4af37" }}>{totalNeeded}</div>
          <div className="text-xs text-gray-400">Slots needed</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold" style={{ color: "#c0c0c0" }}>{availableCount}</div>
          <div className="text-xs text-gray-400">Available now</div>
        </div>
        <div className="text-center">
          <div className={`text-xl font-bold ${diff >= 0 ? "text-green-400" : "text-red-400"}`}>
            {diff >= 0 ? "+" : ""}{diff}
          </div>
          <div className="text-xs text-gray-400">{diff >= 0 ? "Surplus" : "Shortage"}</div>
        </div>
      </div>
      <p className="text-xs text-gray-700 mt-2">Formula: (teams × games/team) ÷ 2 per division</p>
    </div>
  );
}