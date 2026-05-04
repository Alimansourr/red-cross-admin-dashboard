import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle, Sparkles } from "lucide-react";
import { PRIORITIES } from "../services/triageService";

const STYLES = {
  CRITICAL: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-400",
    pulse: true,
    icon: AlertOctagon,
  },
  HIGH: {
    bg: "bg-orange-100",
    text: "text-orange-800",
    border: "border-orange-400",
    icon: AlertTriangle,
  },
  MEDIUM: {
    bg: "bg-yellow-100",
    text: "text-yellow-800",
    border: "border-yellow-400",
    icon: AlertCircle,
  },
  LOW: {
    bg: "bg-green-100",
    text: "text-green-800",
    border: "border-green-400",
    icon: CheckCircle,
  },
};

export default function PriorityBadge({ priority, size = "md", showIcon = true }) {
  if (!priority || !PRIORITIES[priority]) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-500 border border-gray-200">
        <Sparkles size={10} />
        Not analyzed
      </span>
    );
  }

  const style = STYLES[priority];
  const Icon = style.icon;

  const sizeClasses =
    size === "lg"
      ? "px-3 py-1 text-sm"
      : size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold border ${style.bg} ${style.text} ${style.border} ${sizeClasses} ${
        style.pulse ? "animate-pulse" : ""
      }`}
      title={`AI Priority: ${priority}`}
    >
      {showIcon && <Icon size={size === "lg" ? 14 : size === "sm" ? 10 : 12} />}
      {priority}
    </span>
  );
}