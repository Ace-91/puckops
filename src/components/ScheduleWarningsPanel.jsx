import { AlertCircle, AlertTriangle, Info, Zap, Moon, TrendingDown, TrendingUp, Calendar } from "lucide-react";

const iconMap = {
  slot_shortage: AlertCircle,
  short_games: TrendingDown,
  gap_violation: Calendar,
  late_low: Moon,
  late_high: Moon,
  overflow: TrendingUp,
};

const severityConfig = {
  critical: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    headerColor: "text-red-400",
    itemBorder: "border-red-500/20",
    itemBg: "bg-red-500/5",
    msgColor: "text-red-300",
    fixColor: "text-red-400/70",
    icon: AlertCircle,
    label: "Critical Issue",
  },
  warning: {
    border: "border-yellow-500/20",
    bg: "",
    bgStyle: { background: "rgba(212,175,55,0.05)" },
    headerColor: "text-yellow-400",
    itemBorder: "border-yellow-500/10",
    itemBg: "bg-yellow-500/5",
    msgColor: "text-yellow-300",
    fixColor: "text-yellow-500/80",
    icon: AlertTriangle,
    label: "Warning",
  },
  info: {
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    headerColor: "text-blue-400",
    itemBorder: "border-blue-500/10",
    itemBg: "bg-blue-500/5",
    msgColor: "text-blue-300",
    fixColor: "text-blue-400/60",
    icon: Info,
    label: "Info",
  },
};

function WarningGroup({ severity, items }) {
  const cfg = severityConfig[severity];
  const Icon = cfg.icon;
  const plural = items.length > 1;

  return (
    <div
      className={`rounded-xl p-4 border ${cfg.border} ${cfg.bg}`}
      style={cfg.bgStyle || {}}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${cfg.headerColor}`} />
        <span className={`${cfg.headerColor} font-semibold text-sm`}>
          {items.length} {cfg.label}{plural ? "s" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((w, i) => {
          const WIcon = iconMap[w.type] || AlertTriangle;
          return (
            <div key={i} className={`rounded-lg p-3 border ${cfg.itemBorder} ${cfg.itemBg}`}>
              <div className="flex items-start gap-2">
                <WIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cfg.msgColor}`} />
                <div className="flex-1 min-w-0">
                  <p className={`${cfg.msgColor} text-sm`}>{w.message}</p>
                  {w.fix && (
                    <p className={`${cfg.fixColor} text-xs mt-1.5 flex items-start gap-1`}>
                      <Zap className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{w.fix}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScheduleWarningsPanel({ warnings }) {
  if (!warnings || warnings.length === 0) return null;

  const critical = warnings.filter(w => w.severity === "critical");
  const warns = warnings.filter(w => w.severity === "warning");
  const info = warnings.filter(w => w.severity === "info");

  return (
    <div className="space-y-3">
      {critical.length > 0 && <WarningGroup severity="critical" items={critical} />}
      {warns.length > 0 && <WarningGroup severity="warning" items={warns} />}
      {info.length > 0 && <WarningGroup severity="info" items={info} />}
    </div>
  );
}