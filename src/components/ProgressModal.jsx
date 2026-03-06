export default function ProgressModal({ title, current, total, onCancel }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const done = current >= total && total > 0;

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4">
      <div className="rounded-2xl border p-8 w-full max-w-sm text-center" style={{ background: "#111", borderColor: "#2a2a2a" }}>
        <div className="text-4xl mb-4">{done ? "✅" : "⏳"}</div>
        <h2 className="text-lg font-semibold text-white mb-1">{title}</h2>
        <p className="text-sm text-gray-400 mb-5">
          {done ? "Complete!" : `${current} of ${total}`}
        </p>
        <div className="w-full rounded-full h-3 mb-3" style={{ background: "#222" }}>
          <div
            className="h-3 rounded-full transition-all duration-200"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #c0c0c0, #d4af37)" }}
          />
        </div>
        <div className="text-2xl font-bold text-white mb-4">{pct}%</div>
        <div className="text-xs text-gray-500 mb-4">
          {done ? "All done!" : `Processing ${current} of ${total}...`}
        </div>
        {!done && onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-400 text-sm hover:text-white hover:border-gray-500 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}